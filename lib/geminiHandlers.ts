import { GoogleGenAI, Type } from '@google/genai';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export const getModel = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';

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

function validateRequestBody(body: any): Record<string, any> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a valid JSON object.');
  }
  return body;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 55000, errorMsg = 'Gemini API request timed out'): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new HttpError(504, errorMsg));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (err: any) {
    if (err instanceof HttpError) throw err;
    if (err?.status === 404 || err?.statusCode === 404) {
      throw new HttpError(404, `Gemini model '${getModel()}' is unavailable or not found. Please verify GEMINI_MODEL in environment variables.`);
    }
    throw err;
  } finally {
    clearTimeout(timer!);
  }
}

function parseJsonSafe<T = any>(text: string | undefined | null, fallbackMsg = 'Failed to parse AI response'): T {
  if (!text) {
    throw new HttpError(502, fallbackMsg);
  }
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\n?([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    const firstBrace = cleaned.search(/[\{\[]/);
    const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();
    }
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
export async function smartSearch(rawBody: any) {
  const body = validateRequestBody(rawBody);
  const ai = getAiClient();
  const { query, availableCategories } = body;

  if (!query || typeof query !== 'string') {
    throw new HttpError(400, 'Query string is required.');
  }

  const trimmedQuery = query.slice(0, 500);
  const categoriesList = Array.isArray(availableCategories) ? availableCategories.slice(0, 20).map(c => String(c).slice(0, 50)) : [];

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
    55000,
    'Smart search timed out'
  );

  return parseJsonSafe(response.text, 'Smart Search returned an invalid response');
}

// 2. Restock Advisor
export async function restockAdvisor(rawBody: any) {
  const body = validateRequestBody(rawBody);
  const ai = getAiClient();
  const { itemsSummary } = body;

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
    55000,
    'Restock advisor timed out'
  );

  const parsed = parseJsonSafe<any>(response.text, 'Restock Advisor returned an invalid response');
  if (!Array.isArray(parsed.recommendations)) {
    parsed.recommendations = [];
  }
  return parsed;
}

// 3. Item Assistant
export async function itemAssistant(rawBody: any) {
  const body = validateRequestBody(rawBody);
  const ai = getAiClient();
  const { itemName, existingCategories } = body;

  if (!itemName || typeof itemName !== 'string') {
    throw new HttpError(400, 'itemName is required.');
  }

  const trimmedItemName = itemName.slice(0, 300);

  const prompt = `You are a stationery catalog assistant.
Based on the stationery item name "${trimmedItemName}", determine the most appropriate category, whether it is Consumable or Durable, a sensible reorder level or warranty period, and realistic Indian market unit price in INR.
Existing categories to prefer: ${(Array.isArray(existingCategories) ? existingCategories : []).slice(0, 20).map(c => String(c).slice(0, 50)).join(', ')}.`;

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
    55000,
    'Item assistant timed out'
  );

  return parseJsonSafe(response.text, 'Item Assistant returned an invalid response');
}

// 4. DB Assistant
export async function dbAssistant(rawBody: any) {
  const body = validateRequestBody(rawBody);
  const ai = getAiClient();
  const { message, contextType, sqlToExplain, dataSnapshot } = body;

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
    55000,
    'Database assistant timed out'
  );

  return { answer: response.text || '' };
}

function stripSqlCommentsAndLiterals(sql: string): string {
  // Strip block comments /* ... */
  let s = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Strip line comments -- ...
  s = s.replace(/--.*$/gm, ' ');
  // Strip single-quoted string literals
  s = s.replace(/'(?:''|[^'])*'/g, "''");
  // Strip double-quoted string literals
  s = s.replace(/"(?:""|[^"])*"/g, '""');
  return s;
}

// 5. Ask Your Data (Natural Language to SQL)
export async function askData(rawBody: any) {
  const body = validateRequestBody(rawBody);
  const ai = getAiClient();
  const { question, schemaDdl } = body;

  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new HttpError(400, 'question string is required.');
  }

  const trimmedQuestion = question.slice(0, 600);
  const ddlContext = typeof schemaDdl === 'string' ? schemaDdl.slice(0, 15000) : '';

  const prompt = `You are an expert SQLite translator for "ClayStock" DBMS.
Given the 21-table SQLite relational schema below and a user question, generate a single read-only SQL query (SELECT or WITH).
DO NOT use PRAGMA, ATTACH, INSERT, UPDATE, DELETE, DROP, or ALTER.
Always include LIMIT 200 if no lower limit is specified.
Remember:
- StockQty is NEVER stored in tables; always query view V_CURRENT_STOCK or aggregate (SUM(SUPPLIES.Quantity) - SUM(ISSUED_TO.Quantity)).
- V_CURRENT_STOCK has columns: ItemID, ItemName, Category, UnitPrice, TotalPurchased, TotalIssued, StockQty, ReorderLevel, WarrantyPeriod, Status, ItemType.
- V_DEPT_CONSUMPTION has columns: DeptID, DeptName, TotalIssueEvents, TotalQuantityIssued, TotalIssuedValue.
- V_STOCK_LEDGER has columns: Ref, ItemID, TxnDate, TxnType, Qty, Value, PartyID, RunningBalance.

Schema DDL summary:
${ddlContext}

User Question: "${trimmedQuestion}"

Return valid JSON with properties:
- sql: string (single read-only SQLite query)
- explanation: string (plain language explanation of the query logic)
- confidence: number (0.0 to 1.0)`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: getModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sql: { type: Type.STRING },
            explanation: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          },
          required: ['sql', 'explanation', 'confidence']
        }
      }
    }),
    25000,
    'Ask Your Data timed out'
  );

  const parsed = parseJsonSafe(response.text, 'Ask Your Data returned invalid response');

  // Strict server-side validation
  let sql = (parsed.sql || '').trim();
  if (sql.endsWith(';')) sql = sql.slice(0, -1).trim();

  // Strip comments and string literals to test SQL syntax tokens safely
  const stripped = stripSqlCommentsAndLiterals(sql).trim();

  // Validate single statement & read-only
  if (!/^(SELECT|WITH)\b/i.test(stripped)) {
    throw new HttpError(400, 'Security violation: Generated SQL must begin with SELECT or WITH.');
  }
  if (stripped.includes(';')) {
    throw new HttpError(400, 'Security violation: Multiple SQL statements detected.');
  }
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|PRAGMA|ATTACH|DETACH|VACUUM|REPLACE|CREATE|TRUNCATE|EXEC|EXECUTE)\b/i.test(stripped)) {
    throw new HttpError(400, 'Security violation: Mutating keywords detected in read-only query.');
  }

  // Enforce LIMIT 200 if not present
  if (!/\bLIMIT\s+\d+/i.test(sql)) {
    sql += ' LIMIT 200';
  }

  parsed.sql = sql;
  return parsed;
}

// 6. Explain SQL & Plan
export async function explainSql(rawBody: any) {
  const body = validateRequestBody(rawBody);
  const ai = getAiClient();
  const { sql, plan } = body;

  if (!sql || typeof sql !== 'string') {
    throw new HttpError(400, 'sql string is required.');
  }

  const prompt = `You are a DBMS professor explaining a SQL query and its SQLite execution plan.
SQL Query:
\`\`\`sql
${sql.slice(0, 2000)}
\`\`\`

Execution Plan (EXPLAIN QUERY PLAN):
${JSON.stringify(plan || [], null, 2).slice(0, 3000)}

Provide a concise academic explanation covering:
1. Core logic and relational algebra operations.
2. Index utilization (SCAN vs SEARCH USING INDEX, covering index vs full table scan).
3. Potential query optimizations.`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: getModel(),
      contents: prompt
    }),
    25000,
    'Explain SQL timed out'
  );

  return { explanation: response.text || '' };
}

// 7. Schema Reviewer
export async function schemaReviewer(rawBody: any) {
  const body = validateRequestBody(rawBody);
  const ai = getAiClient();
  const { ddl, fds } = body;

  const prompt = `You are a Senior Relational Database Architect and academic evaluator.
Review this 21-table normalized SQLite schema and its functional dependencies:
${typeof ddl === 'string' ? ddl.slice(0, 10000) : ''}
Functional Dependencies:
${typeof fds === 'string' ? fds.slice(0, 8000) : ''}

Evaluate:
1. Normalization compliance (1NF, 2NF, 3NF, BCNF).
2. Key integrity constraints and surrogate key patterns.
3. Suggest 2-3 advanced optimizations or index improvements.

Return JSON:
- rating: number (1-10)
- normalizationAssessment: string
- keyStrengths: string[]
- suggestions: string[]`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: getModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rating: { type: Type.NUMBER },
            normalizationAssessment: { type: Type.STRING },
            keyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['rating', 'normalizationAssessment', 'keyStrengths', 'suggestions']
        }
      }
    }),
    25000,
    'Schema Reviewer timed out'
  );

  return parseJsonSafe(response.text, 'Schema Reviewer returned invalid response');
}

// 8. Forecast & Anomaly Narrator
export async function forecastNarrator(rawBody: any) {
  const body = validateRequestBody(rawBody);
  const ai = getAiClient();
  const { forecastSummary, anomalies } = body;

  const prompt = `You are an inventory supply chain analyst for an engineering institute.
Narrate the following SQL-computed demand forecast and flagged anomalies:
Forecast metrics:
${JSON.stringify(forecastSummary || [], null, 2).slice(0, 4000)}
Anomalies (|z-score| > 2.5):
${JSON.stringify(anomalies || [], null, 2).slice(0, 4000)}

CRITICAL: DO NOT invent numbers. Use ONLY the figures provided above.
Provide:
1. A 2-sentence executive summary.
2. 3 bullet recommendations for reorder prioritization.
3. Plain-language explanation of likely causes for the anomalies (e.g. semester exams, recruitment drive, bulk dispatch).`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: getModel(),
      contents: prompt
    }),
    25000,
    'Forecast Narrator timed out'
  );

  return { narrative: response.text || '' };
}

// 9. Viva Coach (15 Viva Cards & Strict Examiner Chat)
export async function vivaCoach(rawBody: any) {
  const body = validateRequestBody(rawBody);
  const ai = getAiClient();
  const { mode, question, history, topic } = body;

  if (mode === 'CARDS') {
    const prompt = `You are a tough university DBMS examiner preparing 15 viva voce questions for a project defense on "ClayStock: 3NF Relational Stationery Management System".
Create 15 diverse viva questions with authoritative model answers covering:
- Normalization (1NF, 2NF, 3NF, BCNF, transitive dependencies)
- EER Specialization (Consumable vs Durable, Disjoint 'd', Total participation)
- Weak Entities & Identifying Relationships (STOCK_BATCH, REQUISITION_LINE)
- Derived Attributes (why StockQty is never stored as a column)
- Triggers (integrity enforcement, INSUFFICIENT_STOCK, audit logs)
- Transactions & ACID (Atomicity with SAVEPOINT in multi-line fulfillment, Lost update anomaly)
- Indexes & Query Optimization (B-Tree, partial index, EXPLAIN QUERY PLAN)
- Relational Algebra vs SQL

Return JSON array of 15 objects:
- id: number
- topic: string
- question: string
- answer: string
- difficulty: "Easy" | "Medium" | "Hard"`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: getModel(),
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    topic: { type: Type.STRING },
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING },
                    difficulty: { type: Type.STRING }
                  },
                  required: ['id', 'topic', 'question', 'answer', 'difficulty']
                }
              }
            },
            required: ['cards']
          }
        }
      }),
      35000,
      'Viva Coach timed out'
    );

    return parseJsonSafe(response.text, 'Viva Coach returned invalid cards');
  }

  // Examiner Chat Mode
  const userMsg = typeof question === 'string' ? question.slice(0, 500) : '';
  const historyList = Array.isArray(history) ? history.slice(-6) : [];

  let historyContext = historyList.map((h: any) => `${h.role === 'user' ? 'Student' : 'Examiner'}: ${String(h.text || '').slice(0, 500)}`).join('\n');

  const prompt = `You are a strict, probing university DBMS Professor conducting a live viva defense for an engineering student presenting "ClayStock" (a 21-table 3NF Stationery Relational Database).
Active topic: ${typeof topic === 'string' ? topic.slice(0, 100) : 'General Relational Database Design'}

Conversation History:
${historyContext}

Student's Answer: "${userMsg}"

Critique their answer concisely:
1. Grade it: Accurate, Partially Correct, or Incomplete/Flawed.
2. Give a direct, sharp 1-2 sentence correction or refinement.
3. Ask a probing follow-up question related to triggers, normalization, index structures, or transaction isolation.
Keep your response professional, rigorous, and under 150 words.`;

  const response = await withTimeout(
    ai.models.generateContent({
      model: getModel(),
      contents: prompt
    }),
    25000,
    'Examiner Chat timed out'
  );

  return { reply: response.text || '' };
}
