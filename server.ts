import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const apiKey = process.env.GEMINI_API_KEY;

// 1d: Define ONE constant for the recommended Gemini Flash model in AI Studio Build
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// 9b: Size-limit req.body to 100kb
app.use(express.json({ limit: '100kb' }));

// Helper to run promises with a timeout
function withTimeout<T>(promise: Promise<T>, timeoutMs = 20000, errorMsg = 'Gemini API request timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
  ]);
}

// Initialize Google GenAI client if API key is provided
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// 0. API Key Status endpoint
app.get('/api/gemini/status', (_req: Request, res: Response) => {
  res.json({
    available: !!apiKey,
    model: GEMINI_MODEL
  });
});

// 1. AI Smart Search: Natural Language query to Structured Filters
app.post('/api/gemini/smart-search', async (req: Request, res: Response) => {
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const { query, availableCategories } = req.body || {};
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query string is required.' });
  }

  // 9b: Trim long query to 500 characters
  const trimmedQuery = query.slice(0, 500);
  const categoriesList = Array.isArray(availableCategories) ? availableCategories.slice(0, 20) : [];

  try {
    const prompt = `You are an expert SQL search compiler for a stationery DBMS.
Translate the user's natural language search query into structured search filters.
Available categories: ${categoriesList.join(', ')}.

User query: "${trimmedQuery}"

Return a valid JSON object matching the schema.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categories: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Categories mentioned or implied by the search query'
              },
              type: {
                type: Type.STRING,
                description: '"Consumable", "Durable", or "All"'
              },
              status: {
                type: Type.STRING,
                description: '"In Stock", "Low Stock", "Out of Stock", or "All"'
              },
              maxPrice: {
                type: Type.NUMBER,
                description: 'Maximum unit price in INR if mentioned, else 0'
              },
              minPrice: {
                type: Type.NUMBER,
                description: 'Minimum unit price in INR if mentioned, else 0'
              },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Keywords to match against item names'
              },
              generatedSqlCondition: {
                type: Type.STRING,
                description: 'WHERE clause SQL string representing these filters'
              }
            },
            required: ['categories', 'type', 'status', 'keywords']
          }
        }
      }),
      20000,
      'Smart search timed out'
    );

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: unknown) {
    console.error('Smart search error:', err);
    const msg = err instanceof Error ? err.message : 'AI Smart Search failed to process the query.';
    res.status(500).json({ error: msg });
  }
});

// 2. AI Restock Advisor: Prioritized restock recommendation
app.post('/api/gemini/restock-advisor', async (req: Request, res: Response) => {
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const { itemsSummary } = req.body || {};
  if (!itemsSummary || !Array.isArray(itemsSummary)) {
    return res.status(400).json({ error: 'itemsSummary array is required.' });
  }

  const limitedSummary = itemsSummary.slice(0, 30);

  try {
    const prompt = `You are an inventory procurement advisor for an educational institution stationery store in India.
Analyze the following inventory items that are currently low in stock or out of stock:
${JSON.stringify(limitedSummary, null, 2)}

Provide prioritized restock recommendations with suggested order quantities, supplier suggestions, and practical justifications based on academic consumption patterns.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryOverview: {
                type: Type.STRING,
                description: 'Brief 1-2 sentence overall procurement situation'
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemId: { type: Type.STRING },
                    itemName: { type: Type.STRING },
                    urgency: { type: Type.STRING, description: 'CRITICAL, HIGH, or MODERATE' },
                    suggestedQuantity: { type: Type.INTEGER },
                    preferredSupplierId: { type: Type.STRING },
                    preferredSupplierName: { type: Type.STRING },
                    estimatedCostINR: { type: Type.NUMBER },
                    reason: { type: Type.STRING, description: 'One-line justification' }
                  },
                  required: ['itemId', 'itemName', 'urgency', 'suggestedQuantity', 'reason']
                }
              }
            },
            required: ['summaryOverview', 'recommendations']
          }
        }
      }),
      20000,
      'Restock advisor timed out'
    );

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: unknown) {
    console.error('Restock advisor error:', err);
    const msg = err instanceof Error ? err.message : 'AI Restock Advisor failed to generate recommendations.';
    res.status(500).json({ error: msg });
  }
});

// 3. AI Item Assistant: Suggest Category, Type, UnitPrice range, ReorderLevel/Warranty
app.post('/api/gemini/item-assistant', async (req: Request, res: Response) => {
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const { itemName, existingCategories } = req.body || {};
  if (!itemName || typeof itemName !== 'string') {
    return res.status(400).json({ error: 'itemName is required.' });
  }

  const trimmedItemName = itemName.slice(0, 300);

  try {
    const prompt = `You are a stationery catalog assistant.
Based on the stationery item name "${trimmedItemName}", determine the most appropriate category, whether it is Consumable or Durable, a sensible reorder level or warranty period, and realistic Indian market unit price in INR.
Existing categories to prefer: ${(Array.isArray(existingCategories) ? existingCategories : []).slice(0, 20).join(', ')}.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedCategory: { type: Type.STRING },
              itemType: { type: Type.STRING, description: '"Consumable" or "Durable"' },
              unitPrice: { type: Type.NUMBER, description: 'Typical price in INR' },
              reorderLevel: { type: Type.INTEGER, description: 'If Consumable, reorder threshold units' },
              warrantyPeriod: { type: Type.INTEGER, description: 'If Durable, warranty in months' },
              rationale: { type: Type.STRING }
            },
            required: ['suggestedCategory', 'itemType', 'unitPrice', 'rationale']
          }
        }
      }),
      20000,
      'Item assistant timed out'
    );

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: unknown) {
    console.error('Item assistant error:', err);
    const msg = err instanceof Error ? err.message : 'AI Item Assistant failed.';
    res.status(500).json({ error: msg });
  }
});

// 4. AI Database Assistant: DBMS Q&A and SQL Explanations
app.post('/api/gemini/db-assistant', async (req: Request, res: Response) => {
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const { message, contextType, sqlToExplain, dataSnapshot } = req.body || {};
  const trimmedMessage = typeof message === 'string' ? message.slice(0, 500) : '';

  try {
    let prompt = `You are the specialized AI DBMS Tutor and Stationery System Assistant for "ClayStock", an academic mini-project demonstrating a 3NF Relational Database Management System.
Database Schema Information:
1. ITEM (ItemID PK, ItemName, Category, UnitPrice)
2. SUPPLIER (SupplierID PK, SupplierName, Street, Pincode FK -> PINCODE_CITY)
3. PINCODE_CITY (Pincode PK, City) - 3NF split removing transitive dependency Pincode -> City
4. SUPPLIER_CONTACT (SupplierID FK, ContactNo) PK = (SupplierID, ContactNo) - multivalued contact attribute
5. DEPARTMENT (DeptID PK, DeptName)
6. STOCK_BATCH (ItemID FK, BatchNo, ExpiryDate) PK = (ItemID, BatchNo) - weak entity with identifying relationship HAS_BATCH to ITEM
7. CONSUMABLE_ITEM (ItemID PK/FK, ReorderLevel) - EER disjoint specialization
8. DURABLE_ITEM (ItemID PK/FK, WarrantyPeriod) - EER disjoint specialization
9. SUPPLIES (PurchaseID PK, ItemID FK, SupplierID FK, PurchaseDate, Quantity, Cost) - surrogate key
10. ISSUED_TO (IssueID PK, ItemID FK, DeptID FK, IssueDate, Quantity) - surrogate key
Rules: StockQty is a DERIVED attribute computed as SUM(SUPPLIES.Quantity) - SUM(ISSUED_TO.Quantity).

Current data summary snapshot:
${JSON.stringify(dataSnapshot || {}, null, 2)}
`;

    if (contextType === 'EXPLAIN_SQL' && typeof sqlToExplain === 'string') {
      prompt += `\nPlease explain the following SQL query clearly for an academic DBMS viva:
Query:
\`\`\`sql
${sqlToExplain.slice(0, 1000)}
\`\`\`
Explain: 
1. What it does in plain language.
2. Relational algebra operations used (e.g. projection, selection, theta join, group by aggregate).
3. Why this design choice was made (e.g. 3NF, derived attribute, surrogate key).`;
    } else {
      prompt += `\nUser Question: "${trimmedMessage}"\nProvide a friendly, accurate, and concise answer (under 180 words) suitable for an engineering student or viva examiner. Ground your answer strictly in the schema and data provided.`;
    }

    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt
      }),
      20000,
      'Database assistant timed out'
    );

    res.json({ answer: response.text });
  } catch (err: unknown) {
    console.error('DB assistant error:', err);
    const msg = err instanceof Error ? err.message : 'AI Database Assistant encountered an issue.';
    res.status(500).json({ error: msg });
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
    console.log(`ClayStock Server listening on http://0.0.0.0:${PORT} [Model: ${GEMINI_MODEL}]`);
  });
}

startServer();
