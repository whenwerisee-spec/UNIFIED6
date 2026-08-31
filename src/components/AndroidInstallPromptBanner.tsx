import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, CheckCircle2, ShieldCheck, ExternalLink } from 'lucide-react';

interface AndroidInstallPromptBannerProps {
  onOpenAppDownloadModal: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AndroidInstallPromptBanner: React.FC<AndroidInstallPromptBannerProps> = ({
  onOpenAppDownloadModal,
  showToast
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);

  useEffect(() => {
    // Check if dismissed previously in session
    if (sessionStorage.getItem('dismiss_android_install_banner') === 'true') {
      setIsDismissed(true);
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPwaInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      showToast('Sovereign App successfully installed to your Android device!', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  if (isDismissed || isPwaInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          showToast('Installing Sovereign App to your home screen...', 'success');
          setIsPwaInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        onOpenAppDownloadModal();
      }
    } else {
      onOpenAppDownloadModal();
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('dismiss_android_install_banner', 'true');
  };

  return (
    <div
      id="android-install-prompt-banner"
      className="lg:hidden bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-3.5 py-2.5 border-b border-blue-800/40 shadow-sm relative z-30"
    >
      <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#0052FF] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-white truncate">Install Android App</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.2 rounded border border-emerald-500/40 shrink-0">
                1-Tap Install
              </span>
            </div>
            <p className="text-[10px] text-slate-300 truncate">
              Install to Home Screen & Download Package
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-[#0052FF] hover:bg-blue-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1 cursor-pointer min-h-[36px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss app banner"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AndroidInstallPromptBanner;
