import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Mail, User, Landmark, Sparkles, RefreshCw, 
  ArrowRight, ShieldAlert, Check, HelpCircle, Eye, EyeOff, Settings, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { buildApiUrl, safeJsonFetch, getApiBase } from '../lib/api-client';

interface AuthScreenProps {
  onLoginSuccess: (userData: { name: string; email: string; region: 'US' | 'CA'; isNewUser: boolean; kycLevel?: number }) => void;
  showToast: (message: string, type: 'success' | 'info' | 'error') => void;
  onTriggerEmail: (subject: string, sender: string, senderEmail: string, bodyHtml: string, actionType?: string, actionPayload?: any) => void;
}

let isGoogleInitialized = false;

export default function AuthScreen({
  onLoginSuccess,
  showToast,
  onTriggerEmail
}: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);

  // Server Config State
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(getApiBase());

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('mlaframboisemm@gmail.com');
  const [password, setPassword] = useState('Password123456!');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [region, setRegion] = useState<'US' | 'CA'>('US');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [diagnosticInfo, setDiagnosticInfo] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setLoadingStep('Testing connectivity to sovereign node...');
    setIsLoading(true);
    setDiagnosticInfo(null);
    try {
      if (customServerUrl) {
        localStorage.setItem('sovereign_custom_api_base', customServerUrl);
      }
      const res = await fetch(buildApiUrl('/api/health'));
      if (res.ok) {
        const data = await res.json();
        showToast(`Connection Successful! Server time: ${data.time}`, 'success');
      } else {
        throw new Error(`HTTP Error ${res.status}`);
      }
    } catch (e: any) {
      setDiagnosticInfo(`FAIL: ${e.message}. Target: ${buildApiUrl('/api/health')}`);
      showToast('Connection Failed. Check diagnostic log.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please fill out all credentials.', 'error');
      return;
    }

    // Save URL override if set
    if (customServerUrl) {
      localStorage.setItem('sovereign_custom_api_base', customServerUrl);
    }

    setIsLoading(true);
    setLoadingStep(isResetPassword ? 'Authorizing reset...' : isSignUp ? 'Provisioning vault...' : 'Verifying authority...');

    try {
      const endpoint = isResetPassword ? '/api/auth/reset-password' : isSignUp ? '/api/auth/register' : '/api/auth/login';
      const payload = isSignUp ? { email, password, firstName, lastName, citizenship: region } : { email, password, mfaCode };

      const result = await safeJsonFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      if (isResetPassword) {
        showToast('Password successfully reset! Sign in now.', 'success');
        setIsResetPassword(false);
        setPassword('');
        return;
      }

      if (isSignUp) {
        showToast('Account created. Vault is now locked to your identity.', 'success');
        setIsSignUp(false);
        setPassword('');
        return;
      }

      if (result?.token) {
        sessionStorage.setItem('cb_auth_jwt_token', result.token);
        localStorage.setItem('cb_auth_jwt_token', result.token);
        localStorage.setItem('cb_auth_authenticated', 'true');
      }

      const name = result?.user?.name || email.split('@')[0];
      onLoginSuccess({
        name,
        email,
        region: result?.user?.citizenship === 'CA' ? 'CA' : 'US',
        isNewUser: false,
        kycLevel: result?.user?.kycLevel
      });
      showToast(`Welcome back, ${name}! Authority verified.`, 'success');

    } catch (err: any) {
      showToast(err.message, 'error');
      setDiagnosticInfo(`ERROR: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      
      <div className="absolute top-0 left-0 w-full h-1 bg-slate-900 shadow-sm" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-400/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 z-10 relative">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2.5 mb-8">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sovereign Hub</h2>
          <p className="text-xs text-slate-500 font-medium">Institutional Command & Wealth Terminal</p>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-4">
            <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{loadingStep}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3.5">
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold"
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="Principal Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-xs font-bold focus:border-slate-900"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Security Token"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 pl-10 pr-10 py-3 rounded-xl text-xs font-mono font-bold"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5">
                  {showPassword ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow-xl active:scale-95 flex items-center justify-center gap-2"
            >
              {isResetPassword ? 'Reset Authority' : isSignUp ? 'Create Sovereign Vault' : 'Authorize Login'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Diagnostic Log */}
            {diagnosticInfo && (
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
                <p className="text-[10px] text-rose-700 font-mono break-all leading-relaxed">{diagnosticInfo}</p>
              </div>
            )}

            {/* Server Config */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowServerConfig(!showServerConfig)}
                className="flex items-center gap-1.5 text-[10px] text-slate-400 font-black uppercase hover:text-slate-900"
              >
                <Settings className="w-3 h-3" />
                {showServerConfig ? 'Hide Config' : 'Configure Backend Rail'}
              </button>

              {showServerConfig && (
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={customServerUrl}
                    onChange={(e) => setCustomServerUrl(e.target.value)}
                    placeholder="https://your-hub.onrender.com"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-[10px] font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-black uppercase rounded-lg border border-slate-200 flex items-center justify-center gap-1.5"
                  >
                    <Activity className="w-3 h-3" />
                    Test Connectivity
                  </button>
                </div>
              )}
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
            >
              {isSignUp ? 'Back to Sign In' : 'Need a new Sovereign Vault? Create One'}
            </button>
        </div>

      </div>

      <div className="mt-8 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        Quantum-Hardened Session Active
      </div>

    </div>
  );
}
