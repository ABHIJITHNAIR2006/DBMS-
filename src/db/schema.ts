/**
 * Database Schema, DDL definitions, and 3NF Normalization Documentation
 * For DBMS Mini Project: Stationery Management System (ClayStock)
 */

export interface TableMeta {
  name: string;
  description: string;
  pk: string[];
  fks: { column: string; refTable: string; refColumn: string; onDelete: 'RESTRICT' | 'CASCADE' }[];
  candidateKeys: string[];
  fds: string[];
  nfStatus: '3NF (Achieved)' | 'BCNF';
  category: 'Entity' | 'Decomposed 3NF' | 'Multivalued Attribute' | 'Weak Entity' | 'EER Specialization' | 'Relationship (M:N)';
  ddl: string;
}

export const DATABASE_TABLES: Record<string, TableMeta> = {
  ITEM: {
    name: 'ITEM',
    description: 'Central stationery catalog storing master item attributes.',
    pk: ['ItemID'],
    fks: [],
    candidateKeys: ['ItemID'],
    fds: ['ItemID -> ItemName, Category, UnitPrice'],
    nfStatus: '3NF (Achieved)',
    category: 'Entity',
    ddl: `CREATE TABLE ITEM (
    ItemID VARCHAR(10) PRIMARY KEY,
    ItemName VARCHAR(100) NOT NULL,
    Category VARCHAR(50) NOT NULL,
    UnitPrice DECIMAL(10,2) NOT NULL CHECK (UnitPrice >= 0)
);`
  },

  PINCODE_CITY: {
    name: 'PINCODE_CITY',
    description: 'Decomposed 3NF lookup table removing transitive dependency Pincode -> City from SUPPLIER.',
    pk: ['Pincode'],
    fks: [],
    candidateKeys: ['Pincode'],
    fds: ['Pincode -> City'],
    nfStatus: '3NF (Achieved)',
    category: 'Decomposed 3NF',
    ddl: `CREATE TABLE PINCODE_CITY (
    Pincode VARCHAR(10) PRIMARY KEY,
    City VARCHAR(50) NOT NULL
);`
  },

  SUPPLIER: {
    name: 'SUPPLIER',
    description: 'Supplier profile with foreign key reference to PINCODE_CITY (satisfies 3NF).',
    pk: ['SupplierID'],
    fks: [
      { column: 'Pincode', refTable: 'PINCODE_CITY', refColumn: 'Pincode', onDelete: 'RESTRICT' }
    ],
    candidateKeys: ['SupplierID'],
    fds: ['SupplierID -> SupplierName, Street, Pincode'],
    nfStatus: '3NF (Achieved)',
    category: 'Entity',
    ddl: `CREATE TABLE SUPPLIER (
    SupplierID VARCHAR(10) PRIMARY KEY,
    SupplierName VARCHAR(100) NOT NULL,
    Street VARCHAR(150) NOT NULL,
    Pincode VARCHAR(10) NOT NULL,
    FOREIGN KEY (Pincode) REFERENCES PINCODE_CITY(Pincode)
);`
  },

  SUPPLIER_CONTACT: {
    name: 'SUPPLIER_CONTACT',
    description: '1NF decomposition for multivalued ContactNo attribute per supplier.',
    pk: ['SupplierID', 'ContactNo'],
    fks: [
      { column: 'SupplierID', refTable: 'SUPPLIER', refColumn: 'SupplierID', onDelete: 'CASCADE' }
    ],
    candidateKeys: ['(SupplierID, ContactNo)'],
    fds: ['(SupplierID, ContactNo) -> Ø (All key)'],
    nfStatus: '3NF (Achieved)',
    category: 'Multivalued Attribute',
    ddl: `CREATE TABLE SUPPLIER_CONTACT (
    SupplierID VARCHAR(10) NOT NULL,
    ContactNo VARCHAR(20) NOT NULL,
    PRIMARY KEY (SupplierID, ContactNo),
    FOREIGN KEY (SupplierID) REFERENCES SUPPLIER(SupplierID) ON DELETE CASCADE
);`
  },

  DEPARTMENT: {
    name: 'DEPARTMENT',
    description: 'Master list of academic and administrative departments consuming stationery.',
    pk: ['DeptID'],
    fks: [],
    candidateKeys: ['DeptID'],
    fds: ['DeptID -> DeptName'],
    nfStatus: '3NF (Achieved)',
    category: 'Entity',
    ddl: `CREATE TABLE DEPARTMENT (
    DeptID VARCHAR(10) PRIMARY KEY,
    DeptName VARCHAR(100) NOT NULL UNIQUE
);`
  },

  STOCK_BATCH: {
    name: 'STOCK_BATCH',
    description: 'Weak entity with identifying relationship HAS_BATCH to ITEM for expiration tracking.',
    pk: ['ItemID', 'BatchNo'],
    fks: [
      { column: 'ItemID', refTable: 'ITEM', refColumn: 'ItemID', onDelete: 'RESTRICT' }
    ],
    candidateKeys: ['(ItemID, BatchNo)'],
    fds: ['(ItemID, BatchNo) -> ExpiryDate'],
    nfStatus: '3NF (Achieved)',
    category: 'Weak Entity',
    ddl: `CREATE TABLE STOCK_BATCH (
    ItemID VARCHAR(10) NOT NULL,
    BatchNo VARCHAR(15) NOT NULL,
    ExpiryDate DATE NOT NULL,
    PRIMARY KEY (ItemID, BatchNo),
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON DELETE RESTRICT
);`
  },

  CONSUMABLE_ITEM: {
    name: 'CONSUMABLE_ITEM',
    description: 'Disjoint EER subclass specialization for items with reorder threshold triggers.',
    pk: ['ItemID'],
    fks: [
      { column: 'ItemID', refTable: 'ITEM', refColumn: 'ItemID', onDelete: 'CASCADE' }
    ],
    candidateKeys: ['ItemID'],
    fds: ['ItemID -> ReorderLevel'],
    nfStatus: '3NF (Achieved)',
    category: 'EER Specialization',
    ddl: `CREATE TABLE CONSUMABLE_ITEM (
    ItemID VARCHAR(10) PRIMARY KEY,
    ReorderLevel INT NOT NULL CHECK (ReorderLevel >= 0),
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON DELETE CASCADE
);`
  },

  DURABLE_ITEM: {
    name: 'DURABLE_ITEM',
    description: 'Disjoint EER subclass specialization for non-consumable stationery with warranty in months.',
    pk: ['ItemID'],
    fks: [
      { column: 'ItemID', refTable: 'ITEM', refColumn: 'ItemID', onDelete: 'CASCADE' }
    ],
    candidateKeys: ['ItemID'],
    fds: ['ItemID -> WarrantyPeriod'],
    nfStatus: '3NF (Achieved)',
    category: 'EER Specialization',
    ddl: `CREATE TABLE DURABLE_ITEM (
    ItemID VARCHAR(10) PRIMARY KEY,
    WarrantyPeriod INT NOT NULL CHECK (WarrantyPeriod >= 0),
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON DELETE CASCADE
);`
  },

  SUPPLIES: {
    name: 'SUPPLIES',
    description: 'M:N relationship tracking purchases. Surrogate key PurchaseID prevents duplicate composite key anomalies.',
    pk: ['PurchaseID'],
    fks: [
      { column: 'ItemID', refTable: 'ITEM', refColumn: 'ItemID', onDelete: 'RESTRICT' },
      { column: 'SupplierID', refTable: 'SUPPLIER', refColumn: 'SupplierID', onDelete: 'RESTRICT' }
    ],
    candidateKeys: ['PurchaseID'],
    fds: ['PurchaseID -> ItemID, SupplierID, PurchaseDate, Quantity, Cost'],
    nfStatus: '3NF (Achieved)',
    category: 'Relationship (M:N)',
    ddl: `CREATE TABLE SUPPLIES (
    PurchaseID VARCHAR(15) PRIMARY KEY,
    ItemID VARCHAR(10) NOT NULL,
    SupplierID VARCHAR(10) NOT NULL,
    PurchaseDate DATE NOT NULL,
    Quantity INT NOT NULL CHECK (Quantity > 0),
    Cost DECIMAL(12,2) NOT NULL CHECK (Cost >= 0),
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON DELETE RESTRICT,
    FOREIGN KEY (SupplierID) REFERENCES SUPPLIER(SupplierID) ON DELETE RESTRICT
);`
  },

  ISSUED_TO: {
    name: 'ISSUED_TO',
    description: 'M:N relationship tracking stationery issued to departments. Surrogate key IssueID prevents composite key collision.',
    pk: ['IssueID'],
    fks: [
      { column: 'ItemID', refTable: 'ITEM', refColumn: 'ItemID', onDelete: 'RESTRICT' },
      { column: 'DeptID', refTable: 'DEPARTMENT', refColumn: 'DeptID', onDelete: 'RESTRICT' }
    ],
    candidateKeys: ['IssueID'],
    fds: ['IssueID -> ItemID, DeptID, IssueDate, Quantity'],
    nfStatus: '3NF (Achieved)',
    category: 'Relationship (M:N)',
    ddl: `CREATE TABLE ISSUED_TO (
    IssueID VARCHAR(15) PRIMARY KEY,
    ItemID VARCHAR(10) NOT NULL,
    DeptID VARCHAR(10) NOT NULL,
    IssueDate DATE NOT NULL,
    Quantity INT NOT NULL CHECK (Quantity > 0),
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON DELETE RESTRICT,
    FOREIGN KEY (DeptID) REFERENCES DEPARTMENT(DeptID) ON DELETE RESTRICT
);`
  }
};

export const NORMALIZATION_AUDIT = [
  {
    table: 'ITEM',
    candidateKey: 'ItemID',
    fds: 'ItemID -> ItemName, Category, UnitPrice',
    is1NF: 'Yes (Atomic attributes)',
    is2NF: 'Yes (No partial dependency, single attribute key)',
    is3NF: 'Yes (No transitive dependency X -> Y -> Z)',
    verdict: '3NF Compliant'
  },
  {
    table: 'PINCODE_CITY',
    candidateKey: 'Pincode',
    fds: 'Pincode -> City',
    is1NF: 'Yes',
    is2NF: 'Yes',
    is3NF: 'Yes (Direct non-transitive dependency)',
    verdict: '3NF Compliant (Extracted from SUPPLIER)'
  },
  {
    table: 'SUPPLIER',
    candidateKey: 'SupplierID',
    fds: 'SupplierID -> SupplierName, Street, Pincode',
    is1NF: 'Yes (Contact removed to separate table)',
    is2NF: 'Yes (Single attribute key)',
    is3NF: 'Yes (City moved to PINCODE_CITY, removing SupplierID -> Pincode -> City)',
    verdict: '3NF Compliant'
  },
  {
    table: 'SUPPLIER_CONTACT',
    candidateKey: '(SupplierID, ContactNo)',
    fds: 'All-key relation',
    is1NF: 'Yes (Eliminated repeating multivalued contact numbers)',
    is2NF: 'Yes (No non-prime attributes to be partially dependent)',
    is3NF: 'Yes (No non-prime attributes)',
    verdict: '3NF Compliant'
  },
  {
    table: 'DEPARTMENT',
    candidateKey: 'DeptID, DeptName',
    fds: 'DeptID -> DeptName',
    is1NF: 'Yes',
    is2NF: 'Yes',
    is3NF: 'Yes',
    verdict: '3NF Compliant'
  },
  {
    table: 'STOCK_BATCH',
    candidateKey: '(ItemID, BatchNo)',
    fds: '(ItemID, BatchNo) -> ExpiryDate',
    is1NF: 'Yes',
    is2NF: 'Yes (ExpiryDate depends on the full composite key)',
    is3NF: 'Yes (No transitive dependency)',
    verdict: '3NF Compliant (Weak entity representation)'
  },
  {
    table: 'CONSUMABLE_ITEM',
    candidateKey: 'ItemID',
    fds: 'ItemID -> ReorderLevel',
    is1NF: 'Yes',
    is2NF: 'Yes',
    is3NF: 'Yes',
    verdict: '3NF Compliant (EER Disjoint Subclass)'
  },
  {
    table: 'DURABLE_ITEM',
    candidateKey: 'ItemID',
    fds: 'ItemID -> WarrantyPeriod',
    is1NF: 'Yes',
    is2NF: 'Yes',
    is3NF: 'Yes',
    verdict: '3NF Compliant (EER Disjoint Subclass)'
  },
  {
    table: 'SUPPLIES',
    candidateKey: 'PurchaseID',
    fds: 'PurchaseID -> ItemID, SupplierID, PurchaseDate, Quantity, Cost',
    is1NF: 'Yes',
    is2NF: 'Yes (Surrogate key replaces flawed composite key)',
    is3NF: 'Yes',
    verdict: '3NF Compliant'
  },
  {
    table: 'ISSUED_TO',
    candidateKey: 'IssueID',
    fds: 'IssueID -> ItemID, DeptID, IssueDate, Quantity',
    is1NF: 'Yes',
    is2NF: 'Yes (Surrogate key handles multiple issues of same item to same dept)',
    is3NF: 'Yes',
    verdict: '3NF Compliant'
  }
];
