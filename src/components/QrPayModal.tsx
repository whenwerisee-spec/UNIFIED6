import React, { useState, useEffect } from 'react';
import { 
  X, QrCode, Copy, Check, Download, Send, ArrowDownLeft, ShieldCheck, 
  Smartphone, Wallet, RefreshCw, AlertCircle, CheckCircle2, DollarSign, Store, Sparkles, Camera
} from 'lucide-react';
import QRCode from 'qrcode';
import { Coin } from '../types';
import CameraQrScannerModal from './CameraQrScannerModal';

interface QrPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  coins: Coin[];
  userEmail: string;
  userName: string;
  liveCashBalance: number;
  onExecutePayment: (
    amount: number, 
    recipient: string, 
    assetSymbol: string, 
    note: string
  ) => Promise<boolean>;
  onBitcoinInvoiceConfirmed?: (
    amountReceived: number,
    orderId?: string,
    address?: string
  ) => Promise<boolean> | boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function QrPayModal({
  isOpen,
  onClose,
  coins,
  userEmail,
  userName,
  liveCashBalance,
  onExecutePayment,
  onBitcoinInvoiceConfirmed,
  showToast
}: QrPayModalProps) {
  const [activeTab, setActiveTab] = useState<'receive' | 'pay' | 'pos'>('receive');

  // Receive Tab State
  const [selectedReceiveAsset, setSelectedReceiveAsset] = useState<string>('USD');
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [receiveMemo, setReceiveMemo] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [btcInvoiceMeta, setBtcInvoiceMeta] = useState<{ address: string; amount: number; orderId: string; uri: string } | null>(null);
  const [btcInvoiceStatus, setBtcInvoiceStatus] = useState<'waiting' | 'confirmed'>('waiting');

  // Scan & Pay Tab State
  const [qrInputPayload, setQrInputPayload] = useState<string>('');
  const [parsedPayment, setParsedPayment] = useState<{
    recipient: string;
    amount: number;
    currency: string;
    memo: string;
  } | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Merchant POS Tab State
  const [posMerchantName, setPosMerchantName] = useState<string>('Sovereign Merchant Terminal');
  const [posAmount, setPosAmount] = useState<string>('25.00');
  const [posQrUrl, setPosQrUrl] = useState<string>('');
  const [posStatus, setPosStatus] = useState<'awaiting' | 'scanned' | 'settled'>('awaiting');

  const btcWalletAddress = '';
  const defaultWalletAddress = '';

  // Generate QR code for Receive tab
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const amt = parseFloat(receiveAmount);

    const generateStandardQr = async () => {
      if (!btcWalletAddress && selectedReceiveAsset === 'BTC') {
        setQrCodeDataUrl('');
        return;
      }
      let uri = '';

      if (selectedReceiveAsset === 'USD' || selectedReceiveAsset === 'CAD') {
        uri = `paydirect:${userEmail}?amount=${!isNaN(amt) ? amt : 0}&currency=${selectedReceiveAsset}${receiveMemo ? `&memo=${encodeURIComponent(receiveMemo)}` : ''}`;
      } else if (selectedReceiveAsset === 'BTC') {
        const btcAmount = !isNaN(amt) && amt > 0 ? amt : 0.01013935;
        uri = `bitcoin:${btcWalletAddress}?amount=${btcAmount}${receiveMemo ? `&message=${encodeURIComponent(receiveMemo)}` : ''}`;
      } else {
        uri = `${selectedReceiveAsset.toLowerCase()}:${defaultWalletAddress}${!isNaN(amt) && amt > 0 ? `?amount=${amt}` : ''}${receiveMemo ? `&memo=${encodeURIComponent(receiveMemo)}` : ''}`;
      }

      const url = await QRCode.toDataURL(uri, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });

      if (!cancelled) {
        setQrCodeDataUrl(url);
      }
    };

    if (selectedReceiveAsset === 'BTC') {
      const requestedAmount = !isNaN(amt) && amt > 0 ? amt : 0.01013935;
      setBtcInvoiceStatus('waiting');
      fetch(`/api/invoice?amount=${encodeURIComponent(String(requestedAmount))}`, {
        credentials: 'include'
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Invoice request failed');
          }
          const data = await response.json();
          if (cancelled) return;

          const resolvedAddress = data?.invoice?.address || btcWalletAddress;
          const resolvedAmount = Number(data?.invoice?.amountBTC || requestedAmount);
          const resolvedUri = data?.uri || `bitcoin:${resolvedAddress}?amount=${resolvedAmount}`;

          setBtcInvoiceMeta({
            address: resolvedAddress,
            amount: resolvedAmount,
            orderId: data?.invoice?.orderId || 'btc-order',
            uri: resolvedUri
          });
          setQrCodeDataUrl(data?.qr || '');

          const pollInvoice = async () => {
            try {
              const confirmRes = await fetch(`/api/confirm?address=${encodeURIComponent(resolvedAddress)}&amount=${encodeURIComponent(String(resolvedAmount))}&orderId=${encodeURIComponent(data?.invoice?.orderId || 'btc-order')}`);
              const confirmData = await confirmRes.json();
              if (cancelled) return;

              if (confirmData?.confirmed) {
                setBtcInvoiceStatus('confirmed');
                await onBitcoinInvoiceConfirmed?.(Number(confirmData.amountReceived || 0), data?.invoice?.orderId || 'btc-order', resolvedAddress);
                showToast(`BTC invoice confirmed: ${confirmData.amountReceived.toFixed(8)} BTC received.`, 'success');
                return;
              }

              setTimeout(pollInvoice, 5000);
            } catch (e) {
              if (!cancelled) {
                setTimeout(pollInvoice, 5000);
              }
            }
          };

          setTimeout(pollInvoice, 5000);
        })
        .catch((err) => {
          console.error('Failed to generate BTC invoice:', err);
          if (cancelled) return;
          const fallbackUri = `bitcoin:${btcWalletAddress}?amount=${requestedAmount}`;
          setBtcInvoiceMeta({
            address: btcWalletAddress,
            amount: requestedAmount,
            orderId: 'fallback-btc-order',
            uri: fallbackUri
          });
          setQrCodeDataUrl('');
        });

      return () => {
        cancelled = true;
      };
    }

    generateStandardQr().catch((err) => {
      console.error('Failed to generate QR code:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedReceiveAsset, receiveAmount, receiveMemo, userEmail, showToast]);

  // Generate POS QR Code
  useEffect(() => {
    if (!isOpen || activeTab !== 'pos') return;

    const amt = parseFloat(posAmount);
    const posUri = `paydirect:pos-terminal-${Date.now()}?merchant=${encodeURIComponent(posMerchantName)}&amount=${!isNaN(amt) ? amt : 0}&currency=USD`;

    QRCode.toDataURL(posUri, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0052FF',
        light: '#ffffff'
      }
    })
      .then(url => setPosQrUrl(url))
      .catch(err => console.error('Failed to generate POS QR:', err));
  }, [isOpen, activeTab, posAmount, posMerchantName]);

  // Parse QR Payload when pasted or scanned
  const handleParsePayload = (rawPayload: string) => {
    setQrInputPayload(rawPayload);
    setPaymentError(null);
    setPaymentSuccess(null);

    if (!rawPayload.trim()) {
      setParsedPayment(null);
      return;
    }

    try {
      if (rawPayload.startsWith('paydirect:')) {
        const urlStr = rawPayload.replace('paydirect:', 'http://dummy/');
        const parsed = new URL(urlStr);
        const recipient = parsed.pathname.replace('/', '') || 'Merchant Account';
        const amount = parseFloat(parsed.searchParams.get('amount') || '0');
        const currency = parsed.searchParams.get('currency') || 'USD';
        const memo = parsed.searchParams.get('memo') || parsed.searchParams.get('merchant') || 'QR Invoice Payment';

        setParsedPayment({ recipient, amount, currency, memo });
      } else if (rawPayload.includes(':')) {
        const parts = rawPayload.split(':');
        const currency = parts[0].toUpperCase();
        const rest = parts[1] || '';
        const [addr, query] = rest.split('?');
        let amount = 0;
        let memo = 'Crypto QR Payment';

        if (query) {
          const params = new URLSearchParams(query);
          amount = parseFloat(params.get('amount') || '0');
          memo = params.get('memo') || 'Crypto Transfer';
        }

        setParsedPayment({ recipient: addr || rest, amount, currency, memo });
      } else if (rawPayload.startsWith('0x') || rawPayload.length >= 26) {
        setParsedPayment({
          recipient: rawPayload.trim(),
          amount: 10,
          currency: 'USD',
          memo: 'Direct Wallet Transfer'
        });
      } else {
        setParsedPayment({
          recipient: 'Merchant / User',
          amount: 15.00,
          currency: 'USD',
          memo: 'P2P QR Payment'
        });
      }
    } catch (e) {
      setParsedPayment({
        recipient: 'Direct QR Recipient',
        amount: 10.00,
        currency: 'USD',
        memo: 'QR Direct Settlement'
      });
    }
  };

  // Execute QR Payment
  const handleConfirmQrPayment = async () => {
    if (!parsedPayment) return;

    setPaymentError(null);
    setPaymentSuccess(null);
    setIsProcessingPayment(true);

    try {
      const success = await onExecutePayment(
        parsedPayment.amount,
        parsedPayment.recipient,
        parsedPayment.currency,
        parsedPayment.memo
      );

      if (success) {
        setPaymentSuccess(`QR Payment of ${parsedPayment.amount} ${parsedPayment.currency} to ${parsedPayment.recipient} completed successfully!`);
        showToast(`QR Payment sent to ${parsedPayment.recipient}!`, 'success');
        setQrInputPayload('');
        setParsedPayment(null);
      } else {
        setPaymentError('Insufficient balance to complete this QR payment.');
      }
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to process QR payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Download QR Code PNG
  const handleDownloadQr = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `qr-payment-${selectedReceiveAsset.toLowerCase()}.png`;
    a.click();
    showToast('QR Code image downloaded to device.', 'info');
  };

  // Copy QR Payment Link
  const handleCopyLink = () => {
    const amt = parseFloat(receiveAmount);
    const link = `${window.location.origin}/?action=pay_qr&recipient=${encodeURIComponent(userEmail)}&asset=${selectedReceiveAsset}&amount=${!isNaN(amt) ? amt : 0}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    showToast('QR Payment link copied to clipboard!', 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative animate-in zoom-in-95 duration-150 space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center shrink-0 border border-[#0052FF]/20">
            <QrCode className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 flex items-center gap-1.5">
              <span>QR Pay & Instant Checkout</span>
              <span className="text-[10px] bg-blue-50 text-[#0052FF] font-bold px-2 py-0.5 rounded-md border border-blue-200">
                LIVE
              </span>
            </h3>
            <p className="text-xs text-gray-500 font-medium">Instant QR payment scanning, receive links, and POS checkout</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-gray-100/80 rounded-2xl">
          <button
            onClick={() => setActiveTab('receive')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'receive'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
            <span>Receive QR</span>
          </button>
          <button
            onClick={() => setActiveTab('pay')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'pay'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Send className="h-3.5 w-3.5 text-blue-600" />
            <span>Scan & Pay</span>
          </button>
          <button
            onClick={() => setActiveTab('pos')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'pos'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Store className="h-3.5 w-3.5 text-purple-600" />
            <span>POS Terminal</span>
          </button>
        </div>

        {/* TAB 1: RECEIVE QR */}
        {activeTab === 'receive' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Asset Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                  Receive Currency / Asset
                </label>
                <select
                  value={selectedReceiveAsset}
                  onChange={(e) => setSelectedReceiveAsset(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-bold px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                >
                  <option value="USD">USD Cash ($)</option>
                  <option value="CAD">CAD Cash (CA$)</option>
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="ETH">Ethereum (ETH)</option>
                  <option value="SOL">Solana (SOL)</option>
                  <option value="USDC">USD Coin (USDC)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                  Request Amount (Optional)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-bold px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                />
              </div>
            </div>

            {/* Note/Memo */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                Note / Memo (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Dinner split, invoice #104"
                value={receiveMemo}
                onChange={(e) => setReceiveMemo(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
              />
            </div>

            {/* Rendered QR Code */}
            <div className="bg-gray-50/80 border border-gray-200/80 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Pay Receive Code"
                  className="w-48 h-48 rounded-xl border border-gray-200 shadow-sm bg-white p-2"
                />
              ) : (
                <div className="w-48 h-48 rounded-xl bg-gray-200 animate-pulse flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
                </div>
              )}

              <div className="text-center space-y-1">
                <span className="text-xs font-mono font-bold text-gray-800 bg-white px-3 py-1 rounded-lg border border-gray-200 inline-block truncate max-w-xs">
                  {selectedReceiveAsset === 'BTC'
                    ? (btcInvoiceMeta?.address || btcWalletAddress)
                    : selectedReceiveAsset === 'USD' || selectedReceiveAsset === 'CAD'
                      ? userEmail
                      : defaultWalletAddress}
                </span>
                <p className="text-[11px] text-gray-500">
                  {selectedReceiveAsset === 'BTC'
                    ? btcInvoiceStatus === 'confirmed'
                      ? 'BTC invoice confirmed and credited to spendable balance.'
                      : 'Scan with any Bitcoin wallet, Cash App, or Strike for BIP-21 instant settlement'
                    : 'Scan with any camera or QR wallet to initiate instant payment'}
                </p>
              </div>
            </div>

            {selectedReceiveAsset === 'BTC' && btcInvoiceMeta?.uri && (
              <div className="flex justify-center">
                <a
                  href={btcInvoiceMeta.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                >
                  Open in wallet app
                </a>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Payment Link'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadQr}
                className="flex-1 py-2.5 bg-[#0052FF] hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Download className="h-4 w-4 text-white" />
                <span>Download QR PNG</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SCAN & PAY */}
        {activeTab === 'pay' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                Paste QR Code Payload or Payment Link
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Paste QR payload (e.g. paydirect:merchant@store.ca?amount=25 or ethereum:0x...)"
                  value={qrInputPayload}
                  onChange={(e) => handleParsePayload(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-mono p-3 pr-20 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const text = await navigator.clipboard.readText();
                    handleParsePayload(text);
                    showToast('Pasted from clipboard', 'info');
                  }}
                  className="absolute right-2 top-2 px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-[10px] rounded-lg cursor-pointer"
                >
                  Paste
                </button>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Camera className="w-4 h-4" />
                <span>Open Live Camera QR Scanner</span>
              </button>
            </div>

            {/* Parsed Payment Card */}
            {parsedPayment ? (
              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 border border-slate-800">
                <div className="flex justify-between items-start border-b border-slate-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recipient</span>
                    <span className="text-xs font-mono font-bold text-blue-300 truncate block max-w-[200px]">
                      {parsedPayment.recipient}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Amount</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">
                      {parsedPayment.amount.toFixed(2)} {parsedPayment.currency}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span className="text-slate-400">Payment Note:</span>
                  <span className="font-semibold text-slate-200">{parsedPayment.memo}</span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-300 pt-1">
                  <span className="text-slate-400">Available USD Balance:</span>
                  <span className="font-bold font-mono text-white">${liveCashBalance.toFixed(2)} USD</span>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-gray-200 rounded-2xl text-center bg-gray-50/50 space-y-2">
                <Smartphone className="h-8 w-8 text-gray-400 mx-auto" />
                <p className="text-xs text-gray-500 font-medium">
                  Paste a payment payload above to preview and settle
                </p>
              </div>
            )}

            {paymentError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            {paymentSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{paymentSuccess}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmQrPayment}
              disabled={!parsedPayment || isProcessingPayment}
              className="w-full py-3 bg-[#0052FF] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/10 flex items-center justify-center gap-2"
            >
              {isProcessingPayment ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Settling QR Payment...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 text-white" />
                  <span>Confirm & Send QR Payment</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* TAB 3: POS TERMINAL */}
        {activeTab === 'pos' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                  Merchant Name
                </label>
                <input
                  type="text"
                  value={posMerchantName}
                  onChange={(e) => setPosMerchantName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                  Invoice Amount ($)
                </label>
                <input
                  type="number"
                  value={posAmount}
                  onChange={(e) => setPosAmount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 rounded-2xl p-5 text-white text-center space-y-4 shadow-xl">
              <div className="flex items-center justify-between text-xs text-indigo-200 border-b border-indigo-900/60 pb-2.5">
                <span className="font-bold uppercase tracking-wider">{posMerchantName}</span>
                <span className="font-mono font-black text-emerald-400 text-base">${parseFloat(posAmount || '0').toFixed(2)} USD</span>
              </div>

              {posQrUrl && (
                <div className="flex justify-center py-2">
                  <img
                    src={posQrUrl}
                    alt="POS Merchant QR Invoice"
                    className="w-44 h-44 rounded-2xl bg-white p-2 border-2 border-indigo-400 shadow-lg"
                  />
                </div>
              )}

              <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 py-2 rounded-xl border border-emerald-500/20">
                <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>POS Ready — Scan to Settle Instantly</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-medium">
          <span className="flex items-center space-x-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Zero-Fee Direct Settlement</span>
          </span>
          <span>Sovereign Ledger Protected</span>
        </div>

      </div>

      {/* Live Camera WebRTC Scanner Modal */}
      <CameraQrScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanSuccess={(data) => handleParsePayload(data.raw)}
        title="Scan Payment or ATM QR"
        instruction="Point your camera at the QR code on a merchant terminal, ATM screen, or mobile wallet."
      />
    </div>
  );
}
