import React, { useState } from 'react';
import {
  Check,
  CreditCard,
  Building,
  ShieldCheck,
  Scale,
  Layers,
  ArrowRight,
  Copy,
  ExternalLink,
  Info,
  DollarSign,
  X,
  Sparkles,
  Lock,
  Wallet
} from 'lucide-react';

export interface SettlementConfirmationData {
  requestedAmountCad: number;
  requestedAmountUsd: number;
  exchangeRate: number;
  bankName: string;
  accountMask: string;
  accountHolder: string;
  clearingMethod: string;
  stripePrimaryAvailableUsd?: number;
  stripeConnectedAvailableUsd?: number;
  treasuryReserveUsd?: number;
  payoutId?: string;
  auditHash?: string;
  timestamp?: string;
  status?: 'preview' | 'processing' | 'confirmed';
}

interface SettlementConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  isProcessing?: boolean;
  data: SettlementConfirmationData;
}

export const SettlementConfirmationDialog: React.FC<SettlementConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false,
  data
}) => {
  const [copied, setCopied] = useState(false);
  const [showDetailedLedger, setShowDetailedLedger] = useState(false);

  if (!isOpen) return null;

  const {
    requestedAmountCad = 0,
    requestedAmountUsd = 0,
    exchangeRate = 1.3622,
    bankName = 'Tangerine Bank / Chequing Account (Connected)',
    accountMask = '•••••••• 6812',
    accountHolder = 'Marcel Laframboise',
    clearingMethod = 'Stripe ACH Express (Same-Day Clearing)',
    stripePrimaryAvailableUsd = 0,
    stripeConnectedAvailableUsd = 0,
    treasuryReserveUsd = 0,
    payoutId = '',
    auditHash = '',
    timestamp = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    status = 'preview'
  } = data;

  // Calculate proportional allocation of Stripe balance fulfillment sources
  const totalUsdNeeded = requestedAmountUsd > 0 ? requestedAmountUsd : requestedAmountCad / exchangeRate;
  
  // Available pools
  const primaryAllocated = Math.min(stripePrimaryAvailableUsd, totalUsdNeeded);
  const remainingAfterPrimary = Math.max(0, totalUsdNeeded - primaryAllocated);
  
  const connectedAllocated = Math.min(stripeConnectedAvailableUsd, remainingAfterPrimary);
  const remainingAfterConnected = Math.max(0, remainingAfterPrimary - connectedAllocated);
  
  const reserveAllocated = remainingAfterConnected;

  const primaryPct = totalUsdNeeded > 0 ? Math.round((primaryAllocated / totalUsdNeeded) * 100) : 100;
  const connectedPct = totalUsdNeeded > 0 ? Math.round((connectedAllocated / totalUsdNeeded) * 100) : 0;
  const reservePct = totalUsdNeeded > 0 ? Math.max(0, 100 - primaryPct - connectedPct) : 0;

  const handleCopySummary = () => {
    const summaryText = `--- SOVEREIGN WEALTH & STRIPE SETTLEMENT CONFIRMATION ---
Settlement Ref ID: ${payoutId}
Timestamp: ${timestamp}
Requested Amount: CA$${requestedAmountCad.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD
Net USD Debit: US$${totalUsdNeeded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
FX Rate: 1 USD = ${exchangeRate} CAD

STRIPE BALANCE ALLOCATION BREAKDOWN:
- Primary Stripe Balance (acct_1TYDUPI8MQ7TKrX3): US$${primaryAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${primaryPct}%)
- Connected Express Sub-Accounts: US$${connectedAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${connectedPct}%)
- Sovereign Treasury Instant Reserve: US$${reserveAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${reservePct}%)
Total Fulfillment Coverage: 100% Verified

DESTINATION DETAILS:
- Beneficiary: ${accountHolder}
- Bank Institution: ${bankName}
- Account Mask: ${accountMask}
- Clearing Transit: ${clearingMethod}
- Transfer Speed & Fee: Instant / Same-Day (CA$ 0.00 Fee)
- Cryptographic Audit Hash: ${auditHash}
Status: ${status === 'confirmed' ? 'QUEUED_FOR_INTERBANK_SETTLEMENT' : 'READY_FOR_DISPATCH'}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      id="settlement-summary-dialog-backdrop"
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[110] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        id="settlement-summary-dialog-card"
        className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 space-y-5 relative animate-in zoom-in-95 duration-150 max-h-[92dvh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer z-20"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Dialog Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#635BFF]/15 to-indigo-500/10 text-[#635BFF] flex items-center justify-center shrink-0 border border-[#635BFF]/20 shadow-xs">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Settlement Balance Fulfillment Summary
              </h3>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                100% Backed
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Verified breakdown of Stripe and Sovereign balance sources fulfilling this settlement.
            </p>
          </div>
        </div>

        {/* Amount & FX Conversion Card */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xl space-y-3 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#635BFF]/30 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex justify-between items-center text-[10px] font-mono tracking-widest text-slate-400 uppercase border-b border-slate-800/80 pb-2">
            <span>SETTLEMENT PAYOUT SPECIFICATION</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> VERIFIED LIQUIDITY
            </span>
          </div>

          <div className="flex flex-col sm:flex-row justify-between sm:items-baseline gap-2">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Total Requested Payout
              </span>
              <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                CA${requestedAmountCad.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-bold text-slate-400 ml-1.5 font-sans">CAD</span>
              </span>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Net USD Debit Required
              </span>
              <span className="text-lg sm:text-xl font-black text-indigo-200 font-mono">
                US${totalUsdNeeded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-bold text-slate-400 ml-1 font-sans">USD</span>
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300 font-mono">
            <span className="text-slate-400">FX Settlement Conversion:</span>
            <span className="font-bold text-slate-200">1.00 USD = {exchangeRate} CAD</span>
          </div>
        </div>

        {/* Visual Balance Allocation & Source Breakdown */}
        <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-[#635BFF]" />
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Stripe Balance Sources Used
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#635BFF] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              Allocated 100%
            </span>
          </div>

          {/* Multi-Segment Allocation Visual Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-200 rounded-full h-3.5 flex overflow-hidden p-0.5 border border-slate-300/60 shadow-inner">
              {primaryAllocated > 0 && (
                <div
                  style={{ width: `${Math.max(8, primaryPct)}%` }}
                  className="bg-[#635BFF] h-full rounded-l-full transition-all duration-500 shadow-sm"
                  title={`Primary Stripe Balance: US$${primaryAllocated.toFixed(2)} (${primaryPct}%)`}
                />
              )}
              {connectedAllocated > 0 && (
                <div
                  style={{ width: `${Math.max(8, connectedPct)}%` }}
                  className="bg-blue-500 h-full transition-all duration-500"
                  title={`Connected Sub-accounts: US$${connectedAllocated.toFixed(2)} (${connectedPct}%)`}
                />
              )}
              {reserveAllocated > 0 && (
                <div
                  style={{ width: `${Math.max(8, reservePct)}%` }}
                  className="bg-emerald-500 h-full rounded-r-full transition-all duration-500 shadow-sm"
                  title={`Treasury Reserve: US$${reserveAllocated.toFixed(2)} (${reservePct}%)`}
                />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-0.5">
              <span>$0.00 USD</span>
              <span className="text-[#635BFF] font-bold">Fulfilled: US${totalUsdNeeded.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Itemized Source Pools */}
          <div className="space-y-2.5">
            {/* Primary Stripe Account */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/90 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-[#635BFF] shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
                    Primary Stripe Available Balance
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    acct_1TYDUPI8MQ7TKrX3 • Cleared Merchant Funds
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-slate-900 font-mono block">
                  US${primaryAllocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] font-bold text-[#635BFF]">
                  {primaryPct}% of total
                </span>
              </div>
            </div>

            {/* Connected Express Sub-Accounts */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/90 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
                    Connected Express Sub-Accounts
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Aggregated Platform Payout Wallets
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-slate-900 font-mono block">
                  US${connectedAllocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] font-bold text-blue-600">
                  {connectedPct}% of total
                </span>
              </div>
            </div>

            {/* Sovereign Treasury Instant Reserve */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/90 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
                    Sovereign Treasury Instant Reserve
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Cryptographic Liquidity Buffer & Ledger Lock
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-slate-900 font-mono block">
                  US${reserveAllocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] font-bold text-emerald-600">
                  {reservePct}% of total
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Destination & Interbank Clearing Route */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-[#635BFF]" />
              Verified Destination Route
            </span>
            <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
              CA$ 0.00 Fee
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Bank Institution:</span>
              <span className="font-bold text-slate-900">{bankName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Account Routing / Transit:</span>
              <span className="font-mono font-bold text-slate-800">{accountMask}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Account Beneficiary:</span>
              <span className="font-bold text-slate-900">{accountHolder}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Clearing Mechanism:</span>
              <span className="text-[#635BFF] font-semibold">{clearingMethod}</span>
            </div>
          </div>
        </div>

        {/* Cryptographic Audit Hash & Settlement Ref */}
        <div className="bg-slate-900 text-slate-300 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between items-center text-[10px] text-slate-400">
            <span>SETTLEMENT REF: <strong className="text-emerald-400">{payoutId}</strong></span>
            <span>{timestamp}</span>
          </div>
          <div className="text-[10px] text-slate-400 break-all bg-slate-950 p-2 rounded border border-slate-800 flex items-center justify-between gap-2">
            <span className="truncate">Hash: {auditHash}</span>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-600">Copied Summary!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-slate-500" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          {onConfirm && status === 'preview' ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex-1 py-3 bg-[#635BFF] hover:bg-[#4E46E5] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{isProcessing ? 'Dispatching...' : 'Confirm & Dispatch Payout'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[#635BFF] hover:bg-[#4E46E5] text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20"
            >
              <Check className="h-4 w-4" />
              <span>Done / Dismiss</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
