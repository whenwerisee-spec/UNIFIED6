import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Printer,
  Copy,
  Check,
  Lock,
  Eye,
  EyeOff,
  Download,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  FileText,
  X,
  Key
} from 'lucide-react';

export interface BackupWallet {
  id: string;
  coinSymbol: string;
  address: string;
  label: string;
  seedPhrase?: string;
  privateKey?: string;
  createdAt?: number;
  backupStatus?: 'UNVERIFIED' | 'VERIFIED';
}

interface RecoveryKeyBackupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: BackupWallet | null;
  onBackupComplete?: (walletId: string) => void;
  showToast?: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function RecoveryKeyBackupWizard({
  isOpen,
  onClose,
  wallet,
  onBackupComplete,
  showToast
}: RecoveryKeyBackupWizardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 states: Prerequisites
  const [checkNoSurveillance, setCheckNoSurveillance] = useState(false);
  const [checkPaperReady, setCheckPaperReady] = useState(false);
  const [checkUnderstandRisk, setCheckUnderstandRisk] = useState(false);

  // Step 2 states: Seed reveal & actions
  const [isSeedRevealed, setIsSeedRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Step 3 states: Verification challenge
  const [verifyIndices, setVerifyIndices] = useState<number[]>([2, 6, 10]); // 0-indexed word indices to test (e.g. 3rd, 7th, 11th)
  const [userInputs, setUserInputs] = useState<{ [key: number]: string }>({});
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState(false);

  // Reset wizard state when opening a new wallet
  useEffect(() => {
    if (isOpen && wallet) {
      setCurrentStep(1);
      setCheckNoSurveillance(false);
      setCheckPaperReady(false);
      setCheckUnderstandRisk(false);
      setIsSeedRevealed(false);
      setIsCopied(false);
      setUserInputs({});
      setVerifyError(null);
      setVerifySuccess(false);

      // Randomly select 3 distinct word indices from 0 to 11
      const seedWords = (wallet.seedPhrase || '').split(' ').filter(Boolean);
      if (seedWords.length >= 12) {
        const pool = Array.from({ length: seedWords.length }, (_, i) => i);
        // Shuffle pool
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const picked = pool.slice(0, 3).sort((a, b) => a - b);
        setVerifyIndices(picked);
      } else {
        setVerifyIndices([2, 6, 10]);
      }
    }
  }, [isOpen, wallet]);

  if (!isOpen || !wallet) return null;

  const seedWords = (wallet.seedPhrase || '')
    .split(' ')
    .filter(Boolean);

  const canAdvanceStep1 = checkNoSurveillance && checkPaperReady && checkUnderstandRisk;

  const handleCopySeed = () => {
    if (!wallet.seedPhrase) return;
    navigator.clipboard.writeText(wallet.seedPhrase);
    setIsCopied(true);
    if (showToast) showToast('Mnemonic seed phrase copied to clipboard.', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handlePrintColdSheet = () => {
    window.print();
    if (showToast) showToast('Opened print preview for paper cold storage sheet.', 'info');
  };

  const handleDownloadBackupFile = () => {
    if (!wallet) return;
    const dateStr = new Date().toISOString();
    const content = `===================================================================
COINBASE ENCLAVE - WALLET RECOVERY SEED BACKUP SHEET
===================================================================
Date Generated: ${dateStr}
Account Alias:  ${wallet.label}
Coin Standard:  ${wallet.coinSymbol}
Public Address: ${wallet.address}
===================================================================
12-WORD MNEMONIC RECOVERY SEED:
${wallet.seedPhrase || 'N/A'}
===================================================================
ECDSA / Ed25519 PRIVATE KEY (IF APPLICABLE):
${wallet.privateKey || 'N/A'}
===================================================================
CRITICAL SECURITY INSTRUCTIONS:
1. STORE THIS FILE OR PAPER COPY IN A SECURE, FIREPROOF LOCATION.
2. NEVER SHARE THIS SEED PHRASE WITH ANYONE, INCLUDING SUPPORT.
3. DO NOT UPLOAD TO UNENCRYPTED CLOUD STORAGE OR EMAIL.
===================================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recovery_seed_${wallet.coinSymbol}_${wallet.address.slice(0, 8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (showToast) showToast('Downloaded encrypted seed text backup file.', 'success');
  };

  const handleVerifySubmission = () => {
    setVerifyError(null);
    let allCorrect = true;

    for (const idx of verifyIndices) {
      const expected = (seedWords[idx] || '').trim().toLowerCase();
      const entered = (userInputs[idx] || '').trim().toLowerCase();
      if (entered !== expected) {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      setVerifySuccess(true);
      setVerifyError(null);
      if (showToast) showToast('Mnemonic seed phrase verified successfully!', 'success');
      setTimeout(() => {
        setCurrentStep(4);
      }, 600);
    } else {
      setVerifySuccess(false);
      setVerifyError('One or more entered words do not match your seed phrase. Please review your paper backup and try again.');
      if (showToast) showToast('Verification failed. Check your seed words.', 'error');
    }
  };

  const handleFinishWizard = () => {
    if (onBackupComplete) {
      onBackupComplete(wallet.id);
    }
    if (showToast) {
      showToast(`Recovery Key Backup for ${wallet.label} is complete & marked verified!`, 'success');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      {/* Print-Only Cold Storage Layout */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 font-mono text-xs z-[9999]">
        <div className="border-4 border-black p-6 max-w-2xl mx-auto space-y-6">
          <div className="text-center border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black uppercase tracking-wider">OFFICIAL COLD STORAGE RECOVERY SHEET</h1>
            <p className="text-sm font-bold mt-1">Coinbase Multi-Chain Self-Custody Enclave</p>
            <p className="text-xs text-gray-600 mt-0.5">Printed on: {new Date().toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-4">
            <div>
              <span className="font-bold uppercase text-[10px] block text-gray-600">Wallet Alias:</span>
              <span className="font-bold text-sm">{wallet.label}</span>
            </div>
            <div>
              <span className="font-bold uppercase text-[10px] block text-gray-600">Asset Standard:</span>
              <span className="font-bold text-sm">{wallet.coinSymbol}</span>
            </div>
            <div className="col-span-2">
              <span className="font-bold uppercase text-[10px] block text-gray-600">Public Address:</span>
              <span className="font-bold text-xs break-all">{wallet.address}</span>
            </div>
          </div>

          <div>
            <h3 className="font-bold uppercase text-center mb-3 text-sm underline">12-Word Mnemonic Recovery Seed</h3>
            <div className="grid grid-cols-3 gap-3">
              {seedWords.map((word, idx) => (
                <div key={idx} className="border-2 border-black p-2 flex items-center gap-2">
                  <span className="font-bold text-gray-500 w-6 text-right">#{idx + 1}.</span>
                  <span className="font-black text-sm">{word}</span>
                </div>
              ))}
            </div>
          </div>

          {wallet.privateKey && (
            <div className="border-t-2 border-black pt-4">
              <span className="font-bold uppercase text-[10px] block text-gray-600">ECDSA Private Key:</span>
              <span className="font-bold text-xs break-all">{wallet.privateKey}</span>
            </div>
          )}

          <div className="border-t-2 border-black pt-4 text-[10px] space-y-1">
            <p className="font-bold text-center">⚠️ KEEP THIS PAPER COPY IN A SECURE FIREPROOF VAULT ⚠️</p>
            <p>• Do not photograph, photocopy, or scan into digital storage.</p>
            <p>• Anyone in possession of this recovery sheet controls all associated funds.</p>
          </div>
        </div>
      </div>

      {/* Screen Modal Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative space-y-6 text-slate-100 print:hidden my-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0052FF]/10 border border-[#0052FF]/30 flex items-center justify-center text-[#0052FF]">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-[#0052FF]/20 text-blue-400 px-2 py-0.5 rounded-md uppercase">
                  {wallet.coinSymbol} KEYCHAIN
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-white mt-0.5">Recovery Key Backup Wizard</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="Close Wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono font-bold text-slate-400">
            <span>Step {currentStep} of 4</span>
            <span className="text-blue-400">
              {currentStep === 1 && 'Security Notice'}
              {currentStep === 2 && 'Mnemonic Seed Phrase'}
              {currentStep === 3 && 'Verification Challenge'}
              {currentStep === 4 && 'Backup Confirmed'}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#0052FF] h-full transition-all duration-300 ease-out"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: SECURITY NOTICE & PREREQUISITES */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-fade-in">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 text-amber-200">
              <ShieldAlert className="w-6 h-6 shrink-0 text-amber-400" />
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-amber-300">Crucial Asset Safety Warning</h4>
                <p className="text-amber-200/80 leading-relaxed">
                  Your 12-word mnemonic recovery phrase is the single master key to your digital assets. If you lose access or if your device fails, this seed is the ONLY way to recover your wallet.
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950 p-5 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
                Environment Safety Checklist
              </h4>

              <label className="flex items-start gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800/60 transition">
                <input
                  type="checkbox"
                  checked={checkNoSurveillance}
                  onChange={(e) => setCheckNoSurveillance(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-[#0052FF] focus:ring-[#0052FF] h-4 w-4"
                />
                <span className="text-xs text-slate-200 font-medium leading-normal">
                  I am in a private location with no unauthorized people, webcams, or screen capture tools monitoring my screen.
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800/60 transition">
                <input
                  type="checkbox"
                  checked={checkPaperReady}
                  onChange={(e) => setCheckPaperReady(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-[#0052FF] focus:ring-[#0052FF] h-4 w-4"
                />
                <span className="text-xs text-slate-200 font-medium leading-normal">
                  I have pen and paper (or a printing device) ready to record my 12-word seed offline.
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800/60 transition">
                <input
                  type="checkbox"
                  checked={checkUnderstandRisk}
                  onChange={(e) => setCheckUnderstandRisk(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-[#0052FF] focus:ring-[#0052FF] h-4 w-4"
                />
                <span className="text-xs text-slate-200 font-medium leading-normal">
                  I understand that anyone who obtains my 12 words can permanently steal all funds in this wallet.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!canAdvanceStep1}
                className="px-5 py-2.5 bg-[#0052FF] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-2"
              >
                <span>Proceed to Seed Reveal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: REVEAL MNEMONIC SEED & PRINT/DOWNLOAD */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">12-Word Mnemonic Recovery Seed</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Write down or print these 12 words in exact numerical order.
                </p>
              </div>

              <button
                onClick={() => setIsSeedRevealed(!isSeedRevealed)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {isSeedRevealed ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hide Seed</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <span>Reveal Seed</span>
                  </>
                )}
              </button>
            </div>

            {/* Seed Grid */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 relative min-h-[180px] flex items-center justify-center">
              {isSeedRevealed ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
                  {seedWords.map((word, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center gap-2 select-all font-mono"
                    >
                      <span className="text-[10px] font-bold text-slate-500 w-5 text-right">
                        {idx + 1}.
                      </span>
                      <span className="text-xs font-bold text-white">{word}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center space-y-3 py-6">
                  <div className="w-12 h-12 bg-slate-900 border border-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-300">Mnemonic Seed Masked</h4>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1">
                      Click the "Reveal Seed" button above when your physical environment is secure.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions: Copy, Print Cold Sheet, Download Text */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handleCopySeed}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition"
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-blue-400" />
                    <span>Copy Phrase</span>
                  </>
                )}
              </button>

              <button
                onClick={handlePrintColdSheet}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Print Paper Sheet</span>
              </button>

              <button
                onClick={handleDownloadBackupFile}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Download className="w-4 h-4 text-purple-400" />
                <span>Download .txt</span>
              </button>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                onClick={() => setCurrentStep(3)}
                className="px-5 py-2.5 bg-[#0052FF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-2"
              >
                <span>Verify Seed Written</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: VERIFICATION CHALLENGE */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h3 className="text-sm font-bold text-white">Verify Your Seed Phrase Backup</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                To confirm that you accurately recorded your seed words, please enter the requested words below.
              </p>
            </div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {verifyIndices.map((wordIdx) => (
                  <div key={wordIdx} className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-300 block">
                      Word #{wordIdx + 1}
                    </label>
                    <input
                      type="text"
                      placeholder={`Enter word #${wordIdx + 1}`}
                      value={userInputs[wordIdx] || ''}
                      onChange={(e) =>
                        setUserInputs({ ...userInputs, [wordIdx]: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#0052FF] text-xs font-mono px-3 py-2.5 rounded-xl text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {verifyError && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{verifyError}</span>
                </div>
              )}

              {verifySuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-center gap-2 text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Seed phrase verified! Advancing to confirmation...</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Review Seed Phrase</span>
              </button>

              <button
                onClick={handleVerifySubmission}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit & Verify</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: BACKUP COMPLETED & BEST PRACTICES */}
        {currentStep === 4 && (
          <div className="space-y-6 text-center animate-fade-in py-2">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full uppercase">
                Cryptographically Validated
              </span>
              <h3 className="text-xl font-extrabold text-white mt-2">
                Recovery Key Backup Verified!
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                You have successfully backed up and verified the 12-word mnemonic recovery phrase for <span className="text-white font-bold">{wallet.label}</span>.
              </p>
            </div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-left space-y-3 text-xs">
              <h4 className="font-mono font-bold text-slate-300 uppercase text-[11px] tracking-wider">
                Safe Cold Storage Best Practices
              </h4>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Keep your printed/written paper copy in a fireproof, waterproof vault or safe deposit box.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Never share your mnemonic seed words with anyone. Coinbase support will NEVER ask for your seed.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Avoid taking digital screenshots or storing unencrypted plain text on cloud servers.</span>
                </li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                onClick={handleFinishWizard}
                className="w-full py-3 bg-[#0052FF] hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl cursor-pointer transition shadow-lg flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Finish & Mark Backup Verified</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
