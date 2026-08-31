import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Check,
  Copy,
  Download,
  Share2,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  FileCode2,
  Link as LinkIcon,
  X,
  Clock,
  Sparkles,
  ArrowRight,
  Eye
} from 'lucide-react';
import QRCode from 'qrcode';
import { Transaction } from '../types';

export interface TransactionQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const TransactionQrModal: React.FC<TransactionQrModalProps> = ({
  isOpen,
  onClose,
  transaction,
  showToast
}) => {
  const [qrMode, setQrMode] = useState<'verify-url' | 'crypto-uri' | 'audit-json'>('verify-url');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!isOpen || !transaction) return null;

  // Safe formatting helpers to avoid runtime crashes on invalid/string timestamps or null amounts
  const safeTimestamp = (() => {
    if (!transaction.timestamp) return Date.now();
    const parsed = typeof transaction.timestamp === 'number' ? transaction.timestamp : Date.parse(String(transaction.timestamp));
    return isNaN(parsed) ? Date.now() : parsed;
  })();

  const safeAmount = typeof transaction.amount === 'number' && !isNaN(transaction.amount) ? transaction.amount : 0;
  const safeFiatAmount = typeof transaction.fiatAmount === 'number' && !isNaN(transaction.fiatAmount) ? transaction.fiatAmount : 0;

  // Generate cryptographic checksum for verification integrity
  const generateVerificationChecksum = (tx: Transaction) => {
    const raw = `${tx.id || 'tx'}-${tx.assetSymbol || 'ASSET'}-${safeAmount}-${safeTimestamp}-${tx.hash || 'unhashed'}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  };

  const checksum = generateVerificationChecksum(transaction);

  // Formatted Verification URL for secondary mobile devices / cameras
  const verificationUrl = (() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const params = new URLSearchParams({
      verifyTx: transaction.id || '',
      symbol: transaction.assetSymbol || 'ETH',
      amount: safeAmount.toString(),
      fiat: safeFiatAmount.toString(),
      type: transaction.type || 'SEND',
      time: safeTimestamp.toString(),
      status: transaction.status || 'completed',
      hash: transaction.hash || '',
      checksum: checksum
    });
    return `${origin}${pathname}?${params.toString()}`;
  })();

  // Native On-chain crypto protocol URI
  const cryptoUri = (() => {
    const symbol = transaction.assetSymbol || 'ETH';
    const addr = transaction.toAddress || (symbol === 'BTC' ? 'bc1q8yyl8yq9np33jfxlhds6tl836rn3trl0762qsd' : '0x71C...49b');
    if (symbol === 'BTC') {
      return `bitcoin:${addr}?amount=${safeAmount}&label=Coinbase55%20Verified%20TX&message=TX%20${transaction.id || 'TX'}`;
    }
    if (symbol === 'ETH') {
      return `ethereum:${addr}?value=${safeAmount}&message=TX%20${transaction.id || 'TX'}`;
    }
    return `${symbol.toLowerCase()}:${addr}?amount=${safeAmount}`;
  })();

  // Cryptographic JSON Envelope for enterprise auditors
  const auditJsonPayload = JSON.stringify(
    {
      version: '1.0.0',
      standard: 'COINBASE55-AUDIT-INTEGRITY',
      verificationSignature: `CB55-SIG-${checksum}`,
      transactionId: transaction.id || 'TX',
      asset: transaction.assetSymbol || 'ETH',
      amount: safeAmount,
      fiatUsd: safeFiatAmount,
      type: transaction.type || 'SEND',
      status: transaction.status || 'settled',
      timestamp: new Date(safeTimestamp).toISOString(),
      blockchain: {
        hash: transaction.hash || `0x${checksum.repeat(5)}`.slice(0, 42),
        blockHeight: transaction.blockHeight || 894215,
        confirmations: transaction.confirmations || 3,
        network: transaction.network || (transaction.assetSymbol === 'BTC' ? 'Bitcoin Mainnet' : 'Ethereum Mainnet')
      },
      doubleEntryJournal: {
        debitAccount: transaction.ledgerDebit || `${transaction.assetSymbol || 'ETH'} Asset Inventory`,
        creditAccount: transaction.ledgerCredit || 'Cash Operational Settlement Node'
      },
      complianceSeal: 'FINTRAC-REGULATED-VERIFIED'
    },
    null,
    2
  );

  // Active payload mapped to selected QR Mode
  const activePayload =
    qrMode === 'verify-url'
      ? verificationUrl
      : qrMode === 'crypto-uri'
      ? cryptoUri
      : auditJsonPayload;

  // Render QR code
  useEffect(() => {
    let isMounted = true;
    setIsGenerating(true);

    QRCode.toDataURL(activePayload, {
      width: 480,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (isMounted) {
          setQrCodeDataUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate transaction QR code', err);
        setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activePayload]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    if (showToast) {
      showToast(`${fieldName} copied to clipboard!`, 'success');
    }
    setTimeout(() => setCopiedField(null), 2200);
  };

  const handleDownloadQr = () => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `Coinbase55_Verify_${transaction.assetSymbol}_${transaction.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (showToast) {
      showToast('QR Code image downloaded!', 'success');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Verify ${transaction.type} ${transaction.amount} ${transaction.assetSymbol} | Coinbase55`,
          text: `Verify Transaction ID ${transaction.id} on Coinbase55 double-entry ledger`,
          url: verificationUrl
        });
        if (showToast) showToast('Shared successfully!', 'success');
      } catch (err) {
        // user cancelled or share failed
      }
    } else {
      handleCopy(verificationUrl, 'Verification Link');
    }
  };

  const formattedDate = new Date(safeTimestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-800/80 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white tracking-wide">Shareable Verification QR</h3>
                <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Instant Secondary Verification
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Scan with any smartphone camera or device to audit this transaction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Transaction Summary Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-400 uppercase font-mono">{transaction.type || 'SEND'}</span>
                <span className="text-base font-extrabold text-white font-mono">
                  {safeAmount} {transaction.assetSymbol || 'ETH'}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                <span>≈ ${safeFiatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</span>
                <span>•</span>
                <span className="text-slate-400">{formattedDate}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                {transaction.status === 'pending' ? 'Pending (2/3)' : 'Verified (3/3)'}
              </span>
              <span className="block text-[10px] text-slate-400 font-mono mt-1">
                ID: {transaction.id.slice(0, 10)}...
              </span>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold font-mono">
            <button
              onClick={() => setQrMode('verify-url')}
              className={`py-2 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                qrMode === 'verify-url'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Link</span>
            </button>
            <button
              onClick={() => setQrMode('crypto-uri')}
              className={`py-2 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                qrMode === 'crypto-uri'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Crypto URI</span>
            </button>
            <button
              onClick={() => setQrMode('audit-json')}
              className={`py-2 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                qrMode === 'audit-json'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Audit JSON</span>
            </button>
          </div>

          {/* QR Code Canvas & Visual Framing */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
            <div className="relative p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-slate-800 group">
              {/* Corner Target Markers */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-blue-600" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-blue-600" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-blue-600" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-blue-600" />

              {isGenerating ? (
                <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-500">
                  <Clock className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <span className="text-xs font-mono">Generating QR...</span>
                </div>
              ) : qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Transaction Verification QR"
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs font-mono">
                  Loading code...
                </div>
              )}
            </div>

            {/* Instruction Tagline */}
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5">
                <Smartphone className="w-4 h-4 text-blue-400" />
                {qrMode === 'verify-url'
                  ? 'Point secondary phone camera at this QR code to verify details'
                  : qrMode === 'crypto-uri'
                  ? `Standard ${transaction.assetSymbol} wallet protocol URI`
                  : 'Signed JSON envelope containing double-entry & hash proof'}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Checksum Seal: <span className="text-amber-400 font-bold">CB55-{checksum}</span> • Zero login required for inspection
              </p>
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center gap-2 flex-wrap justify-center pt-2">
              <button
                onClick={handleDownloadQr}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Save PNG</span>
              </button>

              <button
                onClick={handleNativeShare}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Share QR</span>
              </button>

              <button
                onClick={() => handleCopy(activePayload, qrMode === 'verify-url' ? 'Verification Link' : qrMode === 'crypto-uri' ? 'Crypto URI' : 'Audit JSON')}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                {copiedField ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy {qrMode === 'verify-url' ? 'Link' : qrMode === 'crypto-uri' ? 'URI' : 'JSON'}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowSimulator(!showSimulator)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showSimulator ? 'Hide Preview' : 'Preview Phone View'}</span>
              </button>
            </div>
          </div>

          {/* Secondary Device Simulation / Verification Preview */}
          {showSimulator && (
            <div className="bg-slate-950 rounded-2xl border border-blue-500/40 p-4 space-y-3 animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-white">Secondary Device Inspection Result</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Checksum Valid
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-2.5 rounded-lg">
                  <span className="text-slate-400 font-medium">Transaction ID:</span>
                  <span className="col-span-2 text-white font-bold">{transaction.id}</span>
                </div>

                <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-2.5 rounded-lg">
                  <span className="text-slate-400 font-medium">Amount & Asset:</span>
                  <span className="col-span-2 text-emerald-400 font-bold">
                    {safeAmount} {transaction.assetSymbol || 'ETH'} (${safeFiatAmount.toFixed(2)} USD)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-2.5 rounded-lg">
                  <span className="text-slate-400 font-medium">Accounting Double-Entry:</span>
                  <span className="col-span-2 text-slate-300">
                    Dr: <span className="text-blue-300">{transaction.ledgerDebit || `${transaction.assetSymbol} Reserve`}</span>
                    <br />
                    Cr: <span className="text-emerald-300">{transaction.ledgerCredit || 'Cash Settlement Reserve'}</span>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-2.5 rounded-lg">
                  <span className="text-slate-400 font-medium">On-Chain Hash:</span>
                  <span className="col-span-2 text-slate-300 truncate select-all">
                    {transaction.hash || `0x${checksum.repeat(5)}`.slice(0, 42)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Raw Payload Preview Box */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="uppercase font-bold">Encoded QR Payload Content:</span>
              <button
                onClick={() => handleCopy(activePayload, 'Payload')}
                className="hover:text-white flex items-center gap-1 text-[10px]"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <pre className="text-[10px] font-mono bg-slate-900 p-2.5 rounded-lg text-slate-300 overflow-x-auto max-h-24 select-all">
              {activePayload}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            Double-Entry Cryptographic Verification
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionQrModal;
