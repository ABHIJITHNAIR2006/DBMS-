/**
 * Deterministic PRNG and Seed Data for ClayStock DBMS Mini Project
 * Organization: K.K. Wagh Institute of Engineering Education & Research, Nashik
 */

// Simple seeded pseudo-random number generator (Mulberry32) for perfectly deterministic data
function createPrng(seed = 42) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSeedSql(): string {
  const prng = createPrng(12345);
  const statements: string[] = [];

  // 1. PINCODE_CITY
  const pincodes = [
    { pin: '422001', city: 'Nashik' },
    { pin: '422003', city: 'Nashik' },
    { pin: '422005', city: 'Nashik' },
    { pin: '422011', city: 'Nashik' },
    { pin: '422013', city: 'Nashik' },
    { pin: '422101', city: 'Nashik' },
    { pin: '411002', city: 'Pune' },
    { pin: '400001', city: 'Mumbai' }
  ];
  for (const p of pincodes) {
    statements.push(`INSERT INTO PINCODE_CITY (Pincode, City) VALUES ('${p.pin}', '${p.city}');`);
  }

  // 2. SUPPLIER & SUPPLIER_CONTACT
  const suppliers = [
    { id: 'S01', name: 'Shree Ganesh Stationers', street: '14 Shalimar Chowk', pin: '422001', contacts: ['9800010001', '9800010002'] },
    { id: 'S02', name: 'Nashik Paper Mart', street: 'Plot 7 Dwarka Circle', pin: '422011', contacts: ['9800020001', '9800020002', '9800020003'] },
    { id: 'S03', name: 'Patil Book Depot', street: '21 College Road', pin: '422005', contacts: ['9800030001'] },
    { id: 'S04', name: 'Sai Office Solutions', street: '5 Gangapur Road', pin: '422013', contacts: ['9800040001', '9800040002'] },
    { id: 'S05', name: 'Deshmukh Traders (Wholesale)', street: '9 Panchavati Market', pin: '422003', contacts: ['9800050001'] },
    { id: 'S06', name: 'Mahalaxmi Computers & Peripherals', street: '3 Nashik Road Station Area', pin: '422101', contacts: ['9800060001'] },
    { id: 'S07', name: 'Pune Office Hub', street: '88 Laxmi Road', pin: '411002', contacts: ['9800070001', '9800070002'] },
    { id: 'S08', name: 'Bombay Stationery Wholesale', street: '12 Crawford Market', pin: '400001', contacts: ['9800080001'] }
  ];
  for (const s of suppliers) {
    statements.push(`INSERT INTO SUPPLIER (SupplierID, SupplierName, Street, Pincode) VALUES ('${s.id}', '${s.name.replace(/'/g, "''")}', '${s.street.replace(/'/g, "''")}', '${s.pin}');`);
    for (const c of s.contacts) {
      statements.push(`INSERT INTO SUPPLIER_CONTACT (SupplierID, ContactNo) VALUES ('${s.id}', '${c}');`);
    }
  }

  // 3. DEPARTMENT
  const departments = [
    { id: 'D01', name: 'Administration' },
    { id: 'D02', name: 'Computer Engineering' },
    { id: 'D03', name: 'Information Technology' },
    { id: 'D04', name: 'Mechanical Engineering' },
    { id: 'D05', name: 'Civil Engineering' },
    { id: 'D06', name: 'Electronics & Telecommunication' },
    { id: 'D07', name: 'Library' },
    { id: 'D08', name: 'Accounts' },
    { id: 'D09', name: 'Examination Cell' },
    { id: 'D10', name: 'Training & Placement' },
    { id: 'D11', name: 'Central Store' }
  ];
  for (const d of departments) {
    statements.push(`INSERT INTO DEPARTMENT (DeptID, DeptName) VALUES ('${d.id}', '${d.name.replace(/'/g, "''")}');`);
  }

  // 4. EMPLOYEE
  const employees = [
    { id: 'E001', name: 'Mr. Suresh Pawar', desig: 'Administrative Officer', dept: 'D01', mgr: null, email: 'suresh.pawar@institute.example', phone: '9822010001' },
    { id: 'E002', name: 'Mrs. Vandana Salunke', desig: 'Office Superintendent', dept: 'D01', mgr: 'E001', email: 'vandana.salunke@institute.example', phone: '9822010002' },
    { id: 'E003', name: 'Mr. Amit Jadhav', desig: 'Store Keeper', dept: 'D11', mgr: 'E001', email: 'amit.jadhav@institute.example', phone: '9822010003' },
    { id: 'E004', name: 'Mr. Ganesh Shinde', desig: 'Store Assistant', dept: 'D11', mgr: 'E003', email: 'ganesh.shinde@institute.example', phone: '9822010004' },
    { id: 'E005', name: 'Dr. Sunita Kulkarni', desig: 'Head of Department', dept: 'D02', mgr: 'E001', email: 'sunita.kulkarni@institute.example', phone: '9822010005' },
    { id: 'E006', name: 'Prof. Rahul Deshmukh', desig: 'Associate Professor', dept: 'D02', mgr: 'E005', email: 'rahul.deshmukh@institute.example', phone: '9822010006' },
    { id: 'E007', name: 'Prof. Neha Joshi', desig: 'Assistant Professor', dept: 'D02', mgr: 'E005', email: 'neha.joshi@institute.example', phone: '9822010007' },
    { id: 'E008', name: 'Mr. Prasad More', desig: 'Lab Assistant', dept: 'D02', mgr: 'E005', email: 'prasad.more@institute.example', phone: '9822010008' },
    { id: 'E009', name: 'Dr. Vivek Patil', desig: 'Head of Department', dept: 'D03', mgr: 'E001', email: 'vivek.patil@institute.example', phone: '9822010009' },
    { id: 'E010', name: 'Prof. Pooja Gaikwad', desig: 'Assistant Professor', dept: 'D03', mgr: 'E009', email: 'pooja.gaikwad@institute.example', phone: '9822010010' },
    { id: 'E011', name: 'Mr. Sagar Bhosale', desig: 'Lab Assistant', dept: 'D03', mgr: 'E009', email: 'sagar.bhosale@institute.example', phone: '9822010011' },
    { id: 'E012', name: 'Dr. Anil Chavan', desig: 'Head of Department', dept: 'D04', mgr: 'E001', email: 'anil.chavan@institute.example', phone: '9822010012' },
    { id: 'E013', name: 'Prof. Mahesh Kadam', desig: 'Assistant Professor', dept: 'D04', mgr: 'E012', email: 'mahesh.kadam@institute.example', phone: '9822010013' },
    { id: 'E014', name: 'Mr. Dnyaneshwar Gite', desig: 'Workshop Instructor', dept: 'D04', mgr: 'E012', email: 'dnyaneshwar.gite@institute.example', phone: '9822010014' },
    { id: 'E015', name: 'Dr. Rekha Bhalerao', desig: 'Head of Department', dept: 'D05', mgr: 'E001', email: 'rekha.bhalerao@institute.example', phone: '9822010015' },
    { id: 'E016', name: 'Prof. Tushar Sonawane', desig: 'Assistant Professor', dept: 'D05', mgr: 'E015', email: 'tushar.sonawane@institute.example', phone: '9822010016' },
    { id: 'E017', name: 'Dr. Meena Thakur', desig: 'Head of Department', dept: 'D06', mgr: 'E001', email: 'meena.thakur@institute.example', phone: '9822010017' },
    { id: 'E018', name: 'Prof. Kiran Ahire', desig: 'Assistant Professor', dept: 'D06', mgr: 'E017', email: 'kiran.ahire@institute.example', phone: '9822010018' },
    { id: 'E019', name: 'Mrs. Anita Gosavi', desig: 'Librarian', dept: 'D07', mgr: 'E001', email: 'anita.gosavi@institute.example', phone: '9822010019' },
    { id: 'E020', name: 'Mr. Yogesh Nikam', desig: 'Library Assistant', dept: 'D07', mgr: 'E019', email: 'yogesh.nikam@institute.example', phone: '9822010020' },
    { id: 'E021', name: 'Mr. Dattatray Kale', desig: 'Accountant', dept: 'D08', mgr: 'E001', email: 'dattatray.kale@institute.example', phone: '9822010021' },
    { id: 'E022', name: 'Mrs. Shweta Mahajan', desig: 'Accounts Clerk', dept: 'D08', mgr: 'E021', email: 'shweta.mahajan@institute.example', phone: '9822010022' },
    { id: 'E023', name: 'Prof. Sandeep Borse', desig: 'Exam Controller', dept: 'D09', mgr: 'E001', email: 'sandeep.borse@institute.example', phone: '9822010023' },
    { id: 'E024', name: 'Ms. Komal Dhumal', desig: 'Exam Clerk', dept: 'D09', mgr: 'E023', email: 'komal.dhumal@institute.example', phone: '9822010024' },
    { id: 'E025', name: 'Prof. Archana Dandekar', desig: 'T&P Officer', dept: 'D10', mgr: 'E001', email: 'archana.dandekar@institute.example', phone: '9822010025' }
  ];
  for (const e of employees) {
    const mgrVal = e.mgr ? `'${e.mgr}'` : 'NULL';
    statements.push(`INSERT INTO EMPLOYEE (EmpID, EmpName, Designation, DeptID, ManagerID, Email, Phone) VALUES ('${e.id}', '${e.name.replace(/'/g, "''")}', '${e.desig}', '${e.dept}', ${mgrVal}, '${e.email}', '${e.phone}');`);
  }

  // 5. ROLE & PERMISSION
  const roles = [
    { name: 'ADMIN', desc: 'System Superuser with unconstrained DDL, DML, and security administration privileges' },
    { name: 'STORE_KEEPER', desc: 'Central Inventory Controller managing stock catalog, purchases, issues, and fulfillment' },
    { name: 'DEPT_HEAD', desc: 'Academic and administrative unit lead authorized to raise and approve departmental requisitions' },
    { name: 'ACCOUNTANT', desc: 'Financial officer auditing procurement expenditures and stock valuation reports' },
    { name: 'AUDITOR', desc: 'Read-only compliance auditor inspecting system logs, audit trails, and ledgers' }
  ];
  for (const r of roles) {
    statements.push(`INSERT INTO ROLE (RoleName, Description) VALUES ('${r.name}', '${r.desc.replace(/'/g, "''")}');`);
  }

  // Permissions matrix
  const permissions: [string, string, string][] = [
    // ADMIN has all actions
    ['ADMIN', 'ITEM', 'READ'], ['ADMIN', 'ITEM', 'CREATE'], ['ADMIN', 'ITEM', 'UPDATE'], ['ADMIN', 'ITEM', 'DELETE'],
    ['ADMIN', 'SUPPLIER', 'READ'], ['ADMIN', 'SUPPLIER', 'CREATE'], ['ADMIN', 'SUPPLIER', 'UPDATE'], ['ADMIN', 'SUPPLIER', 'DELETE'],
    ['ADMIN', 'PURCHASE', 'READ'], ['ADMIN', 'PURCHASE', 'CREATE'], ['ADMIN', 'PURCHASE', 'DELETE'],
    ['ADMIN', 'ISSUE', 'READ'], ['ADMIN', 'ISSUE', 'CREATE'], ['ADMIN', 'ISSUE', 'DELETE'],
    ['ADMIN', 'REQUISITION', 'READ'], ['ADMIN', 'REQUISITION', 'CREATE'], ['ADMIN', 'REQUISITION', 'APPROVE'], ['ADMIN', 'REQUISITION', 'FULFIL'],
    ['ADMIN', 'AUDIT_LOG', 'READ'], ['ADMIN', 'REPORT', 'READ'], ['ADMIN', 'REPORT', 'EXPORT'], ['ADMIN', 'SECURITY', 'UPDATE'],

    // STORE_KEEPER
    ['STORE_KEEPER', 'ITEM', 'READ'], ['STORE_KEEPER', 'ITEM', 'CREATE'], ['STORE_KEEPER', 'ITEM', 'UPDATE'],
    ['STORE_KEEPER', 'SUPPLIER', 'READ'], ['STORE_KEEPER', 'SUPPLIER', 'CREATE'], ['STORE_KEEPER', 'SUPPLIER', 'UPDATE'],
    ['STORE_KEEPER', 'PURCHASE', 'READ'], ['STORE_KEEPER', 'PURCHASE', 'CREATE'],
    ['STORE_KEEPER', 'ISSUE', 'READ'], ['STORE_KEEPER', 'ISSUE', 'CREATE'],
    ['STORE_KEEPER', 'REQUISITION', 'READ'], ['STORE_KEEPER', 'REQUISITION', 'FULFIL'],
    ['STORE_KEEPER', 'REPORT', 'READ'], ['STORE_KEEPER', 'REPORT', 'EXPORT'],

    // DEPT_HEAD
    ['DEPT_HEAD', 'ITEM', 'READ'],
    ['DEPT_HEAD', 'ISSUE', 'READ'],
    ['DEPT_HEAD', 'REQUISITION', 'READ'], ['DEPT_HEAD', 'REQUISITION', 'CREATE'], ['DEPT_HEAD', 'REQUISITION', 'APPROVE'],
    ['DEPT_HEAD', 'REPORT', 'READ'],

    // ACCOUNTANT
    ['ACCOUNTANT', 'ITEM', 'READ'],
    ['ACCOUNTANT', 'SUPPLIER', 'READ'],
    ['ACCOUNTANT', 'PURCHASE', 'READ'], ['ACCOUNTANT', 'PURCHASE', 'CREATE'],
    ['ACCOUNTANT', 'ISSUE', 'READ'],
    ['ACCOUNTANT', 'REPORT', 'READ'], ['ACCOUNTANT', 'REPORT', 'EXPORT'],

    // AUDITOR (Read-only everywhere)
    ['AUDITOR', 'ITEM', 'READ'],
    ['AUDITOR', 'SUPPLIER', 'READ'],
    ['AUDITOR', 'PURCHASE', 'READ'],
    ['AUDITOR', 'ISSUE', 'READ'],
    ['AUDITOR', 'REQUISITION', 'READ'],
    ['AUDITOR', 'AUDIT_LOG', 'READ'],
    ['AUDITOR', 'REPORT', 'READ']
  ];
  for (const [role, res, act] of permissions) {
    statements.push(`INSERT INTO PERMISSION (RoleName, Resource, Action) VALUES ('${role}', '${res}', '${act}');`);
  }

  // 6. APP_USER (password Demo@123)
  // Salt: 'salt_claystock_demo', SHA-256('Demo@123salt_claystock_demo') = a9e7e5944d18721c5f3e9e1cb46fb26dff0dfb199e846059d073b6aa47854fc0
  const salt = 'salt_claystock_demo';
  const demoHash = 'a9e7e5944d18721c5f3e9e1cb46fb26dff0dfb199e846059d073b6aa47854fc0';
  const users = [
    { id: 'U01', username: 'suresh.pawar', role: 'ADMIN', emp: 'E001' },
    { id: 'U02', username: 'amit.jadhav', role: 'STORE_KEEPER', emp: 'E003' },
    { id: 'U03', username: 'sunita.kulkarni', role: 'DEPT_HEAD', emp: 'E005' },
    { id: 'U04', username: 'vivek.patil', role: 'DEPT_HEAD', emp: 'E009' },
    { id: 'U05', username: 'dattatray.kale', role: 'ACCOUNTANT', emp: 'E021' },
    { id: 'U06', username: 'shweta.mahajan', role: 'AUDITOR', emp: 'E022' }
  ];
  for (const u of users) {
    statements.push(`INSERT INTO APP_USER (UserID, Username, PasswordHash, Salt, RoleName, EmpID) VALUES ('${u.id}', '${u.username}', '${demoHash}', '${salt}', '${u.role}', '${u.emp}');`);
  }

  // 7. 46 ITEMS (I101 to I146)
  interface ItemDef {
    id: string;
    name: string;
    category: string;
    price: number;
    type: 'C' | 'D';
    reorderLevel?: number;
    warranty?: number;
    hasBatches?: boolean;
  }
  const itemCatalog: ItemDef[] = [
    // Paper & Notebooks
    { id: 'I101', name: 'JK Copier A4 Paper 75 GSM (500 sheets)', category: 'Paper & Notebooks', price: 285, type: 'C', reorderLevel: 40 },
    { id: 'I102', name: 'Double A A4 Paper 80 GSM (500 sheets)', category: 'Paper & Notebooks', price: 390, type: 'C', reorderLevel: 20 },
    { id: 'I103', name: 'Classmate Long Notebook 172 Pages', category: 'Paper & Notebooks', price: 78, type: 'C', reorderLevel: 60 },
    { id: 'I104', name: 'Classmate Spiral Notebook 300 Pages', category: 'Paper & Notebooks', price: 120, type: 'C', reorderLevel: 30 },
    { id: 'I105', name: 'Laboratory Record Book 100 Pages', category: 'Paper & Notebooks', price: 65, type: 'C', reorderLevel: 80 },
    { id: 'I106', name: 'Answer Booklet 40 Pages (Stitched)', category: 'Paper & Notebooks', price: 14, type: 'C', reorderLevel: 1000 },
    { id: 'I107', name: 'Post-it Sticky Notes 3x3 inch (100 sheets)', category: 'Paper & Notebooks', price: 45, type: 'C', reorderLevel: 25 },
    { id: 'I108', name: 'White Chart Paper Sheet', category: 'Paper & Notebooks', price: 8, type: 'C', reorderLevel: 100 },

    // Writing & Marking
    { id: 'I109', name: 'Reynolds Trimax Ball Pen Blue', category: 'Writing & Marking', price: 10, type: 'C', reorderLevel: 200 },
    { id: 'I110', name: 'Reynolds Trimax Ball Pen Black', category: 'Writing & Marking', price: 10, type: 'C', reorderLevel: 150 },
    { id: 'I111', name: 'Cello Butterflow Ball Pen Red', category: 'Writing & Marking', price: 10, type: 'C', reorderLevel: 60 },
    { id: 'I112', name: 'Pilot V5 Hi-Tecpoint Pen Blue', category: 'Writing & Marking', price: 140, type: 'C', reorderLevel: 15 }, // Demo: 0 stock
    { id: 'I113', name: 'Apsara Platinum Pencil (Pack of 10)', category: 'Writing & Marking', price: 55, type: 'C', reorderLevel: 20 },
    { id: 'I114', name: 'Apsara Non-Dust Eraser', category: 'Writing & Marking', price: 5, type: 'C', reorderLevel: 50 },
    { id: 'I115', name: 'Camlin Permanent Marker Black', category: 'Writing & Marking', price: 30, type: 'C', reorderLevel: 40, hasBatches: true },
    { id: 'I116', name: 'Luxor Whiteboard Marker Blue', category: 'Writing & Marking', price: 32, type: 'C', reorderLevel: 60, hasBatches: true },
    { id: 'I117', name: 'Luxor Whiteboard Marker Black', category: 'Writing & Marking', price: 32, type: 'C', reorderLevel: 60, hasBatches: true },
    { id: 'I118', name: 'Camlin Highlighter Yellow', category: 'Writing & Marking', price: 35, type: 'C', reorderLevel: 25 },
    { id: 'I119', name: 'Faber-Castell Correction Pen', category: 'Writing & Marking', price: 40, type: 'C', reorderLevel: 20, hasBatches: true },

    // Files & Folders
    { id: 'I120', name: 'Solo Box File A4', category: 'Files & Folders', price: 85, type: 'C', reorderLevel: 40 },
    { id: 'I121', name: 'Lever Arch File A4', category: 'Files & Folders', price: 110, type: 'C', reorderLevel: 20 },
    { id: 'I122', name: 'Transparent L-Folder A4 (Pack of 12)', category: 'Files & Folders', price: 95, type: 'C', reorderLevel: 15 },
    { id: 'I123', name: 'Manila Cardboard File Folder', category: 'Files & Folders', price: 12, type: 'C', reorderLevel: 150 },
    { id: 'I124', name: 'Plastic Spring Clip File', category: 'Files & Folders', price: 35, type: 'C', reorderLevel: 60 },

    // Office Supplies
    { id: 'I125', name: 'Kangaro HD-10D Stapler', category: 'Office Supplies', price: 120, type: 'D', warranty: 6 },
    { id: 'I126', name: 'Kangaro 24/6 Staple Pins (Box of 1000)', category: 'Office Supplies', price: 22, type: 'C', reorderLevel: 80 },
    { id: 'I127', name: 'Kangaro DP-600 Hole Punch', category: 'Office Supplies', price: 310, type: 'D', warranty: 6 },
    { id: 'I128', name: 'Paper Clips Gem Type (Box of 100)', category: 'Office Supplies', price: 20, type: 'C', reorderLevel: 40 },
    { id: 'I129', name: 'Binder Clips 32 mm (Box of 12)', category: 'Office Supplies', price: 70, type: 'C', reorderLevel: 20 }, // Dead stock
    { id: 'I130', name: 'Fevistik Glue Stick 15 g', category: 'Office Supplies', price: 25, type: 'C', reorderLevel: 40, hasBatches: true },
    { id: 'I131', name: 'Fevicol MR 125 g', category: 'Office Supplies', price: 50, type: 'C', reorderLevel: 20, hasBatches: true },
    { id: 'I132', name: 'Stainless Steel Scissors 8 inch', category: 'Office Supplies', price: 90, type: 'D', warranty: 0 },
    { id: 'I133', name: 'Cello Tape Transparent 1 inch', category: 'Office Supplies', price: 35, type: 'C', reorderLevel: 30 },
    { id: 'I134', name: 'Brown Packing Tape 2 inch', category: 'Office Supplies', price: 60, type: 'C', reorderLevel: 15 }, // Dead stock
    { id: 'I135', name: 'Stamp Pad Ink Blue 30 ml', category: 'Office Supplies', price: 45, type: 'C', reorderLevel: 15, hasBatches: true },
    { id: 'I136', name: 'Whiteboard Duster', category: 'Office Supplies', price: 40, type: 'C', reorderLevel: 20 },
    { id: 'I137', name: 'Desk Organizer 3-Compartment', category: 'Office Supplies', price: 250, type: 'D', warranty: 0 }, // Dead stock
    { id: 'I138', name: 'Push Pins (Box of 50)', category: 'Office Supplies', price: 30, type: 'C', reorderLevel: 25 },

    // Electronics & Consumables
    { id: 'I139', name: 'Casio MJ-120D Plus Desktop Calculator', category: 'Electronics & Hardware', price: 480, type: 'D', warranty: 24 },
    { id: 'I140', name: 'Casio fx-991EX Scientific Calculator', category: 'Electronics & Hardware', price: 1250, type: 'D', warranty: 24 },
    { id: 'I141', name: 'HP v236w 32 GB USB Pen Drive', category: 'Electronics & Hardware', price: 650, type: 'D', warranty: 60 },
    { id: 'I142', name: 'Logitech B100 Optical USB Mouse', category: 'Electronics & Hardware', price: 350, type: 'D', warranty: 36 },
    { id: 'I143', name: 'Logitech K120 USB Keyboard', category: 'Electronics & Hardware', price: 720, type: 'D', warranty: 36 },
    { id: 'I144', name: 'Anchor Roma 4-Socket Extension Board', category: 'Electronics & Hardware', price: 380, type: 'D', warranty: 12 },
    { id: 'I145', name: 'HP 88A Black Toner Cartridge', category: 'Electronics & Hardware', price: 4200, type: 'C', reorderLevel: 3, hasBatches: true }, // Demo: 0 stock
    { id: 'I146', name: 'Canon PG-47 Black Ink Cartridge', category: 'Electronics & Hardware', price: 650, type: 'C', reorderLevel: 4, hasBatches: true }
  ];

  for (const it of itemCatalog) {
    statements.push(`INSERT INTO ITEM (ItemID, ItemName, Category, UnitPrice) VALUES ('${it.id}', '${it.name.replace(/'/g, "''")}', '${it.category}', ${it.price});`);
    if (it.type === 'C') {
      statements.push(`INSERT INTO CONSUMABLE_ITEM (ItemID, ReorderLevel) VALUES ('${it.id}', ${it.reorderLevel});`);
    } else {
      statements.push(`INSERT INTO DURABLE_ITEM (ItemID, WarrantyPeriod) VALUES ('${it.id}', ${it.warranty});`);
    }
  }

  // Stock Batches: Including 4 expiring within 30 days and 1 already expired
  const now = new Date();
  const fmtDate = (d: Date) => d.toISOString().split('T')[0];
  const addDays = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return fmtDate(d);
  };

  const batches = [
    { itemId: 'I115', batch: 'BAT-2025-C1', exp: addDays(12) },  // Expiring in 12 days
    { itemId: 'I116', batch: 'BAT-2025-L2', exp: addDays(25) },  // Expiring in 25 days
    { itemId: 'I130', batch: 'BAT-2025-F1', exp: addDays(-15) }, // Already expired (15 days ago)
    { itemId: 'I131', batch: 'BAT-2025-F2', exp: addDays(8) },   // Expiring in 8 days
    { itemId: 'I135', batch: 'BAT-2025-S1', exp: addDays(20) },  // Expiring in 20 days
    { itemId: 'I146', batch: 'BAT-2025-CN', exp: addDays(18) },  // Expiring in 18 days
    { itemId: 'I119', batch: 'BAT-2026-A1', exp: addDays(180) }, // Valid
    { itemId: 'I145', batch: 'BAT-2026-H1', exp: addDays(365) }  // Valid
  ];
  for (const b of batches) {
    statements.push(`INSERT INTO STOCK_BATCH (ItemID, BatchNo, ExpiryDate) VALUES ('${b.itemId}', '${b.batch}', '${b.exp}');`);
  }

  // Exact project document examples:
  // PO1001: I123 from S01 on 2026-01-02, qty 500, cost 4500
  // PO1002: I123 from S01 on 2026-03-14, qty 300, cost 2850
  statements.push(`INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO1001', 'I123', 'S01', '2026-01-02', 500, 4500.0);`);
  statements.push(`INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO1002', 'I123', 'S01', '2026-03-14', 300, 2850.0);`);

  // Build baseline purchases (~160 purchases) and issues (~420 issues)
  // We track item purchased and issued counts to satisfy all constraints and demo states
  const totalPurchased = new Map<string, number>();
  const totalIssued = new Map<string, number>();

  totalPurchased.set('I123', 800);

  let purchaseSeq = 1003;
  let issueSeq = 2001;

  // Initial bulk purchase for each item across the 12 months
  for (const it of itemCatalog) {
    if (it.id === 'I123') continue;

    // Determine target purchase quantity based on item nature
    let baseQty = 80;
    if (it.id === 'I106') baseQty = 4000; // Answer Booklets
    else if (it.id === 'I101' || it.id === 'I102') baseQty = 300; // A4 Paper
    else if (it.id === 'I105') baseQty = 400; // Lab records
    else if (it.category === 'Writing & Marking') baseQty = 250;
    else if (it.category === 'Office Supplies') baseQty = 120;
    else if (it.category === 'Electronics & Hardware') baseQty = 35;

    // Pick 2 to 4 purchase dates over the past 300 days
    const numOrders = it.category === 'Electronics & Hardware' ? 2 : 3 + Math.floor(prng() * 2);
    for (let o = 0; o < numOrders; o++) {
      const pId = `PO${purchaseSeq++}`;
      const daysAgo = 320 - o * 75 - Math.floor(prng() * 30);
      const pDate = addDays(-Math.max(daysAgo, 5));
      const sIndex = Math.floor(prng() * suppliers.length);
      const supplierId = suppliers[sIndex].id;
      const orderQty = Math.max(10, Math.floor(baseQty / numOrders) + Math.floor(prng() * 20));

      // Cost factor: 0.88 to 1.00 (bulk discount), except 2 deliberate price spikes > 15% above catalog price
      let unitCost = it.price * (0.88 + prng() * 0.12);
      if ((it.id === 'I101' && o === 0) || (it.id === 'I142' && o === 0)) {
        unitCost = it.price * 1.25; // Deliberate price variance spike (>15% above catalog UnitPrice)!
      }
      const totalCost = Math.round(orderQty * unitCost);

      statements.push(`INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('${pId}', '${it.id}', '${supplierId}', '${pDate}', ${orderQty}, ${totalCost});`);
      totalPurchased.set(it.id, (totalPurchased.get(it.id) || 0) + orderQty);
    }
  }

  // Guaranteed Demo situations for stock:
  // 1. Zero stock for I112 (Pilot V5) and I145 (HP 88A toner): All purchased quantity will be issued!
  // 2. Low stock (at or below reorder level) for:
  //    - I101 (JK Copier): ReorderLevel 40 -> leave 25 units
  //    - I107 (Post-it): ReorderLevel 25 -> leave 12 units
  //    - I115 (Camlin Marker): ReorderLevel 40 -> leave 18 units
  //    - I120 (Solo Box File): ReorderLevel 40 -> leave 20 units
  // 3. Dead stock (no issues in last 90 days):
  //    - I129 (Binder Clips)
  //    - I134 (Brown Packing Tape)
  //    - I137 (Desk Organizer)

  const deadStockIds = new Set(['I129', 'I134', 'I137']);
  const zeroStockIds = new Set(['I112', 'I145']);
  const lowStockTargets = new Map<string, number>([
    ['I101', 25],
    ['I107', 12],
    ['I115', 18],
    ['I120', 20]
  ]);

  // Generate Issues (~420 issues)
  for (const it of itemCatalog) {
    const purchased = totalPurchased.get(it.id) || 0;
    let targetStockRemaining = 0;

    if (zeroStockIds.has(it.id)) {
      targetStockRemaining = 0;
    } else if (lowStockTargets.has(it.id)) {
      targetStockRemaining = lowStockTargets.get(it.id)!;
    } else if (deadStockIds.has(it.id)) {
      // Leave plenty of stock, but all issues occurred over 100 days ago
      targetStockRemaining = Math.floor(purchased * 0.6);
    } else {
      // Healthy stock: leave 30% to 65% remaining
      targetStockRemaining = Math.max(10, Math.floor(purchased * (0.35 + prng() * 0.3)));
    }

    const totalToIssue = Math.max(0, purchased - targetStockRemaining);
    if (totalToIssue <= 0) continue;

    // Distribute into 6 to 14 issue events
    const numIssues = deadStockIds.has(it.id) ? 3 : 7 + Math.floor(prng() * 7);
    let remainingToIssue = totalToIssue;

    for (let i = 0; i < numIssues && remainingToIssue > 0; i++) {
      const isLast = (i === numIssues - 1);
      const isDeadStock = deadStockIds.has(it.id);

      // Quantities per issue
      let issueQty = isLast ? remainingToIssue : Math.max(1, Math.floor(totalToIssue / numIssues) + Math.floor((prng() - 0.5) * 5));
      if (issueQty > remainingToIssue) issueQty = remainingToIssue;
      remainingToIssue -= issueQty;

      // Issue date distribution
      let daysAgo = 0;
      if (isDeadStock) {
        // Must be older than 95 days
        daysAgo = 110 + Math.floor(prng() * 180);
      } else {
        // Natural spread from 300 days ago up to yesterday
        daysAgo = Math.max(1, Math.floor(300 * (1 - (i / numIssues)) + (prng() * 15 - 7)));
      }
      const issueDate = addDays(-daysAgo);

      // Department selection (exam cell gets exam booklets, etc.)
      let deptId = departments[Math.floor(prng() * departments.length)].id;
      if (it.id === 'I106' || it.id === 'I105') {
        deptId = prng() > 0.4 ? 'D09' : 'D02'; // Exam Cell or CS
      } else if (it.category === 'Paper & Notebooks' && prng() > 0.5) {
        deptId = 'D01'; // Admin
      } else if (it.category === 'Files & Folders' && prng() > 0.6) {
        deptId = 'D07'; // Library
      }

      // Employee issue (demo: employee issues with EmpID matching dept)
      const deptEmployees = employees.filter(e => e.dept === deptId);
      let empId: string | null = null;
      if (deptEmployees.length > 0 && prng() > 0.45) {
        empId = deptEmployees[Math.floor(prng() * deptEmployees.length)].id;
      }

      const issueId = `IS${issueSeq++}`;
      const empSqlVal = empId ? `'${empId}'` : 'NULL';

      statements.push(`INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, EmpID, ReqID, IssueDate, Quantity) VALUES ('${issueId}', '${it.id}', '${deptId}', ${empSqlVal}, NULL, '${issueDate}', ${issueQty});`);
      totalIssued.set(it.id, (totalIssued.get(it.id) || 0) + issueQty);
    }
  }

  // 8. REQUISITIONS & REQUISITION_LINES (~15 requisitions across all statuses)
  // Statuses: 6 FULFILLED, 3 APPROVED, 3 SUBMITTED, 2 REJECTED, 1 PARTIALLY_FULFILLED
  const reqDefinitions = [
    // FULFILLED
    { id: 'REQ-101', dept: 'D02', emp: 'E006', date: addDays(-45), status: 'FULFILLED', approver: 'U03', remarks: 'Semester practical lab requirements', lines: [{ item: 'I101', req: 15, app: 15 }, { item: 'I116', req: 10, app: 10 }] },
    { id: 'REQ-102', dept: 'D03', emp: 'E010', date: addDays(-40), status: 'FULFILLED', approver: 'U04', remarks: 'Whiteboard marker supplies for lecture halls', lines: [{ item: 'I117', req: 8, app: 8 }, { item: 'I136', req: 4, app: 4 }] },
    { id: 'REQ-103', dept: 'D01', emp: 'E002', date: addDays(-32), status: 'FULFILLED', approver: 'U01', remarks: 'Executive office files and folders', lines: [{ item: 'I121', req: 12, app: 12 }, { item: 'I107', req: 10, app: 10 }] },
    { id: 'REQ-104', dept: 'D09', emp: 'E024', date: addDays(-28), status: 'FULFILLED', approver: 'U01', remarks: 'Pre-exam document dispatch files', lines: [{ item: 'I123', req: 100, app: 100 }, { item: 'I133', req: 15, app: 15 }] },
    { id: 'REQ-105', dept: 'D04', emp: 'E013', date: addDays(-20), status: 'FULFILLED', approver: 'U01', remarks: 'CAD Lab printout paper', lines: [{ item: 'I102', req: 8, app: 8 }] },
    { id: 'REQ-106', dept: 'D07', emp: 'E020', date: addDays(-16), status: 'FULFILLED', approver: 'U01', remarks: 'Library accession registers & adhesive', lines: [{ item: 'I130', req: 10, app: 10 }, { item: 'I122', req: 6, app: 6 }] },

    // APPROVED (Awaiting fulfillment by Store Keeper)
    { id: 'REQ-107', dept: 'D02', emp: 'E007', date: addDays(-5), status: 'APPROVED', approver: 'U03', remarks: 'AI/ML Project documentation reams', lines: [{ item: 'I101', req: 10, app: 10 }, { item: 'I124', req: 25, app: 25 }] },
    { id: 'REQ-108', dept: 'D03', emp: 'E011', date: addDays(-3), status: 'APPROVED', approver: 'U04', remarks: 'Network maintenance replacement mice', lines: [{ item: 'I142', req: 4, app: 4 }] },
    { id: 'REQ-109', dept: 'D08', emp: 'E022', date: addDays(-2), status: 'APPROVED', approver: 'U05', remarks: 'Annual budget record binders', lines: [{ item: 'I120', req: 15, app: 15 }] },

    // SUBMITTED (Awaiting approval from HOD)
    { id: 'REQ-110', dept: 'D02', emp: 'E008', date: addDays(-2), status: 'SUBMITTED', approver: null, remarks: 'Programming lab printer toner & A4 paper', lines: [{ item: 'I101', req: 12, app: null }, { item: 'I145', req: 2, app: null }] },
    { id: 'REQ-111', dept: 'D06', emp: 'E018', date: addDays(-1), status: 'SUBMITTED', approver: null, remarks: 'Microcontroller lab pens and notebooks', lines: [{ id: 'I103', req: 30, app: null }, { item: 'I109', req: 50, app: null }] },
    { id: 'REQ-112', dept: 'D10', emp: 'E025', date: addDays(0), status: 'SUBMITTED', approver: null, remarks: 'Campus recruitment drive stationery kit', lines: [{ item: 'I122', req: 20, app: null }, { item: 'I118', req: 10, app: null }] },

    // REJECTED
    { id: 'REQ-113', dept: 'D04', emp: 'E014', date: addDays(-10), status: 'REJECTED', approver: 'U01', remarks: 'Excessive USB drive request without lab justification', lines: [{ item: 'I141', req: 25, app: 0 }] },
    { id: 'REQ-114', dept: 'D05', emp: 'E016', date: addDays(-8), status: 'REJECTED', approver: 'U01', remarks: 'Budget exhausted for current quarter', lines: [{ item: 'I140', req: 15, app: 0 }] },

    // PARTIALLY_FULFILLED (Shortfall on I145 toner which is 0 stock!)
    { id: 'REQ-115', dept: 'D02', emp: 'E006', date: addDays(-4), status: 'PARTIALLY_FULFILLED', approver: 'U03', remarks: 'HOD cabin emergency stationery: paper fulfilled, toner short', lines: [{ item: 'I102', req: 5, app: 5 }, { item: 'I145', req: 2, app: 2 }] }
  ];

  for (const rq of reqDefinitions) {
    const apprVal = rq.approver ? `'${rq.approver}'` : 'NULL';
    statements.push(`INSERT INTO REQUISITION (ReqID, DeptID, EmpID, ReqDate, Status, ApprovedBy, Remarks) VALUES ('${rq.id}', '${rq.dept}', '${rq.emp}', '${rq.date}', '${rq.status}', ${apprVal}, '${rq.remarks.replace(/'/g, "''")}');`);
    let lineNo = 1;
    for (const l of rq.lines) {
      const itId = (l as any).item || (l as any).id;
      const appVal = l.app !== null && l.app !== undefined ? l.app : 'NULL';
      statements.push(`INSERT INTO REQUISITION_LINE (ReqID, LineNo, ItemID, QtyRequested, QtyApproved) VALUES ('${rq.id}', ${lineNo++}, '${itId}', ${l.req}, ${appVal});`);
    }
  }

  // Session Context initial defaults
  statements.push(`INSERT OR REPLACE INTO SESSION_CONTEXT (Key, Value) VALUES ('user', 'suresh.pawar');`);
  statements.push(`INSERT OR REPLACE INTO SESSION_CONTEXT (Key, Value) VALUES ('role', 'ADMIN');`);
  statements.push(`INSERT OR REPLACE INTO SESSION_CONTEXT (Key, Value) VALUES ('dept', 'D01');`);

  return statements.join('\n');
}
