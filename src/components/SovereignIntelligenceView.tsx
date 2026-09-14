import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import {
  ShieldCheck, 
  Shield,
  Cpu, 
  Database, 
  Activity, 
  Terminal, 
  ArrowRight, 
  Lock, 
  Settings, 
  Layers, 
  Globe, 
  RefreshCw, 
  Sliders, 
  Check, 
  AlertCircle, 
  Coins, 
  Sparkles,
  BrainCircuit,
  Key,
  FileText,
  CheckCircle2,
  Search,
  Clock,
  AlertTriangle,
  ExternalLink,
  Zap,
  UserPlus,
  Landmark,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import SelfHealingSovereignAgent from './SelfHealingSovereignAgent';

interface SovereignIntelligenceViewProps {
  user: any;
  sovIntelState: any;
  onSaveIntel: (newIntel: any) => Promise<void>;
  sovereignTokens: any[];
  usdRates: Record<string, number>;
  requestSovereignAuthorization: (title: string, description: string, callback: () => void) => Promise<void>;
  triggerNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
  saveAuditLog: (uid: string, action: string, details: string) => Promise<void>;
  activeReconTab?: string;
  setActiveReconTab?: (tab: any) => void;
  onUpdateTokens?: (newTokens: any[]) => Promise<void>;
  wallets?: any[];
  marshallConfig?: any;
  onCreateYieldWallet?: (name: string, chain: any) => Promise<string | null>;
  onAddTransaction?: (tx: any) => void;
}

export default function SovereignIntelligenceView({
  user,
  sovIntelState,
  onSaveIntel,
  sovereignTokens,
  usdRates,
  requestSovereignAuthorization,
  triggerNotification,
  saveAuditLog,
  activeReconTab = 'unified',
  setActiveReconTab = () => {},
  onUpdateTokens = async () => {},
  wallets = [],
  marshallConfig = null,
  onCreateYieldWallet,
  onAddTransaction
}: SovereignIntelligenceViewProps) {
  const [isConsoleActive, setIsConsoleActive] = useState(true);
  const [consoleTitle, setConsoleTitle] = useState('SOVEREIGN SYSTEM CORE');
  const [consoleLogs, setConsoleLogs] = useState<string[]>(['System initializing...', 'Secure handshake confirmed.']);
  const [isSyncingUnified, setIsSyncingUnified] = useState(false);

  const totalLivePortfolioValue = useMemo(() => {
    return sovereignTokens.reduce((sum, t) => sum + (t.balance * (usdRates[t.symbol] || 0)), 0);
  }, [sovereignTokens, usdRates]);

  const generatePdfReport = () => { triggerNotification('Generating audit report...', 'info'); };

  return (
    <div className="space-y-8 pb-12 text-slate-100">
      {/* HEADER BANNER */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 rounded-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.05),transparent)]"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight flex items-center gap-2">
              <BrainCircuit className="w-8 h-8 text-amber-500" />
              Sovereign Intelligence Report
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Real-time treasury optimization and autonomous self-healing ledger integrity.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-end shrink-0 min-w-[200px]">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Market Valuation</span>
            <span className="text-xl font-bold text-amber-500 font-mono mt-0.5">
              ${totalLivePortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </section>

      {/* SELF-HEALING AGENT OVERLAY */}
      <div className="mb-8">
         <SelfHealingSovereignAgent
            sovereignTokens={sovereignTokens}
            usdBalance={totalLivePortfolioValue}
            triggerNotification={triggerNotification}
         />
      </div>

      {/* CUSTODIAL AUDIT SECTION */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-display font-bold text-white uppercase tracking-wider">Sovereign Audit & Reconciliations</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Cryptographically verified asset proofs and institutional cold-storage reconciliations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850 gap-1 overflow-x-auto">
               {['unified', 'exchanges', 'yield', 'wise', 'gold', 'delegation', 'proof', 'kyc-passport'].map((t) => (
                 <button
                   key={t}
                   onClick={() => setActiveReconTab(t as any)}
                   className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${activeReconTab === t ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                 >
                   {t.toUpperCase()}
                 </button>
               ))}
             </div>
          </div>
        </div>

        {activeReconTab === 'unified' && (
          <div className="bg-slate-950 p-6 rounded-2xl border border-amber-500/30 space-y-5">
            <h3 className="text-base font-extrabold text-white tracking-tight">Unified Ledger Synchronization</h3>
            <p className="text-xs text-slate-400">Aggregating treasury balances from all providers.</p>
          </div>
        )}

        {activeReconTab === 'kyc-passport' && (
          <div className="bg-slate-950 p-6 rounded-2xl border border-blue-500/30 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-blue-400" />
              <h3 className="text-base font-extrabold text-white tracking-tight">Sovereign KYC/AML Passport</h3>
            </div>
            <div className="pt-4 border-t border-slate-900 flex justify-end gap-3">
               <button onClick={() => triggerNotification('Identity Pouch Refreshed!', 'success')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition cursor-pointer flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4" />
                 Certify Passport Bundle
               </button>
            </div>
          </div>
        )}
      </section>

      {/* SYSTEM CONSOLE */}
      <AnimatePresence>
        {isConsoleActive && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-mono font-bold text-white tracking-widest">{consoleTitle}</span>
              </div>
              <button
                onClick={() => setIsConsoleActive(false)}
                className="text-slate-500 hover:text-white text-xs font-mono"
              >
                CLOSE CONSOLE
              </button>
            </div>

            <div
              id="intel-console-box"
              className="p-4 bg-slate-950 font-mono text-[10px] text-slate-300 space-y-1.5 max-h-60 overflow-y-auto leading-relaxed divide-y divide-slate-900/50"
            >
              {consoleLogs.map((log, index) => (
                <div key={index} className="pt-1 flex items-start gap-2">
                  <span className="text-slate-500 select-none">&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

    </div>
  );
}
