import React, { useState } from 'react';
import { useSql } from '../db/useSql';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayChip } from '../components/clay/ClayChip';
import {
  BarChart3,
  TrendingUp,
  PackageCheck,
  AlertTriangle,
  Users,
  Calendar,
  Sparkles,
  Download,
  Code
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<'valuation' | 'abc' | 'deadstock' | 'scorecard' | 'forecast' | 'anomalies'>('valuation');
  const [showSqlModal, setShowSqlModal] = useState<string | null>(null);
  const [narrativeText, setNarrativeText] = useState<string | null>(null);
  const [isNarrating, setIsNarrating] = useState(false);

  // F1. Stock Valuation
  const valuationSql = `
    WITH LastPurchases AS (
      SELECT 
        ItemID,
        ROUND(Cost / Quantity, 2) AS LastPurchasePrice,
        ROW_NUMBER() OVER (PARTITION BY ItemID ORDER BY PurchaseDate DESC) AS rn
      FROM SUPPLIES
    ),
    WeightedAvgCost AS (
      SELECT 
        ItemID,
        ROUND(SUM(Cost) / NULLIF(SUM(Quantity), 0), 2) AS WAvgCost
      FROM SUPPLIES
      GROUP BY ItemID
    )
    SELECT 
      cs.ItemID,
      cs.ItemName,
      cs.Category,
      cs.StockQty,
      cs.UnitPrice AS CatalogPrice,
      COALESCE(wac.WAvgCost, cs.UnitPrice) AS WeightedAvgUnitCost,
      lp.LastPurchasePrice,
      ROUND(cs.StockQty * COALESCE(wac.WAvgCost, cs.UnitPrice), 2) AS TotalHoldingValue
    FROM V_CURRENT_STOCK cs
    LEFT JOIN WeightedAvgCost wac ON cs.ItemID = wac.ItemID
    LEFT JOIN LastPurchases lp ON cs.ItemID = lp.ItemID AND lp.rn = 1
    ORDER BY TotalHoldingValue DESC;
  `;
  const { data: valuationData } = useSql(valuationSql, [], [], { enabled: activeReport === 'valuation' });

  // F3. ABC Analysis (Pareto Classification)
  const abcSql = `
    WITH ItemSpend AS (
      SELECT 
        t.ItemID,
        i.ItemName,
        i.Category,
        SUM(t.Quantity) AS TotalIssuedUnits,
        ROUND(SUM(t.Quantity * i.UnitPrice), 2) AS TotalIssuedValue
      FROM ISSUED_TO t
      JOIN ITEM i ON t.ItemID = i.ItemID
      GROUP BY t.ItemID, i.ItemName, i.Category
    ),
    CumulativeSpend AS (
      SELECT 
        ItemID,
        ItemName,
        Category,
        TotalIssuedUnits,
        TotalIssuedValue,
        SUM(TotalIssuedValue) OVER () AS GrandTotalValue,
        SUM(TotalIssuedValue) OVER (ORDER BY TotalIssuedValue DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS RunningTotalValue
      FROM ItemSpend
    )
    SELECT 
      ItemID,
      ItemName,
      Category,
      TotalIssuedUnits,
      TotalIssuedValue,
      ROUND((RunningTotalValue * 100.0) / NULLIF(GrandTotalValue, 0), 1) AS CumulativePercentage,
      CASE 
        WHEN (RunningTotalValue * 100.0) / NULLIF(GrandTotalValue, 0) <= 70.0 THEN 'Class A (Critical 70%)'
        WHEN (RunningTotalValue * 100.0) / NULLIF(GrandTotalValue, 0) <= 90.0 THEN 'Class B (Intermediate 20%)'
        ELSE 'Class C (Bulk Low-Value 10%)'
      END AS AbcClass
    FROM CumulativeSpend
    ORDER BY TotalIssuedValue DESC;
  `;
  const { data: abcData } = useSql(abcSql, [], [], { enabled: activeReport === 'abc' });

  // F4. Dead and Slow Moving Stock
  const deadstockSql = `
    SELECT 
      i.ItemID,
      i.ItemName,
      i.Category,
      cs.StockQty,
      MAX(t.IssueDate) AS LastIssueDate,
      CAST(julianday('now') - julianday(COALESCE(MAX(t.IssueDate), '2025-01-01')) AS INTEGER) AS InactiveDays,
      CASE 
        WHEN MAX(t.IssueDate) IS NULL THEN 'DEAD STOCK (Never Issued)'
        WHEN (julianday('now') - julianday(MAX(t.IssueDate))) > 90 THEN 'DORMANT (>90 Days Inactive)'
        ELSE 'SLOW MOVING'
      END AS Classification
    FROM ITEM i
    JOIN V_CURRENT_STOCK cs ON i.ItemID = cs.ItemID
    LEFT JOIN ISSUED_TO t ON i.ItemID = t.ItemID
    GROUP BY i.ItemID, i.ItemName, i.Category, cs.StockQty
    HAVING MAX(t.IssueDate) IS NULL OR (julianday('now') - julianday(MAX(t.IssueDate))) > 60
    ORDER BY InactiveDays DESC;
  `;
  const { data: deadstockData } = useSql(deadstockSql, [], [], { enabled: activeReport === 'deadstock' });

  // F5. Supplier Scorecard
  const scorecardSql = `
    SELECT 
      s.SupplierID,
      s.SupplierName,
      COUNT(sp.PurchaseID) AS OrderCount,
      SUM(sp.Quantity) AS TotalUnitsSupplied,
      ROUND(SUM(sp.Cost), 2) AS TotalSpend,
      (SELECT COUNT(*) FROM ALERT a WHERE a.AlertType = 'PRICE_VARIANCE' AND a.ItemID IN (SELECT ItemID FROM SUPPLIES s2 WHERE s2.SupplierID = s.SupplierID)) AS PriceVarianceAlerts,
      RANK() OVER (ORDER BY SUM(sp.Cost) DESC) AS SpendRank
    FROM SUPPLIER s
    LEFT JOIN SUPPLIES sp ON s.SupplierID = sp.SupplierID
    GROUP BY s.SupplierID, s.SupplierName
    ORDER BY TotalSpend DESC;
  `;
  const { data: scorecardData } = useSql(scorecardSql, [], [], { enabled: activeReport === 'scorecard' });

  // F8. Moving-Average Demand Forecast
  const forecastSql = `
    WITH MonthlyItemSeries AS (
      SELECT 
        strftime('%Y-%m', IssueDate) AS M,
        ItemID,
        SUM(Quantity) AS MonthlyQty
      FROM ISSUED_TO
      GROUP BY strftime('%Y-%m', IssueDate), ItemID
    )
    SELECT 
      mis.ItemID,
      i.ItemName,
      i.Category,
      mis.M AS Month,
      mis.MonthlyQty,
      ROUND(AVG(mis.MonthlyQty) OVER (
        PARTITION BY mis.ItemID 
        ORDER BY mis.M 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
      ), 1) AS ThreeMonthMovingAvg
    FROM MonthlyItemSeries mis
    JOIN ITEM i ON mis.ItemID = i.ItemID
    ORDER BY mis.ItemID, mis.M DESC;
  `;
  const { data: forecastData } = useSql(forecastSql, [], [], { enabled: activeReport === 'forecast' });

  // F9. Statistical Anomalies (|z-score| > 2.0)
  const anomaliesSql = `
    WITH MonthlySums AS (
      SELECT 
        strftime('%Y-%m', IssueDate) AS M,
        ItemID,
        SUM(Quantity) AS Qty
      FROM ISSUED_TO
      GROUP BY strftime('%Y-%m', IssueDate), ItemID
    ),
    Stats AS (
      SELECT 
        ItemID,
        AVG(Qty) AS MeanQty,
        -- Population standard deviation approx
        MAX(1.0, SQRT(AVG(Qty * Qty) - (AVG(Qty) * AVG(Qty)))) AS StdDev
      FROM MonthlySums
      GROUP BY ItemID
    )
    SELECT 
      ms.M AS Month,
      ms.ItemID,
      i.ItemName,
      i.Category,
      ms.Qty AS IssuedQty,
      ROUND(st.MeanQty, 1) AS BaselineMean,
      ROUND((ms.Qty - st.MeanQty) / st.StdDev, 2) AS ZScore
    FROM MonthlySums ms
    JOIN Stats st ON ms.ItemID = st.ItemID
    JOIN ITEM i ON ms.ItemID = i.ItemID
    WHERE ABS((ms.Qty - st.MeanQty) / st.StdDev) >= 2.0
    ORDER BY ABS((ms.Qty - st.MeanQty) / st.StdDev) DESC;
  `;
  const { data: anomaliesData } = useSql(anomaliesSql, [], [], { enabled: activeReport === 'anomalies' });

  const handleExportCsv = (rows: any[], filename: string) => {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNarrateForecast = async () => {
    setIsNarrating(true);
    setNarrativeText(null);
    try {
      const res = await fetch('/api/gemini/forecast-narrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forecastSummary: (forecastData || []).slice(0, 15),
          anomalies: (anomaliesData || []).slice(0, 10)
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Narrator error');
      setNarrativeText(json.narrative);
    } catch (err: any) {
      setNarrativeText(`AI Narrator unavailable: ${err?.message}`);
    } finally {
      setIsNarrating(false);
    }
  };

  const reportsConfig = [
    { key: 'valuation', label: 'Inventory Valuation', icon: BarChart3, sql: valuationSql },
    { key: 'abc', label: 'ABC Analysis (Pareto)', icon: TrendingUp, sql: abcSql },
    { key: 'deadstock', label: 'Dead & Slow Moving', icon: AlertTriangle, sql: deadstockSql },
    { key: 'scorecard', label: 'Supplier Scorecard', icon: PackageCheck, sql: scorecardSql },
    { key: 'forecast', label: 'Moving-Avg Forecast', icon: Calendar, sql: forecastSql },
    { key: 'anomalies', label: 'Consumption Anomalies', icon: Sparkles, sql: anomaliesSql }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-clay-text tracking-tight">
              SQL Intelligence & Analytics
            </h1>
            <ClayChip variant="primary" size="sm">
              WINDOW FUNCTIONS & CTES
            </ClayChip>
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Institutional inventory business intelligence computed entirely through relational SQL aggregates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ClayButton
            variant="outline"
            size="sm"
            icon={<Code size={14} />}
            onClick={() => {
              const r = reportsConfig.find(rc => rc.key === activeReport);
              if (r) setShowSqlModal(r.sql);
            }}
          >
            View SQL
          </ClayButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-clay-border">
        {reportsConfig.map(rep => {
          const Icon = rep.icon;
          const isActive = activeReport === rep.key;
          return (
            <button
              key={rep.key}
              onClick={() => {
                setActiveReport(rep.key as any);
                setNarrativeText(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'clay-card text-clay-text hover:text-indigo-600'
              }`}
            >
              <Icon size={14} />
              <span>{rep.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report 1: Valuation */}
      {activeReport === 'valuation' && (
        <ClayCard className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-display text-clay-text">
                Inventory Stock Valuation (Weighted Average Cost)
              </h3>
              <p className="text-xs text-clay-text-muted">
                Valuation computed as Derived StockQty × (SUM(Cost)/SUM(Qty)) with last purchase price benchmark.
              </p>
            </div>
            <ClayButton
              variant="outline"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => handleExportCsv(valuationData || [], 'Inventory_Valuation_Report')}
            >
              Export CSV
            </ClayButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Item Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Derived Stock</th>
                  <th className="p-3">Catalog Price</th>
                  <th className="p-3">Weighted Avg Cost</th>
                  <th className="p-3">Last Purchase</th>
                  <th className="p-3 text-right">Holding Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-border">
                {(valuationData || []).map((row: any) => (
                  <tr key={row.ItemID} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{row.ItemID}</td>
                    <td className="p-3 font-semibold text-clay-text">{row.ItemName}</td>
                    <td className="p-3 text-clay-text-muted">{row.Category}</td>
                    <td className="p-3 font-mono font-bold">{row.StockQty}</td>
                    <td className="p-3 font-mono">₹{row.CatalogPrice}</td>
                    <td className="p-3 font-mono">₹{row.WeightedAvgUnitCost}</td>
                    <td className="p-3 font-mono text-clay-text-muted">₹{row.LastPurchasePrice || 'N/A'}</td>
                    <td className="p-3 font-mono font-bold text-right text-emerald-600 dark:text-emerald-400">
                      ₹{Number(row.TotalHoldingValue || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ClayCard>
      )}

      {/* Report 2: ABC Analysis */}
      {activeReport === 'abc' && (
        <ClayCard className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-display text-clay-text">
                ABC Inventory Classification (Pareto Principle 70/20/10)
              </h3>
              <p className="text-xs text-clay-text-muted">
                Class A generates first 70% value, Class B next 20%, Class C bulk 10%.
              </p>
            </div>
            <ClayButton
              variant="outline"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => handleExportCsv(abcData || [], 'ABC_Pareto_Report')}
            >
              Export CSV
            </ClayButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Item Description</th>
                  <th className="p-3">Total Units Issued</th>
                  <th className="p-3">Total Value Issued</th>
                  <th className="p-3">Cumulative Share</th>
                  <th className="p-3">ABC Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-border">
                {(abcData || []).map((row: any) => {
                  let chip: any = 'success';
                  if (row.AbcClass.includes('Class B')) chip = 'primary';
                  if (row.AbcClass.includes('Class C')) chip = 'outline';
                  return (
                    <tr key={row.ItemID} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold">{row.ItemID}</td>
                      <td className="p-3 font-semibold text-clay-text">{row.ItemName}</td>
                      <td className="p-3 font-mono">{row.TotalIssuedUnits}</td>
                      <td className="p-3 font-mono font-bold">₹{Number(row.TotalIssuedValue).toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {row.CumulativePercentage}%
                      </td>
                      <td className="p-3">
                        <ClayChip variant={chip} size="sm">{row.AbcClass}</ClayChip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ClayCard>
      )}

      {/* Report 3: Deadstock */}
      {activeReport === 'deadstock' && (
        <ClayCard className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-display text-clay-text">
                Dead & Slow-Moving Stock Radar
              </h3>
              <p className="text-xs text-clay-text-muted">
                Items with zero issues or unissued for &gt;60 days to identify inventory capital lockup.
              </p>
            </div>
            <ClayButton
              variant="outline"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => handleExportCsv(deadstockData || [], 'Deadstock_Report')}
            >
              Export CSV
            </ClayButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Item Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Current Stock</th>
                  <th className="p-3">Last Issue Date</th>
                  <th className="p-3">Inactive Days</th>
                  <th className="p-3">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-border">
                {(deadstockData || []).map((row: any) => (
                  <tr key={row.ItemID} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold">{row.ItemID}</td>
                    <td className="p-3 font-semibold text-clay-text">{row.ItemName}</td>
                    <td className="p-3 text-clay-text-muted">{row.Category}</td>
                    <td className="p-3 font-mono font-bold">{row.StockQty}</td>
                    <td className="p-3 font-mono text-clay-text-muted">{row.LastIssueDate || 'Never Issued'}</td>
                    <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">{row.InactiveDays} days</td>
                    <td className="p-3">
                      <ClayChip variant="danger" size="sm">{row.Classification}</ClayChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ClayCard>
      )}

      {/* Report 4: Supplier Scorecard */}
      {activeReport === 'scorecard' && (
        <ClayCard className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-display text-clay-text">
                Supplier Performance Scorecard
              </h3>
              <p className="text-xs text-clay-text-muted">
                Procurement volume, institutional spend ranking, and price variance compliance.
              </p>
            </div>
            <ClayButton
              variant="outline"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => handleExportCsv(scorecardData || [], 'Supplier_Scorecard_Report')}
            >
              Export CSV
            </ClayButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold">
                <tr>
                  <th className="p-3">Spend Rank</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3">Vendor ID</th>
                  <th className="p-3">Orders Fulfilled</th>
                  <th className="p-3">Units Supplied</th>
                  <th className="p-3">Total Spend (₹)</th>
                  <th className="p-3">Price Variance Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-border">
                {(scorecardData || []).map((row: any) => (
                  <tr key={row.SupplierID} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-indigo-600">#{row.SpendRank}</td>
                    <td className="p-3 font-bold text-clay-text">{row.SupplierName}</td>
                    <td className="p-3 font-mono text-clay-text-muted">{row.SupplierID}</td>
                    <td className="p-3 font-mono">{row.OrderCount}</td>
                    <td className="p-3 font-mono">{row.TotalUnitsSupplied}</td>
                    <td className="p-3 font-mono font-bold">₹{Number(row.TotalSpend).toLocaleString()}</td>
                    <td className="p-3">
                      {row.PriceVarianceAlerts > 0 ? (
                        <ClayChip variant="warning" size="sm">{row.PriceVarianceAlerts} alerts</ClayChip>
                      ) : (
                        <ClayChip variant="success" size="sm">Clean</ClayChip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ClayCard>
      )}

      {/* Report 5: Forecast & Anomalies */}
      {(activeReport === 'forecast' || activeReport === 'anomalies') && (
        <div className="space-y-6">
          <ClayCard className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold font-display text-clay-text flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-500" />
                  AI Forecast Narrator & Anomaly Insights
                </h3>
                <p className="text-xs text-clay-text-muted">
                  Gemini analyzes SQL-computed moving averages and statistical z-scores without inventing numbers.
                </p>
              </div>

              <ClayButton
                variant="primary"
                size="sm"
                icon={<Sparkles size={14} />}
                onClick={handleNarrateForecast}
                disabled={isNarrating}
              >
                {isNarrating ? 'Generating Narrative...' : 'Narrate Findings'}
              </ClayButton>
            </div>

            {narrativeText && (
              <div className="p-4 rounded-2xl clay-inset text-xs leading-relaxed text-clay-text whitespace-pre-wrap animate-in fade-in">
                {narrativeText}
              </div>
            )}
          </ClayCard>

          {activeReport === 'forecast' ? (
            <ClayCard className="p-6 space-y-4">
              <h3 className="text-base font-bold font-display text-clay-text">
                3-Month Moving Average Demand Forecast (Window Function)
              </h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold sticky top-0">
                    <tr>
                      <th className="p-3">Month</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Item Description</th>
                      <th className="p-3">Monthly Issued</th>
                      <th className="p-3">3-Mo Moving Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clay-border">
                    {(forecastData || []).slice(0, 50).map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono">{row.Month}</td>
                        <td className="p-3 font-mono font-bold text-indigo-600">{row.ItemID}</td>
                        <td className="p-3 font-semibold text-clay-text">{row.ItemName}</td>
                        <td className="p-3 font-mono">{row.MonthlyQty}</td>
                        <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {row.ThreeMonthMovingAvg} units
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ClayCard>
          ) : (
            <ClayCard className="p-6 space-y-4">
              <h3 className="text-base font-bold font-display text-clay-text">
                Consumption Anomalies (|z-score| &gt; 2.0)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold">
                    <tr>
                      <th className="p-3">Month</th>
                      <th className="p-3">Item Description</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Issued Units</th>
                      <th className="p-3">Mean Baseline</th>
                      <th className="p-3">Z-Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clay-border">
                    {(anomaliesData || []).map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono">{row.Month}</td>
                        <td className="p-3 font-semibold text-clay-text">{row.ItemName}</td>
                        <td className="p-3 text-clay-text-muted">{row.Category}</td>
                        <td className="p-3 font-mono font-bold">{row.IssuedQty}</td>
                        <td className="p-3 font-mono">{row.BaselineMean}</td>
                        <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                          {row.ZScore} σ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ClayCard>
          )}
        </div>
      )}

      {/* SQL Source Code Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="clay-card p-6 max-w-2xl w-full space-y-4">
            <div className="flex items-center justify-between border-b border-clay-border pb-3">
              <h3 className="text-sm font-bold font-display text-clay-text">
                SQL Query Definition
              </h3>
              <button
                onClick={() => setShowSqlModal(null)}
                className="text-xs text-clay-text-muted hover:text-clay-text font-bold"
              >
                ✕ Close
              </button>
            </div>
            <pre className="p-4 rounded-2xl clay-inset font-mono text-xs overflow-x-auto text-clay-text whitespace-pre-wrap max-h-96">
              {showSqlModal}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
