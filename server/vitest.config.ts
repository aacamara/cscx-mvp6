import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/test/**/*',
        'src/index.ts'
      ],
      // MVP coverage thresholds - increase as test coverage improves
      thresholds: {
        lines: 1,
        functions: 20,
        branches: 30,
        statements: 1
      }
    },
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    reporters: ['verbose'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
