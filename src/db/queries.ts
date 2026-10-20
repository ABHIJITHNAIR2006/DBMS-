import { dbEngine } from './engine';
import { StockLedgerEntry, StockBatch, Supplies, IssuedTo } from './types';
import { appendSqlLog } from './sqlLog';

export interface MonthlyData {
  month: string; // e.g. "Feb 2026"
  purchasesQty: number;
  issuesQty: number;
  purchasesCost: number;
}

export interface PresetQuery {
  id: string;
  title: string;
  description: string;
  sql: string;
  execute: () => { columns: string[]; rows: (string | number)[][] };
}

export const queries = {
  // Stock ledger for an item (chronological transactions with running balance)
  getStockLedger(itemId: string): StockLedgerEntry[] {
    const state = dbEngine.getState();
    const item = state.ITEM.find(i => i.ItemID === itemId);
    if (!item) return [];

    const purchases = state.SUPPLIES
      .filter(s => s.ItemID === itemId)
      .map(s => {
        const supplier = state.SUPPLIER.find(sp => sp.SupplierID === s.SupplierID);
        return {
          type: 'PURCHASE' as const,
          id: s.PurchaseID,
          date: s.PurchaseDate,
          entityName: supplier ? supplier.SupplierName : s.SupplierID,
          inQty: s.Quantity,
          outQty: 0,
          costOrNote: s.Cost
        };
      });

    const issues = state.ISSUED_TO
      .filter(i => i.ItemID === itemId)
      .map(i => {
        const dept = state.DEPARTMENT.find(d => d.DeptID === i.DeptID);
        return {
          type: 'ISSUE' as const,
          id: i.IssueID,
          date: i.IssueDate,
          entityName: dept ? dept.DeptName : i.DeptID,
          inQty: 0,
          outQty: i.Quantity,
          costOrNote: undefined
        };
      });

    // Combine and sort chronologically
    const all = [...purchases, ...issues].sort((a, b) => a.date.localeCompare(b.date));

    let running = 0;
    const ledger: StockLedgerEntry[] = all.map(entry => {
      running += entry.inQty - entry.outQty;
      return {
        ...entry,
        runningBalance: running
      };
    });

    return ledger;
  },

  // Low stock and out-of-stock items
  getLowStockItems() {
    const stockList = dbEngine.getAllDerivedStock();
    return stockList.filter(s => s.status === 'Low Stock' || s.status === 'Out of Stock');
  },

  // Batches expiring within specified days (default 30 days)
  getExpiringBatches(withinDays = 30) {
    const state = dbEngine.getState();
    const today = new Date();
    const futureLimit = new Date();
    futureLimit.setDate(today.getDate() + withinDays);

    const todayStr = today.toISOString().split('T')[0];
    const limitStr = futureLimit.toISOString().split('T')[0];

    const expiring: Array<StockBatch & { itemName: string; daysRemaining: number }> = [];

    state.STOCK_BATCH.forEach(batch => {
      if (batch.ExpiryDate >= todayStr && batch.ExpiryDate <= limitStr) {
        const item = state.ITEM.find(i => i.ItemID === batch.ItemID);
        const expDate = new Date(batch.ExpiryDate);
        const diffMs = expDate.getTime() - today.getTime();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        expiring.push({
          ...batch,
          itemName: item?.ItemName ?? batch.ItemID,
          daysRemaining: Math.max(0, days)
        });
      }
    });

    return expiring.sort((a, b) => a.daysRemaining - b.daysRemaining);
  },

  // High-level Dashboard statistics
  getDashboardStats() {
    const state = dbEngine.getState();
    const stockList = dbEngine.getAllDerivedStock();

    const totalItems = state.ITEM.length;
    const totalStockUnits = stockList.reduce((sum, s) => sum + Math.max(0, s.currentStock), 0);
    const lowStockCount = stockList.filter(s => s.status === 'Low Stock' || s.status === 'Out of Stock').length;
    const totalPurchaseSpend = state.SUPPLIES.reduce((sum, s) => sum + s.Cost, 0);
    const totalIssuedUnits = state.ISSUED_TO.reduce((sum, i) => sum + i.Quantity, 0);

    return {
      totalItems,
      totalStockUnits,
      lowStockCount,
      totalPurchaseSpend,
      totalIssuedUnits,
      totalPurchasesCount: state.SUPPLIES.length,
      totalIssuesCount: state.ISSUED_TO.length,
      suppliersCount: state.SUPPLIER.length,
      departmentsCount: state.DEPARTMENT.length
    };
  },

  // Monthly aggregated analytics for area/bar chart
  getMonthlyAnalytics(): MonthlyData[] {
    const state = dbEngine.getState();
    const monthMap: Record<string, { purchasesQty: number; issuesQty: number; purchasesCost: number }> = {};

    state.SUPPLIES.forEach(s => {
      const monthKey = s.PurchaseDate.substring(0, 7); // "YYYY-MM"
      if (!monthMap[monthKey]) monthMap[monthKey] = { purchasesQty: 0, issuesQty: 0, purchasesCost: 0 };
      monthMap[monthKey].purchasesQty += s.Quantity;
      monthMap[monthKey].purchasesCost += s.Cost;
    });

    state.ISSUED_TO.forEach(i => {
      const monthKey = i.IssueDate.substring(0, 7);
      if (!monthMap[monthKey]) monthMap[monthKey] = { purchasesQty: 0, issuesQty: 0, purchasesCost: 0 };
      monthMap[monthKey].issuesQty += i.Quantity;
    });

    const sortedKeys = Object.keys(monthMap).sort();
    return sortedKeys.map(k => {
      const [year, month] = k.split('-');
      const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return {
        month: label,
        purchasesQty: monthMap[k].purchasesQty,
        issuesQty: monthMap[k].issuesQty,
        purchasesCost: monthMap[k].purchasesCost
      };
    });
  },

  // Stock count by category (donut chart)
  getStockByCategory() {
    const stockList = dbEngine.getAllDerivedStock();
    const map: Record<string, { stock: number; count: number }> = {};

    stockList.forEach(s => {
      const cat = s.item.Category;
      if (!map[cat]) map[cat] = { stock: 0, count: 0 };
      map[cat].stock += Math.max(0, s.currentStock);
      map[cat].count += 1;
    });

    return Object.entries(map).map(([name, val]) => ({
      name,
      value: val.stock,
      itemCount: val.count
    }));
  },

  // Top issued items
  getTopIssuedItems(limit = 5) {
    const state = dbEngine.getState();
    const map: Record<string, number> = {};

    state.ISSUED_TO.forEach(iss => {
      map[iss.ItemID] = (map[iss.ItemID] || 0) + iss.Quantity;
    });

    const sorted = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sorted.map(([itemId, qty]) => {
      const item = state.ITEM.find(i => i.ItemID === itemId);
      return {
        itemId,
        itemName: item ? item.ItemName : itemId,
        category: item?.Category ?? 'General',
        totalIssued: qty
      };
    });
  },

  // Department-wise distribution
  getDepartmentStats() {
    const state = dbEngine.getState();
    return state.DEPARTMENT.map(dept => {
      const issues = state.ISSUED_TO.filter(i => i.DeptID === dept.DeptID);
      const totalUnits = issues.reduce((sum, i) => sum + i.Quantity, 0);
      return {
        deptId: dept.DeptID,
        deptName: dept.DeptName,
        issueCount: issues.length,
        totalUnitsIssued: totalUnits
      };
    });
  },

  // Supplier-wise distribution
  getSupplierStats() {
    const state = dbEngine.getState();
    return state.SUPPLIER.map(sup => {
      const supplies = state.SUPPLIES.filter(s => s.SupplierID === sup.SupplierID);
      const totalCost = supplies.reduce((sum, s) => sum + s.Cost, 0);
      const totalUnits = supplies.reduce((sum, s) => sum + s.Quantity, 0);
      const contacts = state.SUPPLIER_CONTACT.filter(sc => sc.SupplierID === sup.SupplierID).map(sc => sc.ContactNo);
      const city = state.PINCODE_CITY.find(p => p.Pincode === sup.Pincode)?.City ?? 'Unknown';

      return {
        ...sup,
        city,
        contacts,
        purchaseCount: supplies.length,
        totalCost,
        totalUnits
      };
    });
  }
};

// 8 Preset queries for SQL Playground (Database Lab Tab 5)
export const PRESET_SQL_QUERIES: PresetQuery[] = [
  {
    id: 'q1',
    title: '1. Derived Stock per Item (JOIN + GROUP BY)',
    description: 'Demonstrates computing the derived attribute StockQty without storing it, joining SUPPLIES and ISSUED_TO with ITEM.',
    sql: `SELECT 
    i.ItemID, 
    i.ItemName, 
    i.Category,
    COALESCE(p.Purchased, 0) AS TotalPurchased,
    COALESCE(iss.Issued, 0) AS TotalIssued,
    (COALESCE(p.Purchased, 0) - COALESCE(iss.Issued, 0)) AS DerivedStockQty
FROM ITEM i
LEFT JOIN (
    SELECT ItemID, SUM(Quantity) AS Purchased 
    FROM SUPPLIES 
    GROUP BY ItemID
) p ON i.ItemID = p.ItemID
LEFT JOIN (
    SELECT ItemID, SUM(Quantity) AS Issued 
    FROM ISSUED_TO 
    GROUP BY ItemID
) iss ON i.ItemID = iss.ItemID
ORDER BY DerivedStockQty ASC;`,
    execute: () => {
      const stockList = dbEngine.getAllDerivedStock().sort((a, b) => a.currentStock - b.currentStock);
      return {
        columns: ['ItemID', 'ItemName', 'Category', 'TotalPurchased', 'TotalIssued', 'DerivedStockQty'],
        rows: stockList.map(s => [
          s.item.ItemID,
          s.item.ItemName,
          s.item.Category,
          s.totalPurchased,
          s.totalIssued,
          s.currentStock
        ])
      };
    }
  },
  {
    id: 'q2',
    title: '2. Low Stock Alerts (Stock <= ReorderLevel)',
    description: 'Identifies all consumable items currently at or below their reorder threshold.',
    sql: `SELECT 
    i.ItemID, 
    i.ItemName, 
    c.ReorderLevel,
    (COALESCE(p.Purchased, 0) - COALESCE(iss.Issued, 0)) AS CurrentStock
FROM ITEM i
JOIN CONSUMABLE_ITEM c ON i.ItemID = c.ItemID
LEFT JOIN (SELECT ItemID, SUM(Quantity) AS Purchased FROM SUPPLIES GROUP BY ItemID) p ON i.ItemID = p.ItemID
LEFT JOIN (SELECT ItemID, SUM(Quantity) AS Issued FROM ISSUED_TO GROUP BY ItemID) iss ON i.ItemID = iss.ItemID
WHERE (COALESCE(p.Purchased, 0) - COALESCE(iss.Issued, 0)) <= c.ReorderLevel
ORDER BY CurrentStock ASC;`,
    execute: () => {
      const stockList = dbEngine.getAllDerivedStock().filter(s => s.status === 'Low Stock' || s.status === 'Out of Stock');
      return {
        columns: ['ItemID', 'ItemName', 'ReorderLevel', 'CurrentStock', 'Status'],
        rows: stockList.map(s => [
          s.item.ItemID,
          s.item.ItemName,
          s.reorderLevel ?? 0,
          s.currentStock,
          s.status
        ])
      };
    }
  },
  {
    id: 'q3',
    title: '3. Supplier Purchase Totals with Decomposed City (3NF)',
    description: 'Aggregates spend per supplier, resolving city via the 3NF PINCODE_CITY relation.',
    sql: `SELECT 
    s.SupplierID, 
    s.SupplierName, 
    pc.City, 
    COUNT(p.PurchaseID) AS OrdersCount,
    COALESCE(SUM(p.Quantity), 0) AS TotalUnitsSupplied,
    COALESCE(SUM(p.Cost), 0) AS TotalSpendINR
FROM SUPPLIER s
JOIN PINCODE_CITY pc ON s.Pincode = pc.Pincode
LEFT JOIN SUPPLIES p ON s.SupplierID = p.SupplierID
GROUP BY s.SupplierID, s.SupplierName, pc.City
ORDER BY TotalSpendINR DESC;`,
    execute: () => {
      const stats = queries.getSupplierStats().sort((a, b) => b.totalCost - a.totalCost);
      return {
        columns: ['SupplierID', 'SupplierName', 'City', 'OrdersCount', 'TotalUnitsSupplied', 'TotalSpendINR'],
        rows: stats.map(st => [
          st.SupplierID,
          st.SupplierName,
          st.city,
          st.purchaseCount,
          st.totalUnits,
          `₹${st.totalCost.toLocaleString('en-IN')}`
        ])
      };
    }
  },
  {
    id: 'q4',
    title: '4. Department Stationery Consumption Breakdown',
    description: 'Summarizes total stationery distributed to each department.',
    sql: `SELECT 
    d.DeptID, 
    d.DeptName, 
    COUNT(iss.IssueID) AS IssueTransactions,
    COALESCE(SUM(iss.Quantity), 0) AS TotalUnitsConsumed
FROM DEPARTMENT d
LEFT JOIN ISSUED_TO iss ON d.DeptID = iss.DeptID
GROUP BY d.DeptID, d.DeptName
ORDER BY TotalUnitsConsumed DESC;`,
    execute: () => {
      const stats = queries.getDepartmentStats().sort((a, b) => b.totalUnitsIssued - a.totalUnitsIssued);
      return {
        columns: ['DeptID', 'DeptName', 'IssueTransactions', 'TotalUnitsConsumed'],
        rows: stats.map(st => [
          st.deptId,
          st.deptName,
          st.issueCount,
          st.totalUnitsIssued
        ])
      };
    }
  },
  {
    id: 'q5',
    title: '5. Weak Entity Query: Stock Batches Expiring Soon',
    description: 'Retrieves batches from the weak entity relation STOCK_BATCH with parent item name.',
    sql: `SELECT 
    sb.ItemID, 
    i.ItemName, 
    sb.BatchNo, 
    sb.ExpiryDate,
    DATEDIFF('2026-10-16', sb.ExpiryDate) AS DaysRemaining
FROM STOCK_BATCH sb
JOIN ITEM i ON sb.ItemID = i.ItemID
WHERE sb.ExpiryDate <= DATE_ADD('2026-10-16', INTERVAL 30 DAY)
ORDER BY sb.ExpiryDate ASC;`,
    execute: () => {
      const expiring = queries.getExpiringBatches(60);
      return {
        columns: ['ItemID', 'ItemName', 'BatchNo', 'ExpiryDate', 'DaysRemaining'],
        rows: expiring.map(e => [
          e.ItemID,
          e.itemName,
          e.BatchNo,
          e.ExpiryDate,
          `${e.daysRemaining} days`
        ])
      };
    }
  },
  {
    id: 'q6',
    title: '6. Mandated Document Example: Item I123 History',
    description: 'Inspects purchases of Legal Green Ledger Paper (I123) supplied by ABC Traders (S01) from the mini-project document.',
    sql: `SELECT 
    p.PurchaseID, 
    p.PurchaseDate, 
    s.SupplierName, 
    p.Quantity, 
    p.Cost,
    ROUND(p.Cost / p.Quantity, 2) AS CalculatedUnitCost
FROM SUPPLIES p
JOIN SUPPLIER s ON p.SupplierID = s.SupplierID
WHERE p.ItemID = 'I123'
ORDER BY p.PurchaseDate ASC;`,
    execute: () => {
      const state = dbEngine.getState();
      const purchases = state.SUPPLIES.filter(s => s.ItemID === 'I123');
      return {
        columns: ['PurchaseID', 'PurchaseDate', 'SupplierName', 'Quantity', 'Cost', 'CalculatedUnitCost'],
        rows: purchases.map(p => {
          const sup = state.SUPPLIER.find(s => s.SupplierID === p.SupplierID);
          return [
            p.PurchaseID,
            p.PurchaseDate,
            sup?.SupplierName ?? p.SupplierID,
            p.Quantity,
            `₹${p.Cost.toLocaleString('en-IN')}`,
            `₹${(p.Cost / p.Quantity).toFixed(2)}`
          ];
        })
      };
    }
  },
  {
    id: 'q7',
    title: '7. Multivalued Attribute Contact Inspection',
    description: 'Demonstrates 1NF normalized table SUPPLIER_CONTACT joined back to SUPPLIER.',
    sql: `SELECT 
    s.SupplierID, 
    s.SupplierName, 
    sc.ContactNo
FROM SUPPLIER s
JOIN SUPPLIER_CONTACT sc ON s.SupplierID = sc.SupplierID
ORDER BY s.SupplierID;`,
    execute: () => {
      const state = dbEngine.getState();
      return {
        columns: ['SupplierID', 'SupplierName', 'ContactNo'],
        rows: state.SUPPLIER_CONTACT.map(sc => {
          const sup = state.SUPPLIER.find(s => s.SupplierID === sc.SupplierID);
          return [
            sc.SupplierID,
            sup?.SupplierName ?? sc.SupplierID,
            sc.ContactNo
          ];
        })
      };
    }
  },
  {
    id: 'q8',
    title: '8. Durable vs Consumable Disjoint Hierarchy',
    description: 'Illustrates the disjoint EER specialization hierarchy partitioning items.',
    sql: `SELECT 
    i.ItemID, 
    i.ItemName, 
    i.Category,
    CASE 
        WHEN c.ItemID IS NOT NULL THEN 'Consumable'
        WHEN d.ItemID IS NOT NULL THEN 'Durable'
        ELSE 'Unspecified'
    END AS SpecializationType,
    c.ReorderLevel,
    d.WarrantyPeriod
FROM ITEM i
LEFT JOIN CONSUMABLE_ITEM c ON i.ItemID = c.ItemID
LEFT JOIN DURABLE_ITEM d ON i.ItemID = d.ItemID
ORDER BY SpecializationType, i.ItemName;`,
    execute: () => {
      const stockList = dbEngine.getAllDerivedStock().sort((a, b) => a.itemType.localeCompare(b.itemType));
      return {
        columns: ['ItemID', 'ItemName', 'Category', 'SpecializationType', 'ReorderLevel', 'WarrantyPeriod'],
        rows: stockList.map(s => [
          s.item.ItemID,
          s.item.ItemName,
          s.item.Category,
          s.itemType,
          s.reorderLevel ? `${s.reorderLevel} units` : 'N/A',
          s.warrantyPeriod ? `${s.warrantyPeriod} months` : 'N/A'
        ])
      };
    }
  }
];
