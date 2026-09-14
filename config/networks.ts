export interface NetworkConfig {
  id: string;
  name: string;
  nativeAsset: string;
  chainId: number;
  rpcEndpoint: string;
  blockExplorer: string;
  avgBlockTimeSeconds: number;
  confirmationsRequired: number;
  baseFeeGwei: number;
  testnet: boolean;
  hotVaultAddress: string;
  coldVaultAddress: string;
}

export const SUPPORTED_NETWORKS: Record<string, NetworkConfig> = {
  bitcoin: {
    id: 'bitcoin',
    name: 'Bitcoin Mainnet',
    nativeAsset: 'BTC',
    chainId: 0,
    rpcEndpoint: 'https://btc.coinbase.com/rpc/v1',
    blockExplorer: 'https://mempool.space/tx/',
    avgBlockTimeSeconds: 600,
    confirmationsRequired: 3,
    baseFeeGwei: 15,
    testnet: false,
    hotVaultAddress: 'bc1q9rny26szrgl26u64mdg0cuhvpt2p77jwh792ka',
    coldVaultAddress: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo'
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    nativeAsset: 'ETH',
    chainId: 1,
    rpcEndpoint: 'https://mainnet.infura.io/v3/cb-node',
    blockExplorer: 'https://etherscan.io/tx/',
    avgBlockTimeSeconds: 12,
    confirmationsRequired: 12,
    baseFeeGwei: 24,
    testnet: false,
    hotVaultAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d1476B',
    coldVaultAddress: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503'
  },
  base: {
    id: 'base',
    name: 'Base L2 (Coinbase)',
    nativeAsset: 'ETH',
    chainId: 8453,
    rpcEndpoint: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org/tx/',
    avgBlockTimeSeconds: 2,
    confirmationsRequired: 5,
    baseFeeGwei: 0.05,
    testnet: false,
    hotVaultAddress: '0x39a1D8B4eC6294D290F571bF8C28b173Fdb920a6',
    coldVaultAddress: '0x220866B1A2219f40e72f5c628B65D54268cA3A9D'
  },
  solana: {
    id: 'solana',
    name: 'Solana Mainnet-Beta',
    nativeAsset: 'SOL',
    chainId: 101,
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    blockExplorer: 'https://solscan.io/tx/',
    avgBlockTimeSeconds: 0.4,
    confirmationsRequired: 32,
    baseFeeGwei: 0.000005,
    testnet: false,
    hotVaultAddress: '5tzFkiKscMRHK5ZXWBZ2M58oyDXUoxCF5NdRcxTz5W2r',
    coldVaultAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon PoS',
    nativeAsset: 'POL',
    chainId: 137,
    rpcEndpoint: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com/tx/',
    avgBlockTimeSeconds: 2.1,
    confirmationsRequired: 128,
    baseFeeGwei: 35,
    testnet: false,
    hotVaultAddress: '0xBA62BCfcAaFc6622853cca2BE6Ac7d845BC0f2Dc',
    coldVaultAddress: '0x503828976D22510aad0201ac7EC88293211D23Da'
  }
};
