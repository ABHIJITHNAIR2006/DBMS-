/**
 * Client-side Gemini AI integration service
 * Calls secure backend endpoints defined in /api/gemini/* (Vercel functions & Express server)
 */

export interface SmartSearchFilterResult {
  categories: string[];
  type: string;
  status: string;
  maxPrice?: number;
  minPrice?: number;
  keywords: string[];
  generatedSqlCondition?: string;
}

export interface RestockAdvisorResult {
  summaryOverview: string;
  recommendations: Array<{
    itemId: string;
    itemName: string;
    urgency: 'CRITICAL' | 'HIGH' | 'MODERATE';
    suggestedQuantity: number;
    preferredSupplierId?: string;
    preferredSupplierName?: string;
    estimatedCostINR?: number;
    reason: string;
  }>;
}

export interface ItemAssistantResult {
  suggestedCategory: string;
  itemType: 'Consumable' | 'Durable';
  unitPrice: number;
  reorderLevel?: number;
  warrantyPeriod?: number;
  rationale: string;
}

async function postJson<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('Could not reach the AI server. Check your internet connection.');
  }

  if (!res.ok) {
    let serverMessage = '';
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') {
        serverMessage = data.error;
      }
    } catch {
      // unreadable JSON
    }

    if (serverMessage) {
      throw new Error(serverMessage);
    }
    if (res.status === 404) {
      throw new Error('AI endpoint not found. The /api functions are not deployed.');
    }
    throw new Error(`${fallbackError} (HTTP ${res.status})`);
  }

  try {
    return await res.json();
  } catch {
    throw new Error('Received unreadable response from the server.');
  }
}

export const geminiService = {
  // Check backend Gemini availability
  async checkStatus(): Promise<{ available: boolean; model: string }> {
    try {
      const res = await fetch('/api/gemini/status');
      if (!res.ok) return { available: false, model: 'unavailable' };
      return await res.json();
    } catch {
      return { available: false, model: 'offline' };
    }
  },

  // 1. Natural Language Smart Search
  async parseSmartSearch(query: string, availableCategories: string[]): Promise<SmartSearchFilterResult> {
    return postJson<SmartSearchFilterResult>(
      '/api/gemini/smart-search',
      { query, availableCategories },
      'Smart Search request failed.'
    );
  },

  // 2. Restock Advisor
  async getRestockRecommendations(itemsSummary: unknown[]): Promise<RestockAdvisorResult> {
    return postJson<RestockAdvisorResult>(
      '/api/gemini/restock-advisor',
      { itemsSummary },
      'Restock Advisor request failed.'
    );
  },

  // 3. Item Assistant
  async suggestItemDetails(itemName: string, existingCategories: string[]): Promise<ItemAssistantResult> {
    return postJson<ItemAssistantResult>(
      '/api/gemini/item-assistant',
      { itemName, existingCategories },
      'Item Assistant request failed.'
    );
  },

  // 4. Database Assistant & SQL Explainer
  async askDatabaseAssistant(payload: {
    message: string;
    contextType?: 'CHAT' | 'EXPLAIN_SQL';
    sqlToExplain?: string;
    dataSnapshot?: unknown;
  }): Promise<string> {
    const data = await postJson<{ answer: string }>(
      '/api/gemini/db-assistant',
      payload,
      'Database Assistant request failed.'
    );
    return data.answer || 'No response generated.';
  }
};
