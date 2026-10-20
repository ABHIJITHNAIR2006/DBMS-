import { DatabaseState } from './types';

export const INITIAL_DATABASE: DatabaseState = {
  PINCODE_CITY: [
    { Pincode: '422001', City: 'Nashik' },
    { Pincode: '422005', City: 'Nashik' },
    { Pincode: '422101', City: 'Nashik' },
    { Pincode: '411001', City: 'Pune' },
    { Pincode: '400001', City: 'Mumbai' }
  ],

  SUPPLIER: [
    { SupplierID: 'S01', SupplierName: 'ABC Traders', Street: '42 M.G. Road', Pincode: '422001' },
    { SupplierID: 'S02', SupplierName: 'XYZ Supplies', Street: '108 College Road', Pincode: '422005' },
    { SupplierID: 'S03', SupplierName: 'City Paper Co.', Street: '77 Shivaji Nagar', Pincode: '411001' },
    { SupplierID: 'S04', SupplierName: 'Gokhale Stationers', Street: '15 Main Road, Raviwar Peth', Pincode: '422001' },
    { SupplierID: 'S05', SupplierName: 'Patil Office Mart', Street: '24 Nariman Point', Pincode: '400001' }
  ],

  SUPPLIER_CONTACT: [
    { SupplierID: 'S01', ContactNo: '+91 98220 11223' },
    { SupplierID: 'S01', ContactNo: '+91 98220 11224' },
    { SupplierID: 'S02', ContactNo: '+91 94230 55667' },
    { SupplierID: 'S03', ContactNo: '+91 98231 88990' },
    { SupplierID: 'S03', ContactNo: '+91 20 2553 4411' },
    { SupplierID: 'S04', ContactNo: '+91 98901 33445' },
    { SupplierID: 'S05', ContactNo: '+91 98190 77889' },
    { SupplierID: 'S05', ContactNo: '+91 22 2288 9900' }
  ],

  DEPARTMENT: [
    { DeptID: 'D01', DeptName: 'Administration' },
    { DeptID: 'D02', DeptName: 'Computer Engineering' },
    { DeptID: 'D03', DeptName: 'Mechanical Engineering' },
    { DeptID: 'D04', DeptName: 'Central Library' },
    { DeptID: 'D05', DeptName: 'Accounts & Finance' },
    { DeptID: 'D06', DeptName: 'Examination Cell' }
  ],

  ITEM: [
    { ItemID: 'I101', ItemName: 'A4 Copier Paper Ream (75 GSM)', Category: 'Paper', UnitPrice: 280 },
    { ItemID: 'I123', ItemName: 'Legal Green Ledger Sheets', Category: 'Paper', UnitPrice: 9 }, // Required Project Document Example
    { ItemID: 'I102', ItemName: 'Blue Ballpoint Pens (Pack of 50)', Category: 'Writing', UnitPrice: 250 },
    { ItemID: 'I103', ItemName: 'Whiteboard Markers Assorted (Pack of 4)', Category: 'Writing', UnitPrice: 180 },
    { ItemID: 'I104', ItemName: 'Permanent Marker Chisel Tip (Black)', Category: 'Writing', UnitPrice: 35 },
    { ItemID: 'I105', ItemName: 'Box File Executive Deluxe (A4)', Category: 'Files & Folders', UnitPrice: 195 },
    { ItemID: 'I106', ItemName: 'Document Expanding File 12-Pocket', Category: 'Files & Folders', UnitPrice: 140 },
    { ItemID: 'I107', ItemName: 'Heavy Duty Metal Stapler (No. 10)', Category: 'Office Supplies', UnitPrice: 420 },
    { ItemID: 'I108', ItemName: 'Staple Pins No. 10 (Box of 20)', Category: 'Office Supplies', UnitPrice: 120 },
    { ItemID: 'I109', ItemName: 'Two-Hole Precision Punch Machine', Category: 'Office Supplies', UnitPrice: 310 },
    { ItemID: 'I110', ItemName: 'Whiteboard Refill Ink 15ml (Black)', Category: 'Office Supplies', UnitPrice: 65 },
    { ItemID: 'I111', ItemName: 'Scientific Calculator FX-991CW ClassWiz', Category: 'Electronics', UnitPrice: 1450 },
    { ItemID: 'I112', ItemName: '4-Port High Speed USB 3.0 Hub', Category: 'Electronics', UnitPrice: 680 },
    { ItemID: 'I113', ItemName: 'Mesh Metal Desk Organizer 6-Compartment', Category: 'Furniture accessories', UnitPrice: 380 }
  ],

  CONSUMABLE_ITEM: [
    { ItemID: 'I101', ReorderLevel: 40 },
    { ItemID: 'I123', ReorderLevel: 250 },
    { ItemID: 'I102', ReorderLevel: 15 },
    { ItemID: 'I103', ReorderLevel: 20 }, // Currently LOW stock
    { ItemID: 'I104', ReorderLevel: 30 }, // Currently ZERO stock
    { ItemID: 'I108', ReorderLevel: 25 }, // Currently LOW stock
    { ItemID: 'I110', ReorderLevel: 18 }
  ],

  DURABLE_ITEM: [
    { ItemID: 'I105', WarrantyPeriod: 12 },
    { ItemID: 'I106', WarrantyPeriod: 6 },
    { ItemID: 'I107', WarrantyPeriod: 24 },
    { ItemID: 'I109', WarrantyPeriod: 36 },
    { ItemID: 'I111', WarrantyPeriod: 36 },
    { ItemID: 'I112', WarrantyPeriod: 12 },
    { ItemID: 'I113', WarrantyPeriod: 18 }
  ],

  STOCK_BATCH: [
    { ItemID: 'I103', BatchNo: 'B01', ExpiryDate: '2026-10-28' }, // Expiring within 30 days!
    { ItemID: 'I103', BatchNo: 'B02', ExpiryDate: '2027-04-15' },
    { ItemID: 'I110', BatchNo: 'B01', ExpiryDate: '2026-11-08' }, // Expiring within 30 days!
    { ItemID: 'I110', BatchNo: 'B02', ExpiryDate: '2027-08-20' },
    { ItemID: 'I108', BatchNo: 'B01', ExpiryDate: '2028-12-31' }
  ],

  // 24 purchases spanning Feb 2026 - Oct 2026
  SUPPLIES: [
    // EXACT MANDATED EXAMPLE FROM SPECIFICATION:
    { PurchaseID: 'PO1001', ItemID: 'I123', SupplierID: 'S01', PurchaseDate: '2026-01-02', Quantity: 500, Cost: 4500 },
    { PurchaseID: 'PO1002', ItemID: 'I123', SupplierID: 'S01', PurchaseDate: '2026-03-14', Quantity: 300, Cost: 2850 },

    // Additional realistic purchases
    { PurchaseID: 'PO1003', ItemID: 'I101', SupplierID: 'S03', PurchaseDate: '2026-02-10', Quantity: 150, Cost: 42000 },
    { PurchaseID: 'PO1004', ItemID: 'I102', SupplierID: 'S04', PurchaseDate: '2026-02-18', Quantity: 60, Cost: 15000 },
    { PurchaseID: 'PO1005', ItemID: 'I103', SupplierID: 'S04', PurchaseDate: '2026-03-05', Quantity: 40, Cost: 7200 },
    { PurchaseID: 'PO1006', ItemID: 'I104', SupplierID: 'S02', PurchaseDate: '2026-03-20', Quantity: 50, Cost: 1750 },
    { PurchaseID: 'PO1007', ItemID: 'I105', SupplierID: 'S01', PurchaseDate: '2026-04-02', Quantity: 80, Cost: 15600 },
    { PurchaseID: 'PO1008', ItemID: 'I106', SupplierID: 'S01', PurchaseDate: '2026-04-15', Quantity: 50, Cost: 7000 },
    { PurchaseID: 'PO1009', ItemID: 'I107', SupplierID: 'S02', PurchaseDate: '2026-05-04', Quantity: 30, Cost: 12600 },
    { PurchaseID: 'PO1010', ItemID: 'I108', SupplierID: 'S04', PurchaseDate: '2026-05-18', Quantity: 60, Cost: 7200 },
    { PurchaseID: 'PO1011', ItemID: 'I109', SupplierID: 'S02', PurchaseDate: '2026-06-02', Quantity: 25, Cost: 7750 },
    { PurchaseID: 'PO1012', ItemID: 'I110', SupplierID: 'S04', PurchaseDate: '2026-06-12', Quantity: 45, Cost: 2925 },
    { PurchaseID: 'PO1013', ItemID: 'I111', SupplierID: 'S05', PurchaseDate: '2026-06-25', Quantity: 20, Cost: 29000 },
    { PurchaseID: 'PO1014', ItemID: 'I112', SupplierID: 'S05', PurchaseDate: '2026-07-08', Quantity: 25, Cost: 17000 },
    { PurchaseID: 'PO1015', ItemID: 'I113', SupplierID: 'S02', PurchaseDate: '2026-07-22', Quantity: 35, Cost: 13300 },
    { PurchaseID: 'PO1016', ItemID: 'I101', SupplierID: 'S03', PurchaseDate: '2026-08-05', Quantity: 100, Cost: 28000 },
    { PurchaseID: 'PO1017', ItemID: 'I102', SupplierID: 'S04', PurchaseDate: '2026-08-19', Quantity: 40, Cost: 10000 },
    { PurchaseID: 'PO1018', ItemID: 'I105', SupplierID: 'S01', PurchaseDate: '2026-09-02', Quantity: 30, Cost: 5850 },
    { PurchaseID: 'PO1019', ItemID: 'I111', SupplierID: 'S05', PurchaseDate: '2026-09-15', Quantity: 15, Cost: 21750 },
    { PurchaseID: 'PO1020', ItemID: 'I101', SupplierID: 'S03', PurchaseDate: '2026-09-28', Quantity: 80, Cost: 22400 },
    { PurchaseID: 'PO1021', ItemID: 'I107', SupplierID: 'S02', PurchaseDate: '2026-10-04', Quantity: 15, Cost: 6300 },
    { PurchaseID: 'PO1022', ItemID: 'I112', SupplierID: 'S05', PurchaseDate: '2026-10-10', Quantity: 10, Cost: 6800 }
  ],

  // 24 issues distributed across departments
  ISSUED_TO: [
    // Legal green paper issues (500 + 300 = 800 purchased)
    { IssueID: 'IS2001', ItemID: 'I123', DeptID: 'D06', IssueDate: '2026-01-15', Quantity: 200 },
    { IssueID: 'IS2002', ItemID: 'I123', DeptID: 'D05', IssueDate: '2026-03-25', Quantity: 250 },
    { IssueID: 'IS2003', ItemID: 'I123', DeptID: 'D01', IssueDate: '2026-05-10', Quantity: 150 }, // 800 - 600 = 200 remaining (below 250 reorder level!)

    // A4 paper (150 + 100 + 80 = 330 purchased)
    { IssueID: 'IS2004', ItemID: 'I101', DeptID: 'D02', IssueDate: '2026-02-20', Quantity: 60 },
    { IssueID: 'IS2005', ItemID: 'I101', DeptID: 'D04', IssueDate: '2026-04-10', Quantity: 40 },
    { IssueID: 'IS2006', ItemID: 'I101', DeptID: 'D06', IssueDate: '2026-06-18', Quantity: 80 },
    { IssueID: 'IS2007', ItemID: 'I101', DeptID: 'D03', IssueDate: '2026-08-25', Quantity: 50 }, // 330 - 230 = 100 remaining

    // Blue pens (60 + 40 = 100 purchased)
    { IssueID: 'IS2008', ItemID: 'I102', DeptID: 'D02', IssueDate: '2026-03-02', Quantity: 25 },
    { IssueID: 'IS2009', ItemID: 'I102', DeptID: 'D06', IssueDate: '2026-07-14', Quantity: 35 },
    { IssueID: 'IS2010', ItemID: 'I102', DeptID: 'D05', IssueDate: '2026-09-08', Quantity: 15 }, // 100 - 75 = 25 remaining

    // Whiteboard markers (40 purchased, issued 28 -> remaining 12, <= 20 reorder level! LOW STOCK)
    { IssueID: 'IS2011', ItemID: 'I103', DeptID: 'D02', IssueDate: '2026-03-12', Quantity: 15 },
    { IssueID: 'IS2012', ItemID: 'I103', DeptID: 'D03', IssueDate: '2026-08-10', Quantity: 13 },

    // Permanent marker black (50 purchased, 50 issued -> 0 remaining! OUT OF STOCK)
    { IssueID: 'IS2013', ItemID: 'I104', DeptID: 'D01', IssueDate: '2026-04-05', Quantity: 20 },
    { IssueID: 'IS2014', ItemID: 'I104', DeptID: 'D06', IssueDate: '2026-06-22', Quantity: 30 },

    // Box files (80 + 30 = 110 purchased)
    { IssueID: 'IS2015', ItemID: 'I105', DeptID: 'D05', IssueDate: '2026-04-20', Quantity: 25 },
    { IssueID: 'IS2016', ItemID: 'I105', DeptID: 'D01', IssueDate: '2026-07-30', Quantity: 30 },

    // Staplers (30 + 15 = 45 purchased)
    { IssueID: 'IS2017', ItemID: 'I107', DeptID: 'D02', IssueDate: '2026-05-15', Quantity: 10 },
    { IssueID: 'IS2018', ItemID: 'I107', DeptID: 'D04', IssueDate: '2026-08-12', Quantity: 8 },

    // Staple pins (60 purchased, 42 issued -> 18 remaining, <= 25 reorder level! LOW STOCK)
    { IssueID: 'IS2019', ItemID: 'I108', DeptID: 'D02', IssueDate: '2026-06-01', Quantity: 22 },
    { IssueID: 'IS2020', ItemID: 'I108', DeptID: 'D05', IssueDate: '2026-09-12', Quantity: 20 },

    // Punch machines (25 purchased, 12 issued -> 13 remaining)
    { IssueID: 'IS2021', ItemID: 'I109', DeptID: 'D03', IssueDate: '2026-06-20', Quantity: 12 },

    // Whiteboard refill ink (45 purchased, 25 issued -> 20 remaining)
    { IssueID: 'IS2022', ItemID: 'I110', DeptID: 'D02', IssueDate: '2026-07-01', Quantity: 25 },

    // Calculators (20 + 15 = 35 purchased, 18 issued -> 17 remaining)
    { IssueID: 'IS2023', ItemID: 'I111', DeptID: 'D02', IssueDate: '2026-07-15', Quantity: 10 },
    { IssueID: 'IS2024', ItemID: 'I111', DeptID: 'D03', IssueDate: '2026-09-25', Quantity: 8 },

    // USB Hubs (25 + 10 = 35 purchased, 14 issued -> 21 remaining)
    { IssueID: 'IS2025', ItemID: 'I112', DeptID: 'D02', IssueDate: '2026-08-01', Quantity: 14 }
  ]
};
