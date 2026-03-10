/**
 * NextJS API Route - Proxy to FastAPI Backend
 *
 * This route acts as a bridge between the frontend and the Python FastAPI backend,
 * handling CORS and request/response transformation if needed.
 *
 * @author Igor Vuta (P2773339)
 * @date February 2026
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const backendApiBaseUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const response = await fetch(`${backendApiBaseUrl}/api/automations/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch {
      res.status(500).json({
        status: 'error',
        error_code: 'BACKEND_ERROR',
        message: 'Failed to reach backend service',
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
