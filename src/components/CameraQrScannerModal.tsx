import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Upload,
  Flashlight,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  QrCode,
  DollarSign,
  Smartphone
} from 'lucide-react';
import jsQR from 'jsqr';
import { parseQrOrDeepLink, ParsedQrResult } from '../lib/qrProtocolParser';

interface CameraQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedData: {
    raw: string;
    address: string;
    amount?: number;
    currency?: string;
    memo?: string;
    parsedResult?: ParsedQrResult;
  }) => void;
  title?: string;
  instruction?: string;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function CameraQrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Localcoin QR / ATM / e-Transfer',
  instruction = 'Point your camera at the QR code displayed on the Localcoin ATM screen, banking app, or recipient wallet.',
  showToast
}: CameraQrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [detectedPayload, setDetectedPayload] = useState<ParsedQrResult | null>(null);

  // Start Camera Stream
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setDetectedPayload(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setErrorMessage(null);
    setIsScanning(true);
    setDetectedPayload(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        setErrorMessage('Camera access is not supported on this browser/device.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;

      // Check for torch capability on mobile
      try {
        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = (videoTrack.getCapabilities?.() as any) || {};
        if (capabilities.torch) {
          setHasTorchSupport(true);
        }
      } catch {}

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setHasCameraPermission(true);
        startScanningLoop();
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setHasCameraPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission was denied. Please allow camera permissions in browser settings or upload a QR screenshot.');
      } else {
        setErrorMessage('Unable to initialize video camera. Please paste your address or upload a screenshot.');
      }
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const newTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorch }]
      });
      setIsTorchOn(newTorch);
    } catch (err) {
      console.warn('Could not toggle flashlight:', err);
    }
  };

  // Dual-Engine Scanning Loop (BarcodeDetector + jsQR)
  const startScanningLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let isRunning = true;

    // Check for native BarcodeDetector
    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    const barcodeDetector = hasBarcodeDetector
      ? new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      : null;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scanFrame = async () => {
      if (!isRunning || !videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        if (isRunning) {
          animationFrameId.current = requestAnimationFrame(scanFrame);
        }
        return;
      }

      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;

      if (videoWidth > 0 && videoHeight > 0) {
        // Engine 1: Native BarcodeDetector (Fastest if present)
        if (barcodeDetector) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              isRunning = false;
              handleParsedPayload(barcodes[0].rawValue);
              return;
            }
          } catch {}
        }

        // Engine 2: jsQR Fallback (Works everywhere, 100% platform support)
        if (ctx) {
          canvas.width = videoWidth;
          canvas.height = videoHeight;
          ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);

          try {
            const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert'
            });

            if (code && code.data) {
              isRunning = false;
              handleParsedPayload(code.data);
              return;
            }
          } catch {}
        }
      }

      if (isRunning) {
        animationFrameId.current = requestAnimationFrame(scanFrame);
      }
    };

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  const handleParsedPayload = (rawString: string) => {
    // Haptic feedback if available on mobile
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(100);
    }

    const parsed = parseQrOrDeepLink(rawString);
    setDetectedPayload(parsed);
  };

  const handleConfirmRecognized = () => {
    if (!detectedPayload) return;
    stopCamera();

    onScanSuccess({
      raw: detectedPayload.raw,
      address: detectedPayload.address || detectedPayload.raw,
      amount: detectedPayload.amount || detectedPayload.fiatAmount,
      currency: detectedPayload.currency,
      memo: detectedPayload.memo,
      parsedResult: detectedPayload
    });
    onClose();
  };

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    const parsed = parseQrOrDeepLink(manualInput.trim());
    setDetectedPayload(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleParsedPayload(code.data);
          return;
        }
      }
      setErrorMessage('Could not find a valid QR code in that image. Please try another screenshot or paste manually.');
    };
    img.src = URL.createObjectURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">Localcoin & Multi-Protocol Scanner</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            {hasTorchSupport && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl transition-all ${
                  isTorchOn ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Toggle Flashlight"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Viewport / Scanner Frame */}
        <div className="relative w-full aspect-square bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Targeting Frame Overlay */}
          {!detectedPayload && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
              <div className="w-64 h-64 border-2 border-amber-400/80 rounded-2xl relative shadow-lg shadow-amber-500/20">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

                {/* Animated laser scanline */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_10px_#f59e0b] animate-bounce mt-32" />
              </div>
            </div>
          )}

          {/* Recognition Result Modal Overlay */}
          {detectedPayload && (
            <div className="absolute inset-0 bg-slate-950/95 p-6 flex flex-col justify-between animate-in zoom-in-95 duration-150 z-20">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    {detectedPayload.source === 'LOCALCOIN'
                      ? 'Localcoin App/ATM Recognized'
                      : detectedPayload.source === 'INTERAC_ETRANSFER'
                      ? 'Interac e-Transfer Recognized'
                      : detectedPayload.source === 'TRANSACTION_VERIFICATION'
                      ? 'Cryptographic Transaction Proof Recognized'
                      : 'Payment Protocol Recognized'}
                  </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <h4 className="text-sm font-bold text-white">{detectedPayload.displayTitle}</h4>
                  <p className="text-xs text-amber-300 font-mono font-medium">{detectedPayload.displaySubtitle}</p>

                  {detectedPayload.address && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-mono break-all">
                      <span className="text-slate-500 block">Address:</span>
                      <span className="text-slate-200">{detectedPayload.address}</span>
                    </div>
                  )}

                  {detectedPayload.memo && (
                    <div className="text-[11px] text-slate-400">
                      <span className="text-slate-500 block">Reference / Order:</span>
                      <span className="text-slate-200 font-bold">{detectedPayload.memo}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setDetectedPayload(null);
                    startScanningLoop();
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Scan Again
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRecognized}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Apply & Open</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Fallback permission / error screen */}
          {hasCameraPermission === false && !detectedPayload && (
            <div className="absolute inset-0 bg-slate-900/90 p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs text-slate-300 max-w-xs">{errorMessage || 'Camera access unavailable.'}</p>
              <label className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md">
                <Upload className="w-4 h-4" />
                <span>Upload QR Screenshot</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}
        </div>

        {/* Footer Controls & Manual Input */}
        <div className="p-4 sm:p-5 bg-slate-950 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Supports Localcoin ATM, e-Transfer & BIP21</span>
            <label className="text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1 font-bold">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Or paste Localcoin URL, Bitcoin URI, or e-Transfer"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleManualSubmit();
                }}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={handleManualSubmit}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all flex items-center gap-1 shrink-0"
              >
                <span>Recognize</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
