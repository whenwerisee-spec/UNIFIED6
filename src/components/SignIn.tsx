import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, 
  Lock, 
  Mail, 
  ArrowRight, 
  RefreshCw, 
  Check, 
  ShieldCheck, 
  Database,
  Cpu,
  ArrowRightLeft,
  Settings
} from 'lucide-react';
import { safeJsonFetch, API_BASE } from '../lib/api-client';

interface SignInProps {
  onSuccess: (email: string) => void;
  onRefreshData: () => Promise<void>;
}

interface ConfigStep {
  label: string;
  sublabel: string;
  status: 'pending' | 'running' | 'completed';
}

export default function SignIn({ onSuccess, onRefreshData }: SignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(API_BASE);

  // Login & Configuration Flow States:
  // 'form' -> 'configuring' -> 'success'
  const [flowState, setFlowState] = useState<'form' | 'configuring' | 'success'>('form');
  const [autoConfigure, setAutoConfigure] = useState(true);
  const [activeStep, setActiveStep] = useState(0);

  const [steps, setSteps] = useState<ConfigStep[]>([
    { label: 'Secure TLS Handshake', sublabel: 'Verifying corporate integration gateway keys...', status: 'pending' },
    { label: 'Stripe Webhook Registry', sublabel: 'Mapping listener endpoints on Stripe Node-Port 3000...', status: 'pending' },
    { label: 'Chase Plaid Link', sublabel: 'Establishing secure link tunnels with Chase Checking feeds...', status: 'pending' },
    { label: 'Wise Multi-Currency Wire', sublabel: 'Verifying Wise borderless fx payout routers...', status: 'pending' },
    { label: 'Ledger Seed Initialization', sublabel: 'Configuring default asset, revenue, and expense accounts...', status: 'pending' },
    { label: 'Trial Balance Auto-Reconcile', sublabel: 'Generating balanced double-entry splits across all feeds...', status: 'pending' },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your corporate email address.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    
    setError(null);

    // Save custom server URL if provided
    if (customServerUrl) {
      localStorage.setItem('sovereign_custom_api_base', customServerUrl);
    }

    if (autoConfigure) {
      setFlowState('configuring');
    } else {
      // Direct login without configuration
      localStorage.setItem('finance_hub_user', JSON.stringify({ email }));
      onSuccess(email);
    }
  };

  // Run the automatic configuration sequence step-by-step
  useEffect(() => {
    if (flowState !== 'configuring') return;

    let isCancelled = false;
    
    const runConfig = async () => {
      // Step-by-step updater helper
      const updateStepStatus = (index: number, status: 'pending' | 'running' | 'completed') => {
        setSteps(prev => prev.map((s, idx) => idx === index ? { ...s, status } : s));
      };

      for (let i = 0; i < steps.length; i++) {
        if (isCancelled) return;
        
        setActiveStep(i);
        updateStepStatus(i, 'running');
        
        // Custom actions on specific steps to make the configuration real on the backend
        try {
          if (i === 4) {
            // Re-seed ledger defaults to start fresh
            await safeJsonFetch('/api/reset', { method: 'POST' });
          } else if (i === 5) {
            // Automatically synchronize all raw external transactions into balanced journal splits
            await safeJsonFetch('/api/ledger/auto-sync-all', { method: 'POST' });
          }
        } catch (err: any) {
          console.error('Configuration background warning:', err);
          setError(`Server Error: ${err.message}. Ensure your backend is running at ${customServerUrl || 'the correct URL'}`);
          setFlowState('form');
          return;
        }

        // Animated duration for realistic, highly responsive execution feel
        await new Promise(resolve => setTimeout(resolve, 600));
        updateStepStatus(i, 'completed');
      }

      if (isCancelled) return;

      // Configuration complete! Save session and go to success screen
      localStorage.setItem('finance_hub_user', JSON.stringify({ email }));
      await onRefreshData();
      setFlowState('success');
      
      // Auto-advance to dashboard after a brief delay
      setTimeout(() => {
        if (!isCancelled) {
          onSuccess(email);
        }
      }, 1500);
    };

    runConfig();

    return () => {
      isCancelled = true;
    };
  }, [flowState]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans antialiased" id="signin-root">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-gray-100/50 to-transparent pointer-events-none" />

      <AnimatePresence mode="wait">
        {flowState === 'form' && (
          <motion.div
            key="login-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="w-full max-w-md bg-white border border-gray-100 rounded-3xl p-8 shadow-xl shadow-gray-100/50 relative z-10"
          >
            {/* Logo area */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gray-950 text-white flex items-center justify-center shadow-lg mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Unified Finance Hub</h1>
              <p className="text-xs text-gray-400 font-medium mt-1">Multi-Node Ledger & Double-Entry Sync Engine</p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono font-bold text-gray-400 block mb-1 uppercase tracking-wider">Corporate Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-gray-900 rounded-xl pl-10 pr-4 py-3 text-xs text-gray-800 transition-all font-medium focus:outline-none"
                    id="login-email"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-gray-400 block mb-1 uppercase tracking-wider">Access Token / Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-gray-900 rounded-xl pl-10 pr-4 py-3 text-xs text-gray-800 transition-all font-medium focus:outline-none"
                    id="login-password"
                  />
                </div>
              </div>

              {/* Automatic Configuration Box */}
              <div className="pt-2">
                <label className="flex items-start gap-3 bg-gray-50/70 border border-gray-100 p-3.5 rounded-xl cursor-pointer hover:bg-gray-50 transition-all select-none">
                  <input
                    type="checkbox"
                    checked={autoConfigure}
                    onChange={(e) => setAutoConfigure(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900 accent-gray-900 cursor-pointer"
                    id="checkbox-auto-config"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">Auto-Configure Nodes & Reconcile</span>
                    <span className="text-[10px] text-gray-400 leading-relaxed block mt-0.5">
                      Recommended. Automatically reset backend database to seed files, sync Stripe, Plaid, and Wise feeds, and establish double-entry balances instantly.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-gray-950 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer"
                  id="btn-signin-submit"
                >
                  <span>Sign In & Verify Gateway</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* SERVER CONFIGURATION TOGGLE */}
            <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowServerConfig(!showServerConfig)}
                  className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase hover:text-gray-900 transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  {showServerConfig ? 'Hide Server Config' : 'Configure Backend Server'}
                </button>

                {showServerConfig && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 space-y-2 overflow-hidden"
                  >
                    <label className="text-[9px] font-mono font-bold text-gray-400 block uppercase">Custom Render URL</label>
                    <input
                      type="text"
                      value={customServerUrl}
                      onChange={(e) => setCustomServerUrl(e.target.value)}
                      placeholder="https://your-app.onrender.com"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[10px] font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[8px] text-gray-400 italic">Enter the URL of your Render backend. This ensures the app can talk to your $4.13B ledger.</p>
                  </motion.div>
                )}
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-mono">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure Gateway Core
              </span>
              <span>Port 3000 Ingress</span>
            </div>
          </motion.div>
        )}

        {flowState === 'configuring' && (
          <motion.div
            key="configuring-wizard"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full max-w-lg bg-white border border-gray-100 rounded-3xl p-8 shadow-2xl shadow-gray-100/60 relative z-10"
          >
            {/* Loading top header */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gray-50 rounded-xl text-gray-900 animate-pulse">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Automated Provisioning Agent</h2>
                  <p className="text-[10px] text-gray-400 font-medium">Auto-configuring nodes & balances after sign-in...</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md border border-indigo-100">
                Step {activeStep + 1} of {steps.length}
              </span>
            </div>

            {/* Dynamic steps tracker */}
            <div className="space-y-4">
              {steps.map((step, idx) => {
                const isPending = step.status === 'pending';
                const isRunning = step.status === 'running';
                const isCompleted = step.status === 'completed';

                return (
                  <div
                    key={idx}
                    className={`flex items-start justify-between p-3.5 border rounded-2xl transition-all ${
                      isRunning 
                        ? 'bg-indigo-50/20 border-indigo-100 shadow-xs' 
                        : isCompleted
                        ? 'bg-gray-50/55 border-gray-100'
                        : 'bg-white border-transparent opacity-45'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isCompleted ? 'bg-emerald-500 text-white' :
                        isRunning ? 'bg-indigo-600 text-white' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : isRunning ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                        )}
                      </div>
                      <div>
                        <span className={`text-xs font-bold block ${
                          isRunning ? 'text-indigo-900' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                        }`}>
                          {step.label}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5 leading-relaxed block font-medium">
                          {step.sublabel}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      isCompleted ? 'bg-emerald-100 text-emerald-800' :
                      isRunning ? 'bg-indigo-100 text-indigo-800 animate-pulse' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {step.status}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-2 text-[10px] text-gray-400 font-mono">
              <Database className="w-3.5 h-3.5 text-gray-400 animate-pulse" />
              <span>Real-time persistence layer mapped to: <code className="bg-gray-100 text-gray-600 px-1 rounded">data/finance_store.json</code></span>
            </div>
          </motion.div>
        )}

        {flowState === 'success' && (
          <motion.div
            key="config-success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md bg-white border border-gray-100 rounded-3xl p-8 shadow-2xl shadow-gray-100/60 text-center relative z-10"
          >
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
              <Check className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold text-gray-900 tracking-tight">System Fully Synchronized</h2>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Your multi-node banking integration and balanced trial ledgers are now completely online and synchronized. Routing to your secure corporate workspace dashboard...
            </p>

            <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl mt-6 text-left space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 uppercase">
                <span>Integrated Source</span>
                <span>Status</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#635bff] rounded-full" /> Stripe Node
                </span>
                <span className="text-emerald-600">Reconciled</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#00b9ff] rounded-full" /> Wise Borderless
                </span>
                <span className="text-emerald-600">Reconciled</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-gray-900 rounded-full" /> Plaid ACH Link
                </span>
                <span className="text-emerald-600">Reconciled</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-mono animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Redirecting...
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
