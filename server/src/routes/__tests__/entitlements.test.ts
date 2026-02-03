/**
 * Entitlements API Tests
 * PRD-0: Contract Parsing & Entitlements HITL Review
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Use vi.hoisted to create mock functions that will be available when vi.mock is hoisted
const {
  mockListEntitlements,
  mockGetEntitlement,
  mockUpdateEntitlement,
  mockSaveEntitlementEdit,
  mockFinalizeEntitlement,
  mockGetEntitlementVersionHistory
} = vi.hoisted(() => ({
  mockListEntitlements: vi.fn(),
  mockGetEntitlement: vi.fn(),
  mockUpdateEntitlement: vi.fn(),
  mockSaveEntitlementEdit: vi.fn(),
  mockFinalizeEntitlement: vi.fn(),
  mockGetEntitlementVersionHistory: vi.fn(),
}));

// Mock the Supabase service
vi.mock('../../services/supabase.js', () => ({
  SupabaseService: vi.fn().mockImplementation(() => ({
    listEntitlements: mockListEntitlements,
    getEntitlement: mockGetEntitlement,
    updateEntitlement: mockUpdateEntitlement,
    saveEntitlementEdit: mockSaveEntitlementEdit,
    finalizeEntitlement: mockFinalizeEntitlement,
    getEntitlementVersionHistory: mockGetEntitlementVersionHistory,
  }))
}));

// Mock auth middleware
vi.mock('../../middleware/auth.js', () => ({
  optionalAuthMiddleware: (_req: any, _res: any, next: any) => {
    _req.userId = 'test-user-123';
    _req.user = { id: 'test-user-123', email: 'test@example.com' };
    next();
  }
}));

// Import AFTER mocks are set up
import { entitlementRoutes } from '../entitlements.js';

const app = express();
app.use(express.json());
app.use('/api/entitlements', entitlementRoutes);

describe('Entitlements API (PRD-0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/entitlements', () => {
    it('should list entitlements with default pagination', async () => {
      const mockEntitlements = [
        { id: 'ent-1', sku: 'ENTERPRISE', product_name: 'Enterprise Plan', status: 'finalized' },
        { id: 'ent-2', sku: 'SUPPORT-PRO', product_name: 'Pro Support', status: 'pending_review' }
      ];

      mockListEntitlements.mockResolvedValue({
        entitlements: mockEntitlements,
        total: 2
      });

      const response = await request(app).get('/api/entitlements');

      expect(response.status).toBe(200);
      expect(response.body.entitlements).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should filter by customer_id', async () => {
      mockListEntitlements.mockResolvedValue({
        entitlements: [],
        total: 0
      });

      const response = await request(app).get('/api/entitlements?customer_id=cust-123');

      expect(response.status).toBe(200);
      expect(mockListEntitlements).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      mockListEntitlements.mockResolvedValue({
        entitlements: [],
        total: 0
      });

      const response = await request(app).get('/api/entitlements?status=finalized');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/entitlements/:id', () => {
    it('should return entitlement details', async () => {
      const mockEntitlement = {
        id: 'ent-1',
        sku: 'ENTERPRISE',
        product_name: 'Enterprise Plan',
        quantity: 100,
        quantity_unit: 'users',
        status: 'finalized',
        confidence_overall: 0.92
      };

      mockGetEntitlement.mockResolvedValue(mockEntitlement);

      const response = await request(app).get('/api/entitlements/ent-1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('ent-1');
      expect(response.body.sku).toBe('ENTERPRISE');
    });

    it('should return 404 for non-existent entitlement', async () => {
      mockGetEntitlement.mockResolvedValue(null);

      const response = await request(app).get('/api/entitlements/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('PATCH /api/entitlements/:id', () => {
    it('should update entitlement fields and record edit history', async () => {
      const existingEntitlement = {
        id: 'ent-1',
        sku: 'OLD-SKU',
        product_name: 'Old Name',
        status: 'draft'
      };

      mockGetEntitlement.mockResolvedValue(existingEntitlement);
      mockUpdateEntitlement.mockResolvedValue(undefined);
      mockSaveEntitlementEdit.mockResolvedValue({ id: 'edit-1' });

      const response = await request(app)
        .patch('/api/entitlements/ent-1')
        .send({ sku: 'NEW-SKU', product_name: 'New Name' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('pending_review');
      expect(mockSaveEntitlementEdit).toHaveBeenCalled();
      expect(mockUpdateEntitlement).toHaveBeenCalled();
    });

    it('should return 404 for non-existent entitlement', async () => {
      mockGetEntitlement.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/entitlements/non-existent')
        .send({ sku: 'NEW-SKU' });

      expect(response.status).toBe(404);
    });

    it('should return 200 for empty updates (no fields changed)', async () => {
      // Zod allows empty objects since all fields are optional
      const existingEntitlement = {
        id: 'ent-1',
        sku: 'OLD-SKU',
        status: 'draft'
      };
      mockGetEntitlement.mockResolvedValue(existingEntitlement);
      mockUpdateEntitlement.mockResolvedValue(undefined);

      const response = await request(app)
        .patch('/api/entitlements/ent-1')
        .send({});

      // Empty object is valid (all fields optional) - returns 200
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/entitlements/:id/finalize', () => {
    it('should finalize an entitlement', async () => {
      mockFinalizeEntitlement.mockResolvedValue({
        id: 'ent-1',
        status: 'finalized',
        is_active: true,
        version: 1,
        finalized_at: new Date().toISOString()
      });

      const response = await request(app).post('/api/entitlements/ent-1/finalize');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('finalized');
      expect(response.body.is_active).toBe(true);
    });

    it('should return 404 for non-existent entitlement', async () => {
      mockFinalizeEntitlement.mockRejectedValue(new Error('Entitlement not found'));

      const response = await request(app).post('/api/entitlements/non-existent/finalize');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/entitlements/:id/history', () => {
    it('should return version history with edits', async () => {
      const mockHistory = {
        entitlement: {
          id: 'ent-1',
          version: 2,
          status: 'finalized',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          finalized_at: '2024-01-02T00:00:00Z'
        },
        edits: [
          {
            id: 'edit-1',
            field_name: 'sku',
            old_value: 'OLD',
            new_value: 'NEW',
            edited_at: '2024-01-02T00:00:00Z'
          }
        ]
      };

      mockGetEntitlementVersionHistory.mockResolvedValue(mockHistory);

      const response = await request(app).get('/api/entitlements/ent-1/history');

      expect(response.status).toBe(200);
      expect(response.body.entitlement).toBeDefined();
      expect(response.body.edits).toHaveLength(1);
    });

    it('should return 404 for non-existent entitlement', async () => {
      mockGetEntitlementVersionHistory.mockResolvedValue({ entitlement: null, edits: [] });

      const response = await request(app).get('/api/entitlements/non-existent/history');

      expect(response.status).toBe(404);
    });
  });
});
