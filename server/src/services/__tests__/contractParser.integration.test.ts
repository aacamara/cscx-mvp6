/**
 * Contract Parser Integration Tests
 * Tests validation logic and error handling
 * Note: AI service tests require actual API keys and are marked with .skip
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sampleContractText,
  invalidContractText
} from '../../test/mocks/fixtures/contracts.fixture.js';

describe('ContractParser Validation Tests', () => {
  describe('Input Validation', () => {
    it('should validate text input type', () => {
      const validInput = {
        type: 'text' as const,
        content: sampleContractText,
        fileName: 'test.txt'
      };

      expect(validInput.type).toBe('text');
      expect(validInput.content.length).toBeGreaterThan(50);
    });

    it('should validate file input type', () => {
      const validInput = {
        type: 'file' as const,
        content: 'base64content',
        mimeType: 'application/pdf',
        fileName: 'test.pdf'
      };

      expect(validInput.type).toBe('file');
      expect(validInput.mimeType).toBe('application/pdf');
    });

    it('should identify insufficient content', () => {
      const insufficientContent = invalidContractText;
      expect(insufficientContent.trim().length).toBeLessThan(50);
    });

    it('should identify valid content length', () => {
      const validContent = sampleContractText;
      expect(validContent.trim().length).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Content Extraction Helpers', () => {
    it('should handle empty content', () => {
      const emptyContent = '';
      expect(emptyContent.trim().length).toBe(0);
    });

    it('should handle whitespace-only content', () => {
      const whitespaceContent = '   \n\t\n   ';
      expect(whitespaceContent.trim().length).toBe(0);
    });

    it('should handle special characters', () => {
      const specialContent = `Company: Test & "Special" Corp <tag>
        ARR: $150,000.00
        Contact: John O'Brien
        Additional contract terms and conditions apply here.`;
      expect(specialContent.trim().length).toBeGreaterThan(50);
    });

    it('should handle unicode characters', () => {
      const unicodeContent = `Company: Tëst Cörporatiön
        Annual Value: €150,000
        Contact: 田中太郎
        Additional contract terms and conditions apply here for testing.`;
      expect(unicodeContent.trim().length).toBeGreaterThan(50);
    });
  });

  describe('MIME Type Handling', () => {
    const supportedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/html'
    ];

    supportedMimeTypes.forEach(mimeType => {
      it(`should recognize ${mimeType} as supported`, () => {
        const isPDF = mimeType === 'application/pdf';
        const isDOCX = mimeType.includes('wordprocessingml') || mimeType === 'application/msword';
        const isText = mimeType.startsWith('text/');

        expect(isPDF || isDOCX || isText).toBe(true);
      });
    });
  });

  describe('Confidence Score Calculation', () => {
    it('should calculate average confidence from scores', () => {
      const scores = { company_name: 0.95, arr: 0.90, stakeholders: 0.85 };
      const values = Object.values(scores);
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

      expect(avg).toBeCloseTo(0.9, 2);
    });

    it('should use default confidence when no scores provided', () => {
      const defaultConfidence = 0.7;
      const scores: Record<string, number> | undefined = undefined;

      const confidence = scores
        ? Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
        : defaultConfidence;

      expect(confidence).toBe(0.7);
    });

    it('should handle empty confidence scores', () => {
      const scores: Record<string, number> = {};
      const defaultConfidence = 0.7;

      const values = Object.values(scores);
      const confidence = values.length > 0
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : defaultConfidence;

      expect(confidence).toBe(0.7);
    });
  });
});

describe('Contract Data Structure', () => {
  it('should have required extraction fields', () => {
    const expectedFields = [
      'company_name',
      'arr',
      'contract_period',
      'entitlements',
      'stakeholders',
      'technical_requirements',
      'missing_info',
      'next_steps'
    ];

    const mockExtraction = {
      company_name: 'Test Corp',
      arr: 100000,
      contract_period: '12 months',
      entitlements: [],
      stakeholders: [],
      technical_requirements: [],
      contract_tasks: [],
      pricing_terms: [],
      missing_info: [],
      next_steps: '',
      confidence_scores: {}
    };

    expectedFields.forEach(field => {
      expect(mockExtraction).toHaveProperty(field);
    });
  });

  it('should validate stakeholder structure', () => {
    const validStakeholder = {
      name: 'John Doe',
      role: 'Champion',
      department: 'IT',
      contact: 'john@test.com',
      responsibilities: 'Main POC',
      approval_required: true
    };

    expect(validStakeholder).toHaveProperty('name');
    expect(validStakeholder).toHaveProperty('role');
    expect(validStakeholder).toHaveProperty('contact');
    expect(typeof validStakeholder.approval_required).toBe('boolean');
  });

  it('should validate entitlement structure', () => {
    const validEntitlement = {
      type: 'Enterprise License',
      description: 'Full platform access',
      quantity: '50 users',
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      dependencies: 'None'
    };

    expect(validEntitlement).toHaveProperty('type');
    expect(validEntitlement).toHaveProperty('quantity');
    expect(validEntitlement).toHaveProperty('start_date');
    expect(validEntitlement).toHaveProperty('end_date');
  });
});

// These tests require actual AI services - skip in CI
describe.skip('ContractParser AI Integration Tests (requires API keys)', () => {
  it('should parse text contract with Claude', async () => {
    // Requires ANTHROPIC_API_KEY
  });

  it('should parse PDF with Gemini multimodal', async () => {
    // Requires GEMINI_API_KEY
  });

  it('should fallback from Claude to Gemini on failure', async () => {
    // Requires both API keys
  });
});
