import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';

import { authRoutes } from './routes/auth.js'; // PRD-1: Gated Login + Onboarding
import { agentRoutes } from './routes/agents.js';
import { contractRoutes } from './routes/contracts.js';
import { entitlementRoutes } from './routes/entitlements.js';
import { customerRoutes } from './routes/customers.js';
import { meetingRoutes } from './routes/meetings.js';
import { langchainRoutes } from './routes/langchain.js';
import zapierWebhookRoutes from './routes/webhooks/zapier.js'; // PRD-210: Zapier Webhook Integration
import { featureFlagRoutes } from './routes/featureFlags.js';
import googleRoutes from './routes/google/index.js';
import outlookRoutes from './routes/outlook/index.js'; // PRD-189: Outlook Calendar Integration
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
import linearRoutes from './routes/linear.js'; // PRD-202: Linear Issue Integration
import chatRoutes from './routes/chat.js';
import workspaceAgentRoutes from './routes/workspace-agent.js';
import aiAnalysisRoutes from './routes/ai-analysis.js';
import agenticModeRoutes from './routes/agentic-mode.js';
import agenticAgentsRoutes, { setWebSocketHandler } from './routes/agentic-agents.js';
import schedulesRoutes from './routes/schedules.js';
import skillsRoutes from './routes/skills.js';
import { tracesRoutes } from './routes/traces.js';
import { agentMetricsRoutes } from './routes/agent-metrics.js';
import { triggersRoutes } from './routes/triggers.js';
import mcpRoutes from './routes/mcp.js';
import slackRoutes from './routes/slack.js';
import zoomRoutes from './routes/zoom.js';
import calendlyRoutes from './routes/calendly.js'; // PRD-208: Calendly Scheduling
import meetingIntelligenceRoutes from './routes/meeting-intelligence.js';
import automationsRoutes from './routes/automations.js';
import intelligenceRoutes from './routes/intelligence.js';
import qbrEmailRoutes from './routes/qbr-email.js';
import integrationHealthRoutes from './routes/integration-health.js';
import { engagementMetricsRoutes } from './routes/engagement-metrics.js';
import expansionRoutes from './routes/expansion.js';
import sentimentRoutes from './routes/sentiment.js';
import revenueAnalyticsRoutes from './routes/revenue-analytics.js';
import healthScoreTrendsRoutes from './routes/health-score-trends.js';
import onboardingStallsRoutes from './routes/onboarding-stalls.js';
import { healthPortfolioRoutes } from './routes/health-portfolio.js';
import churnPostMortemRoutes from './routes/churnPostMortem.js';
import meetingPrepRoutes from './routes/meeting-prep.js';
import coverageRoutes from './routes/coverage.js';
import renewalForecastRoutes from './routes/renewal-forecast.js';
import escalationsRoutes from './routes/escalations.js';
import upsellSuccessRoutes from './routes/upsell-success.js'; // PRD-130
import accessibilityRoutes from './routes/accessibility.js'; // PRD-273
import motionRoutes from './routes/motion.js'; // PRD-275: Reduced Motion Option
import referencesRoutes from './routes/references.js'; // PRD-043
import userPreferencesRoutes from './routes/user-preferences.js'; // PRD-274: Font Size Customization
import benchmarkReportRoutes from './routes/benchmark-report.js'; // PRD-171: Benchmark Report
import clvRoutes from './routes/clv.js'; // PRD-173: Customer Lifetime Value Report
import healthPredictionRoutes from './routes/health-prediction.js'; // PRD-231: Health Prediction
import yoyComparisonRoutes from './routes/yoy-comparison.js'; // PRD-177: Year-over-Year Comparison Report
import { playbookRecommendationsRoutes } from './routes/playbook-recommendations.js'; // PRD-232: Automated Playbook Selection
import predictiveAnalyticsRoutes from './routes/predictive-analytics.js'; // PRD-176: Predictive Analytics Report
import executiveSummaryRoutes from './routes/executive-summary.js'; // PRD-179: Executive Summary Report
import { activityFeedRoutes } from './routes/activity-feed.js'; // PRD-172: Activity Feed Analysis
import { taskRoutes } from './routes/tasks.js'; // PRD-234: Natural Language Task Creation
import templateLibraryRoutes from './routes/template-library.js'; // PRD-256: Team Meeting Prep / Template Library
import emailRoutes from './routes/email.js'; // PRD: Email Integration & Summarization
import journeyOptimizationRoutes from './routes/journey-optimization.js'; // PRD-237: Customer Journey Optimization
import teamPerformanceRoutes from './routes/team-performance.js'; // PRD-178: Team Performance Dashboard
import locationRemindersRoutes from './routes/location-reminders.js'; // PRD-268: Location-Based Reminders
import crossFunctionalRoutes from './routes/cross-functional.js'; // PRD-257: Cross-Functional Alignment
import peerReviewRoutes from './routes/peer-review.js'; // PRD-253: Peer Review Workflow
import { segmentAnalysisRoutes } from './routes/segment-analysis.js'; // PRD-175: Customer Segmentation Analysis
import docusignRoutes from './routes/docusign.js'; // PRD-205: DocuSign Contract Management
import nrrReportRoutes from './routes/nrr-report.js'; // PRD-174: Net Revenue Retention Report
import coachingRoutes from './routes/coaching.js'; // PRD-239: AI Coach for CSMs
import successStoryRoutes from './routes/success-stories.js'; // PRD-240: Automated Success Story Drafting
import bestPracticesRoutes from './routes/best-practices.js'; // PRD-254: Best Practice Sharing
import confluenceRoutes from './routes/confluence.js'; // PRD-204: Confluence Knowledge Base
import mobileDocumentScanningRoutes from './routes/mobile-document-scanning.js'; // PRD-267: Mobile Document Scanning
import riskDeepDiveRoutes from './routes/risk-deep-dive.js'; // PRD-083: Risk Deep Dive Analysis
import patternRecognitionRoutes from './routes/pattern-recognition.js'; // PRD-233: AI Pattern Recognition
import expansionPropensityRoutes, { customerPropensityHandler } from './routes/expansion-propensity.js'; // PRD-238: Expansion Propensity Modeling
import absencesRoutes from './routes/absences.js'; // PRD-258: Coverage Backup System - Absences
import coverageAssignmentsRoutes from './routes/coverage-assignments.js'; // PRD-258: Coverage Backup System - Assignments
import teamAbsencesRoutes from './routes/team-absences.js'; // PRD-258: Coverage Backup System - Team View
import mobileRoutes from './routes/mobile.js'; // PRD-266: Apple Watch Integration & Biometric Auth
import customReportsRoutes from './routes/custom-reports.js'; // PRD-180: Custom Report Builder
import teamAnalyticsRoutes from './routes/team-analytics.js'; // PRD-260: Team Goal Tracking
import voiceCommandsRoutes from './routes/voice-commands.js'; // PRD-264: Voice Command Support
import leaderboardRoutes from './routes/leaderboard.js'; // PRD-260: Leaderboard
import accountPlansRoutes from './routes/account-plans.js'; // PRD-235: AI-Powered Account Planning
import mobileMeetingNotesRoutes from './routes/mobile-meeting-notes.js'; // PRD-269: Mobile Meeting Notes
import mentorshipRoutes from './routes/mentorship.js'; // PRD-255: Mentor Assignment
import readinessRoutes from './routes/readiness.js'; // PRD-085: Account Readiness Assessment
import { quickActionsRoutes } from './routes/quick-actions.js'; // PRD-265: Quick Actions Widget
import cadgRoutes from './routes/cadg.js'; // CADG: Context-Aware Agentic Document Generation
import { config } from './config/index.js';
import { schedulerService } from './services/scheduler.js';
import { agentMemoryService } from './services/agentMemory.js';
import { errorHandler } from './middleware/errorHandler.js';
import { metricsMiddleware, getMetrics, getPrometheusMetrics, getAgenticMetrics } from './middleware/metrics.js';
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

// Wire up WebSocket to agentic routes for real-time notifications
setWebSocketHandler(wsHandler);

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

    // Allow localhost for development + production domains
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      // Production domains
      'https://cscx.ai',
      'https://www.cscx.ai',
      'https://app.cscx.ai',
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

// Agentic-specific metrics endpoint
app.get('/metrics/agentic', (req, res) => {
  res.json({
    success: true,
    data: getAgenticMetrics(),
  });
});

// Circuit breaker status
app.get('/health/circuits', (req, res) => {
  res.json(getAllCircuitBreakerStats());
});

// API Routes
app.use('/api/auth', authRoutes); // PRD-1: Gated Login + Onboarding
app.use('/api/agents', agentRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/entitlements', entitlementRoutes); // PRD-0: Contract entitlements HITL review
app.use('/api/customers', customerRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/ai', langchainRoutes); // LangChain-powered AI agents
app.use('/api/flags', featureFlagRoutes); // Feature flags
app.use('/api/google', googleRoutes); // Google Workspace integration
app.use('/api/outlook', outlookRoutes); // Microsoft Outlook/Graph integration (PRD-189)
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
app.use('/api/linear', linearRoutes); // Linear issue integration (PRD-202)
app.use('/api/chat', chatRoutes); // Chat message persistence
app.use('/api/workspace-agent', workspaceAgentRoutes); // Workspace agent quick actions
app.use('/api/ai-analysis', aiAnalysisRoutes); // Claude-powered sheet analysis (AppScript alternative)
app.use('/api/agentic-mode', agenticModeRoutes); // Agentic mode toggle and configuration
app.use('/api/agentic', agenticAgentsRoutes); // Agentic agent execution endpoints
app.use('/api/schedules', schedulesRoutes); // Scheduled agent runs (cron-based)
app.use('/api/skills', skillsRoutes); // Skills layer - reusable multi-step workflows
app.use('/api/traces', tracesRoutes); // Agent trace visualization and replay
app.use('/api/agent-metrics', agentMetricsRoutes); // Agent performance metrics dashboard
app.use('/api/triggers', triggersRoutes); // Event-driven automation triggers
app.use('/api/mcp', mcpRoutes); // MCP tool router and execution
app.use('/api/slack', slackRoutes); // Slack integration and messaging
app.use('/api/zoom', zoomRoutes); // Zoom integration and meetings
app.use('/api/calendly', calendlyRoutes); // Calendly scheduling integration (PRD-208)
app.use('/api/meeting-intelligence', meetingIntelligenceRoutes); // AI-powered meeting analysis
app.use('/api/automations', automationsRoutes); // NL-driven automation builder
app.use('/api/intelligence', intelligenceRoutes); // Account intelligence and briefings (PRD-056)
app.use('/api/customers', qbrEmailRoutes); // QBR email generation (PRD-026)
app.use('/api/integration-health', integrationHealthRoutes); // Integration health monitoring (PRD-101)
app.use('/api/reports/engagement-metrics', engagementMetricsRoutes); // Engagement metrics report (PRD-157)
app.use('/api/expansion', expansionRoutes); // Expansion signal detection and opportunities (PRD-103)
app.use('/api/analytics/expansion-propensity', expansionPropensityRoutes); // Expansion propensity modeling (PRD-238)
app.get('/api/customers/:customerId/expansion-propensity', customerPropensityHandler); // Customer-specific propensity (PRD-238)
app.use('/api/sentiment', sentimentRoutes); // Real-time sentiment analysis (PRD-218)
app.use('/api/reports/revenue-analytics', revenueAnalyticsRoutes); // Revenue analytics report (PRD-158)
app.use('/api/health-trends', healthScoreTrendsRoutes); // Health score trend analysis (PRD-060)
app.use('/api/reports/health-portfolio', healthPortfolioRoutes); // Health score portfolio view (PRD-153)
app.use('/api/reports/segment-analysis', segmentAnalysisRoutes); // Customer segmentation analysis (PRD-175)
app.use('/api/churn', churnPostMortemRoutes); // Churn post-mortem workflow (PRD-124)
app.use('/api/meeting-prep', meetingPrepRoutes); // Automated meeting prep briefs (PRD-127)
app.use('/api/patterns', patternRecognitionRoutes); // AI pattern recognition (PRD-233)
app.use('/api/reports/renewal-forecast', renewalForecastRoutes); // Renewal forecast report (PRD-163)
app.use('/api/escalations', escalationsRoutes); // Escalation war room (PRD-121)
app.use('/api/users/preferences/accessibility', accessibilityRoutes); // High contrast mode (PRD-273)
app.use('/api/users/preferences/motion', motionRoutes); // Reduced motion option (PRD-275)
app.use('/api/references', referencesRoutes); // Reference request to customer (PRD-043)
app.use('/api/reports/benchmark', benchmarkReportRoutes); // Benchmark report (PRD-171)
app.use('/api/reports/clv', clvRoutes); // Customer Lifetime Value report (PRD-173)
app.use('/api/health-prediction', healthPredictionRoutes); // Health prediction (PRD-231)
app.use('/api/reports/yoy', yoyComparisonRoutes); // Year-over-Year comparison report (PRD-177)
app.use('/api', playbookRecommendationsRoutes); // Automated playbook selection (PRD-232)
app.use('/api/reports/predictive-analytics', predictiveAnalyticsRoutes); // Predictive analytics report (PRD-176)
app.use('/api/reports/activity-feed', activityFeedRoutes); // Activity feed analysis (PRD-172)
app.use('/api/tasks', taskRoutes); // Natural language task creation (PRD-234)
app.use('/api/analytics/journey', journeyOptimizationRoutes); // Customer journey optimization (PRD-237)
app.use('/api/reports/team-performance', teamPerformanceRoutes); // Team performance dashboard (PRD-178)
app.use('/api/reports/nrr', nrrReportRoutes); // Net Revenue Retention report (PRD-174)
app.use('/api/reports/executive-summary', executiveSummaryRoutes); // Executive summary report (PRD-179)
app.use('/api/reports/custom', customReportsRoutes); // Custom report builder (PRD-180)
app.use('/api/best-practices', bestPracticesRoutes); // Best practice sharing (PRD-254)
app.use('/api/coaching', coachingRoutes); // AI Coach for CSMs (PRD-239)
app.use('/api/content/success-story', successStoryRoutes); // Automated success story drafting (PRD-240)
app.use('/api/template-library', templateLibraryRoutes); // Team meeting prep templates (PRD-256)
app.use('/api/customers', riskDeepDiveRoutes); // Risk deep dive analysis (PRD-083)
app.use('/api/integrations/docusign', docusignRoutes); // DocuSign contract management (PRD-205)
app.use('/api/docusign', docusignRoutes); // DocuSign envelope operations (PRD-205)
app.use('/api/cross-functional', crossFunctionalRoutes); // Cross-functional alignment (PRD-257)
app.use('/api/confluence', confluenceRoutes); // Confluence Knowledge Base (PRD-204)
app.use('/api/goals', teamAnalyticsRoutes); // Team goal tracking (PRD-260)
app.use('/api/leaderboard', leaderboardRoutes); // Leaderboard (PRD-260)
app.use('/api/webhooks', zapierWebhookRoutes); // Zapier webhook integration (PRD-210)
app.use('/api/mobile', mobileRoutes); // Apple Watch integration & biometric auth (PRD-266)
app.use('/api/voice', voiceCommandsRoutes); // Voice command support (PRD-264)
app.use('/api/mobile/meeting-notes', mobileMeetingNotesRoutes); // Mobile meeting notes (PRD-269)
app.use('/api/absences', absencesRoutes); // PRD-258: Coverage Backup System - Absences
app.use('/api/coverage-assignments', coverageAssignmentsRoutes); // PRD-258: Coverage Backup System - Assignments
app.use('/api/team/absences', teamAbsencesRoutes); // PRD-258: Coverage Backup System - Team Calendar
app.use('/api/quick-actions', quickActionsRoutes); // PRD-265: Quick Actions Widget
app.use('/api/mobile/documents', mobileDocumentScanningRoutes); // Mobile document scanning (PRD-267)
app.use('/api', accountPlansRoutes); // AI-Powered Account Planning (PRD-235)
app.use('/api/locations', locationRemindersRoutes); // Location-based reminders (PRD-268)
app.use('/api/readiness', readinessRoutes); // Account readiness assessment (PRD-085)
app.use('/api/mentorship', mentorshipRoutes); // PRD-255: Mentor Assignment
app.use('/api/peer-review', peerReviewRoutes); // PRD-253: Peer Review Workflow
app.use('/api/cadg', cadgRoutes); // CADG: Context-Aware Agentic Document Generation
app.use('/api/email', emailRoutes); // Email Integration & Summarization

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

  // Initialize scheduler service (loads and starts scheduled agent runs)
  schedulerService.initialize().catch(err => {
    console.error('Failed to initialize scheduler:', err);
  });

  // Initialize agent memory service (starts cleanup job)
  agentMemoryService.initialize();
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  schedulerService.shutdown();
  agentMemoryService.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  schedulerService.shutdown();
  agentMemoryService.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Export for testing
export { app, server, wsHandler };
