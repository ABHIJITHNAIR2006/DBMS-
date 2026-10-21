import type { IncomingMessage, ServerResponse } from 'http';
import { HttpError } from './geminiHandlers.js';

export type VercelReq = IncomingMessage & {
  body?: any;
  method?: string;
  query?: Record<string, string | string[]>;
};

export type VercelRes = ServerResponse & {
  status?: (code: number) => VercelRes;
  json?: (data: any) => void;
  send?: (data: any) => void;
  setHeader?: (name: string, value: string) => VercelRes | any;
};

export function replyJson(res: VercelRes, code: number, data: any) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
  }
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return (res as any).status(code).json(data);
  }
  res.statusCode = code;
  return res.end(JSON.stringify(data));
}

export function postHandler(fn: (body: any) => Promise<any>) {
  return async (req: VercelReq, res: VercelRes) => {
    try {
      if (req.method !== 'POST') {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Allow', 'POST');
        }
        return replyJson(res, 405, { error: 'Method Not Allowed' });
      }

      let body = req.body;
      if (body === undefined && typeof (req as any).on === 'function') {
        body = await new Promise((resolve) => {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => {
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch {
              resolve({});
            }
          });
          req.on('error', () => resolve({}));
        });
      } else if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return replyJson(res, 400, { error: 'Invalid JSON body' });
        }
      }

      const result = await fn(body || {});
      return replyJson(res, 200, result);
    } catch (err: any) {
      console.error(err);
      const status =
        err instanceof HttpError
          ? err.status
          : typeof err?.status === 'number'
          ? err.status
          : 500;
      const message = err?.message || 'Internal Server Error';
      return replyJson(res, status, { error: message });
    }
  };
}
