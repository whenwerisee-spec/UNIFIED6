import React, { useState, useEffect } from 'react';
import { loadStripe, Stripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import {
  X,
  CreditCard,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Wallet
} from 'lucide-react';

import { buildApiUrl, safeJsonFetch } from '../lib/api-client';

function buildAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    ...(extraHeaders || {})
  };
}

interface StripePaymentElementFormProps {
  clientSecret: string;
  paymentIntentId: string;
  amountCad: number;
  amountUsd: number;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}

const StripePaymentElementForm: React.FC<StripePaymentElementFormProps> = ({
  clientSecret,
  paymentIntentId,
  amountCad,
  amountUsd,
  onSuccess,
  onCancel
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Confirm payment with Stripe Elements
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/?action=stripe_success&payment_intent=${paymentIntentId}`
        }
      });

      if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
          setErrorMessage(error.message || 'Payment card validation failed.');
        } else {
          setErrorMessage(error.message || 'An unexpected error occurred during payment processing.');
        }
        setIsProcessing(false);
        return;
      }

      const confirmedId = paymentIntent?.id || paymentIntentId;

      // Finalize the payment intent on server to update local database and ledger
      try {
        const finalizeRes = await fetch(buildApiUrl('/api/stripe/confirm-payment-intent'), {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ payment_intent_id: confirmedId })
        });
        if (!finalizeRes.ok) {
          console.warn('[STRIPE ELEMENT] Local ledger sync returned status:', finalizeRes.status);
        }
      } catch (finalizeErr) {
        console.warn('[STRIPE ELEMENT] Local ledger sync warning:', finalizeErr);
      }

      setIsProcessing(false);
      onSuccess(confirmedId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment execution failed.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Amount and FX summary pill */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 flex items-center justify-between shadow-inner">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Deposit Amount
          </span>
          <span className="text-xl font-black text-white font-mono">
            CA${amountCad.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs text-slate-400 font-sans ml-1">CAD</span>
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Credited USD
          </span>
          <span className="text-base font-bold text-emerald-400 font-mono">
            ≈ US${amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Stripe Payment Element container */}
      <div className="bg-slate-50/80 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-[#635BFF]" />
            Payment Method
          </span>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
            <Lock className="h-2.5 w-2.5" /> 256-bit Encrypted
          </span>
        </div>

        {/* The Stripe Payment Element according to official documentation */}
        <PaymentElement
          id="payment-element"
          onReady={() => setIsReady(true)}
          options={{
            layout: {
              type: 'tabs',
              defaultCollapsed: false,
              spacedAccordionItems: false
            },
            paymentMethodOrder: ['card', 'link', 'google_pay', 'apple_pay', 'us_bank_account'],
            fields: {
              billingDetails: {
                name: 'auto',
                email: 'auto',
                phone: 'auto',
                address: 'auto'
              }
            },
            terms: {
              card: 'auto'
            },
            wallets: {
              applePay: 'auto',
              googlePay: 'auto'
            }
          }}
        />
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={!stripe || !elements || isProcessing}
          className="w-2/3 py-3 bg-[#635BFF] hover:bg-[#4E46E5] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/25 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Processing Payment...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              <span>Pay CA${amountCad.toFixed(2)} CAD</span>
            </>
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
          <Lock className="h-3 w-3 text-slate-400" />
          Secured by Stripe Elements with 3D Secure 2 authentication
        </p>
      </div>
    </form>
  );
};

export interface StripePaymentElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: (paymentIntentId: string, amountUsd: number, amountCad: number) => void;
  initialAmountCad?: number;
  usdCadRate?: number;
}

export const StripePaymentElementModal: React.FC<StripePaymentElementModalProps> = ({
  isOpen,
  onClose,
  onPaymentComplete,
  initialAmountCad = 100,
  usdCadRate = 1.3622
}) => {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [amountCad, setAmountCad] = useState<number>(initialAmountCad);
  const [amountUsd, setAmountUsd] = useState<number>(initialAmountCad / usdCadRate);
  const [isLoadingIntent, setIsLoadingIntent] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  useEffect(() => {
    if (initialAmountCad > 0) {
      setAmountCad(initialAmountCad);
      setAmountUsd(initialAmountCad / usdCadRate);
    }
  }, [initialAmountCad, usdCadRate]);

  // Load Stripe publishable key and initialize PaymentIntent when opened
  useEffect(() => {
    if (!isOpen) {
      setClientSecret(null);
      setPaymentIntentId(null);
      setPaymentCompleted(false);
      setInitError(null);
      return;
    }

    let isMounted = true;

    async function initStripe() {
      setIsLoadingIntent(true);
      setInitError(null);

      try {
        // 1. Fetch Stripe config
        let publishableKey = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || '';
        try {
          const configRes = await fetch(buildApiUrl('/api/stripe/config'));
          if (configRes.ok) {
            const configJson = await configRes.json();
            if (configJson.publishableKey) {
              publishableKey = configJson.publishableKey;
            }
          }
        } catch (confErr) {
          console.warn('[STRIPE CONFIG] Config fetch note:', confErr);
        }

        if (!publishableKey) {
          if (isMounted) setInitError('Live Stripe publishable key is not configured; payment setup is unavailable.');
          return;
        }

        const stripeObjPromise = loadStripe(publishableKey);
        if (isMounted) {
          setStripePromise(stripeObjPromise);
        }

        // 2. Create PaymentIntent on server
        const intentRes = await fetch(buildApiUrl('/api/stripe/create-payment-intent'), {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            amount: amountCad,
            currency: 'cad',
            fxRate: usdCadRate,
            description: 'Sovereign Wallet Deposit via Stripe Payment Element'
          })
        });

        if (!intentRes.ok) {
          const errData = await intentRes.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to create Stripe Payment Intent.');
        }

        const intentJson = await intentRes.json();
        if (isMounted) {
          setClientSecret(intentJson.clientSecret);
          setPaymentIntentId(intentJson.paymentIntentId);
          setAmountCad(intentJson.amountCad || amountCad);
          setAmountUsd(intentJson.amountUsd || amountUsd);
          setIsLoadingIntent(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setInitError(err.message || 'Failed to initialize Stripe Payment Element.');
          setIsLoadingIntent(false);
        }
      }
    }

    initStripe();

    return () => {
      isMounted = false;
    };
  }, [isOpen, amountCad, usdCadRate]);

  if (!isOpen) return null;

  const elementsOptions: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#635BFF',
        colorBackground: '#ffffff',
        colorText: '#1e293b',
        colorDanger: '#df1b41',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        spacingUnit: '4px',
        borderRadius: '12px'
      }
    }
  };

  const handleSuccess = (confirmedId: string) => {
    setPaymentCompleted(true);
    onPaymentComplete(confirmedId, amountUsd, amountCad);
  };

  return (
    <div
      id="stripe-payment-element-modal-backdrop"
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        id="stripe-payment-element-modal-card"
        className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-100 space-y-5 relative animate-in zoom-in-95 duration-150 max-h-[92dvh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer z-20"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#635BFF]/15 to-indigo-500/10 text-[#635BFF] flex items-center justify-center shrink-0 border border-[#635BFF]/20 shadow-xs">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Stripe Payment Element
              </h3>
              <span className="bg-indigo-50 text-[#635BFF] text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wider">
                Universal Checkout
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Securely deposit funds into your Sovereign Vault using Card, Google Pay, Apple Pay, or Link.
            </p>
          </div>
        </div>

        {/* Content Body */}
        {paymentCompleted ? (
          <div className="text-center py-6 space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-900">Payment Succeeded!</h4>
              <p className="text-xs text-slate-500">
                CA${amountCad.toFixed(2)} CAD (≈ US${amountUsd.toFixed(2)} USD) has been credited to your Sovereign Vault balance.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-600">
              Payment Intent: {paymentIntentId}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-[#635BFF] hover:bg-[#4E46E5] text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
            >
              Done & Return
            </button>
          </div>
        ) : isLoadingIntent ? (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="h-8 w-8 text-[#635BFF] animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-700">Initializing Stripe Payment Element...</p>
            <p className="text-[11px] text-slate-400">Mounting 3DS2 secure payment methods</p>
          </div>
        ) : initError ? (
          <div className="py-6 space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Failed to initialize payment:</strong>
                <span>{initError}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
            >
              Dismiss
            </button>
          </div>
        ) : clientSecret && stripePromise ? (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <StripePaymentElementForm
              clientSecret={clientSecret}
              paymentIntentId={paymentIntentId || ''}
              amountCad={amountCad}
              amountUsd={amountUsd}
              onSuccess={handleSuccess}
              onCancel={onClose}
            />
          </Elements>
        ) : null}
      </div>
    </div>
  );
};
export default StripePaymentElementModal;
