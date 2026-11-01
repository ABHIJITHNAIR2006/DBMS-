import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getStatus,
  smartSearch,
  restockAdvisor,
  itemAssistant,
  dbAssistant,
  askData,
  explainSql,
  schemaReviewer,
  forecastNarrator,
  vivaCoach,
  HttpError,
  getModel
} from './lib/geminiHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
// Port 3000 is required by AI Studio environment and nginx reverse proxy
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : null;
const PORT = cliPort || (process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 3000);

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Size-limit req.body to 100kb
app.use(express.json({ limit: '100kb' }));

// In-memory per-IP rate limiter (20 req/min, 200 req/day per IP)
interface RateLimitBucket {
  minuteCount: number;
  minuteReset: number;
  dailyCount: number;
  dailyReset: number;
}
const ipRateLimits = new Map<string, RateLimitBucket>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number; error?: string } {
  const now = Date.now();
  let bucket = ipRateLimits.get(ip);
  if (!bucket) {
    bucket = {
      minuteCount: 0,
      minuteReset: now + 60000,
      dailyCount: 0,
      dailyReset: now + 86400000
    };
    ipRateLimits.set(ip, bucket);
  }

  if (now > bucket.minuteReset) {
    bucket.minuteCount = 0;
    bucket.minuteReset = now + 60000;
  }

  if (now > bucket.dailyReset) {
    bucket.dailyCount = 0;
    bucket.dailyReset = now + 86400000;
  }

  if (bucket.dailyCount >= 200) {
    return {
      allowed: false,
      retryAfter: Math.ceil((bucket.dailyReset - now) / 1000),
      error: 'Daily API budget cap reached (200 requests/day). Please try again tomorrow.'
    };
  }

  if (bucket.minuteCount >= 20) {
    return {
      allowed: false,
      retryAfter: Math.ceil((bucket.minuteReset - now) / 1000),
      error: 'Rate limit exceeded (20 requests/minute). Please slow down.'
    };
  }

  bucket.minuteCount++;
  bucket.dailyCount++;
  return { allowed: true };
}

// Rate limiting middleware for Gemini routes
app.use('/api/gemini', (req, res, next) => {
  if (req.path === '/status') {
    return next();
  }
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const check = checkRateLimit(ip);
  if (!check.allowed) {
    if (check.retryAfter) {
      res.setHeader('Retry-After', String(check.retryAfter));
    }
    return res.status(429).json({ error: check.error || 'Too Many Requests' });
  }
  next();
});

// 0. API Key Status endpoint
app.get('/api/gemini/status', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getStatus());
});

// 1. AI Smart Search: Natural Language query to Structured Filters
app.post('/api/gemini/smart-search', async (req: Request, res: Response) => {
  try {
    const result = await smartSearch(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : (typeof err?.status === 'number' ? err.status : 500);
    res.status(status).json({ error: err?.message || 'Smart search failed' });
  }
});

// 2. AI Restock Advisor: Prioritized restock recommendation
app.post('/api/gemini/restock-advisor', async (req: Request, res: Response) => {
  try {
    const result = await restockAdvisor(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : (typeof err?.status === 'number' ? err.status : 500);
    res.status(status).json({ error: err?.message || 'Restock advisor failed' });
  }
});

// 3. AI Item Assistant: Suggest Category, Type, UnitPrice range, ReorderLevel/Warranty
app.post('/api/gemini/item-assistant', async (req: Request, res: Response) => {
  try {
    const result = await itemAssistant(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : (typeof err?.status === 'number' ? err.status : 500);
    res.status(status).json({ error: err?.message || 'Item assistant failed' });
  }
});

// 4. AI Database Assistant: DBMS Q&A and SQL Explanations
app.post('/api/gemini/db-assistant', async (req: Request, res: Response) => {
  try {
    const result = await dbAssistant(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : (typeof err?.status === 'number' ? err.status : 500);
    res.status(status).json({ error: err?.message || 'Database assistant failed' });
  }
});

// 5. Ask Your Data: Natural language to SQL compiler
app.post('/api/gemini/ask-data', async (req: Request, res: Response) => {
  try {
    const result = await askData(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : (typeof err?.status === 'number' ? err.status : 500);
    res.status(status).json({ error: err?.message || 'Ask Your Data failed' });
  }
});

// 6. Explain SQL & Plan
app.post('/api/gemini/explain-sql', async (req: Request, res: Response) => {
  try {
    const result = await explainSql(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : (typeof err?.status === 'number' ? err.status : 500);
    res.status(status).json({ error: err?.message || 'Explain SQL failed' });
  }
});

// 7. Schema Reviewer
app.post('/api/gemini/schema-reviewer', async (req: Request, res: Response) => {
  try {
    const result = await schemaReviewer(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : (typeof err?.status === 'number' ? err.status : 500);
    res.status(status).json({ error: err?.message || 'Schema reviewer failed' });
  }
});

// 8. Forecast & Anomaly Narrator
app.post('/api/gemini/forecast-narrator', async (req: Request, res: Response) => {
  try {
    const result = await forecastNarrator(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : (typeof err?.status === 'number' ? err.status : 500);
    res.status(status).json({ error: err?.message || 'Forecast narrator failed' });
  }
});

// 9. Viva Coach (Cards & Examiner Chat)
app.post('/api/gemini/viva-coach', async (req: Request, res: Response) => {
  try {
    const result = await vivaCoach(req.body);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : (typeof err?.status === 'number' ? err.status : 500);
    res.status(status).json({ error: err?.message || 'Viva coach failed' });
  }
});

// Mount Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(path.resolve(__dirname, 'dist'), {
        maxAge: '1d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        }
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClayStock Server listening on http://0.0.0.0:${PORT} [Model: ${getModel()}]`);
  });
}

startServer();
