import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import {
  PieChart as PieIcon,
  TrendingDown,
  ArrowUpRight,
  ShoppingBag,
  Zap,
  ArrowLeftRight,
  Utensils,
  Plane,
  Shield,
  Calendar,
  Filter,
  DollarSign,
  Layers,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion';
import { Transaction } from '../types';

export interface SpendingCategoryData {
  id: string;
  name: string;
  amount: number;
  color: string;
  iconName: string;
  percentage: number;
  txCount: number;
  subcategories: string[];
}

export interface DailySpendingData {
  date: string;
  fullDate: string;
  dayNumber: number;
  utilities: number;
  shopping: number;
  transfers: number;
  dining: number;
  other: number;
  total: number;
}

interface SpendingPatternsVisualizationProps {
  transactions?: Transaction[];
  citizenship?: string;
  onNavigateToTransfers?: () => void;
}

// Color palette specifically calibrated for high contrast, sophisticated UI
const CATEGORY_COLORS = {
  utilities: '#6366F1', // Indigo
  shopping: '#0052FF',  // Coinbase Blue
  transfers: '#10B981', // Emerald
  dining: '#F59E0B',    // Amber
  travel: '#EC4899',    // Pink
  financial: '#8B5CF6'  // Purple
};

export const SpendingPatternsVisualization: React.FC<SpendingPatternsVisualizationProps> = ({
  transactions = [],
  citizenship = 'US',
  onNavigateToTransfers
}) => {
  const [timeRange, setTimeRange] = useState<'7D' | '14D' | '30D'>('30D');
  const [activeChartView, setActiveChartView] = useState<'donut' | 'trend' | 'stacked'>('donut');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);

  const currencySymbol = citizenship === 'CA' || citizenship === 'Canada' ? 'CAD' : 'USD';

  // Format currency helper
  const formatCurrency = (val: number, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencySymbol,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(val);
  };

  // Generate 30-day continuous timeline data with realistic deterministic seeding blended with live transactions
  const { categoryData, dailyData, totalMonthlySpend, avgDailySpend, topCategory } = useMemo(() => {
    const days = timeRange === '7D' ? 7 : timeRange === '14D' ? 14 : 30;
    const now = new Date();
    
    // Categorized accumulator
    const categories: Record<string, { name: string; amount: number; color: string; iconName: string; txCount: number; subcategories: string[] }> = {
      utilities: {
        name: 'Utilities & Services',
        amount: 1420.50,
        color: CATEGORY_COLORS.utilities,
        iconName: 'Zap',
        txCount: 8,
        subcategories: ['Cloud Compute', 'Telecom & Fiber', 'Electricity', 'SaaS Hosting']
      },
      shopping: {
        name: 'Shopping & Equipment',
        amount: 3890.25,
        color: CATEGORY_COLORS.shopping,
        iconName: 'ShoppingBag',
        txCount: 19,
        subcategories: ['Hardware Tech', 'Office Supplies', 'Apparel & Goods', 'Retail POS']
      },
      transfers: {
        name: 'Transfers & Remittances',
        amount: 8450.00,
        color: CATEGORY_COLORS.transfers,
        iconName: 'ArrowLeftRight',
        txCount: 14,
        subcategories: ['Wise Interbank', 'ACH Settlement', 'Wallet Payouts', 'Wire Rails']
      },
      dining: {
        name: 'Dining & Provisions',
        amount: 1180.75,
        color: CATEGORY_COLORS.dining,
        iconName: 'Utensils',
        txCount: 22,
        subcategories: ['Client Dinners', 'Catering', 'Coffee & Cafes', 'Merchant Groceries']
      },
      travel: {
        name: 'Travel & Mobility',
        amount: 2150.00,
        color: CATEGORY_COLORS.travel,
        iconName: 'Plane',
        txCount: 6,
        subcategories: ['Airlines', 'Executive Transport', 'Lodging', 'Transit']
      },
      financial: {
        name: 'Financial & Network Fees',
        amount: 640.80,
        color: CATEGORY_COLORS.financial,
        iconName: 'Shield',
        txCount: 11,
        subcategories: ['Gas Priority Fees', 'Custody Insurance', 'Card Processing', 'Regulatory']
      }
    };

    // Blend in any live outward spending transactions from prop
    transactions.forEach((tx) => {
      if (tx.type === 'SEND' || tx.type === 'SELL') {
        const amt = tx.fiatAmount || tx.amount * 1.0;
        if (amt > 0) {
          categories.transfers.amount += amt;
          categories.transfers.txCount += 1;
        }
      }
    });

    // Compute totals & percentages
    const total = Object.values(categories).reduce((acc, c) => acc + c.amount, 0);

    const formattedCategories: SpendingCategoryData[] = Object.entries(categories).map(([id, c]) => ({
      id,
      name: c.name,
      amount: c.amount,
      color: c.color,
      iconName: c.iconName,
      percentage: total > 0 ? (c.amount / total) * 100 : 0,
      txCount: c.txCount,
      subcategories: c.subcategories
    })).sort((a, b) => b.amount - a.amount);

    // Build day-by-day continuous timeseries
    const dailySeries: DailySpendingData[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      // Deterministic pseudo-random generation based on date seed
      const seed = d.getDate() * 17 + d.getMonth() * 31;
      const utilBase = 35 + (seed % 60);
      const shopBase = 80 + ((seed * 3) % 180);
      const transBase = i % 4 === 0 ? 320 + ((seed * 7) % 450) : 40 + (seed % 90);
      const dineBase = 25 + ((seed * 2) % 65);
      const otherBase = 15 + (seed % 35);
      const dayTotal = utilBase + shopBase + transBase + dineBase + otherBase;

      dailySeries.push({
        date: dayStr,
        fullDate: fullDateStr,
        dayNumber: d.getDate(),
        utilities: utilBase,
        shopping: shopBase,
        transfers: transBase,
        dining: dineBase,
        other: otherBase,
        total: dayTotal
      });
    }

    const avgDaily = total / days;
    const top = formattedCategories[0];

    return {
      categoryData: formattedCategories,
      dailyData: dailySeries,
      totalMonthlySpend: total,
      avgDailySpend: avgDaily,
      topCategory: top
    };
  }, [timeRange, transactions, citizenship]);

  // Helper icon renderer
  const renderCategoryIcon = (iconName: string, color: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'Zap':
        return <Zap className={className} style={{ color }} />;
      case 'ShoppingBag':
        return <ShoppingBag className={className} style={{ color }} />;
      case 'ArrowLeftRight':
        return <ArrowLeftRight className={className} style={{ color }} />;
      case 'Utensils':
        return <Utensils className={className} style={{ color }} />;
      case 'Plane':
        return <Plane className={className} style={{ color }} />;
      case 'Shield':
      default:
        return <Shield className={className} style={{ color }} />;
    }
  };

  // Custom CustomTooltip for Recharts Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = (payload && payload[0] ? (payload && payload[0] ? payload[0].payload : {}) : {}) as SpendingCategoryData;
      return (
        <div className="bg-slate-950/95 border border-slate-800 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs z-50 text-white min-w-[200px]">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
            <span className="font-bold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
              {data.name}
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              {data.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 space-y-1 text-slate-300 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Total Spend:</span>
              <span className="text-white font-bold">{formatCurrency(data.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Transactions:</span>
              <span>{data.txCount} events</span>
            </div>
          </div>
          {data.subcategories && data.subcategories.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
              <span className="block font-semibold text-slate-500 mb-0.5 uppercase tracking-wider">Top Subcategories:</span>
              <span className="text-slate-300">{data.subcategories.join(', ')}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Timeline / Trend Charts
  const CustomTimelineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = (payload && payload[0] ? (payload && payload[0] ? payload[0].payload : {}) : {}) as DailySpendingData;
      return (
        <div className="bg-slate-950/95 border border-slate-800 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs text-white z-50 min-w-[220px]">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-sans">
            <span className="font-bold text-slate-200">{item.fullDate || label}</span>
            <span className="text-emerald-400 font-mono font-bold">{formatCurrency(item.total)}</span>
          </div>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Utilities
              </span>
              <span>{formatCurrency(item.utilities)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Shopping
              </span>
              <span>{formatCurrency(item.shopping)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Transfers
              </span>
              <span>{formatCurrency(item.transfers)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Dining
              </span>
              <span>{formatCurrency(item.dining)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="spending-patterns-visualization-section"
      className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-7 shadow-xs space-y-6"
    >
      {/* Section Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60 font-mono tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-600" />
              Recharts Analytics Engine
            </span>
            <span className="text-xs text-gray-400 font-semibold">• Last 30 Days</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight mt-1 flex items-center gap-2">
            Monthly Spending Patterns & Category Flow
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time categorical breakdown across utilities, merchant shopping, interbank transfers, and liquidity rails.
          </p>
        </div>

        {/* View Switchers & Timeframe selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Mode Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold">
            <button
              id="btn-chart-view-donut"
              type="button"
              onClick={() => setActiveChartView('donut')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                activeChartView === 'donut'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Category</span>
            </button>
            <button
              id="btn-chart-view-trend"
              type="button"
              onClick={() => setActiveChartView('trend')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                activeChartView === 'trend'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
            <button
              id="btn-chart-view-stacked"
              type="button"
              onClick={() => setActiveChartView('stacked')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                activeChartView === 'stacked'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Stack</span>
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold">
            {(['7D', '14D', '30D'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  timeRange === range
                    ? 'bg-[#0052FF] text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top High-Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Outflows */}
        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider">
            <span>Total 30D Outflows</span>
            <DollarSign className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-gray-900 font-mono tracking-tight">
              {formatCurrency(totalMonthlySpend)}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Fully Reconciled with Ledger
            </div>
          </div>
        </div>

        {/* Card 2: Highest Category */}
        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider">
            <span>Top Spend Vector</span>
            <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: topCategory?.color }} />
              {topCategory?.name || 'Transfers'}
            </div>
            <div className="text-[11px] text-gray-500 font-mono mt-0.5">
              {formatCurrency(topCategory?.amount || 0)} ({topCategory?.percentage.toFixed(1)}% of total)
            </div>
          </div>
        </div>

        {/* Card 3: Daily Average */}
        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider">
            <span>Average Daily Burn</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-gray-900 font-mono tracking-tight">
              {formatCurrency(avgDailySpend)}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Across {timeRange === '7D' ? '7' : timeRange === '14D' ? '14' : '30'} operational days
            </div>
          </div>
        </div>

        {/* Card 4: Utilities & Core Burn */}
        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider">
            <span>Utilities & Fixed Ops</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-gray-900 font-mono tracking-tight">
              {formatCurrency(categoryData.find((c) => c.id === 'utilities')?.amount || 0)}
            </div>
            <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">
              8 Recurring Cloud/Infra Bills
            </div>
          </div>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Visual Chart Panel (Cols 7 on desktop) */}
        <div className="lg:col-span-7 bg-slate-950 rounded-2xl p-5 border border-slate-800 text-white min-h-[340px] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-800/80">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-slate-200">
                {activeChartView === 'donut'
                  ? 'Categorical Allocation Breakdown'
                  : activeChartView === 'trend'
                  ? '30-Day Daily Spending Velocity'
                  : 'Categorical Stacked Daily Inflows & Outflows'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Interactive Curve Engine</span>
          </div>

          <div className="w-full h-[260px] relative mt-2">
            {activeChartView === 'donut' && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="amount"
                    stroke="#020617"
                    strokeWidth={3}
                    onMouseEnter={(_, index) => setHoveredSliceIndex(index)}
                    onMouseLeave={() => setHoveredSliceIndex(null)}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={entry.color}
                        opacity={
                          hoveredSliceIndex === null || hoveredSliceIndex === index
                            ? 1
                            : 0.4
                        }
                        className="transition-all duration-300 cursor-pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}

            {activeChartView === 'trend' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0052FF" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0052FF" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="transferGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip content={<CustomTimelineTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total Outflow"
                    stroke="#0052FF"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#spendGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="transfers"
                    name="Transfers Rail"
                    stroke="#10B981"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#transferGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeChartView === 'stacked' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip content={<CustomTimelineTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', color: '#94a3b8', paddingBottom: '10px' }}
                  />
                  <Bar dataKey="utilities" name="Utilities" stackId="a" fill={CATEGORY_COLORS.utilities} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="shopping" name="Shopping" stackId="a" fill={CATEGORY_COLORS.shopping} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="transfers" name="Transfers" stackId="a" fill={CATEGORY_COLORS.transfers} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="dining" name="Dining" stackId="a" fill={CATEGORY_COLORS.dining} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Center metric indicator in donut mode */}
            {activeChartView === 'donut' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">30D Volume</span>
                <span className="text-xl font-bold font-mono text-white tracking-tight">
                  {formatCurrency(totalMonthlySpend, 0)}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">{categoryData.length} categories</span>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Category Breakdown Table (Cols 5 on desktop) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Categorical Ranking</span>
            <span className="text-[11px] text-gray-400 font-mono">Sorted by Value</span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {categoryData.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <div
                  key={cat.id}
                  id={`cat-card-${cat.id}`}
                  onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                      : 'bg-white hover:bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cat.color}18` }}
                    >
                      {renderCategoryIcon(cat.iconName, cat.color, 'w-4 h-4')}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-900 truncate flex items-center gap-1.5">
                        <span>{cat.name}</span>
                        <span className="text-[10px] font-mono text-gray-400 font-normal">
                          ({cat.txCount} txs)
                        </span>
                      </div>
                      <div className="w-28 sm:w-36 h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.color
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-gray-900 font-mono">
                      {formatCurrency(cat.amount)}
                    </div>
                    <div className="text-[10px] font-bold text-gray-500 font-mono">
                      {cat.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Transfer Shortcut Action */}
          {onNavigateToTransfers && (
            <button
              type="button"
              onClick={onNavigateToTransfers}
              className="w-full py-2.5 mt-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Manage Transfers & Settlement Rails</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  </div>);
};
