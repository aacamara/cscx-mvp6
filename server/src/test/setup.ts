import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3002';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'test-supabase-key';
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Suppress console output during tests unless DEBUG=true
if (!process.env.DEBUG) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
}
