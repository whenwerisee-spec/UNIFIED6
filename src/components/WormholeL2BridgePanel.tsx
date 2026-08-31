import React, { useState, useEffect } from 'react';
import { 
  Globe2, 
  ArrowRight, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Zap,
  RefreshCw,
  Clock,
  Fuel,
  Network,
  Gauge,
  Activity
} from 'lucide-react';
import { usePortfolioStore } from '../store/portfolio-store';
import { useTransactionExecutor } from '../hooks/useTransactionExecutor';
import { 
  SUPPORTED_WORMHOLE_CHAINS, 
  formatWormholeRecipientAddress,
  calculateWormholeBridgeQuote,
  BridgeQuote
} from '../lib/wormhole-bridge';
import { GasSpeedTier, getOptimizedGasConfig, OptimizedGasParams } from '../lib/gas-optimizer';
import { RPC_FALLBACK_MATRIX } from '../lib/rpc-fallback';

interface WormholeL2BridgePanelProps {
  refetchBalancesNow: () => Promise<void>;
}

export const WormholeL2BridgePanel: React.FC<WormholeL2BridgePanelProps> = ({ refetchBalancesNow }) => {
  const { executeCrossChainBridge, isProcessing } = useTransactionExecutor(refetchBalancesNow);
  const activeAddresses = usePortfolioStore((state) => state.activeAddresses);
  const inFlightBridges = usePortfolioStore((state) => state.inFlightBridges);
  const rawHoldings = usePortfolioStore((state) => state.rawHoldings);

  const [sourceChain, setSourceChain] = useState<string>('ethereum');
  const [targetChain, setTargetChain] = useState<string>('base');
  const [bridgeToken, setBridgeToken] = useState<string>('USDC');
  const [bridgeAmount, setBridgeAmount] = useState<string>('100.00');
  const [recipientOverride, setRecipientOverride] = useState<string>('');
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [gasTier, setGasTier] = useState<GasSpeedTier>('standard');
  const [gasOptimization, setGasOptimization] = useState<OptimizedGasParams | null>(null);

  const effectiveRecipient = recipientOverride.trim() || activeAddresses.selectedVault || activeAddresses.connectedWallet || (import.meta as any).env?.VITE_MARSHALL_ADDRESS || '';
  const paddedWormholeAddress = formatWormholeRecipientAddress(effectiveRecipient);

  // Recalculate quote whenever parameters change
  useEffect(() => {
    try {
      const q = calculateWormholeBridgeQuote(
        sourceChain,
        targetChain,
        bridgeAmount,
        bridgeToken,
        effectiveRecipient
      );
      setQuote(q);
    } catch {
      setQuote(null);
    }
  }, [sourceChain, targetChain, bridgeAmount, bridgeToken, effectiveRecipient]);

  // Automated Gas Optimization estimation
  useEffect(() => {
    let isMounted = true;
    const fetchGas = async () => {
      try {
        const chainName = sourceChain.charAt(0).toUpperCase() + sourceChain.slice(1);
        const params = await getOptimizedGasConfig(chainName, gasTier);
        if (isMounted) setGasOptimization(params);
      } catch {
        // Handled internally in gas-optimizer
      }
    };
    fetchGas();
    return () => { isMounted = false; };
  }, [sourceChain, gasTier]);

  const sourceChainObj = SUPPORTED_WORMHOLE_CHAINS.find((c) => c.id === sourceChain) || SUPPORTED_WORMHOLE_CHAINS[0];
  const targetChainObj = SUPPORTED_WORMHOLE_CHAINS.find((c) => c.id === targetChain) || SUPPORTED_WORMHOLE_CHAINS[1];

  const handleLaunchBridge = async (e: React.FormEvent) => {
    e.preventDefault();
    setBridgeError(null);
    setSuccessTxHash(null);
    setActiveStep(1);

    if (sourceChain === targetChain) {
      setBridgeError('Source network and target destination network must be different.');
      setActiveStep(0);
      return;
    }

    const numAmount = parseFloat(bridgeAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setBridgeError('Please enter a valid transfer amount greater than 0.');
      setActiveStep(0);
      return;
    }

    try {
      setActiveStep(2); // VAA attestation step
      const txHash = await executeCrossChainBridge({
        sourceNetwork: sourceChain,
        targetNetwork: targetChain,
        symbol: bridgeToken,
        amount: numAmount
      });
      setActiveStep(3); // Completed step
      setSuccessTxHash(txHash);
    } catch (err: any) {
      setActiveStep(0);
      setBridgeError(err?.message || 'Cross-chain bridge submission failed.');
    }
  };

  const currentAvailableBalance = rawHoldings[bridgeToken]?.amount 
    ? Number(rawHoldings[bridgeToken].amount) 
    : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Wormhole Layer 2 Cross-Chain Routing</h3>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-2 py-0.5 rounded-full border border-indigo-500/30">
                Guardian VAA Attested
              </span>
            </div>
            <p className="text-xs text-slate-400">Deterministic asset bridging between Ethereum L1, Base, Arbitrum, Optimism, Polygon, and Solana</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleLaunchBridge} className="space-y-5">
        {/* Source & Target Chains Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-400">Source Network (Origin)</label>
            <div className="relative">
              <select
                value={sourceChain}
                onChange={(e) => setSourceChain(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-slate-100 font-medium focus:outline-none focus:border-indigo-500 transition"
              >
                {SUPPORTED_WORMHOLE_CHAINS.map((c) => (
                  <option key={`src-${c.id}`} value={c.id} disabled={c.id === targetChain}>
                    {c.icon} {c.name} ({c.nativeCurrency})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[10px] text-slate-500 block">Wormhole Chain ID: {sourceChainObj.wormholeChainId}</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-400">Destination Network (Target)</label>
            <div className="relative">
              <select
                value={targetChain}
                onChange={(e) => setTargetChain(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-slate-100 font-medium focus:outline-none focus:border-indigo-500 transition"
              >
                {SUPPORTED_WORMHOLE_CHAINS.map((c) => (
                  <option key={`tgt-${c.id}`} value={c.id} disabled={c.id === sourceChain}>
                    {c.icon} {c.name} ({c.nativeCurrency})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[10px] text-slate-500 block">Wormhole Chain ID: {targetChainObj.wormholeChainId}</span>
          </div>
        </div>

        {/* Token & Amount Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-400">Bridge Asset</label>
              <span className="text-[11px] text-slate-400 font-mono">
                Avail: <strong className="text-emerald-400">{currentAvailableBalance.toFixed(4)} {bridgeToken}</strong>
              </span>
            </div>
            <select
              value={bridgeToken}
              onChange={(e) => setBridgeToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-slate-100 font-mono font-medium focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="USDC">USDC (USD Coin - Native NTT / Portal)</option>
              <option value="ETH">ETH (Native Ether)</option>
              <option value="WBTC">WBTC (Wrapped Bitcoin)</option>
              <option value="SOL">SOL (Solana Token Bridge)</option>
              <option value="POL">POL (Polygon Ecosystem Token)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-400">Transfer Amount</label>
              <button
                type="button"
                onClick={() => setBridgeAmount(currentAvailableBalance > 0 ? (currentAvailableBalance * 0.95).toFixed(2) : '100.00')}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider"
              >
                Use Max (95%)
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                min="0"
                value={bridgeAmount}
                onChange={(e) => setBridgeAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 transition"
                placeholder="100.00"
              />
              <span className="absolute right-3.5 top-3 text-xs text-slate-500 font-mono">{bridgeToken}</span>
            </div>
          </div>
        </div>

        {/* Recipient Destination Override */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-slate-400">Destination Recipient Address</label>
            <span className="text-[10px] text-slate-500 font-mono">Auto-resolves to Vault / Connected Wallet</span>
          </div>
          <input
            type="text"
            value={recipientOverride}
            onChange={(e) => setRecipientOverride(e.target.value)}
            placeholder={`Default: ${effectiveRecipient.slice(0, 10)}...${effectiveRecipient.slice(-6)}`}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Formatted 32-Byte Target Address Review */}
        <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1 font-mono text-xs">
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Wormhole 32-Byte Normalized Recipient:</span>
            </span>
            <span className="text-indigo-400 font-sans text-[10px]">Zero-Padded EVM Format</span>
          </div>
          <div className="text-emerald-400 text-[11px] break-all select-all font-mono tracking-tight bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            {paddedWormholeAddress}
          </div>
        </div>

        {/* Dynamic Multi-Chain Gas Optimizer Selector */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Gauge className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Automated Gas Optimization Tier</span>
            </div>
            {gasOptimization && gasOptimization.savingsPercentage > 0 && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                ⚡ ~{gasOptimization.savingsPercentage}% Gas Savings
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setGasTier('eco')}
              className={`p-2.5 rounded-xl border text-left transition ${
                gasTier === 'eco'
                  ? 'bg-emerald-950/50 border-emerald-500/80 text-white shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Eco Saver</span>
                <span className="text-[10px] text-emerald-400 font-mono">-22%</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">EIP-1559 Dynamic Base</p>
            </button>

            <button
              type="button"
              onClick={() => setGasTier('standard')}
              className={`p-2.5 rounded-xl border text-left transition ${
                gasTier === 'standard'
                  ? 'bg-indigo-950/50 border-indigo-500/80 text-white shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Standard</span>
                <span className="text-[10px] text-indigo-400 font-mono">1.2x</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Balanced Mempool Priority</p>
            </button>

            <button
              type="button"
              onClick={() => setGasTier('instant')}
              className={`p-2.5 rounded-xl border text-left transition ${
                gasTier === 'instant'
                  ? 'bg-amber-950/50 border-amber-500/80 text-white shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Instant</span>
                <span className="text-[10px] text-amber-400 font-mono">1.6x</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Immediate Block Priority</p>
            </button>
          </div>

          {gasOptimization && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
              <span>Dynamic Gas: <strong className="text-slate-200">{parseFloat(gasOptimization.gasPriceGwei).toFixed(2)} Gwei</strong></span>
              <span>Est. Cost: <strong className="text-emerald-400">${gasOptimization.estimatedCostUsd} USD</strong></span>
            </div>
          )}
        </div>

        {/* Live Wormhole Route & Fee Breakdown Card */}
        {quote && (
          <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
              <span className="text-slate-400 font-medium">Cross-Chain Route</span>
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span>{quote.sourceChain.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                <span>{quote.targetChain.name}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="flex items-center space-x-2 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Est. Time</span>
                  <span className="font-mono text-white text-xs">{quote.estimatedArrival}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-slate-300">
                <Fuel className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Source Gas Est.</span>
                  <span className="font-mono text-white text-xs">~{quote.sourceFeeEth} ETH</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-slate-300">
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Relayer Gas Fee</span>
                  <span className="font-mono text-white text-xs">~${quote.relayerFeeUsd.toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Attestation Progression Steps */}
        {isProcessing && (
          <div className="p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-xl space-y-3">
            <div className="text-xs font-bold text-indigo-300 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Wormhole Cross-Chain Protocol In-Transit</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
              <div className="p-2 rounded bg-indigo-900/40 border border-indigo-700 text-indigo-200">
                1. Lock on {sourceChainObj.name}
              </div>
              <div className="p-2 rounded bg-indigo-900/60 border border-indigo-500 text-amber-200 animate-pulse">
                2. Guardian VAA Attestation
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-slate-400">
                3. Mint on {targetChainObj.name}
              </div>
            </div>
          </div>
        )}

        {bridgeError && (
          <div className="p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{bridgeError}</span>
          </div>
        )}

        {successTxHash && (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 space-y-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="font-bold">Wormhole Cross-Chain Bridge Broadcast Successful!</span>
            </div>
            <div className="font-mono text-[11px] text-emerald-300 break-all bg-slate-950/80 p-2 rounded-lg border border-emerald-900">
              VAA Sequence Hash: {successTxHash}
            </div>
            <div className="text-[10px] text-slate-400">
              Assets have been submitted to Wormhole Core Relayers and will be credited to {targetChainObj.name} upon 19 guardian signatures.
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={isProcessing}
            className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            {isProcessing ? (
              <span>Routing Through Wormhole Guardians...</span>
            ) : (
              <>
                <span>Execute Wormhole Cross-Chain Transfer</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {quote?.portalUrl && (
            <a
              href={quote.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center justify-center space-x-2 border border-slate-700"
            >
              <span>Open Portal Bridge</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          )}
        </div>
      </form>

      {/* In-Flight Transits Tracker */}
      {inFlightBridges.length > 0 && (
        <div className="pt-5 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">In-Flight Cross-Chain Transits</h4>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
              {inFlightBridges.length} active
            </span>
          </div>
          <div className="space-y-2">
            {inFlightBridges.map((bridge) => (
              <div key={bridge.txHash} className="flex justify-between items-center text-xs bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
                <div className="space-y-0.5">
                  <div className="text-slate-200 font-bold">
                    {bridge.amount} {bridge.tokenSymbol}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {bridge.sourceChain} ➔ {bridge.targetChain}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                  bridge.status === 'completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  bridge.status === 'failed' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                  'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                }`}>
                  {bridge.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Chain RPC Fallback Matrix Status */}
      <div className="pt-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Multi-Chain RPC Fallback Matrix:</span>
          </span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Latency-Optimized Failover Active
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
          {Object.entries(RPC_FALLBACK_MATRIX).slice(0, 4).map(([chain, matrix]) => (
            <div key={chain} className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-300 font-semibold">{chain}</span>
              <span className="text-emerald-400 font-mono">{matrix.endpoints.length} nodes</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

