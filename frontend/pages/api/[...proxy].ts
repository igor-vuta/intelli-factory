// Catch-all proxy: forwards /api/* to FastAPI, preserving Set-Cookie.
import type { NextApiRequest, NextApiResponse } from 'next';

export const maxDuration = 60;

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:8000/api';

export const config = {
  api: {
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

  // only buffer body for methods that carry one (GET/HEAD/DELETE streams never end on Vercel)
  const METHOD_HAS_BODY = new Set(['POST', 'PUT', 'PATCH']);
  const chunks: Buffer[] = [];
  if (METHOD_HAS_BODY.has(req.method ?? '')) {
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

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

  upstream.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk === 'transfer-encoding' || lk === 'connection') return;
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
