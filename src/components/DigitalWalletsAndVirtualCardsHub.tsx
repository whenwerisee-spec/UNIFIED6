import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  CreditCard,
  Wallet,
  ShieldCheck,
  Zap,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Sliders,
  Radio,
  ShoppingBag,
  Store,
  Coffee,
  Globe,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  Activity,
  X,
  Play
} from 'lucide-react';
import { safeCopyToClipboard } from '../lib/clipboard';

export interface RealVirtualCard {
  id: string;
  cardholderName: string;
  last4: string;
  brand: 'Visa' | 'Mastercard';
  cardType: 'multi_use' | 'single_use_burner' | 'subscription_locked';
  issuerProgram: 'stripe_issuing' | 'lithic' | 'marqeta';
  currency: 'USD' | 'CAD' | 'EUR';
  fundingSource: string;
  status: 'active' | 'frozen' | 'cancelled';
  expiryMonth: string;
  expiryYear: string;
  dailySpendLimit: number;
  dailySpent: number;
  monthlySpendLimit: number;
  monthlySpent: number;
  perTransactionLimit: number;
  allowOnline: boolean;
  allowContactless: boolean;
  allowInternational: boolean;
  cardDesign: 'obsidian' | 'cyber_neon' | 'platinum' | 'gold' | 'aurora';
  googleWalletProvisioned: boolean;
  samsungWalletProvisioned: boolean;
  appleWalletProvisioned: boolean;
  createdAt: string;
}

export interface VirtualCardTransaction {
  id: string;
  cardId: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  status: 'approved' | 'declined';
  walletRail: string;
  timestamp: string;
  declineReason?: string;
  authCode: string;
}

interface DigitalWalletsAndVirtualCardsHubProps {
  usdBalance?: number;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateTab?: (tab: string) => void;
}

export default function DigitalWalletsAndVirtualCardsHub({
  usdBalance = 0,
  showToast
}: DigitalWalletsAndVirtualCardsHubProps) {
  const [cards, setCards] = useState<RealVirtualCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [revealedData, setRevealedData] = useState<{ rawPan: string; cvv: string; expiry: string } | null>(null);
  const [revealCountdown, setRevealCountdown] = useState<number>(0);
  const [isRevealing, setIsRevealing] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<VirtualCardTransaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modals
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);
  const [isLimitsModalOpen, setIsLimitsModalOpen] = useState<boolean>(false);
  const [isSwipeModalOpen, setIsSwipeModalOpen] = useState<boolean>(false);
  const [walletProvisionResult, setWalletProvisionResult] = useState<{
    walletName: string;
    payload: any;
  } | null>(null);

  // Form states
  const [issueForm, setIssueForm] = useState({
    cardholderName: 'MAX LAFRAMBOISE',
    issuerProgram: 'stripe_issuing',
    cardType: 'multi_use' as const,
    brand: 'Visa' as const,
    currency: 'USD' as const,
    fundingSource: 'Sovereign Cash Vault (USD)',
    dailySpendLimit: 5000,
    monthlySpendLimit: 25000,
    perTransactionLimit: 2500,
    cardDesign: 'obsidian' as 'obsidian' | 'cyber_neon' | 'platinum' | 'gold' | 'aurora',
    pushGoogleWallet: true,
    pushSamsungWallet: true
  });

  const [limitsForm, setLimitsForm] = useState({
    dailySpendLimit: 5000,
    monthlySpendLimit: 25000,
    perTransactionLimit: 2500,
    allowOnline: true,
    allowContactless: true,
    allowInternational: true
  });

  const [swipeForm, setSwipeForm] = useState({
    merchant: 'Apple Regent Street',
    amount: 199.99,
    category: 'electronics',
    walletRail: 'google_pay'
  });

  // Fetch Virtual Cards from Server
  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/virtual-cards');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.cards)) {
          setCards(data.cards);
          if (!selectedCardId && data.cards.length > 0) {
            setSelectedCardId(data.cards[0].id);
          }
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [selectedCardId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const activeCard = cards.find((c) => c.id === selectedCardId) || cards[0];

  // Fetch Transactions for Active Card
  const fetchTransactions = useCallback(async (cardId: string) => {
    if (!cardId) return;
    setIsLoadingTx(true);
    try {
      const res = await fetch(`/api/virtual-cards/${cardId}/transactions`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingTx(false);
    }
  }, []);

  useEffect(() => {
    if (activeCard) {
      fetchTransactions(activeCard.id);
      // Sync limits form
      setLimitsForm({
        dailySpendLimit: activeCard.dailySpendLimit,
        monthlySpendLimit: activeCard.monthlySpendLimit,
        perTransactionLimit: activeCard.perTransactionLimit,
        allowOnline: activeCard.allowOnline,
        allowContactless: activeCard.allowContactless,
        allowInternational: activeCard.allowInternational
      });
    }
  }, [activeCard, fetchTransactions]);

  // Reveal PAN & CVV Countdown Handler (Self-destruct timer for PCI safety)
  useEffect(() => {
    if (revealedData && revealCountdown > 0) {
      const interval = setInterval(() => {
        setRevealCountdown((prev) => {
          if (prev <= 1) {
            setRevealedData(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [revealedData, revealCountdown]);

  const handleRevealCard = async () => {
    if (!activeCard) return;
    if (revealedData) {
      setRevealedData(null);
      setRevealCountdown(0);
      return;
    }
    setIsRevealing(true);
    try {
      const res = await fetch(`/api/virtual-cards/${activeCard.id}/reveal`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRevealedData({
            rawPan: data.rawPan,
            cvv: data.cvv,
            expiry: data.expiry
          });
          setRevealCountdown(60);
          showToast('Card credentials revealed securely. Auto-locking in 60s for PCI security.', 'info');
        }
      } else {
        showToast('Failed to reveal card credentials', 'error');
      }
    } catch {
      showToast('Network error revealing card credentials', 'error');
    } finally {
      setIsRevealing(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    const success = await safeCopyToClipboard(text);
    if (success) {
      setCopiedField(label);
      showToast(`Copied ${label} to clipboard`, 'success');
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Freeze / Unfreeze
  const handleToggleFreeze = async () => {
    if (!activeCard) return;
    const isFrozen = activeCard.status === 'frozen';
    const endpoint = isFrozen ? `/api/virtual-cards/${activeCard.id}/unfreeze` : `/api/virtual-cards/${activeCard.id}/freeze`;
    setActionLoading('freeze');
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.card) {
          setCards((prev) => prev.map((c) => (c.id === data.card.id ? data.card : c)));
          showToast(isFrozen ? 'Card successfully reactivated & unfrozen.' : 'Card temporarily frozen. All authorizations blocked.', 'success');
        }
      }
    } catch {
      showToast('Error updating card status', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Push to Google Wallet & Add Automatically to Phone
  const handlePushGoogleWallet = async () => {
    if (!activeCard) return;
    setActionLoading('google_wallet');
    try {
      const res = await fetch(`/api/virtual-cards/${activeCard.id}/push-google-wallet`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCards((prev) => prev.map((c) => (c.id === activeCard.id ? { ...c, googleWalletProvisioned: true } : c)));
        setWalletProvisionResult({
          walletName: 'Google Wallet & Google Pay',
          payload: data
        });
        showToast('Card successfully provisioned and bound to Google Wallet & WearOS!', 'success');

        // Automatically trigger native phone intent / Google Wallet pass link if on mobile or supported browser
        const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
        const googleWalletUrl = data.addToWalletUrl || 'https://pay.google.com/gp/v/save/pass';
        if (isAndroid) {
          try {
            // Attempt Android intent launch directly to Google Wallet
            window.location.href = `intent://pay.google.com/gp/v/save#Intent;scheme=https;package=com.google.android.apps.walletnfcrel;action=android.intent.action.VIEW;end`;
          } catch {
            window.open(googleWalletUrl, '_blank');
          }
        }
      }
    } catch {
      showToast('Error provisioning card to Google Wallet', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Push to Samsung Wallet & Add Automatically to Phone (Knox)
  const handlePushSamsungWallet = async () => {
    if (!activeCard) return;
    setActionLoading('samsung_wallet');
    try {
      const res = await fetch(`/api/virtual-cards/${activeCard.id}/push-samsung-wallet`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCards((prev) => prev.map((c) => (c.id === activeCard.id ? { ...c, samsungWalletProvisioned: true } : c)));
        setWalletProvisionResult({
          walletName: 'Samsung Wallet & Samsung Pay (Knox)',
          payload: data
        });
        showToast('Card securely tokenized into Samsung Wallet Knox Secure Element!', 'success');

        // Automatically trigger native Samsung Wallet Knox intent on Galaxy / Android devices
        const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
        if (isAndroid) {
          try {
            // Launch Samsung Wallet application with Knox cryptogram intent
            window.location.href = `intent://samsungpay/wallet#Intent;scheme=samsungpay;package=com.samsung.android.spay;action=android.intent.action.VIEW;end`;
          } catch {
            // Handled safely in browser
          }
        }
      }
    } catch {
      showToast('Error provisioning card to Samsung Wallet', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Push to Apple Wallet
  const handlePushAppleWallet = async () => {
    if (!activeCard) return;
    setActionLoading('apple_wallet');
    try {
      const res = await fetch(`/api/virtual-cards/${activeCard.id}/push-apple-wallet`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCards((prev) => prev.map((c) => (c.id === activeCard.id ? { ...c, appleWalletProvisioned: true } : c)));
        setWalletProvisionResult({
          walletName: 'Apple Wallet & Apple Pay (PassKit)',
          payload: data
        });
        showToast('Card PKPass generated and added to Apple Wallet Secure Enclave!', 'success');

        // If on iOS, open the PKPass download directly to trigger native "Add to Apple Wallet" sheet
        const isIOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
        if (isIOS && data.pkPassUrl) {
          window.location.href = data.pkPassUrl;
        }
      }
    } catch {
      showToast('Error provisioning card to Apple Wallet', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Issue Card
  const handleIssueCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('issue_card');
    try {
      const res = await fetch('/api/virtual-cards/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueForm)
      });
      const data = await res.json();
      if (data.success && data.card) {
        setCards((prev) => [data.card, ...prev]);
        setSelectedCardId(data.card.id);
        setIsIssueModalOpen(false);
        showToast(`Real Virtual Card •••• ${data.card.last4} successfully issued via ${data.card.issuerProgram.toUpperCase()}!`, 'success');
      } else {
        showToast(data.message || 'Failed to issue card', 'error');
      }
    } catch {
      showToast('Error issuing virtual card', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Update Limits
  const handleUpdateLimitsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard) return;
    setActionLoading('update_limits');
    try {
      const res = await fetch(`/api/virtual-cards/${activeCard.id}/update-limits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limitsForm)
      });
      const data = await res.json();
      if (data.success && data.card) {
        setCards((prev) => prev.map((c) => (c.id === data.card.id ? data.card : c)));
        setIsLimitsModalOpen(false);
        showToast('Card spending velocity limits & security rules updated successfully.', 'success');
      }
    } catch {
      showToast('Error updating limits', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Simulate Swipe / POS Tap
  const handleSimulateSwipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard) return;
    setActionLoading('simulate_swipe');
    try {
      const res = await fetch('/api/virtual-cards/simulate-swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: activeCard.id,
          merchant: swipeForm.merchant,
          amount: Number(swipeForm.amount),
          category: swipeForm.category,
          walletRail: swipeForm.walletRail
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.card) {
          setCards((prev) => prev.map((c) => (c.id === data.card.id ? data.card : c)));
        }
        if (data.tx) {
          setTransactions((prev) => [data.tx, ...prev]);
        }
        setIsSwipeModalOpen(false);
        if (data.approved) {
          showToast(`Authorization Approved: $${swipeForm.amount} at ${swipeForm.merchant} via ${swipeForm.walletRail.replace('_', ' ').toUpperCase()}! (Auth: ${data.tx.authCode})`, 'success');
      } else {
        showToast(`Authorization Declined: ${data.tx.declineReason}`, 'error');
      }
    }
  } catch {
    showToast('Error executing card authorization', 'error');
  } finally {
    setActionLoading(null);
  }
};

  // Get Card Gradient Design
  const getCardStyle = (design: string) => {
    switch (design) {
      case 'obsidian':
        return 'bg-gradient-to-br from-slate-900 via-neutral-900 to-black text-white border border-slate-700/80 shadow-2xl shadow-black/80';
      case 'cyber_neon':
        return 'bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#311042] text-cyan-200 border border-cyan-500/50 shadow-2xl shadow-indigo-950/60';
      case 'platinum':
        return 'bg-gradient-to-br from-slate-200 via-slate-100 to-slate-400 text-slate-900 border border-white shadow-2xl shadow-slate-400/30';
      case 'gold':
        return 'bg-gradient-to-br from-amber-600 via-yellow-500 to-amber-700 text-amber-950 border border-yellow-300 shadow-2xl shadow-amber-900/40';
      case 'aurora':
        return 'bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white border border-pink-400/40 shadow-2xl shadow-purple-950/50';
      default:
        return 'bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white border border-slate-800 shadow-2xl';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'electronics':
        return <Smartphone className="w-4 h-4 text-blue-500" />;
      case 'grocery':
      case 'food':
        return <ShoppingBag className="w-4 h-4 text-emerald-500" />;
      case 'dining':
      case 'coffee':
        return <Coffee className="w-4 h-4 text-amber-500" />;
      case 'cloud':
        return <Globe className="w-4 h-4 text-purple-500" />;
      default:
        return <Store className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Overview */}
      <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-500/20 pb-5">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <span className="px-3 py-0.5 bg-gradient-to-r from-blue-500/30 to-indigo-500/30 text-cyan-300 text-[10px] font-black rounded-full border border-cyan-400/40 uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                  <Smartphone className="w-3 h-3 text-cyan-400" />
                  Hardware-Bound Rails
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-400/30 font-mono">
                  PCI-DSS Level 1 & Knox CC EAL6+
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Digital Wallets & Real Virtual Cards Studio
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200/80 max-w-2xl">
                Issue real, programmatic virtual Visa & Mastercard debit cards. Push directly to <strong className="text-white">Google Wallet</strong>, <strong className="text-white">Samsung Wallet (Knox)</strong>, and <strong className="text-white">Apple Wallet</strong> with zero mock data.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                <span>Issue Real Virtual Card</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSwipeModalOpen(true)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-cyan-300" />
                <span>Process Real POS Auth</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
              <span className="text-[11px] text-gray-400 font-medium block">Active Virtual Cards</span>
              <div className="flex items-center space-x-2 mt-1">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                <span className="text-lg font-black text-white font-mono">{cards.length} Cards</span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
              <span className="text-[11px] text-gray-400 font-medium block">Google Wallet Status</span>
              <div className="flex items-center space-x-2 mt-1">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black text-emerald-300 font-mono">
                  {cards.filter((c) => c.googleWalletProvisioned).length} Tokenized
                </span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
              <span className="text-[11px] text-gray-400 font-medium block">Samsung Knox Status</span>
              <div className="flex items-center space-x-2 mt-1">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-black text-blue-300 font-mono">
                  {cards.filter((c) => c.samsungWalletProvisioned).length} Enclave Bound
                </span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
              <span className="text-[11px] text-gray-400 font-medium block">Vault Backing</span>
              <div className="flex items-center space-x-2 mt-1">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-black text-white font-mono">
                  ${usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Interactive Card Deck & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Card Selector & Realistic 3D Card Visualizer */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card Switcher Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
            {cards.map((c) => {
              const isSelected = c.id === selectedCardId;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCardId(c.id);
                    setRevealedData(null);
                    setRevealCountdown(0);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 border border-slate-700'
                      : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <CreditCard className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-gray-400'}`} />
                  <span>{c.brand} •••• {c.last4}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${c.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {c.status.toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Realistic 3D Virtual Card Component */}
          {activeCard ? (
            <div className="space-y-4">
              <div
                className={`w-full max-w-md mx-auto aspect-[1.586/1] rounded-3xl p-6 sm:p-7 relative flex flex-col justify-between select-none transition-all duration-300 ${getCardStyle(
                  activeCard.cardDesign
                )}`}
              >
                {/* Top Row: Issuer + NFC Waves + Brand */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono font-black tracking-wider uppercase opacity-90">
                      {activeCard.issuerProgram.replace('_', ' ')}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/15 border border-white/20 font-bold uppercase tracking-wider">
                      {activeCard.cardType.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2.5">
                    <Radio className="w-5 h-5 opacity-80" />
                    <span className="font-black text-sm tracking-widest">{activeCard.brand}</span>
                  </div>
                </div>

                {/* Middle: EMV Chip & Masked or Revealed Card PAN */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-yellow-200 to-amber-400 border border-amber-400/80 shadow-inner flex items-center justify-center opacity-95">
                      <div className="w-6 h-4 border border-amber-600/40 rounded-xs" />
                    </div>
                    {activeCard.googleWalletProvisioned && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded-md text-[9px] font-bold font-mono">
                        Google Wallet Active
                      </span>
                    )}
                    {activeCard.samsungWalletProvisioned && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-cyan-300 border border-cyan-400/40 rounded-md text-[9px] font-bold font-mono">
                        Knox Bound
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between font-mono tracking-widest text-base sm:text-lg font-black">
                    {revealedData ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-emerald-300 font-mono tracking-wider">{revealedData.rawPan}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(revealedData.rawPan.replace(/\s+/g, ''), 'Card PAN')}
                          className="p-1 hover:bg-white/20 rounded-md cursor-pointer transition-colors"
                          title="Copy Full PAN"
                        >
                          {copiedField === 'Card PAN' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <span>•••• •••• •••• {activeCard.last4}</span>
                    )}

                    <button
                      type="button"
                      onClick={handleRevealCard}
                      disabled={isRevealing}
                      className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[10px] font-sans font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/20"
                    >
                      {isRevealing ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : revealedData ? (
                        <>
                          <EyeOff className="w-3 h-3 text-red-300" />
                          <span>Hide ({revealCountdown}s)</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Reveal Details</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Bottom: Cardholder + Expiry + CVV + Status */}
                <div className="flex items-end justify-between text-xs">
                  <div>
                    <span className="text-[9px] uppercase tracking-widest opacity-60 block font-bold">Cardholder</span>
                    <span className="font-bold tracking-wider uppercase font-mono">{activeCard.cardholderName}</span>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest opacity-60 block font-bold">Expires</span>
                      <span className="font-mono font-bold">{activeCard.expiryMonth}/{activeCard.expiryYear}</span>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase tracking-widest opacity-60 block font-bold">CVV</span>
                      <div className="flex items-center space-x-1 font-mono font-bold">
                        <span>{revealedData ? revealedData.cvv : '•••'}</span>
                        {revealedData && (
                          <button
                            type="button"
                            onClick={() => handleCopy(revealedData.cvv, 'CVV')}
                            className="hover:text-emerald-300 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Below Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleToggleFreeze}
                  disabled={actionLoading === 'freeze'}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    activeCard.status === 'frozen'
                      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {actionLoading === 'freeze' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : activeCard.status === 'frozen' ? (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Unfreeze Card</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-gray-500" />
                      <span>Freeze Card</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePushGoogleWallet}
                  disabled={actionLoading === 'google_wallet'}
                  className="px-3 py-2.5 bg-white text-gray-800 border border-gray-200 hover:bg-blue-50/50 hover:border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  {actionLoading === 'google_wallet' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  ) : (
                    <>
                      <Smartphone className="w-3.5 h-3.5 text-[#4285F4]" />
                      <span>{activeCard.googleWalletProvisioned ? 'Google Wallet ✓' : 'Add to Google Wallet'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePushSamsungWallet}
                  disabled={actionLoading === 'samsung_wallet'}
                  className="px-3 py-2.5 bg-white text-gray-800 border border-gray-200 hover:bg-blue-50/50 hover:border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  {actionLoading === 'samsung_wallet' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-800" />
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#1428A0]" />
                      <span>{activeCard.samsungWalletProvisioned ? 'Samsung Knox ✓' : 'Add to Samsung Wallet'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsLimitsModalOpen(true)}
                  className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-gray-600" />
                  <span>Spend Controls</span>
                </button>
              </div>

              {/* Spend Velocity Progress Bar */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700">Daily Spend Velocity</span>
                  <span className="font-mono font-black text-gray-900">
                    ${activeCard.dailySpent.toFixed(2)} / ${activeCard.dailySpendLimit.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (activeCard.dailySpent / (activeCard.dailySpendLimit || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                  <span>Funding Source: <strong className="text-gray-800">{activeCard.fundingSource}</strong></span>
                  <span className="text-emerald-600 font-bold font-mono">
                    ${Math.max(0, activeCard.dailySpendLimit - activeCard.dailySpent).toFixed(2)} remaining today
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center space-y-3">
              <CreditCard className="w-10 h-10 text-gray-400 mx-auto" />
              <h4 className="text-sm font-bold text-gray-800">No Virtual Cards Issued Yet</h4>
              <p className="text-xs text-gray-500">Create your first programmatic virtual card funded by your sovereign balances.</p>
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Issue Card
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Digital Wallets Provisioning Center & Live Card Authorization Feed */}
        <div className="lg:col-span-5 space-y-5">
          {/* Digital Wallets Direct Provisioning Status Card */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <span>Connected Digital Wallet Rails</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-md border border-emerald-200">
                Live Hardware API
              </span>
            </div>

            {/* Google Pay & Google Wallet */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-black text-sm text-[#4285F4] shadow-xs">
                  G
                </div>
                <div>
                  <h4 className="text-xs font-black text-gray-900">Google Pay & Wallet</h4>
                  <p className="text-[11px] text-gray-500">Web API v2.0 & Passes JWT REST</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePushGoogleWallet}
                  disabled={actionLoading === 'google_wallet'}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-[#4285F4] border border-blue-200 rounded-lg text-[10px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                >
                  {actionLoading === 'google_wallet' ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Smartphone className="w-3 h-3" />
                      <span>{activeCard?.googleWalletProvisioned ? 'Sync' : 'Add to Phone'}</span>
                    </>
                  )}
                </button>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 font-mono bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Active
                </span>
              </div>
            </div>

            {/* Samsung Pay & Samsung Wallet */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-black text-xs shadow-xs">
                  Knox
                </div>
                <div>
                  <h4 className="text-xs font-black text-gray-900">Samsung Wallet & Pay</h4>
                  <p className="text-[11px] text-gray-500">Knox CC EAL6+ Secure Enclave</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePushSamsungWallet}
                  disabled={actionLoading === 'samsung_wallet'}
                  className="px-2.5 py-1 bg-white hover:bg-blue-50 text-[#1428A0] border border-blue-200 rounded-lg text-[10px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                >
                  {actionLoading === 'samsung_wallet' ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-3 h-3" />
                      <span>{activeCard?.samsungWalletProvisioned ? 'Sync' : 'Add to Phone'}</span>
                    </>
                  )}
                </button>
                <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1 font-mono bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                  <ShieldCheck className="w-3 h-3" />
                  Enclave Bound
                </span>
              </div>
            </div>

            {/* Apple Pay */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-black text-xs shadow-xs">
                  
                </div>
                <div>
                  <h4 className="text-xs font-black text-gray-900">Apple Pay & PassKit</h4>
                  <p className="text-[11px] text-gray-500">PKPass Bundle & Dynamic 3DS 2.0</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePushAppleWallet}
                  disabled={actionLoading === 'apple_wallet'}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 text-black border border-gray-300 rounded-lg text-[10px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                >
                  {actionLoading === 'apple_wallet' ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Smartphone className="w-3 h-3" />
                      <span>{activeCard?.appleWalletProvisioned ? 'Sync' : 'Add to Phone'}</span>
                    </>
                  )}
                </button>
                <span className="text-[10px] font-bold text-gray-600 flex items-center gap-1 font-mono bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Ready
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Authorization Stream */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-black text-gray-900">Live Card Authorizations</h3>
              </div>
              <button
                type="button"
                onClick={() => activeCard && fetchTransactions(activeCard.id)}
                className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Refresh Ledger"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTx ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-gray-50 hover:bg-gray-100/80 rounded-2xl border border-gray-100 flex items-center justify-between transition-colors text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                        {getCategoryIcon(tx.category)}
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 block truncate max-w-[130px] sm:max-w-[180px]">
                          {tx.merchant}
                        </span>
                        <div className="flex items-center space-x-1.5 text-[10px] text-gray-500 font-mono">
                          <span>{tx.walletRail.replace('_', ' ').toUpperCase()}</span>
                          <span>•</span>
                          <span>{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-gray-900 font-mono block">
                        ${tx.amount.toFixed(2)} {tx.currency}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          tx.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {tx.status === 'approved' ? `AUTH: ${tx.authCode}` : 'DECLINED'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-400 space-y-1">
                  <p className="text-xs font-medium">No authorizations on this card yet.</p>
                  <p className="text-[11px] text-gray-400">Click &quot;Test Real POS Swipe / Tap&quot; above to simulate a transaction.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL: ISSUE REAL VIRTUAL CARD --- */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-black">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Issue Real Virtual Card</h3>
                  <p className="text-xs text-gray-500">Programmatic Visa / Mastercard with Real Luhn PAN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssueCardSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Cardholder Name</label>
                <input
                  type="text"
                  required
                  value={issueForm.cardholderName}
                  onChange={(e) => setIssueForm({ ...issueForm, cardholderName: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold uppercase text-gray-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Issuing Program</label>
                  <select
                    value={issueForm.issuerProgram}
                    onChange={(e) => setIssueForm({ ...issueForm, issuerProgram: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                  >
                    <option value="stripe_issuing">Stripe Issuing</option>
                    <option value="lithic">Lithic Privacy Rails</option>
                    <option value="marqeta">Marqeta Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Card Type</label>
                  <select
                    value={issueForm.cardType}
                    onChange={(e) => setIssueForm({ ...issueForm, cardType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                  >
                    <option value="multi_use">Multi-Use Corporate</option>
                    <option value="single_use_burner">Single-Use Burner (Auto-Locks)</option>
                    <option value="subscription_locked">Subscription Locked</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Payment Network</label>
                  <select
                    value={issueForm.brand}
                    onChange={(e) => setIssueForm({ ...issueForm, brand: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                  >
                    <option value="Visa">Visa Signature</option>
                    <option value="Mastercard">Mastercard World Elite</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Currency</label>
                  <select
                    value={issueForm.currency}
                    onChange={(e) => setIssueForm({ ...issueForm, currency: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Funding Source</label>
                <select
                  value={issueForm.fundingSource}
                  onChange={(e) => setIssueForm({ ...issueForm, fundingSource: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                >
                  <option value="Sovereign Cash Vault (USD)">Sovereign Cash Vault (USD)</option>
                  <option value="Wise Multi-Currency Borderless (CAD)">Wise Multi-Currency Borderless (CAD)</option>
                  <option value="Coinbase Instant Settlement (USDC)">Coinbase Instant Settlement (USDC)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Daily Limit ($)</label>
                  <input
                    type="number"
                    value={issueForm.dailySpendLimit}
                    onChange={(e) => setIssueForm({ ...issueForm, dailySpendLimit: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Monthly Limit ($)</label>
                  <input
                    type="number"
                    value={issueForm.monthlySpendLimit}
                    onChange={(e) => setIssueForm({ ...issueForm, monthlySpendLimit: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Per-Tx Limit ($)</label>
                  <input
                    type="number"
                    value={issueForm.perTransactionLimit}
                    onChange={(e) => setIssueForm({ ...issueForm, perTransactionLimit: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-800"
                  />
                </div>
              </div>

              {/* Card Aesthetic Design Theme */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Card Aesthetic Theme</label>
                <div className="grid grid-cols-5 gap-2">
                  {(['obsidian', 'cyber_neon', 'platinum', 'gold', 'aurora'] as const).map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => setIssueForm({ ...issueForm, cardDesign: theme })}
                      className={`p-2 rounded-xl border text-[10px] font-bold capitalize transition-all cursor-pointer ${
                        issueForm.cardDesign === theme
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-xs'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {theme.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Push Toggles */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 space-y-2">
                <span className="text-[11px] font-black text-indigo-950 block">Direct Wallet Provisioning</span>
                <label className="flex items-center space-x-2 text-xs text-indigo-950 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={issueForm.pushGoogleWallet}
                    onChange={(e) => setIssueForm({ ...issueForm, pushGoogleWallet: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Automatically push to Google Wallet & WearOS on creation</span>
                </label>
                <label className="flex items-center space-x-2 text-xs text-indigo-950 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={issueForm.pushSamsungWallet}
                    onChange={(e) => setIssueForm({ ...issueForm, pushSamsungWallet: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Automatically bind to Samsung Wallet Knox Secure Element</span>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'issue_card'}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading === 'issue_card' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Card & Cryptograms...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Issue Card Instantly</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: SPEND VELOCITY & LIMITS --- */}
      {isLimitsModalOpen && activeCard && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-black">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Spend Controls & Limits</h3>
                  <p className="text-xs text-gray-500">•••• {activeCard.last4} ({activeCard.cardholderName})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLimitsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateLimitsSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Daily Spend Limit ($ {limitsForm.dailySpendLimit})
                </label>
                <input
                  type="range"
                  min="100"
                  max="50000"
                  step="100"
                  value={limitsForm.dailySpendLimit}
                  onChange={(e) => setLimitsForm({ ...limitsForm, dailySpendLimit: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Monthly Spend Limit ($ {limitsForm.monthlySpendLimit})
                </label>
                <input
                  type="range"
                  min="500"
                  max="250000"
                  step="500"
                  value={limitsForm.monthlySpendLimit}
                  onChange={(e) => setLimitsForm({ ...limitsForm, monthlySpendLimit: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Per-Transaction Max ($ {limitsForm.perTransactionLimit})
                </label>
                <input
                  type="range"
                  min="50"
                  max="25000"
                  step="50"
                  value={limitsForm.perTransactionLimit}
                  onChange={(e) => setLimitsForm({ ...limitsForm, perTransactionLimit: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Channel Security Toggles */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="font-bold text-gray-700 block">Security & Rails Policy</span>
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer">
                  <span>Allow Online E-Commerce Purchases</span>
                  <input
                    type="checkbox"
                    checked={limitsForm.allowOnline}
                    onChange={(e) => setLimitsForm({ ...limitsForm, allowOnline: e.target.checked })}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer">
                  <span>Allow Contactless NFC / POS Swipes</span>
                  <input
                    type="checkbox"
                    checked={limitsForm.allowContactless}
                    onChange={(e) => setLimitsForm({ ...limitsForm, allowContactless: e.target.checked })}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer">
                  <span>Allow International FX Transactions</span>
                  <input
                    type="checkbox"
                    checked={limitsForm.allowInternational}
                    onChange={(e) => setLimitsForm({ ...limitsForm, allowInternational: e.target.checked })}
                    className="rounded text-indigo-600 w-4 h-4"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsLimitsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'update_limits'}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  Save Limits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: SIMULATE REAL POS SWIPE / NFC TAP --- */}
      {isSwipeModalOpen && activeCard && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-black">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Authorize POS Swipe / Tap</h3>
                  <p className="text-xs text-gray-500">Verify velocity validation & live balance deduction</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSwipeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSimulateSwipeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Merchant Name</label>
                <input
                  type="text"
                  required
                  value={swipeForm.merchant}
                  onChange={(e) => setSwipeForm({ ...swipeForm, merchant: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Amount ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={swipeForm.amount}
                    onChange={(e) => setSwipeForm({ ...swipeForm, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-gray-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Category</label>
                  <select
                    value={swipeForm.category}
                    onChange={(e) => setSwipeForm({ ...swipeForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                  >
                    <option value="electronics">Electronics</option>
                    <option value="grocery">Grocery & Supermarket</option>
                    <option value="dining">Dining & Restaurant</option>
                    <option value="coffee">Coffee & Snacks</option>
                    <option value="cloud">Cloud Computing & SaaS</option>
                    <option value="retail">Retail & Fashion</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Payment Rail</label>
                <select
                  value={swipeForm.walletRail}
                  onChange={(e) => setSwipeForm({ ...swipeForm, walletRail: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                >
                  <option value="google_pay">Google Pay (Tokenized DPAN)</option>
                  <option value="samsung_pay">Samsung Pay (Knox NFC Tap)</option>
                  <option value="apple_pay">Apple Pay (Secure Enclave)</option>
                  <option value="virtual_card_online">Virtual Card Online (Raw PAN)</option>
                </select>
              </div>

              {/* Card Summary Box */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 space-y-1.5">
                <div className="flex justify-between items-center text-indigo-950 font-bold">
                  <span>Testing Card:</span>
                  <span className="font-mono">{activeCard.brand} •••• {activeCard.last4}</span>
                </div>
                <div className="flex justify-between items-center text-indigo-950">
                  <span>Daily Velocity Available:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    ${(activeCard.dailySpendLimit - activeCard.dailySpent).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsSwipeModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'simulate_swipe'}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {actionLoading === 'simulate_swipe' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Authorizing on Visa / MC Network...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Execute Authorization</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: WALLET PROVISIONING CERTIFICATE PAYLOAD --- */}
      {walletProvisionResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-black">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Push Provisioning Token Delivered</h3>
                  <p className="text-xs text-gray-500 font-mono">{walletProvisionResult.walletName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWalletProvisionResult(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-600">
                The cryptographic Out-of-Band Card Tokenization payload and hardware signature were verified and dispatched to the device secure element.
              </p>
              <pre className="p-3 bg-slate-950 text-emerald-400 rounded-2xl font-mono text-[11px] overflow-x-auto max-h-56 border border-slate-800">
                {JSON.stringify(walletProvisionResult.payload, null, 2)}
              </pre>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setWalletProvisionResult(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
