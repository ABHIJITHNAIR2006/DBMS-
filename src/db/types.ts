/**
 * Database Types for ClayStock DBMS Mini Project
 * Normalized 3NF Relational Model
 */

export interface Item {
  ItemID: string; // PK: e.g. "I101", "I123"
  ItemName: string;
  Category: string; // "Paper" | "Writing" | "Files & Folders" | "Office Supplies" | "Electronics" | "Furniture"
  UnitPrice: number; // in INR (₹)
}

export interface PincodeCity {
  Pincode: string; // PK: e.g. "422001"
  City: string; // e.g. "Nashik"
}

export interface Supplier {
  SupplierID: string; // PK: e.g. "S01"
  SupplierName: string;
  Street: string;
  Pincode: string; // FK -> PINCODE_CITY.Pincode
}

export interface SupplierContact {
  SupplierID: string; // PK / FK -> SUPPLIER.SupplierID
  ContactNo: string; // PK: e.g. "+91 98220 12345"
}

export interface Department {
  DeptID: string; // PK: e.g. "D01"
  DeptName: string; // e.g. "Computer Engineering"
}

export interface StockBatch {
  ItemID: string; // PK / FK -> ITEM.ItemID (identifying relationship)
  BatchNo: string; // PK: e.g. "B01"
  ExpiryDate: string; // YYYY-MM-DD
}

export interface ConsumableItem {
  ItemID: string; // PK / FK -> ITEM.ItemID
  ReorderLevel: number; // Minimum stock threshold before alert
}

export interface DurableItem {
  ItemID: string; // PK / FK -> ITEM.ItemID
  WarrantyPeriod: number; // In months
}

export interface Supplies {
  PurchaseID: string; // PK: e.g. "PO1001"
  ItemID: string; // FK -> ITEM.ItemID
  SupplierID: string; // FK -> SUPPLIER.SupplierID
  PurchaseDate: string; // YYYY-MM-DD
  Quantity: number; // > 0
  Cost: number; // Total cost in INR (>= 0)
}

export interface IssuedTo {
  IssueID: string; // PK: e.g. "IS2001"
  ItemID: string; // FK -> ITEM.ItemID
  DeptID: string; // FK -> DEPARTMENT.DeptID
  IssueDate: string; // YYYY-MM-DD (not in future)
  Quantity: number; // > 0
}

export type ItemType = 'Consumable' | 'Durable';

export interface DerivedStockInfo {
  item: Item;
  itemType: ItemType;
  reorderLevel?: number;
  warrantyPeriod?: number;
  totalPurchased: number;
  totalIssued: number;
  currentStock: number; // DERIVED: totalPurchased - totalIssued
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Durable Stock';
  batches: StockBatch[];
}

export interface StockLedgerEntry {
  type: 'PURCHASE' | 'ISSUE';
  id: string; // PurchaseID or IssueID
  date: string;
  entityName: string; // SupplierName or DeptName
  inQty: number;
  outQty: number;
  runningBalance: number;
  costOrNote?: number;
}

export interface SqlLogEntry {
  id: string;
  timestamp: string;
  query: string;
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION' | 'DDL';
  status: 'SUCCESS' | 'ERROR';
  executionTimeMs: number;
  rowsAffected?: number;
  errorMessage?: string;
}

export interface DatabaseState {
  ITEM: Item[];
  PINCODE_CITY: PincodeCity[];
  SUPPLIER: Supplier[];
  SUPPLIER_CONTACT: SupplierContact[];
  DEPARTMENT: Department[];
  STOCK_BATCH: StockBatch[];
  CONSUMABLE_ITEM: ConsumableItem[];
  DURABLE_ITEM: DurableItem[];
  SUPPLIES: Supplies[];
  ISSUED_TO: IssuedTo[];
}
