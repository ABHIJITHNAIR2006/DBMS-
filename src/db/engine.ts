import {
  DatabaseState,
  Item,
  Supplier,
  PincodeCity,
  SupplierContact,
  Department,
  StockBatch,
  ConsumableItem,
  DurableItem,
  Supplies,
  IssuedTo,
  DerivedStockInfo
} from './types';
import { INITIAL_DATABASE } from './seed';
import { appendSqlLog } from './sqlLog';

const DB_STORAGE_KEY = 'claystock_relational_db_v1';

type DBListener = (state: DatabaseState) => void;
const listeners: Set<DBListener> = new Set();

// 2e: WeakMap cache for memoized derived stock
const derivedStockCache = new WeakMap<DatabaseState, DerivedStockInfo[]>();

// 1f: Helper to validate that ALL 10 tables exist as arrays
function isValidDatabaseState(data: unknown): data is DatabaseState {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const requiredTables = [
    'ITEM',
    'PINCODE_CITY',
    'SUPPLIER',
    'SUPPLIER_CONTACT',
    'DEPARTMENT',
    'STOCK_BATCH',
    'CONSUMABLE_ITEM',
    'DURABLE_ITEM',
    'SUPPLIES',
    'ISSUED_TO'
  ];
  return requiredTables.every(table => Array.isArray(d[table]));
}

// 2a: Copy-on-write draft helper (shallow copies table arrays)
function createDraft(source: DatabaseState): DatabaseState {
  return {
    ITEM: source.ITEM.slice(),
    PINCODE_CITY: source.PINCODE_CITY.slice(),
    SUPPLIER: source.SUPPLIER.slice(),
    SUPPLIER_CONTACT: source.SUPPLIER_CONTACT.slice(),
    DEPARTMENT: source.DEPARTMENT.slice(),
    STOCK_BATCH: source.STOCK_BATCH.slice(),
    CONSUMABLE_ITEM: source.CONSUMABLE_ITEM.slice(),
    DURABLE_ITEM: source.DURABLE_ITEM.slice(),
    SUPPLIES: source.SUPPLIES.slice(),
    ISSUED_TO: source.ISSUED_TO.slice()
  };
}

class RelationalEngine {
  private state: DatabaseState;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.state = this.loadState();
    this.runSelfAudit();
    this.setupAutoFlush();
  }

  private loadState(): DatabaseState {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DB_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidDatabaseState(parsed)) {
          return parsed;
        }
        console.warn('[DBMS] Corrupted storage schema detected; falling back to fresh seed data.');
      }
    } catch (e) {
      console.error('Failed reading database from localStorage, initializing fresh', e);
    }
    const fresh = structuredClone(INITIAL_DATABASE);
    this.saveStateToStorageImmediate(fresh);
    return fresh;
  }

  // 2b: Immediate flush helper
  public flushStorageNow(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveStateToStorageImmediate(this.state);
  }

  private saveStateToStorageImmediate(stateToSave: DatabaseState): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(stateToSave));
      }
    } catch (e) {
      console.error('Error persisting database to localStorage', e);
    }
  }

  // 2b: 400ms trailing debounce
  private scheduleSave(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveStateToStorageImmediate(this.state);
    }, 400);
  }

  private setupAutoFlush(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flushStorageNow());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushStorageNow();
        }
      });
    }
  }

  // 2a: Commit swaps this.state to the new top-level object and debounces persistence
  private commit(newState: DatabaseState) {
    this.state = newState;
    this.scheduleSave();
    listeners.forEach(fn => fn(this.state));
  }

  // 2a: Returns this.state directly (NO clone!)
  public getState(): DatabaseState {
    return this.state;
  }

  public subscribe(listener: DBListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  public resetToDefault() {
    const start = performance.now();
    const fresh = structuredClone(INITIAL_DATABASE);
    this.commit(fresh);
    this.flushStorageNow();

    appendSqlLog({
      type: 'DDL',
      status: 'SUCCESS',
      query: `-- TRUNCATE & RESTORE SEED DATA (All 10 Relational Tables)
TRUNCATE TABLE ISSUED_TO, SUPPLIES, STOCK_BATCH, DURABLE_ITEM, CONSUMABLE_ITEM, 
               SUPPLIER_CONTACT, SUPPLIER, PINCODE_CITY, DEPARTMENT, ITEM CASCADE;
-- Re-seeding 14 items, 5 suppliers, 6 departments, and initial ledger history...`,
      executionTimeMs: Math.round(performance.now() - start),
      rowsAffected: 85
    });
  }

  // --- DERIVED ATTRIBUTE COMPUTATION ---
  // StockQty is NEVER stored in the database. Computed as SUM(SUPPLIES.Qty) - SUM(ISSUED_TO.Qty)
  public getDerivedStock(itemId: string): number {
    const allStock = this.getAllDerivedStock();
    const found = allStock.find(s => s.item.ItemID === itemId);
    if (found) return found.currentStock;

    // Fallback if item not in catalog yet
    let purchased = 0;
    for (const s of this.state.SUPPLIES) {
      if (s.ItemID === itemId) purchased += s.Quantity;
    }
    let issued = 0;
    for (const i of this.state.ISSUED_TO) {
      if (i.ItemID === itemId) issued += i.Quantity;
    }
    return purchased - issued;
  }

  // 2d & 2e: Memoized derived stock using WeakMap cache and single-pass Maps
  public getAllDerivedStock(): DerivedStockInfo[] {
    const cached = derivedStockCache.get(this.state);
    if (cached) {
      return cached;
    }

    const startTime = performance.now();

    // 2d: Single pass Map aggregations O(N) instead of O(N * M)
    const purchasedByItem = new Map<string, number>();
    for (const s of this.state.SUPPLIES) {
      purchasedByItem.set(s.ItemID, (purchasedByItem.get(s.ItemID) || 0) + s.Quantity);
    }

    const issuedByItem = new Map<string, number>();
    for (const i of this.state.ISSUED_TO) {
      issuedByItem.set(i.ItemID, (issuedByItem.get(i.ItemID) || 0) + i.Quantity);
    }

    const consumableByItem = new Map<string, ConsumableItem>();
    for (const c of this.state.CONSUMABLE_ITEM) {
      consumableByItem.set(c.ItemID, c);
    }

    const durableByItem = new Map<string, DurableItem>();
    for (const d of this.state.DURABLE_ITEM) {
      durableByItem.set(d.ItemID, d);
    }

    const batchesByItem = new Map<string, StockBatch[]>();
    for (const b of this.state.STOCK_BATCH) {
      let list = batchesByItem.get(b.ItemID);
      if (!list) {
        list = [];
        batchesByItem.set(b.ItemID, list);
      }
      list.push(b);
    }

    const result: DerivedStockInfo[] = this.state.ITEM.map(item => {
      const consumable = consumableByItem.get(item.ItemID);
      const durable = durableByItem.get(item.ItemID);
      const purchased = purchasedByItem.get(item.ItemID) || 0;
      const issued = issuedByItem.get(item.ItemID) || 0;
      const currentStock = purchased - issued;
      const itemType = consumable ? 'Consumable' : 'Durable';

      let status: DerivedStockInfo['status'] = 'In Stock';
      if (itemType === 'Consumable') {
        const reorderLevel = consumable?.ReorderLevel ?? 0;
        if (currentStock <= 0) {
          status = 'Out of Stock';
        } else if (currentStock <= reorderLevel) {
          status = 'Low Stock';
        } else {
          status = 'In Stock';
        }
      } else {
        status = currentStock <= 0 ? 'Out of Stock' : 'Durable Stock';
      }

      const batches = batchesByItem.get(item.ItemID) || [];

      return {
        item,
        itemType,
        reorderLevel: consumable?.ReorderLevel,
        warrantyPeriod: durable?.WarrantyPeriod,
        totalPurchased: purchased,
        totalIssued: issued,
        currentStock,
        status,
        batches
      };
    });

    appendSqlLog({
      type: 'SELECT',
      status: 'SUCCESS',
      query: `-- Derived Attribute Query: Compute Current Stock via Group By and Aggregation
SELECT 
    i.ItemID, i.ItemName, i.Category, i.UnitPrice,
    COALESCE(p.TotalPurchased, 0) AS TotalPurchased,
    COALESCE(iss.TotalIssued, 0) AS TotalIssued,
    (COALESCE(p.TotalPurchased, 0) - COALESCE(iss.TotalIssued, 0)) AS CurrentStockQty,
    c.ReorderLevel,
    d.WarrantyPeriod
FROM ITEM i
LEFT JOIN (SELECT ItemID, SUM(Quantity) AS TotalPurchased FROM SUPPLIES GROUP BY ItemID) p ON i.ItemID = p.ItemID
LEFT JOIN (SELECT ItemID, SUM(Quantity) AS TotalIssued FROM ISSUED_TO GROUP BY ItemID) iss ON i.ItemID = iss.ItemID
LEFT JOIN CONSUMABLE_ITEM c ON i.ItemID = c.ItemID
LEFT JOIN DURABLE_ITEM d ON i.ItemID = d.ItemID;`,
      executionTimeMs: Math.round(performance.now() - startTime),
      rowsAffected: result.length
    });

    derivedStockCache.set(this.state, result);
    return result;
  }

  // --- ID GENERATORS ---
  public generateNextId(type: 'ITEM' | 'SUPPLIER' | 'DEPARTMENT' | 'PURCHASE' | 'ISSUE'): string {
    switch (type) {
      case 'ITEM': {
        const numbers = this.state.ITEM
          .map(i => parseInt(i.ItemID.replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n));
        const max = numbers.length > 0 ? Math.max(...numbers) : 100;
        return `I${max + 1}`;
      }
      case 'SUPPLIER': {
        const numbers = this.state.SUPPLIER
          .map(s => parseInt(s.SupplierID.replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n));
        const max = numbers.length > 0 ? Math.max(...numbers) : 0;
        return `S${String(max + 1).padStart(2, '0')}`;
      }
      case 'DEPARTMENT': {
        const numbers = this.state.DEPARTMENT
          .map(d => parseInt(d.DeptID.replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n));
        const max = numbers.length > 0 ? Math.max(...numbers) : 0;
        return `D${String(max + 1).padStart(2, '0')}`;
      }
      case 'PURCHASE': {
        const numbers = this.state.SUPPLIES
          .map(p => parseInt(p.PurchaseID.replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n));
        const max = numbers.length > 0 ? Math.max(...numbers) : 1000;
        return `PO${max + 1}`;
      }
      case 'ISSUE': {
        const numbers = this.state.ISSUED_TO
          .map(i => parseInt(i.IssueID.replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n));
        const max = numbers.length > 0 ? Math.max(...numbers) : 2000;
        return `IS${max + 1}`;
      }
    }
  }

  // 2a: TRANSACTION MANAGER WITH COPY-ON-WRITE DRAFT
  public executeTransaction<T>(
    operationName: string,
    action: (draft: DatabaseState) => { result: T; sqlStatements: string[] }
  ): T {
    const startTime = performance.now();
    // Copy-on-write draft: shallow copy table arrays, NO recursive JSON stringify/parse!
    const draft = createDraft(this.state);

    try {
      const { result, sqlStatements } = action(draft);
      this.commit(draft);

      appendSqlLog({
        type: 'TRANSACTION',
        status: 'SUCCESS',
        query: `BEGIN TRANSACTION; -- [${operationName}]\n${sqlStatements.join('\n')}\nCOMMIT;`,
        executionTimeMs: Math.round(performance.now() - startTime),
        rowsAffected: sqlStatements.length
      });

      return result;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      appendSqlLog({
        type: 'TRANSACTION',
        status: 'ERROR',
        query: `BEGIN TRANSACTION; -- [${operationName}]\n-- Transaction Aborted: ${errorMsg}\nROLLBACK;`,
        executionTimeMs: Math.round(performance.now() - startTime),
        errorMessage: errorMsg
      });
      throw err;
    }
  }

  // --- ITEM MANAGEMENT (Module 1) ---
  public addItem(payload: {
    itemName: string;
    category: string;
    unitPrice: number;
    type: 'Consumable' | 'Durable';
    reorderLevel?: number;
    warrantyPeriod?: number;
    batches?: { batchNo: string; expiryDate: string }[];
  }): Item {
    return this.executeTransaction('ADD_ITEM', draft => {
      if (!payload.itemName.trim()) throw new Error('Item name cannot be empty');
      if (payload.unitPrice < 0) throw new Error('Unit price cannot be negative');

      const newItemId = this.generateNextId('ITEM');
      const newItem: Item = {
        ItemID: newItemId,
        ItemName: payload.itemName.trim(),
        Category: payload.category.trim(),
        UnitPrice: Number(payload.unitPrice)
      };

      draft.ITEM.push(newItem);

      const sqlStatements: string[] = [
        `INSERT INTO ITEM (ItemID, ItemName, Category, UnitPrice) VALUES ('${newItem.ItemID}', '${newItem.ItemName.replace(/'/g, "''")}', '${newItem.Category}', ${newItem.UnitPrice});`
      ];

      // EER Disjoint specialization enforcement
      if (payload.type === 'Consumable') {
        const reorderLevel = payload.reorderLevel ?? 20;
        draft.CONSUMABLE_ITEM.push({ ItemID: newItemId, ReorderLevel: reorderLevel });
        sqlStatements.push(
          `INSERT INTO CONSUMABLE_ITEM (ItemID, ReorderLevel) VALUES ('${newItemId}', ${reorderLevel});`
        );
      } else {
        const warranty = payload.warrantyPeriod ?? 12;
        draft.DURABLE_ITEM.push({ ItemID: newItemId, WarrantyPeriod: warranty });
        sqlStatements.push(
          `INSERT INTO DURABLE_ITEM (ItemID, WarrantyPeriod) VALUES ('${newItemId}', ${warranty});`
        );
      }

      // Optional batches
      if (payload.batches && payload.batches.length > 0) {
        payload.batches.forEach(b => {
          if (b.batchNo && b.expiryDate) {
            draft.STOCK_BATCH.push({
              ItemID: newItemId,
              BatchNo: b.batchNo,
              ExpiryDate: b.expiryDate
            });
            sqlStatements.push(
              `INSERT INTO STOCK_BATCH (ItemID, BatchNo, ExpiryDate) VALUES ('${newItemId}', '${b.batchNo}', '${b.expiryDate}');`
            );
          }
        });
      }

      return { result: newItem, sqlStatements };
    });
  }

  public updateItem(payload: {
    itemId: string;
    itemName: string;
    category: string;
    unitPrice: number;
    type: 'Consumable' | 'Durable';
    reorderLevel?: number;
    warrantyPeriod?: number;
    batches?: { batchNo: string; expiryDate: string }[];
  }): Item {
    return this.executeTransaction('UPDATE_ITEM', draft => {
      const idx = draft.ITEM.findIndex(i => i.ItemID === payload.itemId);
      if (idx === -1) throw new Error(`Item ${payload.itemId} not found`);

      draft.ITEM[idx] = {
        ItemID: payload.itemId,
        ItemName: payload.itemName.trim(),
        Category: payload.category.trim(),
        UnitPrice: Number(payload.unitPrice)
      };

      const sqlStatements: string[] = [
        `UPDATE ITEM SET ItemName = '${payload.itemName.replace(/'/g, "''")}', Category = '${payload.category}', UnitPrice = ${payload.unitPrice} WHERE ItemID = '${payload.itemId}';`
      ];

      // Disjoint specialization switch: remove previous, insert new
      draft.CONSUMABLE_ITEM = draft.CONSUMABLE_ITEM.filter(c => c.ItemID !== payload.itemId);
      draft.DURABLE_ITEM = draft.DURABLE_ITEM.filter(d => d.ItemID !== payload.itemId);

      if (payload.type === 'Consumable') {
        const rLevel = payload.reorderLevel ?? 20;
        draft.CONSUMABLE_ITEM.push({ ItemID: payload.itemId, ReorderLevel: rLevel });
        sqlStatements.push(
          `DELETE FROM DURABLE_ITEM WHERE ItemID = '${payload.itemId}';\nINSERT INTO CONSUMABLE_ITEM (ItemID, ReorderLevel) VALUES ('${payload.itemId}', ${rLevel}) ON CONFLICT (ItemID) DO UPDATE SET ReorderLevel = ${rLevel};`
        );
      } else {
        const wPeriod = payload.warrantyPeriod ?? 12;
        draft.DURABLE_ITEM.push({ ItemID: payload.itemId, WarrantyPeriod: wPeriod });
        sqlStatements.push(
          `DELETE FROM CONSUMABLE_ITEM WHERE ItemID = '${payload.itemId}';\nINSERT INTO DURABLE_ITEM (ItemID, WarrantyPeriod) VALUES ('${payload.itemId}', ${wPeriod}) ON CONFLICT (ItemID) DO UPDATE SET WarrantyPeriod = ${wPeriod};`
        );
      }

      // Update batches if provided
      if (payload.batches !== undefined) {
        draft.STOCK_BATCH = draft.STOCK_BATCH.filter(b => b.ItemID !== payload.itemId);
        payload.batches.forEach(b => {
          if (b.batchNo && b.expiryDate) {
            draft.STOCK_BATCH.push({
              ItemID: payload.itemId,
              BatchNo: b.batchNo,
              ExpiryDate: b.expiryDate
            });
            sqlStatements.push(
              `INSERT INTO STOCK_BATCH (ItemID, BatchNo, ExpiryDate) VALUES ('${payload.itemId}', '${b.batchNo}', '${b.expiryDate}');`
            );
          }
        });
      }

      return { result: draft.ITEM[idx], sqlStatements };
    });
  }

  public deleteItem(itemId: string): void {
    return this.executeTransaction('DELETE_ITEM', draft => {
      // ON DELETE RESTRICT check
      const supplyCount = draft.SUPPLIES.filter(s => s.ItemID === itemId).length;
      if (supplyCount > 0) {
        throw new Error(
          `Cannot delete ITEM '${itemId}' because it is referenced by ${supplyCount} record(s) in SUPPLIES (ON DELETE RESTRICT). Delete purchase history first.`
        );
      }

      const issueCount = draft.ISSUED_TO.filter(i => i.ItemID === itemId).length;
      if (issueCount > 0) {
        throw new Error(
          `Cannot delete ITEM '${itemId}' because it is referenced by ${issueCount} record(s) in ISSUED_TO (ON DELETE RESTRICT). Delete issue history first.`
        );
      }

      // ON DELETE CASCADE for specialization and batches
      draft.CONSUMABLE_ITEM = draft.CONSUMABLE_ITEM.filter(c => c.ItemID !== itemId);
      draft.DURABLE_ITEM = draft.DURABLE_ITEM.filter(d => d.ItemID !== itemId);
      draft.STOCK_BATCH = draft.STOCK_BATCH.filter(b => b.ItemID !== itemId);
      draft.ITEM = draft.ITEM.filter(i => i.ItemID !== itemId);

      const sqlStatements: string[] = [
        `-- Referential integrity: cascading subclass and weak entity deletions`,
        `DELETE FROM CONSUMABLE_ITEM WHERE ItemID = '${itemId}';`,
        `DELETE FROM DURABLE_ITEM WHERE ItemID = '${itemId}';`,
        `DELETE FROM STOCK_BATCH WHERE ItemID = '${itemId}';`,
        `DELETE FROM ITEM WHERE ItemID = '${itemId}';`
      ];

      return { result: undefined, sqlStatements };
    });
  }

  // --- PURCHASE MANAGEMENT (Module 3) ---
  public addPurchase(payload: {
    itemId: string;
    supplierId: string;
    purchaseDate: string;
    quantity: number;
    cost: number;
  }): Supplies {
    return this.executeTransaction('RECORD_PURCHASE', draft => {
      if (payload.quantity <= 0) throw new Error('Purchase quantity must be greater than zero');
      if (payload.cost < 0) throw new Error('Cost cannot be negative');

      const item = draft.ITEM.find(i => i.ItemID === payload.itemId);
      if (!item) throw new Error(`Item ${payload.itemId} does not exist`);

      const supplier = draft.SUPPLIER.find(s => s.SupplierID === payload.supplierId);
      if (!supplier) throw new Error(`Supplier ${payload.supplierId} does not exist`);

      const purchaseId = this.generateNextId('PURCHASE');
      const newPurchase: Supplies = {
        PurchaseID: purchaseId,
        ItemID: payload.itemId,
        SupplierID: payload.supplierId,
        PurchaseDate: payload.purchaseDate,
        Quantity: Number(payload.quantity),
        Cost: Number(payload.cost)
      };

      draft.SUPPLIES.push(newPurchase);

      const sqlStatements = [
        `INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('${purchaseId}', '${payload.itemId}', '${payload.supplierId}', '${payload.purchaseDate}', ${payload.quantity}, ${payload.cost});`,
        `-- Stock Automatically Increments: Item '${item.ItemName}' Stock +${payload.quantity}`
      ];

      return { result: newPurchase, sqlStatements };
    });
  }

  public deletePurchase(purchaseId: string): void {
    return this.executeTransaction('DELETE_PURCHASE', draft => {
      const purchase = draft.SUPPLIES.find(p => p.PurchaseID === purchaseId);
      if (!purchase) throw new Error(`Purchase ${purchaseId} not found`);

      // Check stock-never-negative constraint
      const currentStock = this.getDerivedStock(purchase.ItemID);
      if (currentStock - purchase.Quantity < 0) {
        throw new Error(
          `Cannot delete purchase '${purchaseId}': removing ${purchase.Quantity} units would cause negative stock (Current stock: ${currentStock}). Items have already been issued.`
        );
      }

      draft.SUPPLIES = draft.SUPPLIES.filter(p => p.PurchaseID !== purchaseId);

      const sqlStatements = [
        `DELETE FROM SUPPLIES WHERE PurchaseID = '${purchaseId}';`
      ];

      return { result: undefined, sqlStatements };
    });
  }

  // --- ISSUE MANAGEMENT (Module 4) ---
  public addIssue(payload: {
    itemId: string;
    deptId: string;
    issueDate: string;
    quantity: number;
  }): IssuedTo {
    return this.executeTransaction('RECORD_ISSUE', draft => {
      if (payload.quantity <= 0) throw new Error('Issue quantity must be greater than zero');

      // Date check: not in future
      const todayStr = new Date().toISOString().split('T')[0];
      if (payload.issueDate > todayStr) {
        throw new Error('Issue date cannot be in the future');
      }

      const item = draft.ITEM.find(i => i.ItemID === payload.itemId);
      if (!item) throw new Error(`Item ${payload.itemId} does not exist`);

      const dept = draft.DEPARTMENT.find(d => d.DeptID === payload.deptId);
      if (!dept) throw new Error(`Department ${payload.deptId} does not exist`);

      // Stock-out prevention rule (derived stock check)
      const currentStock = this.getDerivedStock(payload.itemId);
      if (payload.quantity > currentStock) {
        throw new Error(
          `Stock-out prevention triggered: Only ${currentStock} units available for '${item.ItemName}'. Cannot issue requested ${payload.quantity} units.`
        );
      }

      const issueId = this.generateNextId('ISSUE');
      const newIssue: IssuedTo = {
        IssueID: issueId,
        ItemID: payload.itemId,
        DeptID: payload.deptId,
        IssueDate: payload.issueDate,
        Quantity: Number(payload.quantity)
      };

      draft.ISSUED_TO.push(newIssue);

      const sqlStatements = [
        `INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, IssueDate, Quantity) VALUES ('${issueId}', '${payload.itemId}', '${payload.deptId}', '${payload.issueDate}', ${payload.quantity});`,
        `-- Stock Automatically Decrements: Item '${item.ItemName}' Stock -${payload.quantity}`
      ];

      return { result: newIssue, sqlStatements };
    });
  }

  public deleteIssue(issueId: string): void {
    return this.executeTransaction('DELETE_ISSUE', draft => {
      const exists = draft.ISSUED_TO.find(i => i.IssueID === issueId);
      if (!exists) throw new Error(`Issue ${issueId} not found`);

      draft.ISSUED_TO = draft.ISSUED_TO.filter(i => i.IssueID !== issueId);

      const sqlStatements = [
        `DELETE FROM ISSUED_TO WHERE IssueID = '${issueId}';`
      ];

      return { result: undefined, sqlStatements };
    });
  }

  // --- SUPPLIER & PINCODE 3NF MANAGEMENT ---
  public addSupplier(payload: {
    supplierName: string;
    street: string;
    pincode: string;
    city: string;
    contacts: string[];
  }): Supplier {
    return this.executeTransaction('ADD_SUPPLIER_WITH_3NF_PINCODE', draft => {
      const pin = payload.pincode.trim();
      const city = payload.city.trim();
      const sqlStatements: string[] = [];

      // 3NF check: If PINCODE_CITY doesn't have this pincode, insert it first
      const existingPin = draft.PINCODE_CITY.find(p => p.Pincode === pin);
      if (!existingPin) {
        draft.PINCODE_CITY.push({ Pincode: pin, City: city });
        sqlStatements.push(`INSERT INTO PINCODE_CITY (Pincode, City) VALUES ('${pin}', '${city.replace(/'/g, "''")}');`);
      }

      const supplierId = this.generateNextId('SUPPLIER');
      const newSupplier: Supplier = {
        SupplierID: supplierId,
        SupplierName: payload.supplierName.trim(),
        Street: payload.street.trim(),
        Pincode: pin
      };

      draft.SUPPLIER.push(newSupplier);
      sqlStatements.push(
        `INSERT INTO SUPPLIER (SupplierID, SupplierName, Street, Pincode) VALUES ('${supplierId}', '${newSupplier.SupplierName.replace(/'/g, "''")}', '${newSupplier.Street.replace(/'/g, "''")}', '${pin}');`
      );

      // Multivalued contacts
      payload.contacts.forEach(c => {
        if (c.trim()) {
          draft.SUPPLIER_CONTACT.push({ SupplierID: supplierId, ContactNo: c.trim() });
          sqlStatements.push(
            `INSERT INTO SUPPLIER_CONTACT (SupplierID, ContactNo) VALUES ('${supplierId}', '${c.trim()}');`
          );
        }
      });

      return { result: newSupplier, sqlStatements };
    });
  }

  public updateSupplier(payload: {
    supplierId: string;
    supplierName: string;
    street: string;
    pincode: string;
    city: string;
    contacts: string[];
  }): Supplier {
    return this.executeTransaction('UPDATE_SUPPLIER', draft => {
      const pin = payload.pincode.trim();
      const city = payload.city.trim();
      const sqlStatements: string[] = [];

      // Ensure pincode lookup exists
      const existingPin = draft.PINCODE_CITY.find(p => p.Pincode === pin);
      if (!existingPin) {
        draft.PINCODE_CITY.push({ Pincode: pin, City: city });
        sqlStatements.push(`INSERT INTO PINCODE_CITY (Pincode, City) VALUES ('${pin}', '${city.replace(/'/g, "''")}');`);
      } else if (city && existingPin.City !== city) {
        // Update city for pincode
        existingPin.City = city;
        sqlStatements.push(`UPDATE PINCODE_CITY SET City = '${city.replace(/'/g, "''")}' WHERE Pincode = '${pin}';`);
      }

      const idx = draft.SUPPLIER.findIndex(s => s.SupplierID === payload.supplierId);
      if (idx === -1) throw new Error(`Supplier ${payload.supplierId} not found`);

      draft.SUPPLIER[idx] = {
        SupplierID: payload.supplierId,
        SupplierName: payload.supplierName.trim(),
        Street: payload.street.trim(),
        Pincode: pin
      };

      sqlStatements.push(
        `UPDATE SUPPLIER SET SupplierName = '${payload.supplierName.replace(/'/g, "''")}', Street = '${payload.street.replace(/'/g, "''")}', Pincode = '${pin}' WHERE SupplierID = '${payload.supplierId}';`
      );

      // Replace contacts
      draft.SUPPLIER_CONTACT = draft.SUPPLIER_CONTACT.filter(sc => sc.SupplierID !== payload.supplierId);
      payload.contacts.forEach(c => {
        if (c.trim()) {
          draft.SUPPLIER_CONTACT.push({ SupplierID: payload.supplierId, ContactNo: c.trim() });
          sqlStatements.push(
            `INSERT INTO SUPPLIER_CONTACT (SupplierID, ContactNo) VALUES ('${payload.supplierId}', '${c.trim()}');`
          );
        }
      });

      return { result: draft.SUPPLIER[idx], sqlStatements };
    });
  }

  public deleteSupplier(supplierId: string): void {
    return this.executeTransaction('DELETE_SUPPLIER', draft => {
      // ON DELETE RESTRICT for SUPPLIES
      const refCount = draft.SUPPLIES.filter(s => s.SupplierID === supplierId).length;
      if (refCount > 0) {
        throw new Error(
          `Cannot delete SUPPLIER '${supplierId}' because ${refCount} purchase order(s) exist in SUPPLIES (ON DELETE RESTRICT).`
        );
      }

      // ON DELETE CASCADE for SUPPLIER_CONTACT
      draft.SUPPLIER_CONTACT = draft.SUPPLIER_CONTACT.filter(sc => sc.SupplierID !== supplierId);
      draft.SUPPLIER = draft.SUPPLIER.filter(s => s.SupplierID !== supplierId);

      const sqlStatements = [
        `DELETE FROM SUPPLIER_CONTACT WHERE SupplierID = '${supplierId}';`,
        `DELETE FROM SUPPLIER WHERE SupplierID = '${supplierId}';`
      ];

      return { result: undefined, sqlStatements };
    });
  }

  // --- DEPARTMENT MANAGEMENT ---
  public addDepartment(deptName: string): Department {
    return this.executeTransaction('ADD_DEPARTMENT', draft => {
      if (!deptName.trim()) throw new Error('Department name cannot be empty');
      const deptId = this.generateNextId('DEPARTMENT');
      const newDept: Department = {
        DeptID: deptId,
        DeptName: deptName.trim()
      };

      draft.DEPARTMENT.push(newDept);

      const sqlStatements = [
        `INSERT INTO DEPARTMENT (DeptID, DeptName) VALUES ('${deptId}', '${newDept.DeptName.replace(/'/g, "''")}');`
      ];

      return { result: newDept, sqlStatements };
    });
  }

  public deleteDepartment(deptId: string): void {
    return this.executeTransaction('DELETE_DEPARTMENT', draft => {
      // ON DELETE RESTRICT for ISSUED_TO
      const refCount = draft.ISSUED_TO.filter(i => i.DeptID === deptId).length;
      if (refCount > 0) {
        throw new Error(
          `Cannot delete DEPARTMENT '${deptId}' because ${refCount} stationery issue record(s) exist in ISSUED_TO (ON DELETE RESTRICT).`
        );
      }

      draft.DEPARTMENT = draft.DEPARTMENT.filter(d => d.DeptID !== deptId);

      const sqlStatements = [
        `DELETE FROM DEPARTMENT WHERE DeptID = '${deptId}';`
      ];

      return { result: undefined, sqlStatements };
    });
  }

  // --- SELF AUDIT ---
  private runSelfAudit() {
    let allOk = true;
    for (const item of this.state.ITEM) {
      const stock = this.getDerivedStock(item.ItemID);
      if (stock < 0) {
        console.warn(`[DBMS Audit] Negative derived stock detected for item ${item.ItemID}: ${stock}`);
        allOk = false;
      }
    }
    if (allOk) {
      console.log('✅ [DBMS Mini Project] Data Layer self-audit passed: Derived stock balance invariants verified.');
    }
  }
}

export const dbEngine = new RelationalEngine();
