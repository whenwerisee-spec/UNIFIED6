/**
 * Unified Portfolio & Multi-Asset State Synchronization Engine
 * Implements a single source of truth for all on-chain balances,
 * derived fiat valuations, active addresses, and aggregated total net worth.
 */

export interface AssetBalance {
  symbol: string;           // e.g. 'ETH', 'BTC', 'USDC', 'SOL'
  name: string;             // e.g. 'Ethereum', 'Bitcoin'
  decimals: number;         // e.g. 18 for ETH, 8 for BTC, 6 for USDC
  balanceRaw: string;       // Stringified BigInt/raw amount to avoid precision loss
  balanceFormatted: string; // Human-readable token amount (e.g. '1.4520')
  priceUsd: number;         // Oracle spot price in USD
  fiatValue: number;        // Derived: parseFloat(balanceFormatted) * priceUsd
  change24h: number;        // 24h percentage change
  network: string;          // e.g. 'Ethereum', 'Bitcoin', 'Solana'
  depositAddress?: string;  // Primary mapped address
}

export interface PortfolioState {
  activeAddresses: {
    connectedWallet?: string | null;  // Active EIP-1193 browser extension address
    selectedVault?: string | null;     // Decrypted / active local vault address
    monitoredAddresses: string[];      // Additional tracked addresses
  };
  balances: Record<string, AssetBalance>;
  totalNetWorthFiat: number;           // Calculated EXACTLY ONCE here
  lastSyncedTimestamp: number;
}

export interface OracleMeta {
  priceUsd: number;
  change24h: number;
  name: string;
  decimals: number;
  network: string;
}

// Global default oracle price feeds (fallback / baseline)
export const DEFAULT_ORACLE_PRICES: Record<string, OracleMeta> = {
  BTC: { name: 'Bitcoin', priceUsd: 98450.0, change24h: 1.2, decimals: 8, network: 'Bitcoin' },
  ETH: { name: 'Ethereum', priceUsd: 3350.0, change24h: -0.4, decimals: 18, network: 'Ethereum' },
  SOL: { name: 'Solana', priceUsd: 145.0, change24h: 2.1, decimals: 9, network: 'Solana' },
  USDC: { name: 'USD Coin', priceUsd: 1.0, change24h: 0.0, decimals: 6, network: 'Ethereum / Base' },
  USDF: { name: 'Falcon USD', priceUsd: 1.0, change24h: 0.0, decimals: 18, network: 'Ethereum' },
  XAUT: { name: 'Tether Gold', priceUsd: 2350.0, change24h: 0.5, decimals: 6, network: 'Ethereum' },
  LEO: { name: 'UNUS SED LEO', priceUsd: 5.85, change24h: -0.1, decimals: 18, network: 'Ethereum' },
  POL: { name: 'Polygon', priceUsd: 0.52, change24h: 1.5, decimals: 18, network: 'Polygon' },
  WISE_CAD: { name: 'Wise CAD Balance', priceUsd: 0.74, change24h: 0.00, decimals: 2, network: 'Wise Payout' },
  WISE_USD: { name: 'Wise USD Cash', priceUsd: 1.00, change24h: 0.00, decimals: 2, network: 'Wise Banking' },
};

/**
 * Derives the unified PortfolioState by computing each asset balance and summing
 * totalNetWorthFiat in one deterministic pass.
 */
export function computeUnifiedPortfolioState(
  rawHoldings: Record<string, { amount: number | string; depositAddress?: string }>,
  activeAddresses: {
    connectedWallet?: string | null;
    selectedVault?: string | null;
    monitoredAddresses?: string[];
  },
  customPrices?: Record<string, number>
): PortfolioState {
  const balances: Record<string, AssetBalance> = {};
  let totalNetWorthFiat = 0;

  for (const [symbol, holding] of Object.entries(rawHoldings)) {
    const meta: OracleMeta = DEFAULT_ORACLE_PRICES[symbol] || {
      name: symbol,
      priceUsd: 1.0,
      change24h: 0.0,
      decimals: 18,
      network: 'EVM'
    };

    const priceUsd = customPrices && customPrices[symbol] !== undefined 
      ? customPrices[symbol] 
      : meta.priceUsd;

    const amountNum = typeof holding.amount === 'string' ? parseFloat(holding.amount) || 0 : holding.amount;
    const fiatVal = amountNum * priceUsd;

    balances[symbol] = {
      symbol,
      name: meta.name,
      decimals: meta.decimals,
      balanceRaw: (BigInt(Math.floor(amountNum * Math.pow(10, Math.min(meta.decimals, 6))))).toString(),
      balanceFormatted: amountNum.toFixed(meta.decimals > 8 ? 4 : meta.decimals),
      priceUsd,
      fiatValue: fiatVal,
      change24h: meta.change24h,
      network: meta.network,
      depositAddress: holding.depositAddress
    };

    totalNetWorthFiat += fiatVal;
  }

  return {
    activeAddresses: {
      connectedWallet: activeAddresses.connectedWallet || null,
      selectedVault: activeAddresses.selectedVault || null,
      monitoredAddresses: activeAddresses.monitoredAddresses || []
    },
    balances,
    totalNetWorthFiat,
    lastSyncedTimestamp: Date.now()
  };
}
