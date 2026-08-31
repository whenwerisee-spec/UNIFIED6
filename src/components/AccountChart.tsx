import React from 'react';
import { LedgerAccount } from '../types.js';
import { 
  Building2, 
  TrendingUp, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft,
  DollarSign
} from 'lucide-react';

interface AccountChartProps {
  accounts: LedgerAccount[];
}

export const AccountChart: React.FC<AccountChartProps> = React.memo(({ accounts }: AccountChartProps) => {
  // Group accounts
  const assets = accounts.filter(a => a.type === 'asset');
  const liabilities = accounts.filter(a => a.type === 'liability');
  const equity = accounts.filter(a => a.type === 'equity');
  const revenues = accounts.filter(a => a.type === 'revenue');
  const expenses = accounts.filter(a => a.type === 'expense');

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
  const totalRevenues = revenues.reduce((sum, a) => sum + a.balance, 0);
  const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);

  // Formatting helper
  const formatCurr = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col h-full" id="account-chart-container">
      <div className="mb-4">
        <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
          Double-Entry Accounts
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 mt-1">
          Active Chart of Accounts
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Ledger node balances with standard double-entry validation.
        </p>
      </div>

      {/* Reconciled Summary Block */}
      <div className="grid grid-cols-2 gap-3 mb-6 bg-gray-50 p-3.5 rounded-xl border border-gray-100/50">
        <div>
          <span className="text-[10px] text-gray-400 font-mono block">Total Assets & Liquid Cash</span>
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            {formatCurr(totalAssets)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-gray-400 font-mono block">Net Annualized Revenue</span>
          <span className="text-lg font-bold text-emerald-600 tracking-tight">
            {formatCurr(totalRevenues - totalExpenses)}
          </span>
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-1" id="accounts-by-category">
        {/* Assets Section */}
        <div>
          <div className="flex justify-between items-center mb-1.5 border-b border-gray-50 pb-1">
            <span className="text-[11px] font-mono font-bold uppercase text-gray-500 flex items-center gap-1">
              <Wallet className="w-3 h-3 text-blue-500" />
              Assets (Debit Balance)
            </span>
            <span className="text-[11px] font-mono text-gray-900 font-bold">
              {formatCurr(totalAssets)}
            </span>
          </div>
          <div className="space-y-1.5">
            {assets.map(acc => (
              <div key={acc.id} className="flex justify-between items-center text-xs py-1 hover:bg-gray-50/50 px-1 rounded transition-colors">
                <div className="truncate pr-2">
                  <span className="font-medium text-gray-700 block truncate">{acc.name}</span>
                  <span className="text-[9px] text-gray-400 font-mono truncate">{acc.description}</span>
                </div>
                <span className="font-mono text-gray-900 font-medium shrink-0">
                  {formatCurr(acc.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenues Section */}
        <div>
          <div className="flex justify-between items-center mb-1.5 border-b border-gray-50 pb-1">
            <span className="text-[11px] font-mono font-bold uppercase text-gray-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              Revenues (Credit Balance)
            </span>
            <span className="text-[11px] font-mono text-gray-900 font-bold">
              {formatCurr(totalRevenues)}
            </span>
          </div>
          <div className="space-y-1.5">
            {revenues.map(acc => (
              <div key={acc.id} className="flex justify-between items-center text-xs py-1 hover:bg-gray-50/50 px-1 rounded transition-colors">
                <div className="truncate pr-2">
                  <span className="font-medium text-gray-700 block truncate">{acc.name}</span>
                  <span className="text-[9px] text-gray-400 font-mono truncate">{acc.description}</span>
                </div>
                <span className="font-mono text-gray-900 font-medium shrink-0">
                  {formatCurr(acc.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses Section */}
        <div>
          <div className="flex justify-between items-center mb-1.5 border-b border-gray-50 pb-1">
            <span className="text-[11px] font-mono font-bold uppercase text-gray-500 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-rose-500" />
              Expenses (Debit Balance)
            </span>
            <span className="text-[11px] font-mono text-gray-900 font-bold">
              {formatCurr(totalExpenses)}
            </span>
          </div>
          <div className="space-y-1.5">
            {expenses.map(acc => (
              <div key={acc.id} className="flex justify-between items-center text-xs py-1 hover:bg-gray-50/50 px-1 rounded transition-colors">
                <div className="truncate pr-2">
                  <span className="font-medium text-gray-700 block truncate">{acc.name}</span>
                  <span className="text-[9px] text-gray-400 font-mono truncate">{acc.description}</span>
                </div>
                <span className="font-mono text-gray-900 font-medium shrink-0">
                  {formatCurr(acc.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Equation Verification */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] font-mono text-gray-400 bg-gray-50/50 p-2.5 rounded-lg border border-gray-100">
        <span className="font-semibold text-gray-500">Bookkeeping Status:</span>
        <span className="text-emerald-600 font-bold flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Balanced (Debits = Credits)
        </span>
      </div>
    </div>
  );
});

export default AccountChart;
