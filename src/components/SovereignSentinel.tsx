import React, { useState, useEffect } from 'react';
import { Shield, Zap, AlertCircle, Eye, Activity, Cpu, Lock, Globe, Server, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const SovereignSentinel: React.FC = () => {
  const [threatLevel, setThreatLevel] = useState<'LOW' | 'GUARDED' | 'ELEVATED' | 'HIGH'>('LOW');
  const [activeScans, setActiveScans] = useState<string[]>([]);
  const [mempoolAlerts, setMempoolAlerts] = useState<any[]>([]);

  useEffect(() => {
    const scanItems = [
      'Mempool Entropy Analysis',
      'Smart Contract Exploit Detection',
      'Jurisdictional Regulatory Shifts',
      'Protocol Upgrade Monitoring',
      'Sanctioned Address Proximity Scan',
      'Wise Hub API Integrity Audit',
      'Swiss Vault Gold Serial Verification',
      'OSC EMD-784920 Compliance Pulse',
      'Interac clearing rail RBC/TD Proxy'
    ];

    let i = 0;
    const interval = setInterval(() => {
      setActiveScans(prev => {
        const next = [...prev];
        if (next.length > 3) next.shift();
        next.push(scanItems[i % scanItems.length]);
        i++;
        return next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 space-y-6 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Cpu className="w-32 h-32 text-indigo-500 animate-pulse" />
      </div>

      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400">
            <Eye className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">AI Sovereign Sentinel</h2>
            <p className="text-sm text-slate-400">Passive mempool defense & regulatory threat monitoring</p>
          </div>
        </div>
        <div className={`px-4 py-1 rounded-full text-xs font-black border transition-all ${
          threatLevel === 'LOW' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'
        }`}>
          SYSTEM THREAT LEVEL: {threatLevel}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ACTIVE SCANNING LOG */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Zap className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Active Neural Scans</h4>
          </div>
          <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-3 h-32 overflow-hidden">
            <AnimatePresence mode="popLayout">
              {activeScans.map((scan, idx) => (
                <motion.div
                  key={scan + idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center justify-between text-[10px] font-mono text-slate-400"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                    {scan}
                  </span>
                  <span className="text-indigo-400 font-bold">SCANNING...</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* PRIVATE RPC & FAILOVER STATUS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Globe className="w-4 h-4 text-blue-500" />
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Shadow Rail Connectivity</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Swiss Node</span>
              <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Server className="w-3 h-3" /> ONLINE (6ms)
              </p>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Singapore Node</span>
              <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Server className="w-3 h-3" /> ONLINE (14ms)
              </p>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">OTC Liquidity</span>
              <p className="text-[10px] font-bold text-blue-400 flex items-center gap-1.5">
                <Database className="w-3 h-3" /> B2C2 CONNECTED
              </p>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Quantum Defense</span>
              <p className="text-[10px] font-bold text-cyan-400 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-cyan-400 animate-pulse" /> PQR ACTIVE (Level 7)
              </p>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Tesla UWB</span>
              <p className="text-[10px] font-bold text-amber-400 flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> SECURED (8GHz)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-4 flex items-center justify-between gap-4">
        <p className="text-[10px] text-slate-400 leading-relaxed italic">
          <strong>SENTINEL ADVISORY:</strong> Global mempool entropy is currently within safe operational parameters. Your $4.13B treasury is shielded via private Flashbots relays.
        </p>
        <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg border border-slate-700 transition uppercase tracking-widest whitespace-nowrap">
          Neural Reset
        </button>
    </div></div>);
};
