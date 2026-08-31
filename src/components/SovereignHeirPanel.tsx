import React, { useState } from 'react';
import { Shield, Clock, UserPlus, AlertTriangle, CheckCircle2, Lock, Unlock, ArrowRight, Save, Trash2, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'motion/react';

export const SovereignHeirPanel: React.FC = () => {
  const [heirAddress, setHeirAddress] = useState('0x0000000000000000000000000000000000000000');
  const [inactivityDays, setInactivityDays] = useState(180);
  const [isLocked, setIsLocked] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = () => {
    // In production, this broadcasts a policy update to the Smart Account contract
    alert('Dead Man\'s Switch Policy Updated: Authority will transfer if no activity detected for ' + inactivityDays + ' days.');
    setShowConfirm(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Sovereign Heir & Dead Man's Switch</h2>
            <p className="text-sm text-slate-400">Programmable legacy protection for your $4.13B+ wealth</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${isLocked ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'}`}>
          {isLocked ? 'GUARD ACTIVE' : 'UNLOCKED / EDITING'}
        </div>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white uppercase tracking-tight">Inactivity Trigger</h4>
            <p className="text-xs text-slate-400">The amount of time the account can remain idle before the Heir Address is granted withdrawal authority.</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[30, 90, 180, 365].map(days => (
            <button
              key={days}
              onClick={() => setInactivityDays(days)}
              disabled={isLocked}
              className={`py-2 text-xs font-bold rounded-lg transition border cursor-pointer ${
                inactivityDays === days
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white disabled:opacity-30'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <UserPlus className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white uppercase tracking-tight">Designated Heir Address</h4>
            <p className="text-xs text-slate-400">The authoritative EVM address that will receive signing permissions upon trigger.</p>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            value={heirAddress}
            onChange={(e) => setHeirAddress(e.target.value)}
            disabled={isLocked}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-mono text-blue-300 disabled:opacity-50"
            placeholder="0x..."
          />
        </div>
      </div>

      <div className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-[11px] text-amber-200/80 leading-relaxed italic">
          <strong>WARNING:</strong> This switch is enforced by your Smart Contract Wallet. Once the trigger period is met, authority transfer is automatic and irreversible through standard UI paths.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => setIsLocked(!isLocked)}
          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLocked ? <Lock className="w-4 h-4 text-amber-500" /> : <Unlock className="w-4 h-4 text-rose-500" />}
          <span>{isLocked ? 'Unlock Policy for Editing' : 'Lock & Secure Policy'}</span>
        </button>

        {!isLocked && (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer animate-pulse"
          >
            <Save className="w-4 h-4" />
            <span>Save Heir Protocol</span>
          </button>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-rose-500/20 border border-rose-500/40 rounded-full flex items-center justify-center mx-auto text-rose-500">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-white">Confirm Heir Protocol</h3>
              <p className="text-xs text-slate-400">You are setting an automatic authority transfer for your <strong>$4.13B+</strong> portfolio.</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-[10px] space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Inactivity Limit:</span>
                <span className="text-white">{inactivityDays} Days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Heir Address:</span>
                <span className="text-blue-400">{heirAddress.slice(0, 10)}...{heirAddress.slice(-8)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 transition">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-3 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-500 transition shadow-lg shadow-rose-600/20">Finalize Switch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
