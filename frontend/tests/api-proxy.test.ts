import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { Readable } from 'node:stream';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/[...proxy]';

function request(method = 'GET', body?: string) {
  return Object.assign(Readable.from(body ? [Buffer.from(body)] : []), {
    method,
    query: { proxy: ['auth', 'me'] },
    url: '/api/auth/me?locale=en',
    headers: { host: 'intelli-factory.duckdns.org', cookie: 'if_session=test' },
  }) as unknown as NextApiRequest;
}

function response() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
    end: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

const fetchMock = jest.fn<typeof fetch>();
const originalFetch = global.fetch;
const originalBackend = process.env.BACKEND_API_URL;

beforeEach(() => {
  global.fetch = fetchMock;
  process.env.BACKEND_API_URL = 'http://backend:8000/api';
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalBackend === undefined) delete process.env.BACKEND_API_URL;
  else process.env.BACKEND_API_URL = originalBackend;
});

test('uses the private backend URL and forwards the query and session cookie', async () => {
  fetchMock.mockResolvedValue(new Response('{"status":"ok"}', { status: 200 }));
  const res = response();
  await handler(request(), res as unknown as NextApiResponse);
  expect(fetchMock).toHaveBeenCalledWith(
    'http://backend:8000/api/auth/me?locale=en',
    expect.objectContaining({
      method: 'GET',
      headers: { cookie: 'if_session=test' },
    })
  );
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.end).toHaveBeenCalledWith(Buffer.from('{"status":"ok"}'));
});

test('forwards a JSON body without hop-by-hop headers', async () => {
  fetchMock.mockResolvedValue(new Response('{}'));
  const req = request('POST', '{"email":"test@example.com"}');
  req.headers['content-type'] = 'application/json';
  req.headers['transfer-encoding'] = 'chunked';
  req.headers.connection = 'keep-alive';
  await handler(req, response() as unknown as NextApiResponse);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: Buffer.from('{"email":"test@example.com"}'),
      headers: { cookie: 'if_session=test', 'content-type': 'application/json' },
    })
  );
});

test('preserves separate Set-Cookie headers, including cookie expiry commas', async () => {
  const headers = new Headers();
  const cookies = [
    'if_session=abc; Path=/; Secure; HttpOnly',
    'old_session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/',
  ];
  cookies.forEach((cookie) => headers.append('set-cookie', cookie));
  fetchMock.mockResolvedValue(new Response('{}', { headers }));
  const res = response();
  await handler(request(), res as unknown as NextApiResponse);
  expect(res.setHeader).toHaveBeenCalledWith('set-cookie', cookies);
});

test('preserves backend authentication errors', async () => {
  fetchMock.mockResolvedValue(new Response('{"detail":"Not authenticated"}', { status: 401 }));
  const res = response();
  await handler(request(), res as unknown as NextApiResponse);
  expect(res.status).toHaveBeenCalledWith(401);
});

test('returns 502 when the backend cannot be reached', async () => {
  fetchMock.mockRejectedValue(new TypeError('fetch failed'));
  const res = response();
  await handler(request(), res as unknown as NextApiResponse);
  expect(res.status).toHaveBeenCalledWith(502);
  expect(res.json).toHaveBeenCalledWith({ detail: 'Backend unavailable' });
});

test('returns 504 for an upstream timeout', async () => {
  const error = new Error('timeout');
  error.name = 'AbortError';
  fetchMock.mockRejectedValue(error);
  const res = response();
  await handler(request(), res as unknown as NextApiResponse);
  expect(res.status).toHaveBeenCalledWith(504);
});
