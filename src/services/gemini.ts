/**
 * Client-side Gemini AI integration service
 * Calls secure backend endpoints defined in server.ts
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
    const res = await fetch('/api/gemini/smart-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, availableCategories })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Smart Search request failed.');
    }

    return await res.json();
  },

  // 2. Restock Advisor
  async getRestockRecommendations(itemsSummary: unknown[]): Promise<RestockAdvisorResult> {
    const res = await fetch('/api/gemini/restock-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemsSummary })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Restock Advisor request failed.');
    }

    return await res.json();
  },

  // 3. Item Assistant
  async suggestItemDetails(itemName: string, existingCategories: string[]): Promise<ItemAssistantResult> {
    const res = await fetch('/api/gemini/item-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName, existingCategories })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Item Assistant request failed.');
    }

    return await res.json();
  },

  // 4. Database Assistant & SQL Explainer
  async askDatabaseAssistant(payload: {
    message: string;
    contextType?: 'CHAT' | 'EXPLAIN_SQL';
    sqlToExplain?: string;
    dataSnapshot?: unknown;
  }): Promise<string> {
    const res = await fetch('/api/gemini/db-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Database Assistant request failed.');
    }

    const data = await res.json();
    return data.answer || 'No response generated.';
  }
};
