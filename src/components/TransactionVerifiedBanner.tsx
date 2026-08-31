import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  X,
  Smartphone,
  Calendar,
  Layers,
  Hash
} from 'lucide-react';

export interface VerifiedTxParams {
  txId: string;
  symbol: string;
  amount: string;
  fiat: string;
  type: string;
  time: string;
  status: string;
  hash: string;
  checksum: string;
}

interface TransactionVerifiedBannerProps {
  verifiedParams: VerifiedTxParams;
  onDismiss: () => void;
}

export const TransactionVerifiedBanner: React.FC<TransactionVerifiedBannerProps> = ({
  verifiedParams,
  onDismiss
}) => {
  const parsedDate = verifiedParams.time
    ? new Date(parseInt(verifiedParams.time, 10) || Date.now()).toLocaleString()
    : 'Recently';

  return (
    <div className="mb-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border-2 border-emerald-500/50 rounded-2xl p-5 text-white shadow-xl animate-in slide-in-from-top duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs uppercase font-extrabold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono">
                Secondary Device Verified
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Seal CB55-{verifiedParams.checksum || 'OK'}
              </span>
            </div>
            <h2 className="text-base font-black text-white tracking-tight">
              Transaction Successfully Verified via QR Code
            </h2>
            <p className="text-xs text-slate-300">
              The cryptographic integrity seal, double-entry balanced journal, and transaction hash were successfully validated.
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs font-mono">
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Transaction ID</span>
          <span className="text-white font-bold truncate block">{verifiedParams.txId}</span>
        </div>

        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Type & Amount</span>
          <span className="text-emerald-400 font-bold block">
            {verifiedParams.type} {verifiedParams.amount} {verifiedParams.symbol}
          </span>
        </div>

        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Fiat Valuation</span>
          <span className="text-white font-bold block">${parseFloat(verifiedParams.fiat || '0').toFixed(2)} USD</span>
        </div>

        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Status & Time</span>
          <span className="text-blue-300 font-bold block capitalize">{verifiedParams.status}</span>
        </div>
      </div>
    </div>
  );
};

export default TransactionVerifiedBanner;
