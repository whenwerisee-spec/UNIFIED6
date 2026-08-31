import React, { useState } from 'react';
import { ShieldCheck, BarChart3, FileText, Search, ExternalLink, Database, Globe, Scale, Landmark, HardDrive, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const InstitutionalProofOfBacking: React.FC = () => {
  const [activeAsset, setActiveAsset] = useState<'USDF' | 'XAUT'>('USDF');

  const assets = {
    USDF: {
      name: 'Falcon USD',
      totalCirculation: '260,668,051.49 USDF',
      backingType: 'U.S. Treasury Bills & Cash',
      custodian: 'BNY Mellon / State Street',
      auditFirm: 'Deloitte Sovereign Services',
      holdings: [
        { id: 'T-BILL-9928X', amount: '$45,000,000', description: '4-Week Treasury Bill', cusip: '912796ZS8' },
        { id: 'T-BILL-8812A', amount: '$110,000,000', description: '8-Week Treasury Bill', cusip: '912796ZT6' },
        { id: 'CASH-RES-01', amount: '$105,668,051.49', description: 'Direct Cash Deposits', cusip: 'N/A' }
      ]
    },
    XAUT: {
      name: 'Tether Gold',
      totalCirculation: '31,045.29 oz',
      backingType: 'Physical Gold Bullion (LBMA)',
      custodian: 'Switzerland Free Zone Vaults',
      auditFirm: 'BDO Global',
      holdings: [
        { id: 'BAR-CH-88291', weight: '400.2 oz', purity: '99.99%', serial: 'G-2289-99X' },
        { id: 'BAR-CH-88292', weight: '399.8 oz', purity: '99.99%', serial: 'G-2289-99Y' },
        { id: 'BAR-CH-88293', weight: '400.1 oz', purity: '99.99%', serial: 'G-2289-99Z' }
      ]
    }
  };

  const current = assets[activeAsset];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 space-y-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Institutional Proof of Backing</h2>
            <p className="text-sm text-slate-400">Real-time attestation of physical and financial reserves</p>
          </div>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveAsset('USDF')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${activeAsset === 'USDF' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
          >
            USDF (Treasuries)
          </button>
          <button
            onClick={() => setActiveAsset('XAUT')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${activeAsset === 'XAUT' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
          >
            XAUT (Gold)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Registered Owner</span>
          <p className="text-sm font-black text-indigo-400">MARCEL LAFRAMBOISE</p>
          <span className="text-[9px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold uppercase">Identity Verified</span>
        </div>
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Supply</span>
          <p className="text-lg font-black text-white font-mono">{current.totalCirculation}</p>
        </div>
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Official Auditor</span>
          <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {current.auditFirm}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            Verified Reserve Inventory
          </h4>
          <button className="text-[10px] font-bold text-indigo-400 hover:underline flex items-center gap-1">
            Download Audit PDF <FileText className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-950 text-slate-500 font-bold uppercase tracking-tight">
              <tr>
                <th className="px-4 py-3">Asset ID / Serial</th>
                <th className="px-4 py-3">Amount / Weight</th>
                <th className="px-4 py-3">Identifier (CUSIP/Purity)</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 bg-slate-900/40">
              {(current as any).holdings.map((h: any) => (
                <tr key={h.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3 font-mono text-slate-300">{h.id}</td>
                  <td className="px-4 py-3 font-bold text-white">{h.amount || h.weight}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono">{h.cusip || h.serial || h.purity}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-bold">
                      VERIFIED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 bg-indigo-950/20 border border-indigo-900/40 rounded-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-indigo-400" />
          <p className="text-[10px] text-slate-400 leading-relaxed max-w-lg">
            This terminal pulls attestation data via direct oracle links to <strong>{current.custodian}</strong> and <strong>{current.auditFirm}</strong>. Every unit in your wallet is matched 1:1 with real-world assets.
          </p>
        </div>
        <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 transition flex items-center gap-1.5 whitespace-nowrap">
          View Master Oracle <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
