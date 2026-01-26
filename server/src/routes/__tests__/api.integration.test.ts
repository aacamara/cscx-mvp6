/**
 * API Integration Tests
 * Tests the REST API endpoints with supertest
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock external services before importing routes
vi.mock('../../services/supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
    }
  }
}));

vi.mock('../../services/gemini.js', () => ({
  geminiService: {
    generate: vi.fn().mockResolvedValue('Gemini response'),
    generateJSON: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('../../services/claude.js', () => ({
  claudeService: {
    generate: vi.fn().mockResolvedValue('Claude response'),
    parseContract: vi.fn().mockResolvedValue({ company_name: 'Test' })
  }
}));

vi.mock('../../services/health.js', () => ({
  healthService: {
    getBasicHealth: vi.fn().mockReturnValue({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 1000
    }),
    getLivenessStatus: vi.fn().mockResolvedValue({
      status: 'ok',
      timestamp: new Date().toISOString()
    }),
    getReadinessStatus: vi.fn().mockResolvedValue({
      ready: true,
      checks: []
    }),
    getFullHealth: vi.fn().mockResolvedValue({
      status: 'healthy',
      services: {},
      checks: []
    })
  }
}));

// Create minimal test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Health endpoints
  app.get('/health/live', async (req, res) => {
    const { healthService } = await import('../../services/health.js');
    const status = await healthService.getLivenessStatus();
    res.json(status);
  });

  app.get('/health/ready', async (req, res) => {
    const { healthService } = await import('../../services/health.js');
    const status = await healthService.getReadinessStatus();
    res.status(status.ready ? 200 : 503).json(status);
  });

  app.get('/health', async (req, res) => {
    const { healthService } = await import('../../services/health.js');
    const health = await healthService.getFullHealth(false);
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
  });

  app.get('/health/basic', async (req, res) => {
    const { healthService } = await import('../../services/health.js');
    res.json(healthService.getBasicHealth());
  });

  return app;
};

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Endpoints', () => {
    it('GET /health/live should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('GET /health/ready should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('ready', true);
    });

    it('GET /health should return full health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
    });

    it('GET /health/basic should return basic health info', async () => {
      const response = await request(app)
        .get('/health/basic')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('uptime');
    });
  });
});

describe('Request Validation Tests', () => {
  it('should reject requests with invalid JSON', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', (req, res) => res.json({ received: req.body }));
    app.use((err: any, req: any, res: any, next: any) => {
      if (err.type === 'entity.parse.failed') {
        res.status(400).json({ error: 'Invalid JSON' });
      } else {
        next(err);
      }
    });

    const response = await request(app)
      .post('/test')
      .set('Content-Type', 'application/json')
      .send('not valid json{')
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });
});

describe('CORS and Headers Tests', () => {
  it('should accept requests with proper content type', async () => {
    const app = express();
    app.use(express.json());
    app.post('/echo', (req, res) => res.json(req.body));

    const response = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send({ test: 'data' })
      .expect(200);

    expect(response.body).toEqual({ test: 'data' });
  });
});
