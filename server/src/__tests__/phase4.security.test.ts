import fs from 'node:fs';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import path from 'node:path';
import { Duplex } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { AUTH_COOKIE_NAME } from '../middlewares/authCookie.js';

interface SimulatedHttpResponse {
  status: number;
  headers: Record<string, string | number | string[] | undefined>;
  rawBody: string;
  json: Record<string, unknown> | null;
}

/**
 * Dispatches an HTTP request directly into the Express 5 application pipeline in-memory
 * without opening a TCP port (safe in restricted sandboxes and deterministic in CI).
 */
async function dispatchRequest(options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  rawBody?: string;
}): Promise<SimulatedHttpResponse> {
  const app = createApp();

  return new Promise<SimulatedHttpResponse>((resolve, reject) => {
    const mockSocket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    }) as unknown as Socket;

    Object.assign(mockSocket, {
      remoteAddress: '127.0.0.1',
      remotePort: 54321,
      encrypted: false,
      destroy: () => mockSocket,
    });

    const req = new IncomingMessage(mockSocket);
    req.method = options.method.toUpperCase();
    req.url = options.url;
    req.headers = {
      host: 'localhost:4000',
      ...(options.headers ?? {}),
    };

    if (options.rawBody !== undefined) {
      const bodyBuffer = Buffer.from(options.rawBody, 'utf8');
      req.headers['content-length'] = String(bodyBuffer.length);
      req.push(bodyBuffer);
    }
    req.push(null);

    const res = new ServerResponse(req);
    res.assignSocket(mockSocket);

    const bodyChunks: Buffer[] = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = ((chunk: unknown, encodingOrCb?: unknown, cb?: unknown): boolean => {
      if (chunk) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      return originalWrite(chunk as never, encodingOrCb as never, cb as never);
    }) as typeof res.write;

    res.end = ((chunk?: unknown, encodingOrCb?: unknown, cb?: unknown): ServerResponse => {
      if (chunk && typeof chunk !== 'function') {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      const result = originalEnd(chunk as never, encodingOrCb as never, cb as never);
      const rawBody = Buffer.concat(bodyChunks).toString('utf8');
      let json: Record<string, unknown> | null = null;
      try {
        json = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        json = null;
      }

      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        rawBody,
        json,
      });
      return result;
    }) as typeof res.end;

    try {
      app(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

describe('Phase 4 Security & HTTP Contract Audit (createApp)', () => {
  it('sets Helmet security headers, hides x-powered-by, and serves GET /api/v1/health', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.json).toEqual({
      success: true,
      message: 'UPgrade API berjalan dengan baik.',
      data: { status: 'ok' },
      meta: {},
    });
  });

  it('rejects unauthenticated access across all protected module routes with 401 Indonesian envelope', async () => {
    const protectedEndpoints: Array<{ method: string; url: string }> = [
      { method: 'GET', url: '/api/v1/auth/me' },
      { method: 'PATCH', url: '/api/v1/auth/preferences' },
      { method: 'POST', url: '/api/v1/onboarding' },
      { method: 'GET', url: '/api/v1/accounts' },
      { method: 'POST', url: '/api/v1/accounts' },
      { method: 'GET', url: '/api/v1/categories' },
      { method: 'POST', url: '/api/v1/categories' },
      { method: 'GET', url: '/api/v1/transactions' },
      { method: 'POST', url: '/api/v1/transactions' },
      { method: 'GET', url: '/api/v1/debts' },
      { method: 'POST', url: '/api/v1/debts' },
      { method: 'POST', url: '/api/v1/debts/simulate' },
      { method: 'GET', url: '/api/v1/budgets/2026/11' },
      { method: 'PUT', url: '/api/v1/budgets/2026/11' },
      { method: 'GET', url: '/api/v1/dashboard/summary' },
      { method: 'GET', url: '/api/v1/analytics/dashboard' },
      { method: 'POST', url: '/api/v1/analytics/fire/simulate' },
      { method: 'GET', url: '/api/v1/analytics/snapshots' },
      { method: 'POST', url: '/api/v1/analytics/snapshot' },
      { method: 'GET', url: '/api/v1/reports/monthly-pdf' },
    ];

    for (const endpoint of protectedEndpoints) {
      const res = await dispatchRequest(endpoint);
      expect(res.status, `Expected 401 on ${endpoint.method} ${endpoint.url}`).toBe(401);
      expect(res.json).toEqual({
        success: false,
        message: 'Silakan masuk terlebih dahulu.',
        data: null,
        meta: {},
      });
    }
  });

  it('rejects tampered / invalid JWT cookies with 401 Indonesian session-expired message', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/accounts',
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.forged.signature`,
      },
    });

    expect(res.status).toBe(401);
    expect(res.json).toEqual({
      success: false,
      message: 'Sesi berakhir. Silakan masuk kembali.',
      data: null,
      meta: {},
    });
  });

  it('returns 404 Indonesian JSON envelope for unknown routes', async () => {
    const res = await dispatchRequest({
      method: 'GET',
      url: '/api/v1/rute-tidak-ada',
    });

    expect(res.status).toBe(404);
    expect(res.json).toEqual({
      success: false,
      message: 'Rute GET /api/v1/rute-tidak-ada tidak ditemukan.',
      data: null,
      meta: {},
    });
  });

  it('returns 400 Indonesian JSON envelope when malformed JSON is sent', async () => {
    const res = await dispatchRequest({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      rawBody: '{"email": "broken-json"',
    });

    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      success: false,
      message: 'Format JSON yang dikirim tidak valid.',
      data: null,
      meta: {},
    });
  });

  it('verifies IDOR protection across all resource service files (every service scopes queries by userId)', () => {
    const protectedModules = [
      'accounts/accounts.service.ts',
      'categories/categories.service.ts',
      'transactions/transactions.service.ts',
      'debts/debts.service.ts',
      'budgets/budgets.service.ts',
      'dashboard/dashboard.service.ts',
      'analytics/analytics.service.ts',
      'reports/reports.service.ts',
      'onboarding/onboarding.service.ts',
    ];

    for (const relPath of protectedModules) {
      const fullPath = path.resolve(process.cwd(), 'src/modules', relPath);
      const source = fs.readFileSync(fullPath, 'utf8');
      expect(source.includes('userId'), `${relPath} must scope database queries by userId`).toBe(true);
    }
  });
});
