/**
 * Wormhole Cross-Chain Bridging Utility & Configuration
 * Provides standard chain definitions, contract routing addresses, and bridge transaction preparation
 * for routing assets across Ethereum, Base, Arbitrum, Optimism, Polygon, and Solana.
 */
import { ethers } from 'ethers';

export interface WormholeChain {
  id: string;
  name: string;
  wormholeChainId: number;
  evmChainId?: number;
  nativeCurrency: string;
  explorerUrl: string;
  tokenBridgeAddress: string;
  coreBridgeAddress: string;
  icon: string;
  averageBridgeTime: string;
  estimatedRelayerFeeUsd: number;
}

export const SUPPORTED_WORMHOLE_CHAINS: WormholeChain[] = [
  {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    wormholeChainId: 2,
    evmChainId: 1,
    nativeCurrency: 'ETH',
    explorerUrl: 'https://etherscan.io',
    tokenBridgeAddress: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585',
    coreBridgeAddress: '0x98f3c974277a842666321509eb3b900d43b2f1aa',
    icon: '⟠',
    averageBridgeTime: '~15 mins (Finalized block)',
    estimatedRelayerFeeUsd: 12.50
  },
  {
    id: 'base',
    name: 'Base Layer 2',
    wormholeChainId: 30,
    evmChainId: 8453,
    nativeCurrency: 'ETH',
    explorerUrl: 'https://basescan.org',
    tokenBridgeAddress: '0x8d2de8d2f73F1F4cAB472AC9Ca3c42b2d09cdF1E',
    coreBridgeAddress: '0xbebdb6C8ddC67d1604F12F55682Fa979147EecBB',
    icon: '🔵',
    averageBridgeTime: '~2 mins',
    estimatedRelayerFeeUsd: 0.15
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    wormholeChainId: 23,
    evmChainId: 42161,
    nativeCurrency: 'ETH',
    explorerUrl: 'https://arbiscan.io',
    tokenBridgeAddress: '0x0b2402144Bb366A632D14B83F244D2e0e21bD39c',
    coreBridgeAddress: '0xa5f208e072434b47242ef5ca023ec495a4401c76',
    icon: '🔷',
    averageBridgeTime: '~5 mins',
    estimatedRelayerFeeUsd: 0.25
  },
  {
    id: 'optimism',
    name: 'OP Mainnet',
    wormholeChainId: 24,
    evmChainId: 10,
    nativeCurrency: 'ETH',
    explorerUrl: 'https://optimistic.etherscan.io',
    tokenBridgeAddress: '0x1D68124e65faFC907325e3EDbF8c8567310574f2',
    coreBridgeAddress: '0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722',
    icon: '🔴',
    averageBridgeTime: '~5 mins',
    estimatedRelayerFeeUsd: 0.20
  },
  {
    id: 'polygon',
    name: 'Polygon PoS',
    wormholeChainId: 5,
    evmChainId: 137,
    nativeCurrency: 'POL',
    explorerUrl: 'https://polygonscan.com',
    tokenBridgeAddress: '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE',
    coreBridgeAddress: '0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7',
    icon: '🟣',
    averageBridgeTime: '~10 mins',
    estimatedRelayerFeeUsd: 0.05
  },
  {
    id: 'solana',
    name: 'Solana Mainnet-Beta',
    wormholeChainId: 1,
    nativeCurrency: 'SOL',
    explorerUrl: 'https://solscan.io',
    tokenBridgeAddress: 'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb',
    coreBridgeAddress: 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth',
    icon: '🟢',
    averageBridgeTime: '~1 min',
    estimatedRelayerFeeUsd: 0.01
  },
  {
    id: 'bsc',
    name: 'BNB Smart Chain',
    wormholeChainId: 4,
    evmChainId: 56,
    nativeCurrency: 'BNB',
    explorerUrl: 'https://bscscan.com',
    tokenBridgeAddress: '0xB6F6D86a8f9879A9c87f643768d9efc38c1Da6E7',
    coreBridgeAddress: '0x98f3c974277a842666321509eb3b900d43b2f1aa',
    icon: '🟡',
    averageBridgeTime: '~3 mins',
    estimatedRelayerFeeUsd: 0.35
  }
];

export interface BridgeQuote {
  sourceChain: WormholeChain;
  targetChain: WormholeChain;
  amount: string;
  tokenSymbol: string;
  sourceFeeEth: string;
  relayerFeeUsd: number;
  estimatedArrival: string;
  routeType: 'Standard Portal Bridge' | 'Automatic Relayer';
  portalUrl: string;
}

/**
 * Calculates a cross-chain bridging quote for Wormhole transfers
 */
export function calculateWormholeBridgeQuote(
  sourceChainId: string,
  targetChainId: string,
  amount: string,
  tokenSymbol: string = 'ETH',
  destinationAddress?: string
): BridgeQuote {
  const source = SUPPORTED_WORMHOLE_CHAINS.find((c) => c.id === sourceChainId) || SUPPORTED_WORMHOLE_CHAINS[0];
  const target = SUPPORTED_WORMHOLE_CHAINS.find((c) => c.id === targetChainId) || SUPPORTED_WORMHOLE_CHAINS[1];

  const parsedAmount = parseFloat(amount) || 0;
  
  // Base source chain gas estimate
  const sourceFeeEth = source.id === 'ethereum' ? '0.0035' : '0.0002';
  const relayerFeeUsd = target.estimatedRelayerFeeUsd;

  // Build Portal Bridge deep link with source/target parameters
  const portalUrl = `https://portalbridge.com/#/transfer?sourceChain=${source.id}&targetChain=${target.id}${
    destinationAddress ? `&targetAddress=${destinationAddress}` : ''
  }&amount=${parsedAmount > 0 ? parsedAmount : ''}`;

  return {
    sourceChain: source,
    targetChain: target,
    amount,
    tokenSymbol,
    sourceFeeEth,
    relayerFeeUsd,
    estimatedArrival: target.averageBridgeTime,
    routeType: 'Automatic Relayer',
    portalUrl
  };
}

/**
 * Standard ABI interface for Wormhole Bridge contract interaction (Read / Simulation)
 */
export const WORMHOLE_BRIDGE_ABI = [
  'function wrapAndTransferETH(uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) payable returns (uint64 sequence)',
  'function transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) payable returns (uint64 sequence)',
  'function messageFee() view returns (uint256)'
];

/**
 * Encodes an EVM address or cross-chain recipient into a standard 32-byte Wormhole recipient format
 */
export function formatWormholeRecipientAddress(address: string): string {
  if (!address) return '0x' + '0'.repeat(64);
  const trimmed = address.trim();
  if (ethers.isAddress(trimmed)) {
    return ethers.zeroPadValue(trimmed, 32);
  }
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed;
  }
  // For Solana / non-EVM base58 addresses, generate standard 32-byte hash representation
  try {
    const utf8Bytes = ethers.toUtf8Bytes(trimmed);
    return ethers.keccak256(utf8Bytes);
  } catch {
    return '0x' + '0'.repeat(64);
  }
}
