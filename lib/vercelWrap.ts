import type { IncomingMessage, ServerResponse } from 'http';
import { HttpError } from './geminiHandlers';

export type VercelReq = IncomingMessage & {
  body?: any;
  method?: string;
  query?: Record<string, string | string[]>;
};

export type VercelRes = ServerResponse & {
  status: (code: number) => VercelRes;
  json: (data: any) => void;
  send: (data: any) => void;
  setHeader: (name: string, value: string) => VercelRes | any;
};

export function postHandler(fn: (body: any) => Promise<any>) {
  return async (req: VercelReq, res: VercelRes) => {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    try {
      const result = await fn(body || {});
      return res.status(200).json(result);
    } catch (err: any) {
      const status = err instanceof HttpError ? err.status : (typeof err?.status === 'number' ? err.status : 500);
      const message = err?.message || 'Internal Server Error';
      return res.status(status).json({ error: message });
    }
  };
}
