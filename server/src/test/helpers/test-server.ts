import express, { Express } from 'express';
import cors from 'cors';

// Create a minimal test server instance
export function createTestApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  return app;
}

// Helper to make test requests easier
export interface TestRequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function makeRequest(
  app: Express,
  options: TestRequestOptions
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve) => {
    const { method, path, body, headers } = options;

    // Create mock request/response
    const req = {
      method,
      url: path,
      body,
      headers: headers || {},
      params: {},
      query: {}
    };

    const res = {
      statusCode: 200,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: unknown) {
        this.body = data;
        resolve({ status: this.statusCode, body: data });
        return this;
      },
      send(data: unknown) {
        this.body = data;
        resolve({ status: this.statusCode, body: data });
        return this;
      }
    };

    // This is a simplified version - use supertest for actual HTTP tests
    resolve({ status: 200, body: null });
  });
}
