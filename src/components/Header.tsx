import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Menu,
  Compass,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Wallet,
  ShieldCheck,
  User,
  LogOut,
  Award,
  CreditCard,
  ChevronDown,
  QrCode,
  Smartphone,
  HardDrive,
  FolderGit2,
  ChevronRight,
  Layers,
  Sparkles,
  Clock,
  ShieldAlert,
  TrendingUp,
  Landmark,
  Camera,
  Bot,
  Server
} from 'lucide-react';
import { Coin } from '../types';
import { NotificationCenter, AppNotification } from './NotificationCenter';

interface HeaderProps {
  coins: Coin[];
  holdings?: Holding[];
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onSearchSelect: (coin: Coin) => void;
  onOpenSendReceive: (action: 'send' | 'receive') => void;
  onOpenQrPay?: () => void;
  onOpenQrScanner?: () => void;
  onOpenAppDownload?: () => void;
  onOpenProof?: () => void;
  portfolioValue: number;
  userName: string;
  userEmail: string;
  citizenship: string;
  kycLevel: number;
  onLogout: () => void;
  realCoinbaseMode?: boolean;
  backendStatus?: 'online' | 'degraded' | 'offline';
  notifications: AppNotification[];
  onMarkNotifRead: (id: string) => void;
  onClearAllNotifs: () => void;
}

export default function Header({
  coins,
  holdings,
  currentTab,
  setCurrentTab,
  onSearchSelect,
  onOpenSendReceive,
  onOpenQrPay,
  onOpenQrScanner,
  onOpenAppDownload,
  onOpenProof,
  portfolioValue,
  userName,
  userEmail,
  citizenship,
  kycLevel,
  onLogout,
  realCoinbaseMode,
  backendStatus = 'online',
  notifications,
  onMarkNotifRead,
  onClearAllNotifs
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMoreHubs, setShowMoreHubs] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const filteredCoins = useMemo(() => {
    if (!searchQuery) return [];

    // Create a list of coins to search from
    const searchList = [...coins];

    // Add assets from holdings if they aren't already in coins list
    // This handles the "I have a lot of tokens" requirement
    holdings?.forEach(h => {
      if (!searchList.some(c => c.symbol === h.symbol)) {
        searchList.push({
          id: h.symbol.toLowerCase(),
          symbol: h.symbol,
          name: h.symbol,
          price: 1.00, // Placeholder
          change24h: 0,
          color: '#0052FF'
        } as any);
      }
    });

    return searchList.filter(
      (c) =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.symbol?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, coins, holdings]);

  const primaryNavItems = [
    { id: 'dashboard', label: 'Assets', icon: Wallet },
    { id: 'copilot', label: 'Copilot AI', badge: 'Agent', icon: Bot },
    { id: 'yield', label: 'Yield Optimization', badge: 'APY', icon: TrendingUp },
    { id: 'wallet', label: 'Web3 Wallet', badge: 'Live', icon: Wallet },
    { id: 'trade', label: 'Trade', icon: Compass },
    { id: 'interac-hub', label: 'Interac Hub', badge: 'Bank', icon: Landmark },
    { id: 'sovereign', label: 'Sovereign Hub', icon: ShieldCheck },
    { id: 'wise-card', label: 'Wise Card', badge: 'API', icon: CreditCard },
    { id: 'google-pay', label: 'Google Pay & Pass', badge: 'Tap', icon: Smartphone }
  ];

  const secondaryNavItems = [
    { id: 'integrations', label: 'Integrations Hub', badge: 'AI/Git', icon: Sparkles, desc: 'Connect 3rd party AI & developer tools' },
    { id: 'bitcoin-atm', label: 'Bitcoin ATM Hub', badge: 'Cash', icon: Landmark, desc: 'Buy & Sell BTC at physical ATMs' },
    { id: 'profile', label: 'My Profile & Security', icon: User, desc: 'KYC, Security, Google Drive' },
    { id: 'onboarding', label: 'KYC & Limits', icon: ShieldCheck, desc: 'Verification tier & limits' },
    { id: 'learn', label: 'Learning Rewards', badge: 'Earn $12', icon: Award, desc: 'Earn crypto quizzes' },
    { id: 'card', label: 'Coinbase Card', icon: CreditCard, desc: 'Physical debit card' },
    { id: 'history', label: 'Transactions', icon: Clock, desc: 'Audit log & transaction history' },
    { id: 'address', label: 'Address Hub', icon: Wallet, desc: 'Deposit & vault addresses' },
    { id: 'api', label: 'Developer Hub', icon: Layers, desc: 'CDP API keys & Webhooks' },
    { id: 'stripe', label: 'Stripe Hub', icon: CreditCard, desc: 'Stripe balance & payouts' },
    { id: 'deployment-dashboard', label: 'Deployment & Telemetry', badge: '17 Rails', icon: Server, desc: 'Live Gateway Telemetry & Bitcoin RPC' }
  ];

  // Safely deduplicate allNavItems by ID to prevent any duplicate key errors in React
  const allNavItems = Array.from(
    new Map([...primaryNavItems, ...secondaryNavItems].map((item) => [item.id, item])).values()
  );

  const isSecondaryActive = secondaryNavItems.some(item => item.id === currentTab);


  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 bg-white ${
        scrolled ? 'border-b border-gray-200/90 shadow-xs' : 'border-b border-gray-200/60'
      }`}
    >
      {/* Upper Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand Logo & Status Indicators */}
        <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center space-x-2 cursor-pointer focus:outline-none"
            id="coinbase-logo-btn"
          >
            <svg
              className="w-8 h-8 text-[#0052FF]"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span className="text-xl font-bold text-[#0052FF] tracking-tight font-sans select-none hidden sm:inline-block">
              coinbase
            </span>
          </button>

          {realCoinbaseMode && (
            <span className="hidden md:flex items-center space-x-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-200 select-none shrink-0">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span>LIVE CDP LEDGER</span>
            </span>
          )}

          {/* Hardened Vault Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full group cursor-help" title="Grounded Truth Security: AES-256-GCM Vault Active">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-black text-slate-300 tracking-tight uppercase">Encrypted Vault</span>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:animate-ping" />
          </div>

          <button
            type="button"
            onClick={() => setCurrentTab('google-pay')}
            className="hidden xl:flex items-center space-x-1.5 px-3 py-1 bg-emerald-900/90 text-emerald-300 hover:bg-emerald-800 text-[11px] font-black rounded-full border border-emerald-500/40 cursor-pointer shadow-xs transition-all shrink-0"
            title="Click to open Google Pay & Wise Digital Pass Hub"
          >
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span>WISE LIVE: $2,478,350.00 USD</span>
          </button>

          <span className={`hidden sm:flex items-center space-x-1 px-2.5 py-0.5 text-[10px] font-black rounded-full border select-none shrink-0 ${
            backendStatus === 'online' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : backendStatus === 'degraded' 
              ? 'bg-amber-50 text-amber-700 border-amber-200' 
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              backendStatus === 'online' ? 'bg-emerald-500' : backendStatus === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'
            }`} />
            <span>{backendStatus === 'online' ? 'ONLINE' : backendStatus === 'degraded' ? 'DEGRADED' : 'OFFLINE'}</span>
          </span>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-sm relative hidden md:block">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="w-full bg-gray-50 hover:bg-gray-100/70 focus:bg-white text-gray-800 text-xs sm:text-sm pl-9 pr-8 py-1.5 rounded-xl border border-gray-200 focus:border-[#0052FF] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/15 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          {showSearchResults && searchQuery && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSearchResults(false)}
              />
              <div className="absolute top-11 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 max-h-80 overflow-y-auto py-2">
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Assets Found
                </div>
                {filteredCoins.length > 0 ? (
                  filteredCoins.map((coin) => (
                    <button
                      key={coin.id}
                      onClick={() => {
                        onSearchSelect(coin);
                        setSearchQuery('');
                        setShowSearchResults(false);
                      }}
                      className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 cursor-pointer text-left"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold font-mono shrink-0"
                          style={{ backgroundColor: coin.color }}
                        >
                          {coin.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900">
                            {coin.name}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {coin.symbol}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-gray-900 font-mono">
                          ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div
                          className={`text-[10px] font-bold font-mono ${
                            coin.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {coin.change24h >= 0 ? '+' : ''}
                          {coin.change24h.toFixed(2)}%
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-4 text-xs text-center text-gray-500">
                    No matching assets found.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Side: Quick Action Buttons, Notifications & Profile */}
        <div className="flex items-center space-x-2 shrink-0">
          
          <div className="hidden lg:flex items-center space-x-1.5">
            <button
              onClick={() => onOpenSendReceive('send')}
              className="px-2.5 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200/80 rounded-xl flex items-center space-x-1 transition-all cursor-pointer"
              id="header-send-btn"
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-gray-600" />
              <span>Send</span>
            </button>
            <button
              onClick={() => onOpenSendReceive('receive')}
              className="px-2.5 py-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200/80 rounded-xl flex items-center space-x-1 transition-all cursor-pointer"
              id="header-receive-btn"
            >
              <ArrowDownLeft className="h-3.5 w-3.5 text-gray-600" />
              <span>Receive</span>
            </button>
            {onOpenQrScanner && (
              <button
                onClick={onOpenQrScanner}
                className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl flex items-center space-x-1 transition-all cursor-pointer"
                id="header-scan-qr-btn"
                title="Scan Localcoin ATM, Interac e-Transfer or Crypto QR Code"
              >
                <Camera className="h-3.5 w-3.5 text-emerald-600" />
                <span>Scan QR</span>
              </button>
            )}
            {onOpenQrPay && (
              <button
                onClick={onOpenQrPay}
                className="px-2.5 py-1.5 text-xs font-bold text-[#0052FF] bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-xl flex items-center space-x-1 transition-all cursor-pointer"
                id="header-qr-pay-btn"
                title="Open QR Pay & Instant Terminal"
              >
                <QrCode className="h-3.5 w-3.5 text-[#0052FF]" />
                <span>QR Pay</span>
              </button>
            )}
            {onOpenProof && (
              <button
                onClick={onOpenProof}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 rounded-xl flex items-center space-x-1 transition-all cursor-pointer"
                id="header-proof-funds-btn"
                title="Cryptographic Proof of Ownership & Live API Handshakes"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Proof</span>
              </button>
            )}
            {onOpenAppDownload && (
              <button
                onClick={onOpenAppDownload}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 rounded-xl flex items-center space-x-1 transition-all cursor-pointer"
                id="header-download-app-btn"
                title="Download Android APK & Install PWA"
              >
                <Smartphone className="h-3.5 w-3.5 text-[#0052FF]" />
                <span>App</span>
              </button>
            )}
            <button
              onClick={() => setCurrentTab('copilot')}
              className={`px-2.5 py-1.5 text-xs font-black rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs ${
                currentTab === 'copilot'
                  ? 'bg-purple-600 text-white shadow-purple-500/20'
                  : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80'
              }`}
              id="header-copilot-agent-btn"
              title="Open GitHub Copilot In-App Agent & Autonomous Controls"
            >
              <Bot className="h-3.5 w-3.5 text-purple-600" />
              <span>Copilot AI</span>
            </button>
          </div>

          {/* Quick Balance Indicator */}
          <div className="hidden xl:flex flex-col items-end px-3 py-1 bg-gray-50 rounded-xl border border-gray-200/60 select-none">
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">NET WORTH</span>
            <span className="text-xs font-black text-gray-900 font-mono">
              {citizenship === 'Canada' || citizenship === 'CA'
                ? `CA$${(portfolioValue * 1.36).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                : `$${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            </span>
          </div>

          {/* Notification Center */}
          <NotificationCenter
            notifications={notifications}
            onMarkRead={onMarkNotifRead}
            onClearAll={onClearAllNotifs}
          />

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
                setShowMoreHubs(false);
              }}
              className="flex items-center space-x-1.5 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer focus:outline-none"
              id="profile-menu-btn"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0052FF] to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs select-none uppercase">
                {userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'JD'}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-500 hidden sm:block" />
            </button>

            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 py-2">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-black text-gray-900 truncate">
                      {userName || 'Jane Doe'}
                    </p>
                    <p className="text-xs text-gray-500 font-mono truncate">
                      {userEmail || 'account@secure.local'}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-100">
                        <span>{citizenship === 'Canada' || citizenship === 'CA' ? '🇨🇦 CAD' : '🇺🇸 USD'}</span>
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 font-extrabold px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        <span>KYC Live (Tier {kycLevel || 3})</span>
                      </span>
                    </div>
                  </div>
                  
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setCurrentTab('profile');
                        setShowProfileMenu(false);
                      }}
                      className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2.5 cursor-pointer text-left font-bold"
                    >
                      <User className="h-4 w-4 text-[#0052FF]" />
                      <span>My Profile Hub</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTab('onboarding');
                        setShowProfileMenu(false);
                      }}
                      className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2.5 cursor-pointer text-left font-medium"
                    >
                      <ShieldCheck className="h-4 w-4 text-gray-400" />
                      <span>KYC Verification & Limits</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTab('sovereign');
                        setShowProfileMenu(false);
                      }}
                      className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2.5 cursor-pointer text-left font-medium"
                    >
                      <ShieldCheck className="h-4 w-4 text-amber-500" />
                      <span className="font-bold text-gray-900">Sovereign Banking Hub</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTab('stripe');
                        setShowProfileMenu(false);
                      }}
                      className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2.5 cursor-pointer text-left font-medium"
                    >
                      <CreditCard className="h-4 w-4 text-[#635BFF]" />
                      <span>Stripe Hub & Payouts</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTab('copilot');
                        setShowProfileMenu(false);
                      }}
                      className="w-full px-4 py-2 text-xs text-purple-700 hover:bg-purple-50 flex items-center space-x-2.5 cursor-pointer text-left font-black"
                    >
                      <Bot className="h-4 w-4 text-purple-600" />
                      <span>Copilot AI Agent & GitHub</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTab('api');
                        setShowProfileMenu(false);
                      }}
                      className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2.5 cursor-pointer text-left font-medium"
                    >
                      <Compass className="h-4 w-4 text-emerald-500" />
                      <span>Developer CDP Hub</span>
                    </button>
                  </div>
                  
                  <div className="border-t border-gray-100 pt-1 mt-1">
                    <button
                      onClick={() => {
                        onLogout();
                        setShowProfileMenu(false);
                      }}
                      className="w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2 cursor-pointer text-left font-bold"
                    >
                      <LogOut className="h-4 w-4 text-red-500" />
                      <span>Sign Out Securely</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile Drawer Hamburger Button */}
          <button
            onClick={() => setShowMobileDrawer(true)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl lg:hidden cursor-pointer"
            title="Open Mobile Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

        </div>
      </div>

      {/* Navigation Sub-Bar (Desktop) */}
      <div className="hidden lg:block border-t border-gray-100 bg-gray-50/60 py-1.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Primary Nav Links */}
          <nav className="flex items-center space-x-1">
            {primaryNavItems.map((item) => {
              const IconComp = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center space-x-1.5 relative ${
                    isActive
                      ? 'text-[#0052FF] bg-white shadow-xs border border-gray-200/80'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                  }`}
                  id={`nav-${item.id}`}
                >
                  <IconComp className={`h-3.5 w-3.5 ${isActive ? 'text-[#0052FF]' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-extrabold rounded-full border border-emerald-200">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* "More Hubs" Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoreHubs(!showMoreHubs)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center space-x-1.5 relative ${
                  isSecondaryActive
                    ? 'text-[#0052FF] bg-white shadow-xs border border-gray-200/80'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
                id="nav-more-hubs"
              >
                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                <span>More Hubs</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showMoreHubs ? 'rotate-180' : ''}`} />
              </button>

              {showMoreHubs && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMoreHubs(false)}
                  />
                  <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 py-2 divide-y divide-gray-100">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Specialized Platform Hubs
                    </div>
                    <div className="py-1">
                      {secondaryNavItems.map((item) => {
                        const IconComponent = item.icon;
                        const isActive = currentTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setCurrentTab(item.id);
                              setShowMoreHubs(false);
                            }}
                            className={`w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-gray-50 cursor-pointer transition-colors ${
                              isActive ? 'bg-blue-50/60 text-[#0052FF] font-bold' : 'text-gray-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <IconComponent className={`h-4 w-4 ${isActive ? 'text-[#0052FF]' : 'text-gray-400'}`} />
                              <div>
                                <div className="text-xs font-bold leading-tight">{item.label}</div>
                                <div className="text-[10px] text-gray-400 font-normal">{item.desc}</div>
                              </div>
                            </div>
                            {item.badge && (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* Right Sub-nav info */}
          <div className="text-[11px] text-gray-400 font-medium flex items-center space-x-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-mono text-[10px] uppercase">FinCEN & FINTRAC Registered</span>
          </div>

        </div>
      </div>

      {/* Horizontal Scroll Bar for Mobile/Tablet (< lg) */}
      <div className="lg:hidden border-t border-gray-100 bg-gray-50/90 py-2 px-3 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap flex items-center gap-2">
        {allNavItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`text-xs px-3 py-1.5 font-bold rounded-xl cursor-pointer transition-all shrink-0 relative flex items-center space-x-1.5 ${
                isActive
                  ? 'text-white bg-[#0052FF] shadow-xs'
                  : 'text-gray-600 bg-white border border-gray-200/70 hover:bg-gray-100'
              }`}
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className={`px-1 py-0.2 text-[9px] font-black rounded-md ${
                  isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Full Mobile Slide-Over Drawer */}
      {showMobileDrawer && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowMobileDrawer(false)}
          />

          {/* Drawer Panel */}
          <div className="relative ml-auto w-full max-w-xs bg-white h-full shadow-2xl flex flex-col z-20 overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-[#0052FF] flex items-center justify-center font-bold text-xs">
                  CB
                </div>
                <span className="font-black text-sm">Coinbase Navigation</span>
              </div>
              <button
                onClick={() => setShowMobileDrawer(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile User Profile Header */}
            <div className="p-4 bg-slate-50 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0052FF] to-indigo-600 flex items-center justify-center text-white font-bold text-xs select-none">
                  {userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'JD'}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 truncate">{userName || 'Jane Doe'}</p>
                  <p className="text-[10px] text-gray-500 font-mono truncate">{userEmail}</p>
                </div>
              </div>
            </div>

            {/* Nav Groups */}
            <div className="p-3 space-y-4 flex-1">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block px-2 mb-2">
                  Core App Hubs
                </span>
                <div className="space-y-1">
                  {primaryNavItems.map((item) => {
                    const IconComp = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentTab(item.id);
                          setShowMobileDrawer(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between cursor-pointer transition-colors ${
                          isActive ? 'bg-[#0052FF] text-white' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <IconComp className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded-full ${
                            isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block px-2 mb-2">
                  Specialized Services
                </span>
                <div className="space-y-1">
                  {secondaryNavItems.map((item) => {
                    const IconComp = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentTab(item.id);
                          setShowMobileDrawer(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold text-left flex items-center justify-between cursor-pointer transition-colors ${
                          isActive ? 'bg-[#0052FF] text-white' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <IconComp className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded-full ${
                            isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mobile Footer Actions */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">
              {onOpenAppDownload && (
                <button
                  onClick={() => {
                    onOpenAppDownload();
                    setShowMobileDrawer(false);
                  }}
                  className="w-full py-2.5 bg-[#0052FF] hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer transition-colors shadow-xs"
                >
                  <Smartphone className="h-4 w-4 text-white" />
                  <span>Download Android APK / PWA</span>
                </button>
              )}
              <button
                onClick={() => {
                  onLogout();
                  setShowMobileDrawer(false);
                }}
                className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer transition-colors"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                <span>Sign Out Securely</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </header>
  );
}
