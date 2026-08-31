import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Download,
  CheckCircle2,
  ShieldCheck,
  FolderGit2,
  Sparkles,
  Terminal,
  ExternalLink,
  PackageCheck,
  FileArchive,
  Info,
  Check,
  Copy,
  ArrowUpRight,
  AlertCircle
} from 'lucide-react';

interface AppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AppDownloadModal: React.FC<AppDownloadModalProps> = ({
  isOpen,
  onClose,
  showToast
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'pwa' | 'instructions' | 'sdk'>('pwa');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState<boolean>(false);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
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

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPwaInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  if (!isOpen) return null;

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          showToast('Sovereign App installed to your home screen!', 'success');
          setIsPwaInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    } else {
      if (isIframe) {
        window.open(window.location.href, '_blank');
        showToast('Opened in full browser tab! Tap menu (⋮) > "Install app" to install.', 'info');
      } else {
        showToast('To install: Tap the top-right menu (⋮) and tap "Install app" or "Add to Home Screen".', 'info');
      }
    }
  };

  const handleDownloadSdk = () => {
    const link = document.createElement('a');
    link.href = '/api/download/android-sdk';
    link.download = 'sovereign-android-sdk.zip';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloading complete Android Studio SDK (.zip)...', 'success');
  };

  const openInDirectBrowser = () => {
    window.open(window.location.href, '_blank');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(label);
    showToast(`Copied ${label} to clipboard`, 'info');
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-gray-100 space-y-5 relative animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-[#0052FF] rounded-2xl border border-blue-100 shrink-0">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-gray-900">Install Sovereign App</h2>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                  Android & iOS
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Install directly to your home screen with no APK parsing errors.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-gray-100 p-1 rounded-2xl space-x-1">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'pwa'
                ? 'bg-white text-[#0052FF] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>1-Tap Install</span>
          </button>
          <button
            onClick={() => setActiveTab('instructions')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'instructions'
                ? 'bg-white text-[#0052FF] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Info className="h-3.5 w-3.5" />
            <span>2-Step Guide</span>
          </button>
          <button
            onClick={() => setActiveTab('sdk')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'sdk'
                ? 'bg-white text-[#0052FF] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileArchive className="h-3.5 w-3.5" />
            <span>Developer SDK (.zip)</span>
          </button>
        </div>

        {/* TAB 1: 1-Tap Mobile Install */}
        {activeTab === 'pwa' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Parse Error Notice & Solution */}
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-black text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Zero Parse Errors — Installs as Real Android App</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                Do not open downloaded .apk files directly in Android files (which causes Android's "Problem parsing package" error). Instead, tap <strong>Install App Now</strong> below to install directly to your home screen!
              </p>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 relative overflow-hidden shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Standalone Android App Features
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                  {isPwaInstalled ? 'Installed' : 'Ready'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800">
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Full Screen (No Browser Bar)</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Home Screen App Icon</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Offline Ledger Access</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Biometric Passkeys & NFC</span>
                </div>
              </div>
            </div>

            {/* Main Action Button */}
            <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100 space-y-3">
              <div>
                <h4 className="text-xs font-black text-gray-900">
                  {isPwaInstalled ? 'Sovereign App is Installed' : 'Ready to Install on Your Device'}
                </h4>
                <p className="text-[11px] text-gray-600">
                  {isPwaInstalled
                    ? 'The app is running in standalone mode.'
                    : 'Tap below to trigger the Android system install dialog.'}
                </p>
              </div>

              <button
                onClick={handleInstallApp}
                className="w-full py-3.5 bg-[#0052FF] hover:bg-blue-700 active:scale-98 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>{deferredPrompt ? 'Install Sovereign App Now' : 'Install App to Phone'}</span>
              </button>

              {isIframe && (
                <button
                  onClick={openInDirectBrowser}
                  className="w-full py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <ArrowUpRight className="h-3.5 w-3.5 text-blue-600" />
                  <span>Open in Mobile Chrome / New Tab (For 1-Tap Prompt)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Step-by-Step Mobile Instructions */}
        {activeTab === 'instructions' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 shadow-md">
              <span className="text-xs font-extrabold text-blue-300 uppercase tracking-wider flex items-center">
                <Smartphone className="h-4 w-4 mr-1 text-blue-400" />
                2-Step Installation by Browser
              </span>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Follow these 2 simple steps on your mobile phone to install the app icon directly to your home screen:
              </p>
            </div>

            {/* Android Chrome Instructions */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <div className="font-extrabold text-gray-900 text-xs flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                <span>Google Chrome or Brave (Android):</span>
              </div>
              <ol className="list-decimal pl-6 text-[11px] text-gray-700 space-y-1">
                <li>Tap the <strong>⋮ (three vertical dots)</strong> in the top right corner of Chrome.</li>
                <li>Tap <strong>"Install app"</strong> (or <strong>"Add to Home screen"</strong>).</li>
                <li>Tap <strong>Install</strong> on the confirmation popup.</li>
              </ol>
            </div>

            {/* Samsung Internet Instructions */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <div className="font-extrabold text-gray-900 text-xs flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                <span>Samsung Internet:</span>
              </div>
              <ol className="list-decimal pl-6 text-[11px] text-gray-700 space-y-1">
                <li>Tap the <strong>≡ (menu icon)</strong> at the bottom right.</li>
                <li>Tap <strong>"+ Add page to"</strong> &gt; select <strong>"Home screen"</strong>.</li>
                <li>Tap <strong>Add</strong>.</li>
              </ol>
            </div>

            {/* iPhone Safari Instructions */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
              <div className="font-extrabold text-gray-900 text-xs flex items-center space-x-1.5">
                <span className="w-5 h-5 rounded-full bg-gray-800 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                <span>Apple Safari (iPhone / iPad):</span>
              </div>
              <ol className="list-decimal pl-6 text-[11px] text-gray-700 space-y-1">
                <li>Tap the <strong>Share button (square with arrow pointing up)</strong>.</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                <li>Tap <strong>Add</strong> at top right.</li>
              </ol>
            </div>
          </div>
        )}

        {/* TAB 3: Complete Android Studio SDK Project (.zip) */}
        {activeTab === 'sdk' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-400 uppercase tracking-wider flex items-center">
                  <FolderGit2 className="h-4 w-4 mr-1 text-blue-400" />
                  Full Android Studio SDK & Gradle Source (.zip)
                </span>
                <span className="text-[10px] bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full font-mono border border-blue-400/30">
                  Gradle 8.2 + Android 14
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                For developers who want to compile a signed APK file in Android Studio: Download the complete native Android project source archive containing <code className="bg-slate-800 text-blue-300 px-1 py-0.5 rounded font-mono text-[10px]">/android</code>, Gradle wrapper (<code className="text-blue-300">gradlew</code>), native Java activities, and biometrics security.
              </p>

              <button
                onClick={handleDownloadSdk}
                className="w-full py-3 bg-[#0052FF] hover:bg-blue-600 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-blue-900/30"
              >
                <Download className="h-4 w-4" />
                <span>Download sovereign-android-sdk.zip (282 KB)</span>
              </button>
            </div>

            {/* Build Terminal Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-slate-800 pb-2">
                <span className="flex items-center text-slate-300">
                  <Terminal className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
                  Android Studio / CLI Compilation
                </span>
                <span className="text-gray-500">Gradle Wrapper</span>
              </div>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-emerald-400 select-all">cd android && ./gradlew assembleDebug</span>
                  <button
                    onClick={() => copyToClipboard('cd android && ./gradlew assembleDebug', 'Build Command')}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {copiedCmd === 'Build Command' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Close */}
        <div className="pt-1">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppDownloadModal;
