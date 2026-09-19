import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, CheckCircle2, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { Coin, Holding, Transaction } from '../types';

export interface YieldOptimizationViewProps {
  coins: Coin[];
  holdings: Holding[];
  usdBalance: number;
  onUpdateHoldings?: (newHoldings: Holding[]) => void;
  onAddTransaction?: (tx: Transaction) => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onOpenTradeModal?: (symbol: string) => void;
}

type LiveYieldSource = {
  id: string;
  provider: string;
  network: string;
  assetSymbol: string;
  addressType: 'evm' | 'bitcoin' | 'solana' | 'provider-managed' | 'other';
  collectionModes: Array<'manual' | 'automatic'>;
  addressIssuanceAvailable: boolean;
  claimPreparationAvailable: boolean;
};

type YieldDestination = {
  id: string;
  sourceId: string;
  provider: string;
  network: string;
  assetSymbol: string;
  address: string;
  addressType: string;
  collectionMode: 'manual' | 'automatic';
  status: 'pending_verification' | 'active' | 'paused' | 'revoked';
  recoveryReference: string;
  lastClaimTxHash?: string;
  lastClaimAt?: string;
};

type ClaimPreparation = {
  message?: string;
  executable?: boolean;
  requiresProviderApproval?: boolean;
  rewards?: {
    totalRewardsWei: string;
    totalRewardsUsd?: number;
    recordCount: number;
    latestRewardDate?: string;
  };
};

function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const configuredBase = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim();
  if (configuredBase) return new URL(normalized, configuredBase).toString();
  return normalized;
}

function buildAuthHeaders(contentType = false): Record<string, string> {
  const token = sessionStorage.getItem('cb_auth_jwt_token') || localStorage.getItem('cb_auth_jwt_token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(contentType ? { 'Content-Type': 'application/json' } : {})
  };
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.message || payload?.error || `Request failed with HTTP ${response.status}.`));
  }
  return payload as T;
}

export default function YieldOptimizationView({ showToast }: YieldOptimizationViewProps) {
  const [sources, setSources] = useState<LiveYieldSource[]>([]);
  const [destinations, setDestinations] = useState<YieldDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [address, setAddress] = useState('');
  const [signature, setSignature] = useState('');
  const [recoveryReference, setRecoveryReference] = useState('');
  const [collectionMode, setCollectionMode] = useState<'manual' | 'automatic'>('manual');
  const [isRegistering, setIsRegistering] = useState(false);
  const [claimPreparation, setClaimPreparation] = useState<ClaimPreparation | null>(null);
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) || null,
    [selectedSourceId, sources]
  );

  const refreshLiveState = async (showSuccess = false) => {
    setIsRefreshing(true);
    setError(null);
    try {
      const [sourcePayload, destinationPayload] = await Promise.all([
        fetch(buildApiUrl('/api/yield/sources'), { credentials: 'include', headers: buildAuthHeaders() }).then(parseApiResponse<{ sources?: LiveYieldSource[] }>),
        fetch(buildApiUrl('/api/yield/destinations'), { credentials: 'include', headers: buildAuthHeaders() }).then(parseApiResponse<{ destinations?: YieldDestination[] }>)
      ]);
      const nextSources = Array.isArray(sourcePayload.sources) ? sourcePayload.sources : [];
      setSources(nextSources);
      setDestinations(Array.isArray(destinationPayload.destinations) ? destinationPayload.destinations : []);
      if (!selectedSourceId && nextSources[0] || {}) setSelectedSourceId(nextSources[0] || {}.id);
      if (showSuccess) showToast?.('Live yield routing status refreshed.', 'success');
    } catch (requestError: any) {
      const message = requestError?.message || 'Live yield routing is unavailable.';
      setError(message);
      if (showSuccess) showToast?.(message, 'error');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshLiveState();
  }, []);

  useEffect(() => {
    if (selectedSource && !selectedSource.collectionModes.includes(collectionMode)) {
      setCollectionMode('manual');
    }
  }, [collectionMode, selectedSource]);

  const registerDestination = async () => {
    if (!selectedSource) {
      showToast?.('Select a configured live yield source first.', 'error');
      return;
    }
    setIsRegistering(true);
    setError(null);
    try {
      const payload = await fetch(buildApiUrl('/api/yield/destinations/register'), {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({
          sourceId: selectedSource.id,
          address,
          signature,
          recoveryReference,
          collectionMode
        })
      }).then(parseApiResponse<{ destination: YieldDestination }>);
      setAddress('');
      setSignature('');
      setRecoveryReference('');
      setDestinations((current) => {
        const withoutExisting = current.filter((destination) => destination.id !== payload.destination.id);
        return [...withoutExisting, payload.destination];
      });
      showToast?.(`Verified permanent routing address registered for ${selectedSource.provider}.`, 'success');
    } catch (requestError: any) {
      const message = requestError?.message || 'Destination registration failed.';
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const prepareCollection = async (destination: YieldDestination) => {
    setActiveClaimId(destination.id);
    setClaimPreparation(null);
    setError(null);
    try {
      const payload = await fetch(buildApiUrl('/api/yield/claims/prepare'), {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ destinationId: destination.id })
      }).then(parseApiResponse<ClaimPreparation>);
      setClaimPreparation(payload);
      showToast?.(payload.message || 'Live claim status prepared.', 'info');
    } catch (requestError: any) {
      const message = requestError?.message || 'Live claim preparation failed.';
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setActiveClaimId(null);
    }
  };

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-slate-100 sm:p-6">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Live-only yield routing</span>
          </div>
          <h2 className="text-xl font-semibold text-white">Verified rewards, permanent destinations, no invented results</h2>
          <p className="text-sm leading-6 text-slate-400">
            This workspace displays only authenticated provider data and registered destination records. A source that is not configured or cannot prove address ownership remains unavailable; it is never represented as accrued yield, a completed sweep, or a funded wallet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshLiveState(true)}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh live status
        </button>
      </header>

      {error && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-300" />
            <h3 className="font-semibold text-white">Permanent destination registration</h3>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400">Loading authenticated provider configuration…</p>
          ) : sources.length === 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              No live yield source is configured for this account. Registration is disabled until the server has a verified provider and network definition.
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-300">
                Live yield source
                <select value={selectedSourceId} onChange={(event) => setSelectedSourceId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.provider.toUpperCase()} · {source.assetSymbol} · {source.network}
                    </option>
                  ))}
                </select>
              </label>

              {selectedSource && !selectedSource.addressIssuanceAvailable && (
                <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs leading-5 text-slate-400">
                  A custody-issued address endpoint has not yet been verified for this source. You may register a user-controlled address only after signing the ownership message; the application will not manufacture a new address.
                </div>
              )}

              <label className="block text-xs font-semibold text-slate-300">
                {selectedSource?.addressType?.toUpperCase() || 'NETWORK'} destination address
                <input value={address} onChange={(event) => setAddress(event.target.value.trim())} placeholder={selectedSource?.addressType === 'evm' ? '0x…' : 'Verified destination address'} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Signed ownership proof
                <textarea value={signature} onChange={(event) => setSignature(event.target.value.trim())} placeholder="Wallet signature for the displayed registration message" rows={3} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white" />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Recovery reference
                <input value={recoveryReference} onChange={(event) => setRecoveryReference(event.target.value.trim())} placeholder="Custody record ID or user-managed recovery reference" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Collection mode
                <select value={collectionMode} onChange={(event) => setCollectionMode(event.target.value as 'manual' | 'automatic')} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="manual">Manual collection with explicit approval</option>
                  {selectedSource?.collectionModes.includes('automatic') && <option value="automatic">Provider-verified automatic collection</option>}
                </select>
              </label>
              <button type="button" onClick={() => void registerDestination()} disabled={isRegistering} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" />
                {isRegistering ? 'Verifying destination…' : 'Register verified permanent destination'}
              </button>
            </div>
          )}
        </article>

        <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-emerald-300" />
            <h3 className="font-semibold text-white">Registered routes and collection</h3>
          </div>
          {destinations.length === 0 ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-400">No permanent yield destination is registered in this authenticated account. There are no synthetic sweep records or default routes.</p>
          ) : (
            <div className="space-y-3">
              {destinations.map((destination) => (
                <div key={destination.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{destination.provider.toUpperCase()} · {destination.assetSymbol}</p>
                      <p className="mt-1 text-xs text-slate-400">{destination.network} · {destination.collectionMode} collection · {destination.status}</p>
                    </div>
                    <button type="button" onClick={() => void prepareCollection(destination)} disabled={activeClaimId === destination.id || destination.status !== 'active'} className="rounded-lg border border-emerald-500/50 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                      {activeClaimId === destination.id ? 'Checking live claim…' : 'Collect yield'}
                    </button>
                  </div>
                  <p className="mt-3 break-all rounded bg-slate-900 p-2 font-mono text-xs text-slate-300">{destination.address}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      {claimPreparation && (
        <aside className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 text-sm text-blue-50">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-2">
              <p className="font-semibold">Live claim preparation result</p>
              <p className="leading-6 text-blue-100">{claimPreparation.message || 'The provider returned a live status response.'}</p>
              {claimPreparation.rewards && (
                <p className="font-mono text-xs text-blue-100">Reported reward records: {claimPreparation.rewards.recordCount} · Total reward units: {claimPreparation.rewards.totalRewardsWei}{typeof claimPreparation.rewards.totalRewardsUsd === 'number' ? ` · Reported USD: ${claimPreparation.rewards.totalRewardsUsd.toFixed(2)}` : ''}</p>
              )}
              {claimPreparation.requiresProviderApproval && <p className="text-xs text-blue-100">No transaction was broadcast. Provider or custody approval remains required before any irreversible collection action.</p>}
            </div>
          </div>
        </aside>
      )}
    </section>
  );
}
