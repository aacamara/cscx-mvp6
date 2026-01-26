import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';

import { agentRoutes } from './routes/agents.js';
import { contractRoutes } from './routes/contracts.js';
import { customerRoutes } from './routes/customers.js';
import { meetingRoutes } from './routes/meetings.js';
import { langchainRoutes } from './routes/langchain.js';
import { featureFlagRoutes } from './routes/featureFlags.js';
import googleRoutes from './routes/google/index.js';
import approvalRoutes from './routes/approvals.js';
import workspaceRoutes from './routes/workspace.js';
import workflowRoutes from './routes/workflows.js';
import onboardingRoutes from './routes/onboarding.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { glossaryRoutes } from './routes/glossary.js';
import { playbooksRoutes } from './routes/playbooks.js';
import { metricsRoutes } from './routes/metrics.js';
import agentActivitiesRoutes from './routes/agentActivities.js';
import otterRoutes from './routes/otter.js';
import agentAnalysisRoutes from './routes/agentAnalysis.js';
import usageIngestRoutes from './routes/usage-ingest.js';
import integrationsRoutes from './routes/integrations.js';
import chatRoutes from './routes/chat.js';
import workspaceAgentRoutes from './routes/workspace-agent.js';
import aiAnalysisRoutes from './routes/ai-analysis.js';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { metricsMiddleware, getMetrics, getPrometheusMetrics } from './middleware/metrics.js';
import { WebSocketHandler } from './services/websocket.js';
import { healthService } from './services/health.js';
import { getAllCircuitBreakerStats } from './services/circuitBreaker.js';
import { agentTracer } from './services/agentTracer.js';
import { seedKnowledgeBase } from './data/seed-knowledge.js';

dotenv.config();

const app = express();
const server = createServer(app);

// WebSocket server for real-time agent updates
const wss = new WebSocketServer({ server, path: '/ws' });
const wsHandler = new WebSocketHandler(wss);

// Wire up agent tracer events to WebSocket for real-time observability
agentTracer.on('run:start', (event) => {
  if (event.userId) {
    wsHandler.broadcastTraceEvent(event.userId, {
      type: 'run:start',
      runId: event.runId,
      data: {
        agentId: event.agentId,
        agentName: event.agentName,
        agentType: event.agentType,
        input: event.input,
        customerContext: event.customerContext
      }
    });
  }
});

agentTracer.on('run:end', (event) => {
  if (event.userId) {
    wsHandler.broadcastTraceEvent(event.userId, {
      type: 'run:end',
      runId: event.runId,
      data: {
        status: event.status,
        output: event.output,
        error: event.error,
        duration: event.duration
      }
    });
  }
});

agentTracer.on('step', (event) => {
  if (event.userId) {
    wsHandler.broadcastAgentStep(event.userId, {
      runId: event.runId,
      stepId: event.stepId,
      type: event.type,
      name: event.name,
      status: 'completed',
      input: event.input,
      output: event.output,
      duration: event.duration
    });
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://*.supabase.co"],
    }
  } : false
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Allow localhost on any port for development
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ];

    if (config.corsOrigin === '*' || allowedOrigins.includes(origin) || config.corsOrigin === origin) {
      callback(null, origin);
    } else {
      callback(null, config.corsOrigin);
    }
  },
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Request metrics collection
app.use(metricsMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } }
});
app.use('/api/', limiter);

// Health check endpoints
// Liveness probe - lightweight, always returns ok if process is running
app.get('/health/live', async (req, res) => {
  const status = await healthService.getLivenessStatus();
  res.json(status);
});

// Readiness probe - checks if app can serve traffic
app.get('/health/ready', async (req, res) => {
  const status = await healthService.getReadinessStatus();
  res.status(status.ready ? 200 : 503).json(status);
});

// Full health check - detailed service status with connectivity tests
app.get('/health', async (req, res) => {
  const skipCache = req.query.fresh === 'true';
  const health = await healthService.getFullHealth(skipCache);
  const statusCode = health.status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(health);
});

// Basic health check (backward compatibility)
app.get('/health/basic', (req, res) => {
  res.json(healthService.getBasicHealth());
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const format = req.query.format;
  if (format === 'prometheus') {
    res.set('Content-Type', 'text/plain');
    res.send(getPrometheusMetrics());
  } else {
    res.json(getMetrics());
  }
});

// Circuit breaker status
app.get('/health/circuits', (req, res) => {
  res.json(getAllCircuitBreakerStats());
});

// API Routes
app.use('/api/agents', agentRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/ai', langchainRoutes); // LangChain-powered AI agents
app.use('/api/flags', featureFlagRoutes); // Feature flags
app.use('/api/google', googleRoutes); // Google Workspace integration
app.use('/api/approvals', approvalRoutes); // HITL approval queue
app.use('/api/workspace', workspaceRoutes); // Interactive workspace actions
app.use('/api/workflows', workflowRoutes); // Agent workflow orchestration
app.use('/api/onboarding', onboardingRoutes); // Onboarding workspace creation
app.use('/api/dashboard', dashboardRoutes); // Dashboard and portfolio metrics
app.use('/api/glossary', glossaryRoutes); // CSM glossary terms
app.use('/api/playbooks', playbooksRoutes); // CSM playbooks
app.use('/api/metrics', metricsRoutes); // CS metrics, surveys, QBR generation
app.use('/api/agent-activities', agentActivitiesRoutes); // Agent inbox and activity log
app.use('/api/otter', otterRoutes); // Otter AI meeting transcripts
app.use('/api/agent-analysis', agentAnalysisRoutes); // AI-powered analysis with Apps Script
app.use('/api/v1/usage', usageIngestRoutes); // Usage data ingestion and metrics
app.use('/api/integrations', integrationsRoutes); // CRM integrations (Salesforce, HubSpot)
app.use('/api/chat', chatRoutes); // Chat message persistence
app.use('/api/workspace-agent', workspaceAgentRoutes); // Workspace agent quick actions
app.use('/api/ai-analysis', aiAnalysisRoutes); // Claude-powered sheet analysis (AppScript alternative)

// Error handler
app.use(errorHandler);

// Serve static frontend in production
if (config.nodeEnv === 'production') {
  const publicPath = path.join(process.cwd(), 'public');

  // Serve static files
  app.use(express.static(publicPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  const dbStatus = config.supabaseUrl ? '● Supabase' : '○ In-Memory';
  const aiStatus = config.geminiApiKey ? '● Gemini' : (config.anthropicApiKey ? '● Claude' : '○ None');
  const googleStatus = config.google?.clientId ? '● Configured' : '○ Not Set';

  console.log(`
╔═══════════════════════════════════════════╗
║           CSCX.AI API Server              ║
╠═══════════════════════════════════════════╣
║  HTTP:      http://localhost:${PORT}          ║
║  WebSocket: ws://localhost:${PORT}/ws         ║
║  Env:       ${config.nodeEnv.padEnd(27)}║
║  Database:  ${dbStatus.padEnd(27)}║
║  AI:        ${aiStatus.padEnd(27)}║
║  Google:    ${googleStatus.padEnd(27)}║
╚═══════════════════════════════════════════╝
  `);

  // Seed knowledge base with CS playbooks
  seedKnowledgeBase().catch(err => {
    console.error('Failed to seed knowledge base:', err);
  });
});

// Export for testing
export { app, server, wsHandler };
