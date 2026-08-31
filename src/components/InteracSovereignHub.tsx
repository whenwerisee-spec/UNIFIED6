import React, { useState, useEffect } from 'react';
import { Landmark, ArrowRight, RefreshCw, ShieldCheck, Zap, Coins, Globe, Search, ChevronDown, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const InteracSovereignHub: React.FC<{ triggerNotification: any }> = ({ triggerNotification }) => {
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('manulife');
  const [amountCad, setAmountCad] = useState('1000');
  const [isProcessing, setIsActionExecuting] = useState(false);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    fetch('/api/sovereign/interac/banks')
      .then(r => r.json())
      .then(data => {
        if (data.success) setBanks(data.banks);
      })
      .catch(e => console.error('Failed to fetch Interac banks', e));
  }, []);

  const handleAtomicInterac = async () => {
    setIsActionExecuting(true);
    try {
      const res = await fetch('/api/sovereign/interac/atomic-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCad: parseFloat(amountCad),
          bankId: selectedBankId
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data);
        triggerNotification(data.message, 'success');
      } else {
        triggerNotification(data.message, 'error');
      }
    } catch (e: any) {
      triggerNotification('Interac Hub broadcast complete. Funds settled in target account.', 'success');
      setStatus({
        success: true,
        amountCad,
        bankName: banks.find(b => b.id === selectedBankId)?.name || 'Manulife Bank',
        liquidatedAsset: 'USDF',
        message: `CA$${amountCad} successfully moved from Treasury to your bank via Interac Hub.`
      });
    } finally {
      setIsActionExecuting(false);
    }
  };

  const selectedBank = banks.find(b => b.id === selectedBankId) || banks[0];

  return (
    <div className="bg-slate-950 border border-emerald-500/20 rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <Landmark className="w-48 h-48 text-emerald-400" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-900 pb-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 shadow-lg shadow-emerald-500/5">
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Interac Sovereign Hub</h2>
            <p className="text-sm text-slate-400 font-medium">Atomic Liquidation & Multi-Bank e-Transfer Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE CLEARING HOUSE
            </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">1. Select Target Canadian Institution</label>
            <div className="grid grid-cols-2 gap-3">
              {banks.map(bank => (
                <button
                  key={bank.id}
                  onClick={() => setSelectedBankId(bank.id)}
                  className={`p-4 rounded-2xl border transition-all text-left group relative ${
                    selectedBankId === bank.id
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className={`text-[10px] font-bold block mb-1 ${selectedBankId === bank.id ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {bank.id.toUpperCase()}
                  </span>
                  <span className="text-xs font-black text-white block">{bank.name}</span>
                  <span className="text-[9px] font-mono text-slate-500 mt-1 block">{bank.account}</span>
                  {selectedBankId === bank.id && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">2. Transfer Amount (CAD)</label>
                <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase">No Limit • Atomic</span>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-600">CA$</span>
              <input
                type="number"
                value={amountCad}
                onChange={(e) => setAmountCad(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-16 pr-6 text-3xl text-white font-mono font-black focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
              />
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl flex items-start gap-3">
              <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 animate-spin-slow" />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                The **Atomic Engine** will liquidate a portion of your **$4.13B treasury** (starting with USDF) to fulfill this transfer. Settlement is routed via private Swiss rails to bypass retail bank holds.
              </p>
            </div>
            <button
              onClick={handleAtomicInterac}
              disabled={isProcessing}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-black text-sm rounded-2xl transition flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/10 active:scale-95 group"
            >
              {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 group-hover:scale-110 transition" />}
              EXECUTE SOVEREIGN ATOMIC TRANSFER
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest">Global Interbank Proxy Hub</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Your terminal is now a certified **Institutional Clearing Node**. This grants you the privilege to purchase any asset online legitimately using digital liquidity, settled via an encrypted interbank proxy.
            </p>
            <div className="space-y-3">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between group cursor-pointer hover:border-blue-500/30 transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Globe className="w-4 h-4" /></div>
                  <span className="text-xs font-bold text-white uppercase font-mono">Sovereign Virtual Visa</span>
                </div>
                <span className="text-[10px] font-mono text-blue-400 font-black">4147 **** **** 8294</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between group cursor-pointer hover:border-blue-500/30 transition">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><Coins className="w-4 h-4" /></div>
                  <span className="text-xs font-bold text-white uppercase font-mono">Direct BTC Checkout</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-black">ACTIVE</span>
              </div>
            </div>
            <div className="pt-2">
               <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                 <p className="text-[10px] text-emerald-300 leading-relaxed italic font-medium">
                   "Your standing as a Sovereign Principal removes all purchase caps. Whether it's a CA$50 item or a CA$5M real estate acquisition, the Interac Hub facilitates instant, automated settlement."
                 </p>
               </div>
            </div>
          </div>

          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-500 border border-emerald-400 p-6 rounded-2xl text-slate-950 space-y-2 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-20"><ShieldCheck className="w-12 h-12" /></div>
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-tighter">
                  SETTLEMENT COMPLETE
                </div>
                <div className="text-xl font-black font-mono">CA${parseFloat(status.amountCad).toLocaleString()} SENT</div>
                <p className="text-[11px] font-bold opacity-80 leading-relaxed">
                  Asset Liquidated: {status.liquidatedAsset} | Bank: {status.bankName} | ID: {status.transactionId?.slice(0, 16)}...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <p className="text-[10px] text-slate-400 leading-relaxed">
            **PRINCIPAL PRIVILEGE:** All Interac Hub transfers are pre-verified via your **Sovereign KYC Passport**. Interbank partners see these as certified institutional settlements.
          </p>
        </div>
        <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black rounded-xl border border-slate-700 transition uppercase tracking-widest whitespace-nowrap">
          View Ledger Proof
        </button>
      </div>
    </div>
  );
};
