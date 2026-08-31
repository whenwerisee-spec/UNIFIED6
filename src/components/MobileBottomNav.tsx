import React from 'react';
import { 
  Wallet, 
  ShieldCheck, 
  Landmark, 
  QrCode, 
  User, 
  Download,
  CreditCard
} from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenQrPay: () => void;
  onOpenQrScanner?: () => void;
  onOpenAppDownload: () => void;
  onOpenSendReceive: (action: 'send' | 'receive') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
  onOpenQrPay,
  onOpenQrScanner,
  onOpenAppDownload,
  onOpenSendReceive
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Assets',
      icon: Wallet
    },
    {
      id: 'sovereign',
      label: 'Vault & Proof',
      icon: ShieldCheck
    },
    {
      id: 'qr-pay-action',
      label: 'QR Pay',
      icon: QrCode,
      isAction: true
    },
    {
      id: 'bitcoin-atm',
      label: 'ATM Hub',
      icon: Landmark
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User
    }
  ];

  return (
    <nav
      id="mobile-bottom-navigation-bar"
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          if (item.isAction) {
            return (
              <button
                key={item.id}
                id="mobile-bottom-qr-pay-btn"
                onClick={onOpenQrPay}
                className="flex flex-col items-center justify-center -mt-5 cursor-pointer group focus:outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0052FF] to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 group-active:scale-95 transition-transform">
                  <QrCode className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-extrabold text-[#0052FF] mt-1 tracking-tight">
                  QR Pay
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              id={`mobile-nav-${item.id}`}
              onClick={() => setCurrentTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
                isActive
                  ? 'text-[#0052FF]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#0052FF] rounded-full" />
                )}
              </div>
              <span className={`text-[10px] tracking-tight mt-1 truncate max-w-[64px] ${isActive ? 'font-black text-[#0052FF]' : 'font-semibold text-slate-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
