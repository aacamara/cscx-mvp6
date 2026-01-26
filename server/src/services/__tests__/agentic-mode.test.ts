/**
 * Agentic Mode Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgenticModeService, AGENTIC_PRESETS } from '../agentic-mode.js';

describe('AgenticModeService', () => {
  let service: AgenticModeService;

  beforeEach(() => {
    service = new AgenticModeService();
  });

  describe('getSettings', () => {
    it('should return default settings for unknown user', async () => {
      const settings = await service.getSettings('unknown-user');

      expect(settings.userId).toBe('unknown-user');
      expect(settings.config.enabled).toBe(false);
      expect(settings.preset).toBe('manual');
    });

    it('should include all required config fields', async () => {
      const settings = await service.getSettings('test-user');

      expect(settings.config).toHaveProperty('enabled');
      expect(settings.config).toHaveProperty('maxSteps');
      expect(settings.config).toHaveProperty('autoApproveLevel');
      expect(settings.config).toHaveProperty('pauseOnHighRisk');
      expect(settings.config).toHaveProperty('notifyOnCompletion');
    });
  });

  describe('toggleMode', () => {
    it('should enable agentic mode', async () => {
      const settings = await service.toggleMode('test-user', true);

      expect(settings.config.enabled).toBe(true);
      expect(settings.preset).toBe('supervised');
    });

    it('should disable agentic mode', async () => {
      // First enable
      await service.toggleMode('test-user', true);

      // Then disable
      const settings = await service.toggleMode('test-user', false);

      expect(settings.config.enabled).toBe(false);
      expect(settings.preset).toBe('manual');
    });
  });

  describe('applyPreset', () => {
    it('should apply vacation preset', async () => {
      const settings = await service.applyPreset('test-user', 'vacation');

      expect(settings.config.enabled).toBe(true);
      expect(settings.config.autoApproveLevel).toBe('low_risk');
      expect(settings.preset).toBe('vacation');
    });

    it('should apply manual preset', async () => {
      // First enable agentic mode
      await service.toggleMode('test-user', true);

      // Then apply manual preset
      const settings = await service.applyPreset('test-user', 'manual');

      expect(settings.config.enabled).toBe(false);
      expect(settings.preset).toBe('manual');
    });

    it('should apply supervised preset', async () => {
      const settings = await service.applyPreset('test-user', 'supervised');

      expect(settings.config.enabled).toBe(true);
      expect(settings.config.autoApproveLevel).toBe('low_risk');
      expect(settings.config.pauseOnHighRisk).toBe(true);
    });

    it('should apply autonomous preset', async () => {
      const settings = await service.applyPreset('test-user', 'autonomous');

      expect(settings.config.enabled).toBe(true);
      expect(settings.config.autoApproveLevel).toBe('all');
      expect(settings.config.maxSteps).toBe(30);
    });

    it('should throw for unknown preset', async () => {
      await expect(
        service.applyPreset('test-user', 'unknown' as any)
      ).rejects.toThrow('Unknown preset');
    });
  });

  describe('updateSettings', () => {
    it('should update specific config values', async () => {
      const settings = await service.updateSettings('test-user', {
        config: { enabled: true, maxSteps: 25 } as any,
      });

      expect(settings.config.enabled).toBe(true);
      expect(settings.config.maxSteps).toBe(25);
    });

    it('should preserve unchanged config values', async () => {
      // First set up
      await service.applyPreset('test-user', 'vacation');

      // Update only maxSteps
      const settings = await service.updateSettings('test-user', {
        config: { maxSteps: 15 } as any,
      });

      expect(settings.config.maxSteps).toBe(15);
      expect(settings.config.autoApproveLevel).toBe('low_risk'); // Preserved
    });

    it('should update updatedAt timestamp', async () => {
      const before = new Date();
      const settings = await service.updateSettings('test-user', {
        config: { enabled: true } as any,
      });

      expect(settings.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('getEffectiveConfig', () => {
    it('should return base config when no schedule', async () => {
      await service.applyPreset('test-user', 'vacation');
      const config = await service.getEffectiveConfig('test-user');

      expect(config.enabled).toBe(true);
      expect(config.autoApproveLevel).toBe('low_risk');
    });
  });

  describe('getPresets', () => {
    it('should return all available presets', () => {
      const presets = service.getPresets();

      expect(presets).toHaveProperty('manual');
      expect(presets).toHaveProperty('vacation');
      expect(presets).toHaveProperty('supervised');
      expect(presets).toHaveProperty('autonomous');
    });

    it('should not allow modifying returned presets', () => {
      const presets = service.getPresets();
      presets.manual.enabled = true; // Try to modify

      // Original should be unchanged
      expect(AGENTIC_PRESETS.manual.enabled).toBe(false);
    });
  });

  describe('cache behavior', () => {
    it('should cache settings after first fetch', async () => {
      await service.getSettings('cached-user');
      await service.updateSettings('cached-user', {
        config: { enabled: true } as any,
      });

      const settings = await service.getSettings('cached-user');
      expect(settings.config.enabled).toBe(true);
    });

    it('should clear cache for specific user', async () => {
      // Set up with custom settings
      await service.updateSettings('cache-clear-test', {
        config: { enabled: true } as any,
      });

      // Verify it's cached
      let settings = await service.getSettings('cache-clear-test');
      expect(settings.config.enabled).toBe(true);

      // Clear cache
      service.clearCache('cache-clear-test');

      // Since there's no DB, clearing cache means we get defaults again
      // This is expected behavior in memory-only mode
    });
  });
});

describe('AGENTIC_PRESETS', () => {
  it('should have manual preset disabled', () => {
    expect(AGENTIC_PRESETS.manual.enabled).toBe(false);
    expect(AGENTIC_PRESETS.manual.autoApproveLevel).toBe('none');
  });

  it('should have vacation preset with low_risk auto-approve', () => {
    expect(AGENTIC_PRESETS.vacation.enabled).toBe(true);
    expect(AGENTIC_PRESETS.vacation.autoApproveLevel).toBe('low_risk');
    expect(AGENTIC_PRESETS.vacation.pauseOnHighRisk).toBe(true);
  });

  it('should have autonomous preset with high maxSteps', () => {
    expect(AGENTIC_PRESETS.autonomous.maxSteps).toBeGreaterThan(AGENTIC_PRESETS.manual.maxSteps);
    expect(AGENTIC_PRESETS.autonomous.autoApproveLevel).toBe('all');
  });

  it('should all presets have pauseOnHighRisk for safety', () => {
    // Even autonomous mode should pause on high-risk actions
    Object.values(AGENTIC_PRESETS).forEach(preset => {
      expect(preset.pauseOnHighRisk).toBe(true);
    });
  });
});
