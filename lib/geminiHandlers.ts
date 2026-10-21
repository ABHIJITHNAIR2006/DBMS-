import { GoogleGenAI, Type } from '@google/genai';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export const getModel = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new HttpError(
      503,
      'GEMINI_API_KEY is not configured. Add it in Vercel -> Settings -> Environment Variables and redeploy.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 25000, errorMsg = 'Gemini API request timed out'): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new HttpError(504, errorMsg));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

function parseJsonSafe<T = any>(text: string | undefined | null, fallbackMsg = 'Failed to parse AI response'): T {
  if (!text) {
    throw new HttpError(502, fallbackMsg);
  }
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned.trim());
  } catch {
    throw new HttpError(502, `${fallbackMsg}: Invalid JSON received from model.`);
  }
}

// 0. Status
export function getStatus(): { available: boolean; model: string } {
  const apiKey = process.env.GEMINI_API_KEY;
  const isAvailable = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
  return {
    available: isAvailable,
    model: getModel()
  };
}

// 1. Smart Search
export async function smartSearch(body: any) {
  const ai = getAiClient();
  const { query, availableCategories } = body || {};

  if (!query || typeof query !== 'string') {
    throw new HttpError(400, 'Query string is required.');
  }

  const trimmedQuery = query.slice(0, 500);
  const categoriesList = Array.isArray(availableCategories) ? availableCategories.slice(0, 20) : [];

  const prompt = `You are an expert SQL search compiler for a stationery DBMS.
Translate the user's natural language search query into structured search filters.
Available categories: ${categoriesList.join(', ')}.

User query: "${trimmedQuery}"

Return a valid JSON object matching the schema.`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: getModel(),
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
    25000,
    'Smart search timed out'
  );

  return parseJsonSafe(response.text, 'Smart Search returned an invalid response');
}

// 2. Restock Advisor
export async function restockAdvisor(body: any) {
  const ai = getAiClient();
  const { itemsSummary } = body || {};

  if (!itemsSummary || !Array.isArray(itemsSummary)) {
    throw new HttpError(400, 'itemsSummary array is required.');
  }

  const limitedSummary = itemsSummary.slice(0, 30);

  const prompt = `You are an inventory procurement advisor for an educational institution stationery store in India.
Analyze the following inventory items that are currently low in stock or out of stock:
${JSON.stringify(limitedSummary, null, 2)}

Provide prioritized restock recommendations with suggested order quantities, supplier suggestions, and practical justifications based on academic consumption patterns.`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: getModel(),
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
    25000,
    'Restock advisor timed out'
  );

  const parsed = parseJsonSafe<any>(response.text, 'Restock Advisor returned an invalid response');
  if (!Array.isArray(parsed.recommendations)) {
    parsed.recommendations = [];
  }
  return parsed;
}

// 3. Item Assistant
export async function itemAssistant(body: any) {
  const ai = getAiClient();
  const { itemName, existingCategories } = body || {};

  if (!itemName || typeof itemName !== 'string') {
    throw new HttpError(400, 'itemName is required.');
  }

  const trimmedItemName = itemName.slice(0, 300);

  const prompt = `You are a stationery catalog assistant.
Based on the stationery item name "${trimmedItemName}", determine the most appropriate category, whether it is Consumable or Durable, a sensible reorder level or warranty period, and realistic Indian market unit price in INR.
Existing categories to prefer: ${(Array.isArray(existingCategories) ? existingCategories : []).slice(0, 20).join(', ')}.`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: getModel(),
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
    25000,
    'Item assistant timed out'
  );

  return parseJsonSafe(response.text, 'Item Assistant returned an invalid response');
}

// 4. DB Assistant
export async function dbAssistant(body: any) {
  const ai = getAiClient();
  const { message, contextType, sqlToExplain, dataSnapshot } = body || {};

  if (contextType !== 'EXPLAIN_SQL' && (!message || typeof message !== 'string' || !message.trim())) {
    throw new HttpError(400, 'A non-empty message is required.');
  }

  const trimmedMessage = typeof message === 'string' ? message.slice(0, 500) : '';
  const trimmedSql = typeof sqlToExplain === 'string' ? sqlToExplain.slice(0, 1000) : '';
  const snapshotStr = JSON.stringify(dataSnapshot || {}, null, 2).slice(0, 20000);

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
${snapshotStr}
`;

  if (contextType === 'EXPLAIN_SQL' && trimmedSql) {
    prompt += `\nPlease explain the following SQL query clearly for an academic DBMS viva:
Query:
\`\`\`sql
${trimmedSql}
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
      model: getModel(),
      contents: prompt
    }),
    25000,
    'Database assistant timed out'
  );

  return { answer: response.text || '' };
}
