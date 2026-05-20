/**
 * Catch-all proxy — forwards every /api/* request to the FastAPI backend and
 * returns the full response including Set-Cookie headers.
 *
 * This runs as a Node.js serverless function on Vercel, giving us full control
 * over headers. The previous `next.config.js` rewrites approach was unreliable
 * because Vercel's Edge Network can strip Set-Cookie from external proxies.
 *
 * maxDuration is set to 60s so Render's free-tier cold start (up to ~50s)
 * doesn't cause Vercel to time out before the backend responds.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

export const maxDuration = 60; // seconds — Vercel Hobby plan maximum

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:8000/api';

export const config = {
  api: {
    // Disable body parsing so we can forward the raw body to the backend.
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const segments = req.query.proxy;
  const path = Array.isArray(segments) ? segments.join('/') : (segments ?? '');
  const qs = req.url?.split('?')[1] ?? '';
  const targetUrl = `${BACKEND}/${path}${qs ? `?${qs}` : ''}`;

  // Only read the body for methods that actually carry one.
  // Iterating over `req` for GET/HEAD/DELETE can hang on Vercel's Node.js
  // runtime because the IncomingMessage stream never emits 'end' for bodyless
  // requests, stalling the handler indefinitely before fetch() is reached.
  const METHOD_HAS_BODY = new Set(['POST', 'PUT', 'PATCH']);
  const chunks: Buffer[] = [];
  if (METHOD_HAS_BODY.has(req.method ?? '')) {
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  // Forward all incoming headers except `host` (must be the backend's host).
  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() === 'host') continue;
    if (value == null) continue;
    forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  let upstream: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    try {
      upstream = await fetch(targetUrl, {
        method: req.method ?? 'GET',
        headers: forwardHeaders,
        body: body && body.length > 0 ? body : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    res.status(isTimeout ? 504 : 502).json({
      detail: isTimeout ? 'Backend request timed out' : 'Backend unavailable',
    });
    return;
  }

  // Forward all response headers.  Set-Cookie in particular must reach the
  // browser so the session is stored on the frontend domain (same-origin).
  upstream.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    // Strip hop-by-hop headers that must not be forwarded.
    if (lk === 'transfer-encoding' || lk === 'connection') return;
    // Node.js 18 fetch auto-decompresses the body, so these would mismatch.
    if (lk === 'content-encoding' || lk === 'content-length') return;
    res.setHeader(key, value);
  });

  res.status(upstream.status);
  let buf: ArrayBuffer;
  try {
    buf = await upstream.arrayBuffer();
  } catch {
    res.status(502).json({ detail: 'Failed to read backend response' });
    return;
  }
  res.end(Buffer.from(buf));
}
