import React from 'react';
import { motion } from 'motion/react';
import { 
  CreditCard, 
  Send, 
  Layers, 
  CheckCircle2, 
  HelpCircle,
  Link,
  ArrowRightLeft,
  Coins
} from 'lucide-react';
import { IntegrationsState } from '../types.js';

interface NodesGraphProps {
  status: IntegrationsState;
  isSyncing: boolean;
  onSync: () => void;
  pendingCount: number;
}

export default function NodesGraph({ status, isSyncing, onSync, pendingCount }: NodesGraphProps) {
  return (
    <div className="relative bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden" id="nodes-graph-container">
      {/* Decorative dots background */}
      <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10 gap-4">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
            Automated Node Topology
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-gray-900 mt-1">
            Unified Integration Map
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time status of your financial nodes feeding into the Ledger.
          </p>
        </div>
        
        <button
          onClick={onSync}
          disabled={isSyncing}
          className={`relative overflow-hidden group px-4 py-2.5 rounded-lg text-xs font-medium transition-all ${
            pendingCount > 0 
              ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-md shadow-gray-100' 
              : 'bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200'
          }`}
          id="btn-auto-sync"
        >
          {isSyncing ? (
            <span className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </motion.div>
              Synchronizing Nodes...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
              {pendingCount > 0 ? `Auto-Sync ${pendingCount} Node Events` : 'Ledger Fully Synced'}
            </span>
          )}
          
          {pendingCount > 0 && !isSyncing && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          )}
        </button>
      </div>

      {/* SVG Canvas for Connections */}
      <div className="relative h-64 flex items-center justify-center bg-gray-50/50 rounded-xl border border-gray-50" id="nodes-canvas">
        
        {/* Animated connection lines (rendered as SVGs) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="gradient-stripe" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#635bff" />
              <stop offset="100%" stopColor="#0a2540" />
            </linearGradient>
            <linearGradient id="gradient-wise" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00b9ff" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#37517e" />
            </linearGradient>
          </defs>

          {/* Paths from outer nodes to center ledger (center is approx 50%, 50%) */}
          {/* Node 1: Stripe (Left) - Center */}
          <line x1="22%" y1="50%" x2="50%" y2="50%" stroke="#e4e4e7" strokeWidth="2" strokeDasharray="4 4" />
          {isSyncing && (
            <motion.circle
              r="4"
              fill="#635bff"
              animate={{ cx: ["22%", "50%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              cy="50%"
            />
          )}

          {/* Node 2: Plaid (Top Center) - Center */}
          <line x1="50%" y1="20%" x2="50%" y2="50%" stroke="#e4e4e7" strokeWidth="2" strokeDasharray="4 4" />
          {isSyncing && (
            <motion.circle
              r="4"
              fill="#111827"
              animate={{ cy: ["20%", "50%"] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              cx="50%"
            />
          )}

          {/* Node 3: Wise (Right) - Center */}
          <line x1="78%" y1="50%" x2="50%" y2="50%" stroke="#e4e4e7" strokeWidth="2" strokeDasharray="4 4" />
          {isSyncing && (
            <motion.circle
              r="4"
              fill="#00b9ff"
              animate={{ cx: ["78%", "50%"] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              cy="50%"
            />
          )}
        </svg>

        {/* Central Node: Ledger */}
        <div className="absolute z-10 flex flex-col items-center" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} id="node-center-ledger">
          <motion.div
            animate={isSyncing ? { scale: [1, 1.08, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center shadow-lg border-4 border-white text-white cursor-pointer relative"
          >
            <Layers className="w-6 h-6" />
            
            {/* Spinning ring during sync */}
            {isSyncing && (
              <div className="absolute inset-0 -m-2.5 rounded-full border border-dashed border-gray-900 animate-spin" />
            )}
          </motion.div>
          <span className="text-xs font-semibold text-gray-900 mt-2 bg-white px-2 py-0.5 rounded-full shadow-sm border border-gray-100">
            Central Ledger
          </span>
          <span className="text-[9px] font-mono text-gray-400 mt-0.5">
            Double-Entry Core
          </span>
        </div>

        {/* Outer Node 1: Stripe (Left) */}
        <div className="absolute left-[8%] flex flex-col items-center" style={{ top: '50%', transform: 'translateY(-50%)' }} id="node-stripe">
          <motion.div
            whileHover={{ y: -3 }}
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border text-white ${
              status.stripe.apiKeySet ? 'bg-[#635bff] border-transparent' : 'bg-white border-gray-200 text-[#635bff]'
            }`}
          >
            <CreditCard className="w-5 h-5" />
          </motion.div>
          <span className="text-[11px] font-medium text-gray-900 mt-2">
            Stripe Node
          </span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded mt-1 font-semibold ${
            status.stripe.apiKeySet 
              ? 'bg-emerald-50 text-emerald-600' 
              : 'bg-amber-50 text-amber-600 border border-amber-100'
          }`}>
            {status.stripe.apiKeySet ? 'LIVE' : 'AUTO SANDBOX'}
          </span>
        </div>

        {/* Outer Node 2: Plaid (Top Center) */}
        <div className="absolute top-[8%] flex flex-col items-center" style={{ left: '50%', transform: 'translateX(-50%)' }} id="node-plaid">
          <motion.div
            whileHover={{ y: -3 }}
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border ${
              status.plaid.apiKeySet ? 'bg-[#111827] text-white border-transparent' : 'bg-white border-gray-200 text-gray-800'
            }`}
          >
            <Coins className="w-5 h-5" />
          </motion.div>
          <span className="text-[11px] font-medium text-gray-900 mt-2">
            Plaid Link
          </span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded mt-1 font-semibold ${
            status.plaid.apiKeySet 
              ? 'bg-emerald-50 text-emerald-600' 
              : 'bg-amber-50 text-amber-600 border border-amber-100'
          }`}>
            {status.plaid.apiKeySet ? 'LIVE' : 'AUTO SANDBOX'}
          </span>
        </div>

        {/* Outer Node 3: Wise (Right) */}
        <div className="absolute right-[8%] flex flex-col items-center" style={{ top: '50%', transform: 'translateY(-50%)' }} id="node-wise">
          <motion.div
            whileHover={{ y: -3 }}
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border text-white ${
              status.wise.apiKeySet ? 'bg-[#00b9ff] border-transparent' : 'bg-white border-gray-200 text-[#00b9ff]'
            }`}
          >
            <Send className="w-5 h-5" />
          </motion.div>
          <span className="text-[11px] font-medium text-gray-900 mt-2">
            Wise Forex
          </span>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded mt-1 font-semibold ${
            status.wise.apiKeySet 
              ? 'bg-emerald-50 text-emerald-600' 
              : 'bg-amber-50 text-amber-600 border border-amber-100'
          }`}>
            {status.wise.apiKeySet ? 'LIVE' : 'AUTO SANDBOX'}
          </span>
        </div>

      </div>

      {/* Quick explanation footer inside card */}
      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-[11px] text-gray-500">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span>
          <strong>Double-entry clearing fully automated</strong>. Sync mapping: Stripe payouts balance to clearing ledger, Plaid feeds reconcile bank debits, Wise manages currency transfers.
        </span>
      </div>
    </div>
  );
}
