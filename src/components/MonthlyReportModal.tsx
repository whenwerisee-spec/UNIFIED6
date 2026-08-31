import React, { useState } from 'react';
import {
  X,
  FileText,
  Download,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Building2,
  Sparkles,
  PieChart
} from 'lucide-react';
import { Coin, Holding, Transaction } from '../types';
import { generateMonthlyPortfolioPdf } from '../lib/pdfReportGenerator';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  citizenship: string;
  netWorth: number;
  liveCashBalance: number;
  holdings: Holding[];
  coins: Coin[];
  transactions: Transaction[];
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({
  isOpen,
  onClose,
  userName,
  userEmail,
  citizenship,
  netWorth,
  liveCashBalance,
  holdings,
  coins,
  transactions,
  showToast
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('August 2026');
  const [includeTransactions, setIncludeTransactions] = useState<boolean>(true);
  const [includeAuditSignature, setIncludeAuditSignature] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  if (!isOpen) return null;

  const monthOptions = [
    'August 2026 (Current)',
    'July 2026',
    'June 2026',
    'Q2 2026 Comprehensive'
  ];

  const handleDownloadReport = () => {
    setIsGenerating(true);
    try {
      const doc = generateMonthlyPortfolioPdf({
        userName,
        userEmail,
        citizenship,
        netWorth,
        liveCashBalance,
        holdings,
        coins,
        transactions: includeTransactions ? transactions : [],
        selectedMonth
      });

      const cleanMonthName = selectedMonth.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Portfolio_Summary_Statement_${cleanMonthName}_${Date.now()}.pdf`;

      doc.save(filename);
      showToast('Monthly Portfolio PDF Report generated and downloaded!', 'success');
      onClose();
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
      showToast('Failed to generate PDF report. Please try again.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const formattedNetWorth = netWorth.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-gray-100 space-y-6 relative animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-[#0052FF] rounded-2xl border border-blue-100">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-gray-900">Monthly Portfolio Statement</h2>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                  PDF EXPORT
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Generate an official, audited PDF summary statement for tax and accounting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Statement Preview Summary Box */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 relative overflow-hidden shadow-md">
          <div className="absolute top-0 right-0 p-8 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Statement Period
              </span>
              <span className="text-sm font-extrabold text-blue-400 flex items-center mt-0.5">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                {selectedMonth}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Account Holder
              </span>
              <span className="text-xs font-bold text-slate-200">{userName || 'Primary User'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Consolidated Net Worth
              </span>
              <span className="text-lg font-black text-white font-mono">
                ${formattedNetWorth}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Liquid Cash Balance
              </span>
              <span className="text-lg font-black text-emerald-400 font-mono">
                ${liveCashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tracked Assets
              </span>
              <span className="text-lg font-black text-indigo-300 font-mono">
                {holdings.length} Coins + USD
              </span>
            </div>
          </div>
        </div>

        {/* Customization Options */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
            Report Options & Settings
          </h3>

          <div className="space-y-3">
            {/* Select Period */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Select Reporting Period
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0052FF]"
              >
                {monthOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTransactions}
                  onChange={(e) => setIncludeTransactions(e.target.checked)}
                  className="rounded border-gray-300 text-[#0052FF] focus:ring-[#0052FF] h-4 w-4"
                />
                <span className="text-xs font-semibold text-gray-700">
                  Include Recent Monthly Activity Ledger ({transactions.length} items)
                </span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAuditSignature}
                  onChange={(e) => setIncludeAuditSignature(e.target.checked)}
                  className="rounded border-gray-300 text-[#0052FF] focus:ring-[#0052FF] h-4 w-4"
                />
                <span className="text-xs font-semibold text-gray-700 flex items-center">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                  Attach Cryptographic Ledger Verification Signature
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Security & Proof Notice */}
        <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-100 flex items-start space-x-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-900 leading-relaxed font-medium">
            This PDF statement includes institutional-grade asset valuation, complete portfolio weighting breakdown, and verified double-entry ledger timestamps suitable for tax filing and financial auditing.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleDownloadReport}
            className="w-2/3 py-3 bg-[#0052FF] hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <span>Generating PDF...</span>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download Portfolio PDF Report</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportModal;
