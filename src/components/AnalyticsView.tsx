import React, { useState } from 'react';
import { GoalBar } from './GoalBar';
import { CustomSelect } from './ui/CustomSelect';
import { useInventory } from '../context/InventoryContext';
import {
  formatCurrency,
  calculateMonthlyMetrics,
  parseDateLocal,
} from '../utils/helpers';
import { calculateProfitMarginPercent, formatSignedCurrency, getProfitTextColor } from '../utils/financialDisplay';
import {
  Calendar,
  BarChart2,
  PackageCheck,
} from 'lucide-react';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const AnalyticsView: React.FC = () => {
  const { state } = useInventory();

  const currentYearNum = new Date().getFullYear(); // e.g. 2026
  const currentMonthIdx = new Date().getMonth(); // 0-11 (August = 7)

  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(currentMonthIdx);

  // Collect available years from builds & transactions
  const availableYears = React.useMemo(() => {
    const yearsSet = new Set<number>([currentYearNum]);
    state.builds.forEach((b) => {
      const d = b.saleDate || b.createdDate;
      if (d) {
        const parsed = parseDateLocal(d);
        if (parsed) yearsSet.add(parsed.year);
      }
    });
    state.transactions.forEach((tx) => {
      const d = tx.dateSortable || tx.timestamp;
      if (d) {
        const parsed = parseDateLocal(d);
        if (parsed) yearsSet.add(parsed.year);
      }
    });
    return Array.from(yearsSet).filter((yr) => yr > 0).sort((a, b) => b - a);
  }, [state.builds, state.transactions, currentYearNum]);

  // Compute monthly stats for selectedYear
  const monthlyData = React.useMemo(() => MONTH_NAMES.map((monthName, idx) => {
    const {
      revenue,
      profit,
      pcsSold,
      cost,
      pcRevenue,
      pcProfit,
    } = calculateMonthlyMetrics(state, selectedYear, idx);

    return {
      monthIndex: idx,
      monthName,
      revenue,
      profit,
      pcsSold,
      cost: cost !== undefined ? cost : Math.max(0, revenue - profit),
      pcRevenue,
      pcProfit,
    };
  }), [state, selectedYear]);

  // Calculate Yearly Totals
  const {
    totalYearlyRevenue,
    totalYearlyProfit,
    totalYearlyCost,
    totalYearlyPcsSold,
    avgYearlyProfitPerBuild,
    avgYearlyProfitMargin,
  } = React.useMemo(() => {
    const rev = monthlyData.reduce((sum, m) => sum + m.revenue, 0);
    const prof = monthlyData.reduce((sum, m) => sum + m.profit, 0);
    const cost = Math.max(0, rev - prof);
    const pcs = monthlyData.reduce((sum, m) => sum + m.pcsSold, 0);
    const pcRevenue = monthlyData.reduce((sum, m) => sum + m.pcRevenue, 0);
    const pcProf = monthlyData.reduce((sum, m) => sum + m.pcProfit, 0);

    const avgProf = pcs > 0 ? pcProf / pcs : 0;
    const avgProfitMargin = pcs > 0 ? calculateProfitMarginPercent(pcProf, pcRevenue) : 0;
    return {
      totalYearlyRevenue: rev,
      totalYearlyProfit: prof,
      totalYearlyCost: cost,
      totalYearlyPcsSold: pcs,
      avgYearlyProfitPerBuild: avgProf,
      avgYearlyProfitMargin: avgProfitMargin,
    };
  }, [monthlyData]);

  // Selected Month Stats
  const selectedMonthData = React.useMemo(() => {
    return monthlyData[selectedMonthIdx] || monthlyData[currentMonthIdx];
  }, [monthlyData, selectedMonthIdx, currentMonthIdx]);

  const selectedMonthName = selectedMonthData.monthName;
  const selectedMonthRevenue = selectedMonthData.revenue;
  const selectedMonthProfit = selectedMonthData.profit;
  const selectedMonthCost = selectedMonthData.cost;
  const selectedMonthPcsSold = selectedMonthData.pcsSold;
  const selectedMonthPcRevenue = selectedMonthData.pcRevenue;
  const selectedMonthPcProfit = selectedMonthData.pcProfit;

  const selectedMonthAvgProfit =
    selectedMonthPcsSold > 0 ? selectedMonthPcProfit / selectedMonthPcsSold : 0;
  const selectedMonthProfitMargin = selectedMonthPcsSold > 0
    ? calculateProfitMarginPercent(selectedMonthPcProfit, selectedMonthPcRevenue)
    : 0;

  return (
    <div className="analytics-view w-full">
      <GoalBar />

      {/* Reporting controls */}
      <section className="report-toolbar analytics-toolbar">
        <div className="analytics-toolbar-row">
          <h2 className="app-page-title">PC Sales &amp; Portfolio Analysis</h2>

          <div className="analytics-date-filters">
            <div className="analytics-year-select">
              <CustomSelect
                value={String(selectedYear)}
                onChange={(val) => setSelectedYear(Number(val))}
                options={availableYears.map((year) => ({ label: String(year), value: String(year) }))}
                fitLongestOption={false}
              />
            </div>

            <div className="analytics-month-select">
              <CustomSelect
                value={String(selectedMonthIdx)}
                onChange={(val) => setSelectedMonthIdx(Number(val))}
                options={MONTH_NAMES.map((mName, i) => ({
                  label: mName,
                  value: String(i)
                }))}
                fitLongestOption={false}
              />
            </div>
          </div>
        </div>
        <p className="app-page-copy analytics-scope-copy">
          Totals include PC and loose-part sales. Per-PC averages and Profit Margin use PC sales only; Profit Margin = PC profit ÷ PC revenue.
        </p>
      </section>

      {/* Month and annual ledgers */}
      <div className="analytics-summary-stack">
        {/* Selected Month Performance Card */}
        <section className="report-section">
          <div className="analytics-summary-header">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#B9EF68]" /> {selectedMonthName} {selectedYear} Performance
            </h3>
          </div>

          <div className="report-metrics">
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Revenue</p>
              <p className="text-sm sm:text-base font-bold font-mono text-[#83E5DF] mt-0.5 leading-tight">{formatCurrency(selectedMonthRevenue)}</p>
            </div>
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Total Cost</p>
              <p className="text-sm sm:text-base font-bold font-mono text-zinc-200 mt-0.5 leading-tight">{formatCurrency(selectedMonthCost)}</p>
            </div>
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Net Profit</p>
              <p className={`text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight ${getProfitTextColor(selectedMonthProfit)}`}>{formatSignedCurrency(selectedMonthProfit)}</p>
            </div>
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">PCs Sold</p>
              <p className="text-sm sm:text-base font-bold font-mono text-[#83E5DF] mt-0.5 leading-tight">{selectedMonthPcsSold}</p>
            </div>
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Avg Profit / PC</p>
              <p className="text-sm sm:text-base font-bold font-mono text-zinc-100 mt-0.5 leading-tight">{formatCurrency(selectedMonthAvgProfit)}</p>
            </div>
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Profit Margin</p>
              <p className={`text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight ${getProfitTextColor(selectedMonthProfitMargin)}`}>{selectedMonthProfitMargin.toFixed(1)}%</p>
            </div>
          </div>
        </section>

        {/* Yearly Stats Card */}
        <section className="report-section">
          <div className="analytics-summary-header">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5 text-[#B9EF68]" /> {selectedYear} Full Year Totals
            </h3>
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              12 Month Aggregate
            </span>
          </div>

          <div className="report-metrics">
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Total Revenue</p>
              <p className="text-sm sm:text-base font-bold font-mono text-[#83E5DF] mt-0.5 leading-tight">{formatCurrency(totalYearlyRevenue)}</p>
            </div>
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Total Cost</p>
              <p className="text-sm sm:text-base font-bold font-mono text-zinc-200 mt-0.5 leading-tight">{formatCurrency(totalYearlyCost)}</p>
            </div>
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Net Profit</p>
              <p className={`text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight ${getProfitTextColor(totalYearlyProfit)}`}>{formatSignedCurrency(totalYearlyProfit)}</p>
            </div>
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Total PCs Sold</p>
              <p className="text-sm sm:text-base font-bold font-mono text-[#83E5DF] mt-0.5 leading-tight">{totalYearlyPcsSold}</p>
            </div>
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Avg Profit / PC</p>
              <p className="text-sm sm:text-base font-bold font-mono text-zinc-100 mt-0.5 leading-tight">{formatCurrency(avgYearlyProfitPerBuild)}</p>
            </div>
            <div className="p-3 bg-[#0D1416] flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Profit Margin</p>
              <p className={`text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight ${getProfitTextColor(avgYearlyProfitMargin)}`}>{avgYearlyProfitMargin.toFixed(1)}%</p>
            </div>
          </div>
        </section>
      </div>

      {/* Monthly Sales Tracking Spreadsheet Table */}
      <section className="report-section sales-tracking-section overflow-hidden">
        <div className="sales-tracking-heading">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
              <PackageCheck className="w-3.5 h-3.5 text-[#B9EF68]" /> Sales Tracking — {selectedYear}
            </h3>
            <p className="sales-tracking-copy text-zinc-400">
              Revenue and profit include PC and loose-part sales. PCs Sold counts PC sales only.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#101719]/80 text-zinc-400 font-mono font-bold uppercase tracking-wider border-b border-white/[0.08]">
                <th className="w-[28%] border-r border-white/[0.06]">Month</th>
                <th className="w-[24%] border-r border-white/[0.06]">Revenue</th>
                <th className="w-[24%] border-r border-white/[0.06] text-emerald-400">Profit</th>
                <th className="w-[24%] text-[#83E5DF]">PCs Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono text-xs">
              {monthlyData.map((row) => {
                const isSelected = row.monthIndex === selectedMonthIdx;
                const isCurrent = row.monthIndex === currentMonthIdx && selectedYear === currentYearNum;

                return (
                  <tr
                    key={row.monthName}
                    onClick={() => setSelectedMonthIdx(row.monthIndex)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#B9EF68]/15 text-white'
                        : isCurrent
                        ? 'bg-white/[0.02] text-zinc-100 font-semibold border-l-2 border-[#B9EF68] hover:bg-white/[0.04]'
                        : 'hover:bg-white/[0.02] border-l-2 border-transparent'
                    }`}
                  >
                    {/* Month Cell */}
                    <td className="font-sans font-medium text-zinc-200 border-r border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <span>{row.monthName.substring(0, 3)}<span className="hidden sm:inline">{row.monthName.substring(3)}</span></span>
                      </div>
                    </td>

                    {/* Revenue Cell */}
                    <td className="text-[#83E5DF] border-r border-white/[0.06] font-mono font-medium">
                      {formatCurrency(row.revenue)}
                    </td>

                    {/* Profit Cell */}
                    <td className={`border-r border-white/[0.06] font-mono font-medium ${row.profit < 0 ? getProfitTextColor(row.profit) : 'text-emerald-400'}`}>
                      {formatCurrency(row.profit)}
                    </td>

                    {/* PCs Sold Cell */}
                    <td className="text-[#83E5DF] font-mono font-medium text-center sm:text-left">
                      {row.pcsSold}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* TOTAL Row */}
            <tfoot>
              <tr className="bg-[#101719] border-t-2 border-[#B9EF68]/40 font-mono text-xs font-bold">
                <td className="font-sans text-zinc-200 tracking-wider uppercase border-r border-white/[0.06]">
                  TOTAL
                </td>
                <td className="text-[#83E5DF] border-r border-white/[0.06]">
                  {formatCurrency(totalYearlyRevenue)}
                </td>
                <td className={`border-r border-white/[0.06] ${totalYearlyProfit < 0 ? getProfitTextColor(totalYearlyProfit) : 'text-emerald-400'}`}>
                  {formatSignedCurrency(totalYearlyProfit)}
                </td>
                <td className="text-[#83E5DF] text-center sm:text-left">
                  {totalYearlyPcsSold}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

    </div>
  );
};
