/**
 * Database Types for ClayStock DBMS Mini Project
 * Normalized 3NF/BCNF Relational Model (21 Tables)
 */

export interface Item {
  ItemID: string; // PK: e.g. "I101", "I123"
  ItemName: string;
  Category: string;
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
  ContactNo: string; // PK: e.g. "9800010001"
}

export interface Department {
  DeptID: string; // PK: e.g. "D01"
  DeptName: string; // e.g. "Computer Engineering"
}

export interface StockBatch {
  ItemID: string; // PK / FK -> ITEM.ItemID
  BatchNo: string; // PK: e.g. "BAT-2025-C1"
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
  EmpID?: string | null; // FK -> EMPLOYEE.EmpID (nullable)
  ReqID?: string | null; // FK -> REQUISITION.ReqID (nullable)
  IssueDate: string; // YYYY-MM-DD (not in future)
  Quantity: number; // > 0
}

export interface Employee {
  EmpID: string;
  EmpName: string;
  Designation: string;
  DeptID: string;
  ManagerID?: string | null;
  Email?: string | null;
  Phone?: string | null;
}

export interface Role {
  RoleName: string;
  Description: string;
}

export interface Permission {
  RoleName: string;
  Resource: string;
  Action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'FULFIL' | 'EXPORT';
}

export interface AppUser {
  UserID: string;
  Username: string;
  PasswordHash: string;
  Salt: string;
  RoleName: string;
  EmpID?: string | null;
}

export interface Requisition {
  ReqID: string;
  DeptID: string;
  EmpID: string;
  ReqDate: string;
  Status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PARTIALLY_FULFILLED' | 'FULFILLED';
  ApprovedBy?: string | null;
  Remarks?: string | null;
}

export interface RequisitionLine {
  ReqID: string;
  LineNo: number;
  ItemID: string;
  QtyRequested: number;
  QtyApproved?: number | null;
}

export interface AuditLogEntry {
  AuditID: number;
  TableName: string;
  RecordKey: string;
  Action: 'INSERT' | 'UPDATE' | 'DELETE';
  OldValues?: string | null;
  NewValues?: string | null;
  ChangedBy?: string | null;
  ChangedAt: string;
}

export interface AlertEntry {
  AlertID: string;
  ItemID: string;
  AlertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING' | 'PRICE_VARIANCE';
  Message: string;
  CreatedAt: string;
  ResolvedAt?: string | null;
}

export interface PriceHistoryEntry {
  ItemID: string;
  ChangedAt: string;
  OldPrice: number;
  NewPrice: number;
  ChangedBy?: string | null;
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
  id: string;
  date: string;
  entityName: string;
  inQty: number;
  outQty: number;
  costOrNote?: number;
  runningBalance: number;
}

export interface SqlLogEntry {
  id: string;
  timestamp: string;
  query: string;
  params?: any[];
  user?: string;
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
  EMPLOYEE?: Employee[];
  REQUISITION?: Requisition[];
  REQUISITION_LINE?: RequisitionLine[];
  ALERT?: AlertEntry[];
}
