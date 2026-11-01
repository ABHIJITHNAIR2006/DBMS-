/**
 * Formal Functional Dependencies & Schema Relational Theory Definitions
 * For 21 Tables in ClayStock DBMS Mini Project
 * 
 * Used by:
 * - Normalization Lab (E5) for automated schema verification (1NF, 2NF, 3NF, BCNF)
 * - Candidate Key & Minimal Cover computation
 * - Lossless Join & Dependency Preservation checks
 */

export interface TableFDDefinition {
  tableName: string;
  category: 'CORE' | 'EXTENSION';
  attributes: string[];
  primaryKey: string[];
  candidateKeys: string[][];
  foreignKeys: { columns: string[]; referencesTable: string; referencesColumns: string[] }[];
  functionalDependencies: {
    lhs: string[];
    rhs: string[];
    description: string;
  }[];
  normalFormAchieved: 'BCNF' | '3NF';
  normalFormExplanation: string;
  notes?: string;
}

export const SCHEMA_FDS: Record<string, TableFDDefinition> = {
  // --- 10 CORE TABLES ---
  ITEM: {
    tableName: 'ITEM',
    category: 'CORE',
    attributes: ['ItemID', 'ItemName', 'Category', 'UnitPrice'],
    primaryKey: ['ItemID'],
    candidateKeys: [['ItemID']],
    foreignKeys: [],
    functionalDependencies: [
      { lhs: ['ItemID'], rhs: ['ItemName', 'Category', 'UnitPrice'], description: 'Primary key uniquely determines all item descriptive attributes' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'Every determinant (ItemID) is a superkey. No transitive or partial dependencies exist.'
  },
  PINCODE_CITY: {
    tableName: 'PINCODE_CITY',
    category: 'CORE',
    attributes: ['Pincode', 'City'],
    primaryKey: ['Pincode'],
    candidateKeys: [['Pincode']],
    foreignKeys: [],
    functionalDependencies: [
      { lhs: ['Pincode'], rhs: ['City'], description: 'Postal pincode uniquely determines the city in this organizational domain' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'Determinant Pincode is the superkey. This table exists to eliminate the transitive dependency (SupplierID -> Pincode -> City) from SUPPLIER.'
  },
  SUPPLIER: {
    tableName: 'SUPPLIER',
    category: 'CORE',
    attributes: ['SupplierID', 'SupplierName', 'Street', 'Pincode'],
    primaryKey: ['SupplierID'],
    candidateKeys: [['SupplierID']],
    foreignKeys: [
      { columns: ['Pincode'], referencesTable: 'PINCODE_CITY', referencesColumns: ['Pincode'] }
    ],
    functionalDependencies: [
      { lhs: ['SupplierID'], rhs: ['SupplierName', 'Street', 'Pincode'], description: 'Supplier ID determines vendor name, street address, and pincode' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'SupplierID is the only determinant and is a superkey. City has been factored out into PINCODE_CITY to satisfy 3NF/BCNF.'
  },
  SUPPLIER_CONTACT: {
    tableName: 'SUPPLIER_CONTACT',
    category: 'CORE',
    attributes: ['SupplierID', 'ContactNo'],
    primaryKey: ['SupplierID', 'ContactNo'],
    candidateKeys: [['SupplierID', 'ContactNo']],
    foreignKeys: [
      { columns: ['SupplierID'], referencesTable: 'SUPPLIER', referencesColumns: ['SupplierID'] }
    ],
    functionalDependencies: [
      { lhs: ['SupplierID', 'ContactNo'], rhs: [], description: 'All-key relation representing 1NF decomposition of multivalued phone contact numbers' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'All-key relation; no non-trivial functional dependencies where LHS is not a superkey.'
  },
  DEPARTMENT: {
    tableName: 'DEPARTMENT',
    category: 'CORE',
    attributes: ['DeptID', 'DeptName'],
    primaryKey: ['DeptID'],
    candidateKeys: [['DeptID'], ['DeptName']],
    foreignKeys: [],
    functionalDependencies: [
      { lhs: ['DeptID'], rhs: ['DeptName'], description: 'DeptID uniquely identifies department name' },
      { lhs: ['DeptName'], rhs: ['DeptID'], description: 'Department names are unique within the institution' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'Both determinants (DeptID and DeptName) are candidate superkeys.'
  },
  CONSUMABLE_ITEM: {
    tableName: 'CONSUMABLE_ITEM',
    category: 'CORE',
    attributes: ['ItemID', 'ReorderLevel'],
    primaryKey: ['ItemID'],
    candidateKeys: [['ItemID']],
    foreignKeys: [
      { columns: ['ItemID'], referencesTable: 'ITEM', referencesColumns: ['ItemID'] }
    ],
    functionalDependencies: [
      { lhs: ['ItemID'], rhs: ['ReorderLevel'], description: 'ItemID determines reorder threshold for consumable supplies' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'Specialization subclass of ITEM. ItemID is the superkey.'
  },
  DURABLE_ITEM: {
    tableName: 'DURABLE_ITEM',
    category: 'CORE',
    attributes: ['ItemID', 'WarrantyPeriod'],
    primaryKey: ['ItemID'],
    candidateKeys: [['ItemID']],
    foreignKeys: [
      { columns: ['ItemID'], referencesTable: 'ITEM', referencesColumns: ['ItemID'] }
    ],
    functionalDependencies: [
      { lhs: ['ItemID'], rhs: ['WarrantyPeriod'], description: 'ItemID determines warranty tenure in months for capital assets' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'Specialization subclass of ITEM. ItemID is the superkey.'
  },
  STOCK_BATCH: {
    tableName: 'STOCK_BATCH',
    category: 'CORE',
    attributes: ['ItemID', 'BatchNo', 'ExpiryDate'],
    primaryKey: ['ItemID', 'BatchNo'],
    candidateKeys: [['ItemID', 'BatchNo']],
    foreignKeys: [
      { columns: ['ItemID'], referencesTable: 'ITEM', referencesColumns: ['ItemID'] }
    ],
    functionalDependencies: [
      { lhs: ['ItemID', 'BatchNo'], rhs: ['ExpiryDate'], description: 'Composite weak entity key determines the batch expiry date' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'Weak entity dependent on ITEM. Determinant (ItemID, BatchNo) is the superkey.'
  },
  SUPPLIES: {
    tableName: 'SUPPLIES',
    category: 'CORE',
    attributes: ['PurchaseID', 'ItemID', 'SupplierID', 'PurchaseDate', 'Quantity', 'Cost'],
    primaryKey: ['PurchaseID'],
    candidateKeys: [['PurchaseID']],
    foreignKeys: [
      { columns: ['ItemID'], referencesTable: 'ITEM', referencesColumns: ['ItemID'] },
      { columns: ['SupplierID'], referencesTable: 'SUPPLIER', referencesColumns: ['SupplierID'] }
    ],
    functionalDependencies: [
      { lhs: ['PurchaseID'], rhs: ['ItemID', 'SupplierID', 'PurchaseDate', 'Quantity', 'Cost'], description: 'Surrogate purchase transaction key determines purchase event details' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'PurchaseID is the superkey. Transitive dependencies are prevented as supplier details and item details reside in their own normalized relations.'
  },
  ISSUED_TO: {
    tableName: 'ISSUED_TO',
    category: 'CORE',
    attributes: ['IssueID', 'ItemID', 'DeptID', 'EmpID', 'ReqID', 'IssueDate', 'Quantity'],
    primaryKey: ['IssueID'],
    candidateKeys: [['IssueID']],
    foreignKeys: [
      { columns: ['ItemID'], referencesTable: 'ITEM', referencesColumns: ['ItemID'] },
      { columns: ['DeptID'], referencesTable: 'DEPARTMENT', referencesColumns: ['DeptID'] },
      { columns: ['EmpID'], referencesTable: 'EMPLOYEE', referencesColumns: ['EmpID'] },
      { columns: ['ReqID'], referencesTable: 'REQUISITION', referencesColumns: ['ReqID'] }
    ],
    functionalDependencies: [
      { lhs: ['IssueID'], rhs: ['ItemID', 'DeptID', 'EmpID', 'ReqID', 'IssueDate', 'Quantity'], description: 'Surrogate issue ID uniquely determines distribution event' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'IssueID is the candidate superkey. No partial dependencies exist on the primary key.'
  },

  // --- 11 EXTENSION TABLES ---
  EMPLOYEE: {
    tableName: 'EMPLOYEE',
    category: 'EXTENSION',
    attributes: ['EmpID', 'EmpName', 'Designation', 'DeptID', 'ManagerID', 'Email', 'Phone'],
    primaryKey: ['EmpID'],
    candidateKeys: [['EmpID'], ['Email']],
    foreignKeys: [
      { columns: ['DeptID'], referencesTable: 'DEPARTMENT', referencesColumns: ['DeptID'] },
      { columns: ['ManagerID'], referencesTable: 'EMPLOYEE', referencesColumns: ['EmpID'] }
    ],
    functionalDependencies: [
      { lhs: ['EmpID'], rhs: ['EmpName', 'Designation', 'DeptID', 'ManagerID', 'Email', 'Phone'], description: 'EmpID determines all staff personal and hierarchy attributes' },
      { lhs: ['Email'], rhs: ['EmpID', 'EmpName', 'Designation', 'DeptID', 'ManagerID', 'Phone'], description: 'Unique email address uniquely resolves to staff member' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'Both determinants (EmpID, Email) are superkeys. ManagerID is a normalized self-referencing foreign key.'
  },
  ROLE: {
    tableName: 'ROLE',
    category: 'EXTENSION',
    attributes: ['RoleName', 'Description'],
    primaryKey: ['RoleName'],
    candidateKeys: [['RoleName']],
    foreignKeys: [],
    functionalDependencies: [
      { lhs: ['RoleName'], rhs: ['Description'], description: 'Security role key determines role scope description' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'RoleName is the superkey. Single non-key attribute directly dependent.'
  },
  PERMISSION: {
    tableName: 'PERMISSION',
    category: 'EXTENSION',
    attributes: ['RoleName', 'Resource', 'Action'],
    primaryKey: ['RoleName', 'Resource', 'Action'],
    candidateKeys: [['RoleName', 'Resource', 'Action']],
    foreignKeys: [
      { columns: ['RoleName'], referencesTable: 'ROLE', referencesColumns: ['RoleName'] }
    ],
    functionalDependencies: [
      { lhs: ['RoleName', 'Resource', 'Action'], rhs: [], description: 'All-key relation representing RBAC authorization matrix' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'All-key relation with no non-trivial dependencies; automatically in BCNF.'
  },
  APP_USER: {
    tableName: 'APP_USER',
    category: 'EXTENSION',
    attributes: ['UserID', 'Username', 'PasswordHash', 'Salt', 'RoleName', 'EmpID'],
    primaryKey: ['UserID'],
    candidateKeys: [['UserID'], ['Username'], ['EmpID']],
    foreignKeys: [
      { columns: ['RoleName'], referencesTable: 'ROLE', referencesColumns: ['RoleName'] },
      { columns: ['EmpID'], referencesTable: 'EMPLOYEE', referencesColumns: ['EmpID'] }
    ],
    functionalDependencies: [
      { lhs: ['UserID'], rhs: ['Username', 'PasswordHash', 'Salt', 'RoleName', 'EmpID'], description: 'UserID identifies application user credentials and role' },
      { lhs: ['Username'], rhs: ['UserID', 'PasswordHash', 'Salt', 'RoleName', 'EmpID'], description: 'Username is unique login handle' },
      { lhs: ['EmpID'], rhs: ['UserID', 'Username', 'PasswordHash', 'Salt', 'RoleName'], description: '1-to-1 mapping between employee and user profile' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'All determinants (UserID, Username, EmpID) are candidate superkeys.'
  },
  REQUISITION: {
    tableName: 'REQUISITION',
    category: 'EXTENSION',
    attributes: ['ReqID', 'DeptID', 'EmpID', 'ReqDate', 'Status', 'ApprovedBy', 'Remarks'],
    primaryKey: ['ReqID'],
    candidateKeys: [['ReqID']],
    foreignKeys: [
      { columns: ['DeptID'], referencesTable: 'DEPARTMENT', referencesColumns: ['DeptID'] },
      { columns: ['EmpID'], referencesTable: 'EMPLOYEE', referencesColumns: ['EmpID'] },
      { columns: ['ApprovedBy'], referencesTable: 'APP_USER', referencesColumns: ['UserID'] }
    ],
    functionalDependencies: [
      { lhs: ['ReqID'], rhs: ['DeptID', 'EmpID', 'ReqDate', 'Status', 'ApprovedBy', 'Remarks'], description: 'Requisition ticket ID identifies requisition header' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'ReqID is the superkey. Master-detail separation keeps line quantities in REQUISITION_LINE.'
  },
  REQUISITION_LINE: {
    tableName: 'REQUISITION_LINE',
    category: 'EXTENSION',
    attributes: ['ReqID', 'LineNo', 'ItemID', 'QtyRequested', 'QtyApproved'],
    primaryKey: ['ReqID', 'LineNo'],
    candidateKeys: [['ReqID', 'LineNo']],
    foreignKeys: [
      { columns: ['ReqID'], referencesTable: 'REQUISITION', referencesColumns: ['ReqID'] },
      { columns: ['ItemID'], referencesTable: 'ITEM', referencesColumns: ['ItemID'] }
    ],
    functionalDependencies: [
      { lhs: ['ReqID', 'LineNo'], rhs: ['ItemID', 'QtyRequested', 'QtyApproved'], description: 'Weak entity line key determines stationery item requested and quantities' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'Weak entity child of REQUISITION. Determinant (ReqID, LineNo) is the superkey.'
  },
  AUDIT_LOG: {
    tableName: 'AUDIT_LOG',
    category: 'EXTENSION',
    attributes: ['AuditID', 'TableName', 'RecordKey', 'Action', 'OldValues', 'NewValues', 'ChangedBy', 'ChangedAt'],
    primaryKey: ['AuditID'],
    candidateKeys: [['AuditID']],
    foreignKeys: [],
    functionalDependencies: [
      { lhs: ['AuditID'], rhs: ['TableName', 'RecordKey', 'Action', 'OldValues', 'NewValues', 'ChangedBy', 'ChangedAt'], description: 'Auto-increment audit log sequence determines log record' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'AuditID is the surrogate superkey.'
  },
  ALERT: {
    tableName: 'ALERT',
    category: 'EXTENSION',
    attributes: ['AlertID', 'ItemID', 'AlertType', 'Message', 'CreatedAt', 'ResolvedAt'],
    primaryKey: ['AlertID'],
    candidateKeys: [['AlertID']],
    foreignKeys: [
      { columns: ['ItemID'], referencesTable: 'ITEM', referencesColumns: ['ItemID'] }
    ],
    functionalDependencies: [
      { lhs: ['AlertID'], rhs: ['ItemID', 'AlertType', 'Message', 'CreatedAt', 'ResolvedAt'], description: 'Alert ID determines system triggered notification event' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'AlertID is the superkey.'
  },
  PRICE_HISTORY: {
    tableName: 'PRICE_HISTORY',
    category: 'EXTENSION',
    attributes: ['ItemID', 'ChangedAt', 'OldPrice', 'NewPrice', 'ChangedBy'],
    primaryKey: ['ItemID', 'ChangedAt'],
    candidateKeys: [['ItemID', 'ChangedAt']],
    foreignKeys: [
      { columns: ['ItemID'], referencesTable: 'ITEM', referencesColumns: ['ItemID'] }
    ],
    functionalDependencies: [
      { lhs: ['ItemID', 'ChangedAt'], rhs: ['OldPrice', 'NewPrice', 'ChangedBy'], description: 'Item and change timestamp identify historical unit price mutation' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'Composite primary key (ItemID, ChangedAt) is the superkey.'
  },
  PROCEDURE_REGISTRY: {
    tableName: 'PROCEDURE_REGISTRY',
    category: 'EXTENSION',
    attributes: ['ProcName', 'ParamsJson', 'BodySql', 'Description'],
    primaryKey: ['ProcName'],
    candidateKeys: [['ProcName']],
    foreignKeys: [],
    functionalDependencies: [
      { lhs: ['ProcName'], rhs: ['ParamsJson', 'BodySql', 'Description'], description: 'Procedure name identifies stored procedure signature and body' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'ProcName is the superkey.'
  },
  SESSION_CONTEXT: {
    tableName: 'SESSION_CONTEXT',
    category: 'EXTENSION',
    attributes: ['Key', 'Value'],
    primaryKey: ['Key'],
    candidateKeys: [['Key']],
    foreignKeys: [],
    functionalDependencies: [
      { lhs: ['Key'], rhs: ['Value'], description: 'Session variable key uniquely determines session state value' }
    ],
    normalFormAchieved: 'BCNF',
    normalFormExplanation: 'Key is the superkey.'
  }
};
