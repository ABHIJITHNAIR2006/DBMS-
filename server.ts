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
  HttpError,
  getModel
} from './lib/geminiHandlers';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Port 3000 is required by AI Studio environment and nginx reverse proxy
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : null;
const PORT = cliPort || (process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 3000);

// Size-limit req.body to 100kb
app.use(express.json({ limit: '100kb' }));

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
