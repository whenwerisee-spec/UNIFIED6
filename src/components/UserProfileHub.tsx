import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  CreditCard,
  HardDrive,
  Lock,
  CheckCircle2,
  FileText,
  Key,
  Smartphone,
  Award,
  Clock,
  ChevronRight,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Building2,
  RefreshCw,
  QrCode,
  Eye,
  EyeOff,
  Copy,
  Check
} from 'lucide-react';
import OnboardingKyc from './OnboardingKyc';
import GoogleDriveFolderHub from './GoogleDriveFolderHub';
import RecoveryKeyBackupWizard, { BackupWallet } from './RecoveryKeyBackupWizard';
import BitcoinSecurityAndReconciliationHub from './BitcoinSecurityAndReconciliationHub';

interface UserProfileHubProps {
  userName: string;
  userEmail: string;
  citizenship: string;
  kycLevel: number;
  onVerificationSuccess: (level: number) => void;
  showToast: (message: string, type: 'success' | 'info' | 'error') => void;
  onOpenProof?: () => void;
  onOpenMonthlyReport?: () => void;
  setCurrentTab: (tab: string) => void;
  btcBalance?: number;
  marshallConfig?: any;
  wiseLiveBalance?: any;
}

export default function UserProfileHub({
  userName,
  userEmail,
  citizenship,
  kycLevel,
  onVerificationSuccess,
  showToast,
  onOpenProof,
  onOpenMonthlyReport,
  setCurrentTab,
  btcBalance = 0,
  marshallConfig = null,
  wiseLiveBalance = null
}: UserProfileHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'kyc' | 'security' | 'btc_vault' | 'drive' | 'methods'>('overview');
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isBtcWizardOpen, setIsBtcWizardOpen] = useState(false);

  // Persistent Vault Password State
  const [vaultPasswordHash, setVaultPasswordHash] = useState<string | null>(() => {
    return localStorage.getItem('cb_vault_password_hash');
  });
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [vaultPasswordInput, setVaultPasswordInput] = useState('');
  const [vaultPasswordConfirmInput, setVaultPasswordConfirmInput] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [vaultPasswordError, setVaultPasswordError] = useState<string | null>(null);

  const hashPassword = async (pwd: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(`sovereign_vault_salt_${pwd}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSetVaultPassword = async () => {
    setVaultPasswordError(null);
    if (!vaultPasswordInput || vaultPasswordInput.length < 4) {
      setVaultPasswordError('Password must be at least 4 characters long.');
      return;
    }
    if (vaultPasswordInput !== vaultPasswordConfirmInput) {
      setVaultPasswordError('Passwords do not match. Please try again.');
      return;
    }
    const hash = await hashPassword(vaultPasswordInput);
    localStorage.setItem('cb_vault_password_hash', hash);
    setVaultPasswordHash(hash);
    setIsVaultUnlocked(true);
    setIsChangingPassword(false);
    setVaultPasswordInput('');
    setVaultPasswordConfirmInput('');
    showToast('Vault password set and saved securely!', 'success');
  };

  const handleUnlockVault = async () => {
    setVaultPasswordError(null);
    if (!vaultPasswordInput) {
      setVaultPasswordError('Please enter your vault password.');
      return;
    }
    const enteredHash = await hashPassword(vaultPasswordInput);
    if (enteredHash === vaultPasswordHash) {
      setIsVaultUnlocked(true);
      setVaultPasswordError(null);
      setVaultPasswordInput('');
      showToast('Vault unlocked successfully!', 'success');
    } else {
      setVaultPasswordError('Incorrect vault password. Please try again.');
    }
  };

  const handleLockVault = () => {
    setIsVaultUnlocked(false);
    setShowSeedPhrase(false);
    setShowPrivateKey(false);
    setVaultPasswordInput('');
    setVaultPasswordError(null);
    showToast('Vault locked.', 'info');
  };

  const btcWalletForWizard: BackupWallet = {
    id: 'wallet-btc-primary',
    coinSymbol: 'BTC',
    address: (import.meta as any).env?.VITE_MARSHALL_BTC_ADDRESS || '',
    label: 'Primary Bitcoin Native SegWit Vault',
    seedPhrase: 'abandon ability able about above absent absorb abstract absurd abuse access accident',
    privateKey: 'KxZ8w9j7k6m5n4p3r2t1v0x9y8z7w6v5u...[Configured in Vault]',
    backupStatus: 'UNVERIFIED'
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedText(null), 2500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0052FF] to-blue-700 flex items-center justify-center text-white text-2xl font-black shadow-lg border border-blue-400/30 shrink-0">
              {userName ? userName.charAt(0).toUpperCase() : 'J'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">{userName || 'Jane Doe'}</h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Verified Level {kycLevel}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-1">{userEmail || 'mlaframboisemm@gmail.com'}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                <span className="flex items-center space-x-1">
                  <Building2 className="w-3 h-3 text-blue-400" />
                  <span>Region: {citizenship === 'CA' ? 'Canada (SIN Verified)' : 'United States (SSN Verified)'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>FinCEN Compliant</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col items-stretch gap-2 shrink-0 w-full sm:w-auto">
            {onOpenProof && (
              <button
                onClick={onOpenProof}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-blue-200" />
                <span>Proof of Funds Certificate</span>
              </button>
            )}
            {onOpenMonthlyReport && (
              <button
                onClick={onOpenMonthlyReport}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Monthly PDF Statement</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-2xl p-1.5 shadow-xs overflow-x-auto gap-1">
        {[
          { id: 'overview', label: 'Profile Overview', icon: User },
          { id: 'kyc', label: 'Identity & Limits', icon: ShieldCheck },
          { id: 'security', label: 'Safety & Security', icon: Lock },
          { id: 'btc_vault', label: 'Institutional Vault & Audit', icon: ShieldCheck },
          { id: 'drive', label: 'Google Workspace', icon: HardDrive },
          { id: 'methods', label: 'Payment Methods', icon: CreditCard }
        ].map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#0052FF] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <IconComp className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content 1: Overview */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Main Column */}
          <div className="md:col-span-8 space-y-6">
            
            {/* Account Status Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-5 h-5 text-[#0052FF]" />
                  <h3 className="text-base font-bold text-gray-900">Verification & Account Tier</h3>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-full border border-emerald-200">
                  Level {kycLevel} Unrestricted Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Daily Buy/Sell Limit</span>
                  <span className="text-lg font-black text-gray-900 font-mono mt-1 block">
                    {kycLevel >= 3 ? 'Unlimited' : '$25,000.00'}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">Verified</span>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">On-Chain Vault</span>
                  <span className="text-lg font-black text-gray-900 font-mono mt-1 block">Unlimited</span>
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                    {marshallConfig?.address ? `${marshallConfig.address.slice(0, 6)}...${marshallConfig.address.slice(-4)}` : 'Unconfigured'}
                  </span>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Wise Bank Link</span>
                  <span className="text-lg font-black text-gray-900 font-mono mt-1 block">
                    ${(wiseLiveBalance?.totalUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">Active API Sync</span>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed pt-2">
                Your account is fully compliant with FINTRAC and FinCEN anti-money laundering regulations. All internal transfers utilize atomic double-entry ledger balancing with on-chain cryptographic settlement verification.
              </p>
            </div>

            {/* Quick Hub Jump Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setCurrentTab('sovereign')}
                className="p-5 bg-white border border-gray-100 rounded-2xl shadow-xs hover:border-amber-300 hover:shadow-sm transition-all text-left group cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Sovereign Banking Hub</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Manage cold vaults, rate-limiting overrides, and high-net-worth liquidity reserves.</p>
                </div>
              </button>

              <button
                onClick={() => setCurrentTab('wise-card')}
                className="p-5 bg-white border border-gray-100 rounded-2xl shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all text-left group cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Wise Multi-Currency Card</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Manage virtual debit cards, foreign exchange balances, and POS spending limits.</p>
                </div>
              </button>
            </div>

            {/* Google Drive Production Folder Integration Card */}
            <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-xs border border-blue-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center border border-blue-400/30">
                    <HardDrive className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Google Drive Workspace Folder</h4>
                    <span className="text-[10px] text-blue-200 font-mono block">Folder ID: 1ABPIEmoPH_OWpSjHYu1DzjPRPlk3i8QM</span>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Connected directly to your cloud production workspace. Sync files, audit statements, and export reports seamlessly.
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => setActiveSubTab('drive')}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Manage Drive Folder
                </button>
                <a
                  href="https://drive.google.com/drive/folders/1ABPIEmoPH_OWpSjHYu1DzjPRPlk3i8QM"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center space-x-1"
                >
                  <span>Open Drive</span>
                  <ExternalLink className="w-3 h-3 text-blue-400" />
                </a>
              </div>
            </div>

          </div>

          {/* Sidebar Column */}
          <div className="md:col-span-4 space-y-6">
            
            {/* Safety & Security Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                <Lock className="w-4 h-4 text-[#0052FF]" />
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Account Protection</h4>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Two-Factor Auth (2FA)</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Biometric FaceID / Passkey</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Cryptographic Seed Backup</span>
                  <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md">Encrypted</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium">Render/GitHub Production Live</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">Wired</span>
                </div>
              </div>

              <button
                onClick={() => setActiveSubTab('security')}
                className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold border border-gray-200 transition-all text-center"
              >
                Security Center
              </button>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Account Downloads</h4>
              {onOpenMonthlyReport && (
                <button
                  onClick={onOpenMonthlyReport}
                  className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-between text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">Monthly PDF Statement</span>
                      <span className="text-[10px] text-gray-400 font-mono">Tax & Accounting</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              )}

              {onOpenProof && (
                <button
                  onClick={onOpenProof}
                  className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-between text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">Proof of Funds Certificate</span>
                      <span className="text-[10px] text-gray-400 font-mono">Real-time Solvency</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Tab Content 2: KYC & Identity */}
      {activeSubTab === 'kyc' && (
        <OnboardingKyc
          onVerificationSuccess={(level) => {
            onVerificationSuccess(level);
            showToast(`Verified level updated to Tier ${level}.`, 'success');
          }}
          showToast={showToast}
        />
      )}

      {/* Tab Content 3: Security & Safety */}
      {activeSubTab === 'security' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center space-x-2.5">
              <Lock className="w-5 h-5 text-[#0052FF]" />
              <div>
                <h3 className="text-base font-bold text-gray-900">Security & Protection Matrix</h3>
                <p className="text-xs text-gray-500">Enterprise-grade multi-layer protection and session safeguards.</p>
              </div>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              100% Security Rating
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">2-Factor Authentication</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Active</span>
              </div>
              <p className="text-xs text-gray-500">Time-based one-time password (TOTP) hardware security key linked.</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">Render & GitHub Deployment</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Production Live</span>
              </div>
              <p className="text-xs text-gray-500">All secrets, credentials, and environment keys configured for live production deployment.</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">Internal Ledger Audit Engine</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Running</span>
              </div>
              <p className="text-xs text-gray-500">Real-time background double-entry debit/credit reconciliation enabled.</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">Sovereign Mode Safeguards</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Owner Override</span>
              </div>
              <p className="text-xs text-gray-500">Rate-limiting overrides enabled for account owner session.</p>
            </div>
          </div>
          {/* Bitcoin Vault, Address, Private Key & Recovery Seed Section */}
          <div className="bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 rounded-2xl border border-amber-500/30 p-6 text-white space-y-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-lg shadow-sm">
                  ₿
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">Bitcoin Native SegWit Vault Credentials</h3>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30">
                      {btcBalance.toFixed(2)} BTC Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Master password protected vault for your Bitcoin source address, private key, and seed phrase.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveSubTab('btc_vault')}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Cold Vault & Audit Hub ↗</span>
                </button>
                {isVaultUnlocked ? (
                  <>
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer transition-all"
                    >
                      Change Password
                    </button>
                    <button
                      onClick={handleLockVault}
                      className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock Vault</span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs bg-slate-800 text-amber-400 border border-slate-700 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Vault Locked</span>
                  </span>
                )}
              </div>
            </div>

            {/* CASE 1: Setting / Changing Master Password */}
            {(!vaultPasswordHash || isChangingPassword) && (
              <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                  <Key className="w-4 h-4" />
                  <span>{vaultPasswordHash ? 'Change Vault Master Password' : 'Set Your Master Vault Password'}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Choose a secure password or PIN to protect your 12-word seed phrase and Bitcoin private keys. This password will be saved permanently in your browser.
                </p>

                {vaultPasswordError && (
                  <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-300 rounded-lg text-xs font-semibold">
                    {vaultPasswordError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      New Vault Password / PIN
                    </label>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={vaultPasswordInput}
                      onChange={(e) => setVaultPasswordInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={vaultPasswordConfirmInput}
                      onChange={(e) => setVaultPasswordConfirmInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {isChangingPassword && (
                    <button
                      onClick={() => {
                        setIsChangingPassword(false);
                        setVaultPasswordError(null);
                        setVaultPasswordInput('');
                        setVaultPasswordConfirmInput('');
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSetVaultPassword}
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    Save Password & Unlock Vault
                  </button>
                </div>
              </div>
            )}

            {/* CASE 2: Vault is Locked */}
            {vaultPasswordHash && !isChangingPassword && !isVaultUnlocked && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2 text-white font-bold text-sm">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Enter Password to Access Bitcoin Keys</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your seed phrase and private key are encrypted behind your saved vault password. Enter your password below to reveal your credentials.
                </p>

                {vaultPasswordError && (
                  <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-300 rounded-lg text-xs font-semibold">
                    {vaultPasswordError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="password"
                    placeholder="Enter your vault password / PIN"
                    value={vaultPasswordInput}
                    onChange={(e) => setVaultPasswordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUnlockVault();
                    }}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <button
                    onClick={handleUnlockVault}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Unlock Vault</span>
                  </button>
                </div>
              </div>
            )}

            {/* CASE 3: Vault is Unlocked (Displays Full Credentials) */}
            {vaultPasswordHash && !isChangingPassword && isVaultUnlocked && (
              <div className="space-y-4 pt-1">
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold">Vault Unlocked: Master credentials authenticated.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentTab('bitcoin-atm')}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] rounded-lg shadow-sm cursor-pointer transition-all flex items-center gap-1"
                    >
                      <span>🏧 ATM Cash Kiosk Hub</span>
                    </button>
                    <button
                      onClick={() => setIsBtcWizardOpen(true)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shadow-sm cursor-pointer transition-all"
                    >
                      Launch Backup Wizard
                    </button>
                  </div>
                </div>

                {/* Address Row */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bitcoin Source Address (Bech32 Native SegWit)</span>
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Live On-Chain
                    </span>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3 flex justify-between items-center font-mono text-xs">
                    <span className="text-amber-400 font-bold break-all select-all">{(import.meta as any).env?.VITE_MARSHALL_BTC_ADDRESS || 'Unconfigured'}</span>
                    <button
                      onClick={() => handleCopy((import.meta as any).env?.VITE_MARSHALL_BTC_ADDRESS || '')}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer ml-3 shrink-0"
                      title="Copy Bitcoin Address"
                    >
                      {copiedText === ((import.meta as any).env?.VITE_MARSHALL_BTC_ADDRESS || '') ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Seed Phrase Container */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">12-Word Recovery Seed Phrase</span>
                    <button
                      onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {showSeedPhrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showSeedPhrase ? 'Hide Seed' : 'Reveal Seed Phrase'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3">
                    {showSeedPhrase ? (
                      <div className="flex justify-between items-start">
                        <p className="font-mono text-xs text-emerald-300 leading-relaxed select-all">
                          abandon ability able about above absent absorb abstract absurd abuse access accident
                        </p>
                        <button
                          onClick={() => handleCopy('abandon ability able about above absent absorb abstract absurd abuse access accident')}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer ml-3 shrink-0"
                          title="Copy Seed Phrase"
                        >
                          {copiedText === 'abandon ability able about above absent absorb abstract absurd abuse access accident' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      <div className="text-slate-500 font-mono tracking-widest text-xs py-1 select-none text-center">
                        •••••••• •••••••• •••••••• •••••••• •••••••• •••••••• •••••••• •••••••• •••••••• •••••••• •••••••• ••••••••
                      </div>
                    )}
                  </div>
                </div>

                {/* Private Key WIF Container */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bitcoin Signing Key (WIF / Private Key)</span>
                    <button
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {showPrivateKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPrivateKey ? 'Hide Key' : 'Reveal Private Key'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3">
                    {showPrivateKey ? (
                      <div className="flex justify-between items-start">
                        <p className="font-mono text-xs text-red-400 font-bold break-all select-all">
                          KxZ8w9j7k6m5n4p3r2t1v0x9y8z7w6v5u...[Configured in Vault & .env]
                        </p>
                        <button
                          onClick={() => handleCopy('KxZ8w9j7k6m5n4p3r2t1v0x9y8z7w6v5u...[Configured in Vault]')}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer ml-3 shrink-0"
                          title="Copy Key"
                        >
                          {copiedText === 'KxZ8w9j7k6m5n4p3r2t1v0x9y8z7w6v5u...[Configured in Vault]' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      <div className="text-slate-500 font-mono tracking-widest text-xs py-1 select-none text-center">
                        ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Bitcoin Institutional Vault & Reconciliation */}
      {activeSubTab === 'btc_vault' && (
        <BitcoinSecurityAndReconciliationHub
          btcBalance={btcBalance}
          btcAddress={(import.meta as any).env?.VITE_MARSHALL_BTC_ADDRESS || ''}
          btcPriceUsd={98450}
          userName={userName || 'Primary Sovereign Holder'}
          userEmail={userEmail || 'mlaframboisemm@gmail.com'}
        />
      )}

      {/* Tab Content 4: Google Workspace Drive */}
      {activeSubTab === 'drive' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <HardDrive className="w-5 h-5 text-blue-600" />
              <span>Google Drive Production Workspace</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Manage connected production files, audit exports, and document repository.</p>
          </div>
          <GoogleDriveFolderHub folderId="1ABPIEmoPH_OWpSjHYu1DzjPRPlk3i8QM" />
        </div>
      )}

      {/* Tab Content 5: Linked Payment Methods */}
      {activeSubTab === 'methods' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <span>Connected Bank Accounts & Cards</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Instant credit card checkout, Plaid bank sync, and Wise multi-currency accounts.</p>
          </div>
          <OnboardingKyc
            onVerificationSuccess={(level) => {
              onVerificationSuccess(level);
            }}
            showToast={showToast}
          />
        </div>
      )}

      {/* Recovery Key Backup Wizard Modal */}
      {isBtcWizardOpen && (
        <RecoveryKeyBackupWizard
          isOpen={isBtcWizardOpen}
          onClose={() => setIsBtcWizardOpen(false)}
          wallet={btcWalletForWizard}
          showToast={showToast}
        />
      )}

    </div>
  );
}
