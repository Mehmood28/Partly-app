import React, { useState } from 'react';
import { GoalBar } from './GoalBar';
import { CustomSelect } from './ui/CustomSelect';
import { EditBaselineModal } from './analytics/EditBaselineModal';
import { useInventory } from '../context/InventoryContext';
import {
  calculateUnassignedValueStrict,
  calculateUnassignedQuantityStrict,
  precomputeAssignedBatches,
  formatCurrency, 
  calculateMonthlyMetrics,
  parseDateLocal,
} from '../utils/helpers';
import { getBaselineYears, getMonthlyBaseline } from '../utils/baselineStats';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  PieChart as PieIcon,
  Calendar,
  BarChart2,
  CheckCircle2,
  PackageCheck,
  Pencil,
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

const formatSignedCurrency = (amount: number): string =>
  `${amount >= 0 ? '+' : ''}${formatCurrency(amount)}`;

const getProfitTextColor = (amount: number): string =>
  amount >= 0 ? 'text-emerald-400' : 'text-rose-400';

interface AnalyticsViewProps {
  isActive?: boolean;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  isActive = true,
}) => {
  const { state } = useInventory();

  const currentYearNum = new Date().getFullYear(); // e.g. 2026
  const currentMonthIdx = new Date().getMonth(); // 0-11 (August = 7)

  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(currentMonthIdx);

  // Edit monthly baseline modal state
  const [isEditingBaseline, setIsEditingBaseline] = useState(false);

  // Collect available years from builds & transactions (starting from 2026)
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
    getBaselineYears(state.sheetStats).forEach((year) => yearsSet.add(year));
    return Array.from(yearsSet).filter((yr) => yr > 0).sort((a, b) => b - a);
  }, [state.builds, state.transactions, state.sheetStats, currentYearNum]);

  // Compute monthly stats for selectedYear
  const monthlyData = React.useMemo(() => MONTH_NAMES.map((monthName, idx) => {
    const {
      revenue,
      profit,
      pcsSold,
      cost,
      pcRevenue,
      pcCost,
      pcProfit,
      partRevenue,
      partCost,
      partProfit,
    } = calculateMonthlyMetrics(state, selectedYear, idx);

    const pcMargin = pcsSold > 0 && pcRevenue > 0 ? (pcProfit / pcRevenue) * 100 : 0;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      monthIndex: idx,
      monthName,
      revenue,
      profit,
      pcsSold,
      cost: cost !== undefined ? cost : Math.max(0, revenue - profit),
      profitMargin,
      pcRevenue,
      pcCost,
      pcProfit,
      pcMargin,
      partRevenue,
      partCost,
      partProfit,
    };
  }), [state, selectedYear]);

  // Calculate Yearly Totals
  const {
    totalYearlyRevenue,
    totalYearlyProfit,
    totalYearlyCost,
    totalYearlyPcsSold,
    totalYearlyPcRevenue,
    totalYearlyPcProfit,
    avgYearlyProfitPerBuild,
    avgYearlyMargin,
  } = React.useMemo(() => {
    const rev = monthlyData.reduce((sum, m) => sum + m.revenue, 0);
    const prof = monthlyData.reduce((sum, m) => sum + m.profit, 0);
    const cost = Math.max(0, rev - prof);
    const pcs = monthlyData.reduce((sum, m) => sum + m.pcsSold, 0);
    const pcRev = monthlyData.reduce((sum, m) => sum + m.pcRevenue, 0);
    const pcProf = monthlyData.reduce((sum, m) => sum + m.pcProfit, 0);

    const avgProf = pcs > 0 ? pcProf / pcs : 0;
    const avgMarg = pcs > 0 && pcRev > 0 ? (pcProf / pcRev) * 100 : 0;
    return {
      totalYearlyRevenue: rev,
      totalYearlyProfit: prof,
      totalYearlyCost: cost,
      totalYearlyPcsSold: pcs,
      totalYearlyPcRevenue: pcRev,
      totalYearlyPcProfit: pcProf,
      avgYearlyProfitPerBuild: avgProf,
      avgYearlyMargin: avgMarg,
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
  const selectedMonthBaseline = React.useMemo(
    () => getMonthlyBaseline(state.sheetStats, selectedYear, selectedMonthIdx),
    [state.sheetStats, selectedYear, selectedMonthIdx]
  );
  const selectedMonthPcRevenue = selectedMonthData.pcRevenue;
  const selectedMonthPcProfit = selectedMonthData.pcProfit;

  const selectedMonthAvgProfit =
    selectedMonthPcsSold > 0 ? selectedMonthPcProfit / selectedMonthPcsSold : 0;
  const selectedMonthAvgMargin =
    selectedMonthPcsSold > 0 && selectedMonthPcRevenue > 0
      ? (selectedMonthPcProfit / selectedMonthPcRevenue) * 100
      : 0;

  // In-stock loose inventory value by category
  const categoryData = React.useMemo(() => {
    const precomputedMap = precomputeAssignedBatches(state.builds);
    return [
      'GPU',
      'RAM',
      'CPU',
      'Storage',
      'Motherboard',
      'PSU',
      'Case',
      'Cooling',
      'Fans',
      'Accessories',
      'Other',
    ]
      .map((cat) => {
        const items = state.components.filter((c) => c.category === cat);
        const value = items.reduce((sum, c) => sum + calculateUnassignedValueStrict(c, state.builds, precomputedMap), 0);
        const units = items.reduce((sum, c) => sum + calculateUnassignedQuantityStrict(c, state.builds, precomputedMap), 0);
        return {
          name: cat,
          value,
          units,
        };
      })
      .filter((c) => c.value > 0);
  }, [state.components, state.builds]);

  return (
    <div className="space-y-3 w-full">
      <GoalBar />

      {/* Top Controls Banner */}
      <div className="bg-[#0D1118] border border-white/[0.08] p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 flex items-center justify-center text-[#7C6CF2]">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            PC SALES & PORTFOLIO ANALYTICS
          </h2>
          <p className="text-[11px] text-zinc-400 mt-1">
            Full annual tracking, monthly breakdowns, revenue, profit, and inventory metrics.
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {/* Year Picker */}
          <div className="flex-1 sm:flex-initial w-32 sm:w-36">
            <CustomSelect
              value={String(selectedYear)}
              onChange={(val) => setSelectedYear(Number(val))}
              options={availableYears.map(yr => ({ label: yr + ' Stats', value: String(yr) }))}
            />
          </div>

          {/* Month Picker */}
          <div className="flex-1 sm:flex-initial w-48 sm:w-56">
            <CustomSelect
              value={String(selectedMonthIdx)}
              onChange={(val) => setSelectedMonthIdx(Number(val))}
              options={MONTH_NAMES.map((mName, i) => ({
                label: `${mName} ${selectedYear} ${i === currentMonthIdx && selectedYear === currentYearNum ? '(Current)' : ''}`,
                value: String(i)
              }))}
            />
          </div>
        </div>
      </div>

      {/* Scope Explainer Helper Text */}
      <p className="text-[11px] text-zinc-400 px-1">
        Totals include PC and loose-part sales. Per-PC averages and PC Margin use PC sales only.
      </p>

      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Selected Month Performance Card */}
        <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-3.5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-3 relative z-10 flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#7C6CF2]" /> {selectedMonthName} {selectedYear} Performance
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingBaseline(true)}
                className="px-2.5 py-1 bg-[#121722] hover:bg-white/[0.04] border border-white/[0.08] hover:border-[#7C6CF2]/40 text-zinc-300 hover:text-white rounded-lg text-[10px] sm:text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                title="Override baseline figures for this month"
              >
                <Pencil className="w-3 h-3 text-[#7C6CF2]" /> Edit Baseline
              </button>
              {selectedMonthIdx === currentMonthIdx && selectedYear === currentYearNum && (
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold tracking-wider uppercase leading-none inline-flex items-center justify-center whitespace-nowrap bg-[#7C6CF2]/15 text-[#9D91FA] border border-[#7C6CF2]/30">
                  Current Month
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 relative z-10">
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Revenue</p>
              <p className="text-sm sm:text-base font-bold font-mono text-[#9D91FA] mt-0.5 leading-tight">{formatCurrency(selectedMonthRevenue)}</p>
            </div>
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Total Cost</p>
              <p className="text-sm sm:text-base font-bold font-mono text-zinc-200 mt-0.5 leading-tight">{formatCurrency(selectedMonthCost)}</p>
            </div>
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Net Profit</p>
              <p className={`text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight ${getProfitTextColor(selectedMonthProfit)}`}>{formatSignedCurrency(selectedMonthProfit)}</p>
            </div>
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">PCs Sold</p>
              <p className="text-sm sm:text-base font-bold font-mono text-blue-400 mt-0.5 leading-tight">{selectedMonthPcsSold}</p>
            </div>
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Avg Profit / PC</p>
              <p className="text-sm sm:text-base font-bold font-mono text-zinc-100 mt-0.5 leading-tight">{formatCurrency(selectedMonthAvgProfit)}</p>
            </div>
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">PC Margin</p>
              <p className={`text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight ${getProfitTextColor(selectedMonthAvgMargin)}`}>{selectedMonthAvgMargin.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Yearly Stats Card */}
        <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-3.5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-3 relative z-10 flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5 text-[#7C6CF2]" /> {selectedYear} Full Year Totals
            </h3>
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              12 Month Aggregate
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 relative z-10">
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Total Revenue</p>
              <p className="text-sm sm:text-base font-bold font-mono text-[#9D91FA] mt-0.5 leading-tight">{formatCurrency(totalYearlyRevenue)}</p>
            </div>
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Total Cost</p>
              <p className="text-sm sm:text-base font-bold font-mono text-zinc-200 mt-0.5 leading-tight">{formatCurrency(totalYearlyCost)}</p>
            </div>
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Net Profit</p>
              <p className={`text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight ${getProfitTextColor(totalYearlyProfit)}`}>{formatSignedCurrency(totalYearlyProfit)}</p>
            </div>
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Total PCs Sold</p>
              <p className="text-sm sm:text-base font-bold font-mono text-blue-400 mt-0.5 leading-tight">{totalYearlyPcsSold}</p>
            </div>
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">Avg Profit / PC</p>
              <p className="text-sm sm:text-base font-bold font-mono text-zinc-100 mt-0.5 leading-tight">{formatCurrency(avgYearlyProfitPerBuild)}</p>
            </div>
            <div className="border border-white/[0.08] bg-[#121722] rounded-xl p-2.5 flex flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-tight">PC Margin</p>
              <p className={`text-sm sm:text-base font-bold font-mono mt-0.5 leading-tight ${getProfitTextColor(avgYearlyMargin)}`}>{avgYearlyMargin.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* PC Sales Tracking Spreadsheet Table */}
      <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
        <div className="bg-[#121722] px-3.5 py-2.5 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-2">
              <PackageCheck className="w-3.5 h-3.5 text-[#7C6CF2]" /> PC Sales Tracking — {selectedYear}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5">
              Click any month row below to inspect its performance stats above.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#121722]/80 text-zinc-400 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider border-b border-white/[0.08]">
                <th className="py-2.5 px-3 w-[28%] border-r border-white/[0.06]">Month</th>
                <th className="py-2.5 px-3 w-[24%] border-r border-white/[0.06]">Revenue</th>
                <th className="py-2.5 px-3 w-[24%] border-r border-white/[0.06] text-emerald-400">Profit</th>
                <th className="py-2.5 px-3 w-[24%] text-blue-400">PCs Sold</th>
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
                        ? 'bg-[#7C6CF2]/15 text-white'
                        : isCurrent
                        ? 'bg-white/[0.02] text-zinc-100 font-semibold border-l-2 border-[#7C6CF2] hover:bg-white/[0.04]'
                        : 'hover:bg-white/[0.02] border-l-2 border-transparent'
                    }`}
                  >
                    {/* Month Cell */}
                    <td className="py-2 px-3 font-sans font-medium text-zinc-200 border-r border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">{row.monthName.substring(0, 3)}<span className="hidden sm:inline">{row.monthName.substring(3)}</span></span>
                          {isCurrent && (
                            <span className="text-[#9D91FA] bg-[#7C6CF2]/20 border border-[#7C6CF2]/40 flex items-center justify-center w-4 h-4 rounded-full">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#7C6CF2] hidden sm:block" />}
                      </div>
                    </td>

                    {/* Revenue Cell */}
                    <td className="py-2 px-3 text-[#9D91FA] border-r border-white/[0.06] font-mono font-medium">
                      {formatCurrency(row.pcRevenue)}
                    </td>

                    {/* Profit Cell */}
                    <td className={`py-2 px-3 border-r border-white/[0.06] font-mono font-medium ${getProfitTextColor(row.pcProfit)}`}>
                      {formatCurrency(row.pcProfit)}
                    </td>

                    {/* PCs Sold Cell */}
                    <td className="py-2 px-3 text-blue-400 font-mono font-medium text-center sm:text-left">
                      {row.pcsSold}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* TOTAL Row */}
            <tfoot>
              <tr className="bg-[#121722] border-t-2 border-[#7C6CF2]/40 font-mono text-xs font-bold">
                <td className="py-2.5 px-3 font-sans text-zinc-200 tracking-wider uppercase border-r border-white/[0.06]">
                  TOTAL
                </td>
                <td className="py-2.5 px-3 text-[#9D91FA] border-r border-white/[0.06]">
                  {formatCurrency(totalYearlyPcRevenue)}
                </td>
                <td className={`py-2.5 px-3 border-r border-white/[0.06] ${getProfitTextColor(totalYearlyPcProfit)}`}>
                  {formatSignedCurrency(totalYearlyPcProfit)}
                </td>
                <td className="py-2.5 px-3 text-blue-400 text-center sm:text-left">
                  {totalYearlyPcsSold}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Monthly Revenue & Profit Chart */}
        <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-3.5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#7C6CF2]" /> {selectedYear} Monthly Total Revenue & Profit
            </h3>
          </div>

          <div className="h-52 w-full">
            {isActive ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <XAxis
                    dataKey="monthName"
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    tickFormatter={(val) => val.substring(0, 3)}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0D1118',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '0.75rem',
                      color: '#f4f4f5',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name,
                    ]}
                  />
                  <Bar dataKey="revenue" fill="#7C6CF2" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" fill="#10b981" name="Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full" />
            )}
          </div>
        </div>

        {/* Inventory Value by Category Bar Chart */}
        <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-3.5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <PieIcon className="w-3.5 h-3.5 text-[#7C6CF2]" /> Inventory Valuation by Category
            </h3>
          </div>
          <div className="h-52 w-full">
            {isActive ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0D1118',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '0.75rem',
                      color: '#f4f4f5',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Inventory Value']}
                  />
                  <Bar dataKey="value" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full" />
            )}
          </div>
        </div>

        {/* PC Margin Trend Line Chart */}
        <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-3.5 space-y-3 lg:col-span-2 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#7C6CF2]" /> PC Margin Trend
            </h3>
            <span className="text-[11px] font-mono text-zinc-400 font-medium">%</span>
          </div>
          <div className="h-52 w-full">
            {isActive ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="monthName"
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    tickFormatter={(val) => val.substring(0, 3)}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                    tickFormatter={(val) => `${val.toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0D1118',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '0.75rem',
                      color: '#f4f4f5',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)}%`, 'PC Margin']}
                  />
                  <Line type="monotone" dataKey="pcMargin" stroke="#7C6CF2" strokeWidth={2.5} dot={{ fill: '#7C6CF2', strokeWidth: 2, r: 3.5 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full" />
            )}
          </div>
        </div>
      </div>

      <EditBaselineModal
        isOpen={isEditingBaseline}
        onClose={() => setIsEditingBaseline(false)}
        selectedMonthIdx={selectedMonthIdx}
        selectedYear={selectedYear}
        initialRev={selectedMonthBaseline.revenue}
        initialProf={selectedMonthBaseline.profit}
        initialPcs={selectedMonthBaseline.pcsSold}
      />
    </div>
  );
};
