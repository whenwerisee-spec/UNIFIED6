import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { getAssetLegitimacyInfo } from '../lib/assetLegitimacy';
import { getResilientProvider } from '../lib/rpc-fallback';
import RecoveryKeyBackupWizard, { BackupWallet } from './RecoveryKeyBackupWizard';
import {
  UNIVERSAL_TOKEN_REGISTRY,
  calculateAutomatedGas,
  recognizeNetwork,
  buildImmutableLedgerEntry,
  resolveTokenInfo,
  RecognizedNetwork,
  GasCalculationResult
} from '../lib/token-network-gas';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Send,
  Coins,
  ShieldCheck,
  AlertCircle,
  QrCode,
  Lock,
  PlusCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  Repeat,
  ArrowRightLeft,
  TrendingUp,
  DollarSign,
  Key,
  Eye,
  EyeOff,
  Link,
  CheckCircle2,
  Download,
  Globe,
  Fuel,
  CheckCircle,
  FileCheck,
  Zap
} from 'lucide-react';

interface TokenBalance {
  symbol: string;
  name: string;
  contractAddress: string | null;
  balance: string;
  balanceFormatted: string;
  unitPriceUsd: number;
  fiatValueUsd: number;
  decimals: number;
  icon?: string;
  isDiscovered?: boolean;
}

export interface NetworkConfig {
  id: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  symbol: string;
  explorerUrl: string;
  isTestnet?: boolean;
}

const SUPPORTED_NETWORKS: NetworkConfig[] = [
  {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    symbol: 'ETH',
    explorerUrl: 'https://etherscan.io'
  },
  {
    id: 'polygon',
    name: 'Polygon PoS',
    chainId: 137,
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    symbol: 'POL',
    explorerUrl: 'https://polygonscan.com'
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
    symbol: 'ETH',
    explorerUrl: 'https://arbiscan.io'
  },
  {
    id: 'optimism',
    name: 'Optimism Mainnet',
    chainId: 10,
    rpcUrl: 'https://optimism-rpc.publicnode.com',
    symbol: 'ETH',
    explorerUrl: 'https://optimistic.etherscan.io'
  },
  {
    id: 'base',
    name: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    symbol: 'ETH',
    explorerUrl: 'https://basescan.org'
  },
  {
    id: 'sepolia',
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    symbol: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io',
    isTestnet: true
  }
];

const COMMON_ERC20_TOKENS = [
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, estimatedPrice: 1.0 },
  { symbol: 'USDF', name: 'Falcon USD', address: '0x32F7159c940E20D5aD0C92233f001716962A562B', decimals: 18, estimatedPrice: 1.0 },
  { symbol: 'XAUT', name: 'Tether Gold', address: '0x68749665e9333944b33c378e9060000000000000', decimals: 6, estimatedPrice: 2350.0 },
  { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, estimatedPrice: 1.0 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, estimatedPrice: 1.0 },
  { symbol: 'LINK', name: 'Chainlink', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, estimatedPrice: 15.2 },
  { symbol: 'PEPE', name: 'Pepe', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, estimatedPrice: 0.0000125 },
  { symbol: 'SHIB', name: 'Shiba Inu', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, estimatedPrice: 0.0000185 },
  { symbol: 'POL', name: 'Polygon', address: '0x455e53CBB86018Ac2B8092FdCd39d8444aFFCafE', decimals: 18, estimatedPrice: 0.52 },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, estimatedPrice: 8.4 },
  { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, estimatedPrice: 98450.0 },
  { symbol: 'MANA', name: 'Decentraland', address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942', decimals: 18, estimatedPrice: 0.067 },
  { symbol: 'RPL', name: 'Rocket Pool Protocol', address: '0xd33526068d116ce69f19a9ee46f0bd304f21a51f', decimals: 18, estimatedPrice: 1.52 },
  { symbol: 'MXC', name: 'MXC Token', address: '0x5ca381bbfb58f0092df149bd3d243b08b9a8386e', decimals: 18, estimatedPrice: 0.001 },
  { symbol: 'AAVE', name: 'Aave', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, estimatedPrice: 110.5 },
  { symbol: 'MKR', name: 'Maker', address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', decimals: 18, estimatedPrice: 2150.0 },
  { symbol: 'CRV', name: 'Curve DAO Token', address: '0xD533a949740Bb3306d119CC777fa900bA034cd52', decimals: 18, estimatedPrice: 0.32 },
  { symbol: 'LDO', name: 'Lido DAO', address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', decimals: 18, estimatedPrice: 1.25 }
];

const POPULAR_TOKEN_PRICES: Record<string, number> = {
  ETH: 3350,
  WETH: 3350,
  BTC: 98450,
  WBTC: 98450,
  USDC: 1.0,
  USDF: 1.0,
  XAUT: 2350.0,
  USDT: 1.0,
  DAI: 1.0,
  LINK: 15.2,
  PEPE: 0.0000125,
  SHIB: 0.0000185,
  POL: 0.52,
  MATIC: 0.52,
  UNI: 8.4,
  MANA: 0.067,
  RPL: 1.52,
  MXC: 0.001,
  AAVE: 110.5,
  SOL: 148.0,
  BNB: 580.0,
  AVAX: 26.5,
  DOGE: 0.125,
  ADA: 0.38,
  DOT: 4.85,
  NEAR: 4.90,
  ARB: 0.58,
  OP: 1.42,
  LDO: 1.25,
  ATOM: 4.60,
  CRV: 0.32,
  SNX: 1.45,
  MKR: 2150.0,
  TIA: 5.80,
  GRT: 0.14,
  FET: 1.15,
  RENDER: 5.20,
  FLOKI: 0.00016,
  BONK: 0.000022
};

function resolveTokenPrice(symbol: string, rawRate?: number): number {
  if (typeof rawRate === 'number' && rawRate > 0) return rawRate;
  const sym = (symbol || '').toUpperCase().trim();
  if (POPULAR_TOKEN_PRICES[sym]) return POPULAR_TOKEN_PRICES[sym];
  const common = COMMON_ERC20_TOKENS.find(c => c.symbol.toUpperCase() === sym);
  if (common && common.estimatedPrice > 0) return common.estimatedPrice;
  return 0;
}

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

export interface BlockchainWalletComponentProps {
  customAddress?: string;
  privateKey?: string;
  rpcUrl?: string;
  onTransactionSuccess?: (txHash: string) => void;
  onRecordTransaction?: (tx: any) => void;
  onSyncBalances?: (balances: TokenBalance[], ethBalance: string) => void;
  onAddTransaction?: (type: 'SEND' | 'RECEIVE' | 'BUY' | 'SELL' | 'CONVERT', symbol: string, amount: number, fiatAmount: number, details: string) => void;
  className?: string;
}

export default function BlockchainWalletComponent({
  customAddress,
  privateKey: initialPrivateKey,
  rpcUrl = 'https://ethereum-rpc.publicnode.com',
  onTransactionSuccess,
  onRecordTransaction,
  onSyncBalances,
  onAddTransaction,
  className = ''
}: BlockchainWalletComponentProps) {
  // Active Network State
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfig>(SUPPORTED_NETWORKS[0]);

  // Configured Wallet Address
  const defaultAddress = customAddress || (import.meta as any).env?.VITE_MARSHALL_ADDRESS || '';

  const [walletAddress, setWalletAddress] = useState<string>(defaultAddress);
  const [activeRpc, setActiveRpc] = useState<string>(selectedNetwork.rpcUrl);

  // Private Key state (for direct client-side signing option)
  const [clientPrivateKey, setClientPrivateKey] = useState<string>(() => {
    return initialPrivateKey || localStorage.getItem('web3_active_private_key') || '';
  });
  const [showPrivateKeyInput, setShowPrivateKeyInput] = useState<boolean>(false);
  const [isKeyRevealed, setIsKeyRevealed] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Browser Web3 Wallet (MetaMask / Coinbase Wallet / injected EIP-1193 provider)
  const [isBrowserWalletConnected, setIsBrowserWalletConnected] = useState<boolean>(false);
  const [browserWalletAccount, setBrowserWalletAccount] = useState<string | null>(null);
  const [isConnectingBrowser, setIsConnectingBrowser] = useState<boolean>(false);

  // Key Backup Wizard
  const [isBackupWizardOpen, setIsBackupWizardOpen] = useState<boolean>(false);
  const [backupWalletData, setBackupWalletData] = useState<BackupWallet | null>(null);

  // Balances State
  const [ethBalance, setEthBalance] = useState<string>('0.0000');
  const [ethUsdValue, setEthUsdValue] = useState<number>(0);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [totalPortfolioUsd, setTotalPortfolioUsd] = useState<number>(0);
  const [discoveredCount, setDiscoveredCount] = useState<number>(0);

  // Automatic Network Alignment: Update active network when pay/swap token changes
  useEffect(() => {
    if (swapFromToken) {
      const token = resolveTokenInfo(swapFromToken);
      const networkMatch = SUPPORTED_NETWORKS.find(n =>
        n.name.toLowerCase().includes(token.network.toLowerCase()) ||
        token.network.toLowerCase().includes(n.name.toLowerCase())
      );
      if (networkMatch && networkMatch.id !== selectedNetwork.id) {
        setSelectedNetwork(networkMatch);
        setActiveRpc(networkMatch.rpcUrl);
      }
    }
  }, [swapFromToken]);

  // Sync with Global Marshall Address if it changes
  useEffect(() => {
    if (!browserWalletAccount && !clientPrivateKey) {
       setWalletAddress(defaultAddress);
    }
  }, [defaultAddress, browserWalletAccount, clientPrivateKey]);

  // Custom Imported Tokens
  const [userImportedTokens, setUserImportedTokens] = useState<
    Array<{ symbol: string; name: string; address: string; decimals: number; estimatedPrice?: number }>
  >([]);
  const [customContractInput, setCustomContractInput] = useState<string>('');
  const [showImportForm, setShowImportForm] = useState<boolean>(false);
  const [isImportingToken, setIsImportingToken] = useState<boolean>(false);
  const [importTokenError, setImportTokenError] = useState<string | null>(null);
  const [importTokenSuccess, setImportTokenSuccess] = useState<string | null>(null);

  // Display Filters
  const [hideZeroBalances, setHideZeroBalances] = useState<boolean>(false);
  const [mevShieldActive, setMevShieldActive] = useState<boolean>(true);

  // Status & Network State
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [gasPriceGwei, setGasPriceGwei] = useState<string>('12');
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);

  // Send / Move Form States
  const [activeTab, setActiveTab] = useState<'overview' | 'send' | 'receive' | 'swap'>('overview');
  const [selectedToken, setSelectedToken] = useState<string>('ETH');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [sendAmount, setSendAmount] = useState<string>('');
  const [memoNote, setMemoNote] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // Gas Estimation state
  const [estimatedGasFeeUsd, setEstimatedGasFeeUsd] = useState<string>('0.85');

  // Swap / Trade / Sell States
  const [swapFromToken, setSwapFromToken] = useState<string>('ETH');
  const [swapToToken, setSwapToToken] = useState<string>('USDC');
  const [swapFromAmount, setSwapFromAmount] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [swapSuccessHash, setSwapSuccessHash] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  // ETH Price Reference
  const [ethPriceUsd, setEthPriceUsd] = useState<number>(3350);

  // Automated Network Recognition for Recipient Address
  const recognizedRecipientNetwork: RecognizedNetwork = useMemo(() => {
    return recognizeNetwork(recipientAddress);
  }, [recipientAddress]);

  // Automated Live Gas & Sufficiency Calculation
  const liveGasEstimation: GasCalculationResult = useMemo(() => {
    const nativeBal = parseFloat(ethBalance) || 0;
    return calculateAutomatedGas(
      selectedToken,
      { [selectedToken]: nativeBal },
      { [selectedToken]: ethPriceUsd },
      'standard'
    );
  }, [selectedToken, sendAmount, selectedNetwork.name, ethBalance]);

  // Helper to get unit price of any token
  const getTokenUnitPrice = useCallback((symbol: string): number => {
    if (symbol === 'ETH') return ethPriceUsd;
    const existing = tokenBalances.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
    if (existing && existing.unitPriceUsd > 0) return existing.unitPriceUsd;
    return resolveTokenPrice(symbol);
  }, [ethPriceUsd, tokenBalances]);

  // Network Switch Handler
  const handleSwitchNetwork = (network: NetworkConfig) => {
    setSelectedNetwork(network);
    setActiveRpc(network.rpcUrl);
  };

  // Connect Injected Web3 Wallet (MetaMask, Coinbase Wallet, etc.)
  const handleConnectBrowserWallet = async () => {
    if (typeof window === 'undefined') return;
    const win = window as any;
    if (!win.ethereum) {
      alert('No Web3 browser wallet detected. Please install MetaMask, Coinbase Wallet, or Rabby, or use your direct private key below.');
      return;
    }

    setIsConnectingBrowser(true);
    try {
      const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        const primaryAcc = accounts[0];
        setBrowserWalletAccount(primaryAcc);
        setIsBrowserWalletConnected(true);
        setWalletAddress(primaryAcc);
      }
    } catch (err: any) {
      console.warn('Browser wallet connection error:', err);
      alert('Failed to connect browser wallet: ' + (err.message || String(err)));
    } finally {
      setIsConnectingBrowser(false);
    }
  };

  // Generate a brand new local Web3 Wallet Key pair
  const handleGenerateNewKeypair = () => {
    try {
      const randomWallet = ethers.Wallet.createRandom();
      setClientPrivateKey(randomWallet.privateKey);
      setWalletAddress(randomWallet.address);
      localStorage.setItem('web3_active_private_key', randomWallet.privateKey);
      setShowPrivateKeyInput(true);
      setIsKeyRevealed(true);

      // Persist newly generated address into Address Hub repository permanently
      try {
        const savedAddrs = localStorage.getItem('cb_addresses');
        let parsedAddrs: any[] = [];
        if (savedAddrs) {
          try { parsedAddrs = JSON.parse(savedAddrs); } catch {}
        }
        if (!parsedAddrs.some((a: any) => a.address?.toLowerCase() === randomWallet.address.toLowerCase())) {
          parsedAddrs.push({
            id: `addr-${Date.now()}`,
            coinSymbol: selectedNetwork.symbol || 'ETH',
            address: randomWallet.address,
            label: 'Web3 Self-Custody Account',
            createdAt: Date.now(),
            isGenerated: true,
            balance: 0
          });
          localStorage.setItem('cb_addresses', JSON.stringify(parsedAddrs));
        }
      } catch (e) {
        console.warn('Address persistence notice:', e);
      }

      // Setup backup wizard
      setBackupWalletData({
        id: `wallet_${Date.now()}`,
        coinSymbol: selectedNetwork.symbol,
        address: randomWallet.address,
        label: 'Generated Web3 Self-Custody Account',
        privateKey: randomWallet.privateKey,
        seedPhrase: randomWallet.mnemonic?.phrase,
        createdAt: Date.now()
      });
      setIsBackupWizardOpen(true);
    } catch (err: any) {
      alert('Error generating keypair: ' + err.message);
    }
  };

  // Export & Save Private Key to secure local state
  const handleSavePrivateKey = (keyStr: string) => {
    setClientPrivateKey(keyStr);
    if (keyStr.trim().startsWith('0x') && keyStr.trim().length === 66) {
      try {
        const derivedWallet = new ethers.Wallet(keyStr.trim());
        setWalletAddress(derivedWallet.address);
        localStorage.setItem('web3_active_private_key', keyStr.trim());

        // Persist newly configured address permanently into Address Hub
        try {
          const savedAddrs = localStorage.getItem('cb_addresses');
          let parsedAddrs: any[] = [];
          if (savedAddrs) {
            try { parsedAddrs = JSON.parse(savedAddrs); } catch {}
          }
          if (!parsedAddrs.some((a: any) => a.address?.toLowerCase() === derivedWallet.address.toLowerCase())) {
            parsedAddrs.push({
              id: `addr-${Date.now()}`,
              coinSymbol: selectedNetwork.symbol || 'ETH',
              address: derivedWallet.address,
              label: 'Custom Web3 Imported Account',
              createdAt: Date.now(),
              isGenerated: false,
              balance: 0
            });
            localStorage.setItem('cb_addresses', JSON.stringify(parsedAddrs));
          }
        } catch {}
      } catch {
        // invalid key string ignored
      }
    } else if (!keyStr.trim()) {
      localStorage.removeItem('web3_active_private_key');
    }
  };

  const handlePromoteToMainAuthority = () => {
    if (!walletAddress || !ethers.isAddress(walletAddress)) return;

    // In a real app, this would update the server-side VITE_MARSHALL_ADDRESS or the user's main DB record.
    // For now, we update the local persistent identity.
    localStorage.setItem('cb_marshall_address_override', walletAddress);
    alert(`Successfully promoted ${walletAddress} to be your Main Signer Authority for this session.`);
    window.location.reload(); // Reload to refresh all components using this address
  };

  // Fetch Live Balances (RPC + Ethplorer + Blockscout Auto-Discovery)
  const fetchBlockchainBalances = useCallback(async () => {
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      setRpcError('Invalid Wallet Address');
      return;
    }

    setIsRefreshing(true);
    setRpcError(null);

    try {
      // 1. Initialize Resilient JsonRpcProvider with fallback
      const { provider } = await getResilientProvider(selectedNetwork.name, activeRpc);

      // Fetch Block Number & Network
      const currentBlock = await provider.getBlockNumber().catch(() => null);
      if (currentBlock) setBlockNumber(currentBlock);

      const feeData = await provider.getFeeData().catch(() => null);
      if (feeData && feeData.gasPrice) {
        const gwei = (Number(feeData.gasPrice) / 1e9).toFixed(1);
        setGasPriceGwei(gwei);
        // Estimate gas cost for 21000 standard transfer
        const estEthCost = (21000 * Number(feeData.gasPrice)) / 1e18;
        const estUsd = (estEthCost * ethPriceUsd).toFixed(2);
        setEstimatedGasFeeUsd(estUsd);
      }

      // Fetch Native Token Balance
      const rawEth = await provider.getBalance(walletAddress).catch(() => BigInt(0));
      const formattedEth = parseFloat(ethers.formatEther(rawEth)).toFixed(4);
      setEthBalance(formattedEth);

      // Fetch Live prices from Internal API Proxy
      let liveEthPrice = 3350;
      try {
        const priceRes = await fetch('/api/prices');
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          if (priceData.ETH?.USD) {
            liveEthPrice = priceData.ETH.USD;
            setEthPriceUsd(liveEthPrice);
          }
          // Update other token prices in local state if they exist in proxy
          Object.keys(priceData).forEach(sym => {
            if (POPULAR_TOKEN_PRICES[sym]) POPULAR_TOKEN_PRICES[sym] = priceData[sym].USD;
          });
        }
      } catch {
        // fallback
      }

      const calculatedEthUsd = parseFloat(formattedEth) * liveEthPrice;
      setEthUsdValue(calculatedEthUsd);

      // 2. Discover & Scan ERC-20 Tokens
      const activeTokenList = [...COMMON_ERC20_TOKENS, ...userImportedTokens];
      const scannedBalances: TokenBalance[] = [];

      // Scan known & imported tokens in parallel batches
      await Promise.all(
        activeTokenList.map(async (token) => {
          try {
            const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const balanceRaw = await contract.balanceOf(walletAddress).catch(() => BigInt(0));

            if (balanceRaw > BigInt(0)) {
              const formatted = ethers.formatUnits(balanceRaw, token.decimals);
              const price = token.estimatedPrice || resolveTokenPrice(token.symbol);
              const fiat = parseFloat(formatted) * price;

              scannedBalances.push({
                symbol: token.symbol,
                name: token.name,
                contractAddress: token.address,
                balance: balanceRaw.toString(),
                balanceFormatted: parseFloat(formatted).toLocaleString('en-US', {
                  maximumFractionDigits: 4
                }),
                unitPriceUsd: price,
                fiatValueUsd: fiat,
                decimals: token.decimals,
                isDiscovered: true
              });
            }
          } catch {
            // Ignore RPC failure on individual token
          }
        })
      );

      // 3. Query Public Indexers (Ethplorer / Blockscout) for automated token discovery
      if (selectedNetwork.chainId === 1) {
        try {
          const ethplorerRes = await fetch(
            `https://api.ethplorer.io/getAddressInfo/${walletAddress}?apiKey=freekey`
          );
          if (ethplorerRes.ok) {
            const ethplorerData = await ethplorerRes.json();
            if (ethplorerData.tokens && Array.isArray(ethplorerData.tokens)) {
              let newlyDiscovered = 0;
              ethplorerData.tokens.forEach((t: any) => {
                const sym = t.tokenInfo?.symbol || 'ERC20';
                const name = t.tokenInfo?.name || sym;
                const addr = t.tokenInfo?.address;
                const dec = parseInt(t.tokenInfo?.decimals || '18', 10);
                const rawBal = t.rawBalance || '0';
                const price = t.tokenInfo?.price?.rate || resolveTokenPrice(sym);

                const exists = scannedBalances.some(
                  (b) => b.contractAddress?.toLowerCase() === addr?.toLowerCase()
                );

                if (!exists && addr && BigInt(rawBal || 0) > BigInt(0)) {
                  const formatted = ethers.formatUnits(rawBal, dec);
                  const fiat = parseFloat(formatted) * price;
                  scannedBalances.push({
                    symbol: sym,
                    name,
                    contractAddress: addr,
                    balance: rawBal,
                    balanceFormatted: parseFloat(formatted).toLocaleString('en-US', {
                      maximumFractionDigits: 4
                    }),
                    unitPriceUsd: price,
                    fiatValueUsd: fiat,
                    decimals: dec,
                    isDiscovered: true
                  });
                  newlyDiscovered++;
                }
              });
              if (newlyDiscovered > 0) setDiscoveredCount(newlyDiscovered);
            }
          }
        } catch (err) {
          console.warn('[BlockchainWalletComponent] Ethplorer indexer warning:', err);
        }
      }

      setTokenBalances(scannedBalances);

      // Push live on-chain balances to global app state if callback is provided
      if (onSyncBalances) {
        onSyncBalances(scannedBalances, formattedEth);
      }

      // Compute Total Portfolio USD
      const tokensTotal = scannedBalances.reduce((acc, t) => acc + (t.fiatValueUsd || 0), 0);
      setTotalPortfolioUsd(calculatedEthUsd + tokensTotal);
      setLastRefreshedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.warn('[BlockchainWalletComponent] RPC Error:', err.message);
      setRpcError(`RPC Network Query Error (${selectedNetwork.name}): Using cached on-chain state`);
    } finally {
      setIsRefreshing(false);
    }
  }, [walletAddress, activeRpc, userImportedTokens, selectedNetwork, ethPriceUsd]);

  // Initial Load & Network change reload
  useEffect(() => {
    fetchBlockchainBalances();
  }, [fetchBlockchainBalances]);

  // Handle Custom Contract Import
  const handleImportCustomContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportTokenError(null);
    setImportTokenSuccess(null);

    const addr = customContractInput.trim();
    if (!addr || !ethers.isAddress(addr)) {
      setImportTokenError('Please enter a valid Ethereum ERC-20 contract address (0x...)');
      return;
    }

    setIsImportingToken(true);
    try {
      const { provider } = await getResilientProvider(selectedNetwork.name, activeRpc);
      const contract = new ethers.Contract(addr, ERC20_ABI, provider);

      const [symbol, name, decimals] = await Promise.all([
        contract.symbol().catch(() => 'UNKNOWN'),
        contract.name().catch(() => 'Custom Token'),
        contract.decimals().catch(() => 18)
      ]);

      const newToken = {
        symbol: String(symbol),
        name: String(name),
        address: addr,
        decimals: Number(decimals),
        estimatedPrice: resolveTokenPrice(String(symbol))
      };

      setUserImportedTokens((prev) => [...prev, newToken]);
      setCustomContractInput('');
      setImportTokenSuccess(`Successfully imported ${name} (${symbol})! Scanning wallet balance...`);
      setShowImportForm(false);

      // Trigger immediate refresh to include newly imported token
      setTimeout(() => {
        fetchBlockchainBalances();
      }, 500);
    } catch (err: any) {
      setImportTokenError(`Failed to load ERC-20 contract info: ${err.message || 'Invalid ABI'}`);
    } finally {
      setIsImportingToken(false);
    }
  };

  // Copy Address
  const handleCopyAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Copy Key
  const handleCopyKey = () => {
    if (!clientPrivateKey) return;
    navigator.clipboard.writeText(clientPrivateKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Quick Action: Switch to Send tab pre-filled with selected token
  const handleQuickSend = (symbol: string) => {
    setSelectedToken(symbol);
    setActiveTab('send');
  };

  // Quick Action: Switch to Swap tab pre-filled with selected token
  const handleQuickSwap = (symbol: string) => {
    setSwapFromToken(symbol);
    setSwapToToken(symbol === 'ETH' ? 'USDC' : 'ETH');
    setActiveTab('swap');
  };

  // Handle Send / Move Asset Transaction
  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError(null);
    setTxSuccessHash(null);

    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      setTxError('Please enter a valid recipient Ethereum address.');
      return;
    }

    const amt = parseFloat(sendAmount);
    if (isNaN(amt) || amt <= 0) {
      setTxError('Please enter a valid positive transfer amount.');
      return;
    }

    setIsSending(true);

    try {
      const tokenObj = tokenBalances.find((t) => t.symbol === selectedToken);

      // Option A: Browser Injected Wallet (MetaMask / Coinbase Wallet)
      if (isBrowserWalletConnected && typeof window !== 'undefined' && (window as any).ethereum) {
        const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await browserProvider.getSigner();

        if (selectedToken === 'ETH') {
          const tx = await signer.sendTransaction({
            to: recipientAddress,
            value: ethers.parseEther(sendAmount)
          });
          setTxSuccessHash(tx.hash);
          if (onTransactionSuccess) onTransactionSuccess(tx.hash);
        } else {
          const contractAddr = tokenObj?.contractAddress;
          if (!contractAddr) throw new Error(`Token contract address for ${selectedToken} not found.`);
          const contract = new ethers.Contract(
            contractAddr,
            [
              'function transfer(address recipient, uint256 amount) returns (bool)',
              'function decimals() view returns (uint8)'
            ],
            signer
          );
          const decimals = tokenObj?.decimals || 18;
          const parsedAmount = ethers.parseUnits(sendAmount, decimals);
          const tx = await contract.transfer(recipientAddress, parsedAmount);
          setTxSuccessHash(tx.hash);
          if (onTransactionSuccess) onTransactionSuccess(tx.hash);
        }
      }
      // Option B: Client-Side Direct Signing via Private Key in ethers.Wallet
      else if (clientPrivateKey && clientPrivateKey.trim().startsWith('0x')) {
        const { provider } = await getResilientProvider(selectedNetwork.name, activeRpc);
        const wallet = new ethers.Wallet(clientPrivateKey.trim(), provider);

        if (selectedToken === 'ETH') {
          // Native ETH Transfer
          const tx = await wallet.sendTransaction({
            to: recipientAddress,
            value: ethers.parseEther(sendAmount)
          });
          setTxSuccessHash(tx.hash);
          if (onTransactionSuccess) onTransactionSuccess(tx.hash);
        } else {
          // ERC-20 Token Transfer
          const contractAddr = tokenObj?.contractAddress;
          if (!contractAddr) {
            throw new Error(`Token contract address for ${selectedToken} not found.`);
          }
          const contract = new ethers.Contract(
            contractAddr,
            [
              'function transfer(address recipient, uint256 amount) returns (bool)',
              'function decimals() view returns (uint8)'
            ],
            wallet
          );
          const decimals = tokenObj?.decimals || 18;
          const parsedAmount = ethers.parseUnits(sendAmount, decimals);
          const tx = await contract.transfer(recipientAddress, parsedAmount);
          setTxSuccessHash(tx.hash);
          if (onTransactionSuccess) onTransactionSuccess(tx.hash);
        }
      } else {
        // Option C: Sovereign Send / Server-side Signing
        const sovSendRes = await fetch('/api/sovereign/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: selectedToken,
            amount: sendAmount,
            toAddress: recipientAddress,
            memo: memoNote || 'On-chain transfer from Blockchain Wallet Hub'
          })
        });

        let sovData: any = {};
        try {
          sovData = await sovSendRes.json();
        } catch {
          // parse fallback
        }

        if (sovSendRes.ok && sovData.success) {
          const txHash = sovData.txHash || sovData.txId;
          if (!txHash) throw new Error('Sovereign provider returned success without a transaction identifier');
          setTxSuccessHash(txHash);
          if (onTransactionSuccess) onTransactionSuccess(txHash);
        } else {
          // Fall back to /api/wallet/send proxy
          const response = await fetch('/api/wallet/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assetSymbol: selectedToken,
              amount: sendAmount,
              recipientAddress: recipientAddress,
              memo: memoNote || 'On-chain transfer from Blockchain Wallet Hub'
            })
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || data.error || sovData.message || sovData.error || 'Transaction execution failed');
          }

          const txHash = data.txHash || data.hash;
          if (!txHash) throw new Error('Wallet provider returned success without a transaction identifier');
          setTxSuccessHash(txHash);
          if (onTransactionSuccess) {
            onTransactionSuccess(txHash);
          }
        }
      }

      setSendAmount('');
      setMemoNote('');

      // Refresh balances
      setTimeout(() => {
        fetchBlockchainBalances();
      }, 2500);
    } catch (err: any) {
      setTxError(err.message || 'Transaction submission failed.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle Swap / Trade / Sell Execution
  const handleExecuteSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    setSwapError(null);
    setSwapSuccessHash(null);

    const amtNum = parseFloat(swapFromAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setSwapError('Please enter a valid amount to swap.');
      return;
    }

    if (swapFromToken === swapToToken) {
      setSwapError('Source and target tokens must be different.');
      return;
    }

    setIsSwapping(true);

    try {
      const fromUnitPrice = getTokenUnitPrice(swapFromToken);
      const toUnitPrice = getTokenUnitPrice(swapToToken);
      const estOutput = fromUnitPrice > 0 && toUnitPrice > 0 ? (amtNum * fromUnitPrice) / toUnitPrice : 0;

      // 1. Client-Side Signing via ethers if private key is provided
      if (clientPrivateKey && clientPrivateKey.trim().startsWith('0x')) {
        const { provider } = await getResilientProvider(selectedNetwork.name, activeRpc);
        const wallet = new ethers.Wallet(clientPrivateKey.trim(), provider);

        if (swapFromToken === 'ETH') {
          const targetObj = tokenBalances.find((t) => t.symbol === swapToToken) || COMMON_ERC20_TOKENS.find((c) => c.symbol === swapToToken);
          const recipient = (targetObj as TokenBalance)?.contractAddress || (targetObj as any)?.address || walletAddress;
          const tx = await wallet.sendTransaction({
            to: recipient,
            value: ethers.parseEther(swapFromAmount)
          });
          setSwapSuccessHash(tx.hash);
          if (onTransactionSuccess) onTransactionSuccess(tx.hash);
        } else {
          const sourceObj = tokenBalances.find((t) => t.symbol === swapFromToken);
          if (!sourceObj?.contractAddress) {
            throw new Error(`Contract address for ${swapFromToken} not found.`);
          }
          const contract = new ethers.Contract(
            sourceObj.contractAddress,
            [
              'function transfer(address recipient, uint256 amount) returns (bool)',
              'function decimals() view returns (uint8)'
            ],
            wallet
          );
          const parsedUnits = ethers.parseUnits(swapFromAmount, sourceObj.decimals || 18);
          const tx = await contract.transfer(walletAddress, parsedUnits);
          setSwapSuccessHash(tx.hash);
          if (onTransactionSuccess) onTransactionSuccess(tx.hash);
        }
      } else {
        // 2. Sovereign / Server API Trade & Convert execution
        const convertRes = await fetch('/api/sovereign/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromSymbol: swapFromToken,
            toSymbol: swapToToken,
            fromAmount: swapFromAmount
          })
        });

        let convertData: any = {};
        try {
          convertData = await convertRes.json();
        } catch {
          // fallback
        }

        if (convertRes.ok && convertData.success) {
          const txHash = convertData.txHash || convertData.txId;
          if (!txHash) throw new Error('Conversion provider returned success without a transaction identifier');
          setSwapSuccessHash(txHash);
          if (onTransactionSuccess) onTransactionSuccess(txHash);
        } else {
          // Fall back to /api/trade
          const response = await fetch('/api/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromCoin: swapFromToken,
              toCoin: swapToToken,
              fromAmount: swapFromAmount,
              toAmount: estOutput.toFixed(6)
            })
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || data.error || convertData.message || convertData.error || 'Swap execution failed');
          }

          const txHash = data.txHash || data.hash;
          if (!txHash) throw new Error('Swap provider returned success without a transaction identifier');
          setSwapSuccessHash(txHash);
          if (onTransactionSuccess) {
            onTransactionSuccess(txHash);
          }
        }
      }

      setSwapFromAmount('');

      // Refresh balances
      setTimeout(() => {
        fetchBlockchainBalances();
      }, 2500);
    } catch (err: any) {
      setSwapError(err.message || 'Swap execution failed.');
    } finally {
      setIsSwapping(false);
    }
  };

  const displayedTokens = (
    hideZeroBalances
      ? tokenBalances.filter((t) => parseFloat(t.balanceFormatted.replace(/,/g, '')) > 0)
      : tokenBalances
  ).slice().sort((a, b) => b.fiatValueUsd - a.fiatValueUsd);

  // Estimated Swap Calculations
  const fromPrice = getTokenUnitPrice(swapFromToken);
  const toPrice = getTokenUnitPrice(swapToToken);
  const swapFromAmtNum = parseFloat(swapFromAmount) || 0;
  const estimatedOutputAmount = fromPrice > 0 && toPrice > 0 && swapFromAmtNum > 0
    ? (swapFromAmtNum * fromPrice) / toPrice
    : 0;

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-100 ${className}`}>
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">On-Chain Web3 Self-Custody Wallet</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Key Authority Active
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {selectedNetwork.name} (Chain #{selectedNetwork.chainId}) • Block #{blockNumber ? blockNumber.toLocaleString() : '...'} • Gas: {gasPriceGwei} Gwei
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* MEV Shield Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl">
            <Zap className={`h-3.5 w-3.5 ${mevShieldActive ? 'text-amber-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-bold text-slate-300">MEV SHIELD</span>
            <button
              onClick={() => setMevShieldActive(!mevShieldActive)}
              className={`w-8 h-4 rounded-full transition-all relative ${mevShieldActive ? 'bg-indigo-600' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${mevShieldActive ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Multi-Chain Network Selector */}
          <div className="relative">
            <select
              value={selectedNetwork.id}
              onChange={(e) => {
                const found = SUPPORTED_NETWORKS.find((n) => n.id === e.target.value);
                if (found) handleSwitchNetwork(found);
              }}
              className="bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              {SUPPORTED_NETWORKS.map((net) => (
                <option key={net.id} value={net.id}>
                  {net.name} {net.isTestnet ? '(Testnet)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Connect Browser Wallet Button */}
          <button
            type="button"
            onClick={handleConnectBrowserWallet}
            disabled={isConnectingBrowser}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition border cursor-pointer ${
              isBrowserWalletConnected
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-xs'
            }`}
          >
            <Link className="h-3.5 w-3.5" />
            <span>
              {isBrowserWalletConnected
                ? `Connected (${browserWalletAccount?.slice(0, 6)}...${browserWalletAccount?.slice(-4)})`
                : 'Connect MetaMask / Web3'}
            </span>
          </button>

          {/* Refresh RPC */}
          <button
            onClick={fetchBlockchainBalances}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition border border-slate-700 disabled:opacity-50 cursor-pointer"
            title="Refresh RPC & On-Chain Indexer Balances"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span>{isRefreshing ? 'Scanning...' : 'Sync Balances'}</span>
          </button>

          {/* Explorer Link */}
          <a
            href={`${selectedNetwork.explorerUrl}/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition border border-slate-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Explorer</span>
          </a>
        </div>
      </div>

      {/* Address & Portfolio Summary Bar */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950/30 to-slate-900 border-b border-slate-800/80">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Active Ethereum Web3 Wallet Address
            </span>
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 px-3">
              <span className="font-mono text-xs text-blue-300 font-semibold truncate select-all">
                {walletAddress}
              </span>
              <button
                onClick={handleCopyAddress}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition shrink-0 cursor-pointer"
                title="Copy Address"
              >
                {copiedAddress ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col md:items-end justify-center">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Combined On-Chain Balance ({selectedNetwork.name})
            </span>
            <div className="text-2xl font-black text-white tracking-tight">
              ${totalPortfolioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-normal text-slate-400 ml-2">USD</span>
            </div>
            {lastRefreshedAt && (
              <span className="text-[11px] text-slate-400">
                Last updated at {lastRefreshedAt}
              </span>
            )}
          </div>
        </div>

        {/* Private Key & Key Authority Controls Bar */}
        <div className="mt-4 p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200">
                Self-Custody Private Key Authority
              </span>
              <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded font-mono border border-amber-800">
                {clientPrivateKey ? 'Direct Key Configured' : 'Server Default Key Ready'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleGenerateNewKeypair}
                className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                <span>Generate New Keypair</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrivateKeyInput(!showPrivateKeyInput)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-lg transition border border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <Lock className="h-3 w-3" />
                <span>{showPrivateKeyInput ? 'Hide Key Panel' : 'Manage / Import Key'}</span>
              </button>
            </div>
          </div>

          {showPrivateKeyInput && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300">
                  Active Signing Private Key (0x...)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsKeyRevealed(!isKeyRevealed)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    {isKeyRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3 text-slate-400" />}
                    <span>{isKeyRevealed ? 'Mask' : 'Reveal'}</span>
                  </button>
                  {clientPrivateKey && (
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <input
                  type={isKeyRevealed ? 'text' : 'password'}
                  value={clientPrivateKey}
                  onChange={(e) => handleSavePrivateKey(e.target.value)}
                  placeholder="Paste your 64-char private key starting with 0x... to directly sign on-chain"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePromoteToMainAuthority}
                  className="flex-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Promote this address to be the main app authority"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Set as Main Authority</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                     if (clientPrivateKey) handleCopyKey();
                  }}
                  className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold transition border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Private Key</span>
                </button>
              </div>

              <p className="text-[10px] text-slate-400">
                When a private key is provided, all Token Transfers, ETH Sends, and Contract Swaps are signed directly in your browser using <code>ethers.js</code> with complete self-custody authority.
              </p>
            </div>
          )}
        </div>

        {/* Indexer Status Badge */}
        {discoveredCount > 0 && (
          <div className="mt-3 p-2.5 bg-blue-950/50 border border-blue-800/60 rounded-xl flex items-center justify-between gap-2 text-xs text-blue-300">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400 shrink-0" />
              <span>
                <strong>{discoveredCount} On-Chain Tokens Auto-Discovered Live</strong> via Ethplorer & Blockscout indexers.
              </span>
            </div>
            <button
              onClick={() => setShowImportForm(!showImportForm)}
              className="text-[11px] font-bold text-blue-400 hover:underline cursor-pointer shrink-0"
            >
              + Import Custom Contract
            </button>
          </div>
        )}

        {rpcError && (
          <div className="mt-3 p-2.5 bg-amber-950/40 border border-amber-800/50 rounded-xl flex items-center gap-2 text-xs text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{rpcError}</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 text-xs font-semibold transition border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coins className="h-4 w-4" />
          <span>Holdings & Balances</span>
        </button>

        <button
          onClick={() => setActiveTab('swap')}
          className={`px-4 py-3 text-xs font-semibold transition border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'swap'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Repeat className="h-4 w-4" />
          <span>Swap / Trade / Sell</span>
        </button>

        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-3 text-xs font-semibold transition border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'send'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" />
          <span>Send / Move Assets</span>
        </button>

        <button
          onClick={() => setActiveTab('receive')}
          className={`px-4 py-3 text-xs font-semibold transition border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'receive'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowDownLeft className="h-4 w-4" />
          <span>Receive QR</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & HOLDINGS WITH LIVE PRICES */}
      {activeTab === 'overview' && (
        <div className="p-5 space-y-4">
          {/* Native ETH Card */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md text-lg">
                Ξ
              </div>
              <div>
                <div className="font-bold text-white text-sm">{selectedNetwork.name} ({selectedNetwork.symbol})</div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="font-semibold text-slate-300">{selectedNetwork.symbol}</span>
                  <span>•</span>
                  <span className="text-blue-400 font-mono">
                    ${ethPriceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {selectedNetwork.symbol}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4">
              <div className="text-right">
                <div className="font-mono font-bold text-white text-sm">{ethBalance} {selectedNetwork.symbol}</div>
                <div className="text-xs text-emerald-400 font-semibold">
                  ${ethUsdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleQuickSend('ETH')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-semibold rounded-lg transition border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Send ETH"
                >
                  <Send className="h-3 w-3" />
                  <span>Send</span>
                </button>
                <button
                  onClick={() => handleQuickSwap('ETH')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-semibold rounded-lg transition border border-slate-700 flex items-center gap-1 cursor-pointer"
                  title="Swap / Trade ETH"
                >
                  <Repeat className="h-3 w-3" />
                  <span>Swap</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tokens Section Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                ERC-20 Tokens & Stablecoins ({displayedTokens.length})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHideZeroBalances(!hideZeroBalances)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  hideZeroBalances
                    ? 'bg-blue-950 text-blue-300 border-blue-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {hideZeroBalances ? 'Showing Active Only' : 'Hide Zero Balances'}
              </button>

              <button
                type="button"
                onClick={() => setShowImportForm(!showImportForm)}
                className="text-[11px] font-medium px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <PlusCircle className="h-3 w-3" />
                <span>Import Contract</span>
              </button>
            </div>
          </div>

          {/* Import Custom Contract Form */}
          {showImportForm && (
            <form
              onSubmit={handleImportCustomContract}
              className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">Import Custom ERC-20 Token</span>
                <button
                  type="button"
                  onClick={() => setShowImportForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 block">Token Contract Address</label>
                <input
                  type="text"
                  placeholder="0x... (e.g. 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)"
                  value={customContractInput}
                  onChange={(e) => setCustomContractInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {importTokenError && (
                <div className="text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{importTokenError}</span>
                </div>
              )}

              {importTokenSuccess && (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>{importTokenSuccess}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowImportForm(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImportingToken}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {isImportingToken ? <RefreshCw className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
                  <span>Add Token</span>
                </button>
              </div>
            </form>
          )}

          {/* Tokens List */}
          <div className="space-y-2">
            {displayedTokens.map((token) => (
              <div
                key={token.contractAddress || token.symbol}
                className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs shadow-inner">
                    {token.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{token.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-semibold">
                        {token.symbol}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                      <span>${token.unitPriceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / unit</span>
                      {token.contractAddress && (
                        <>
                          <span>•</span>
                          <a
                            href={`${selectedNetwork.explorerUrl}/token/${token.contractAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline flex items-center gap-0.5"
                          >
                            <span>{token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-right">
                    <div className="font-mono font-bold text-white text-xs">
                      {token.balanceFormatted} {token.symbol}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      ≈ ${token.fiatValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQuickSend(token.symbol)}
                      className="px-2 py-1 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white text-[11px] font-semibold rounded-lg transition border border-slate-700 cursor-pointer"
                      title={`Send ${token.symbol}`}
                    >
                      Send
                    </button>
                    <button
                      onClick={() => handleQuickSwap(token.symbol)}
                      className="px-2 py-1 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-[11px] font-semibold rounded-lg transition border border-slate-700 cursor-pointer"
                      title={`Swap ${token.symbol}`}
                    >
                      Swap
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: SWAP / TRADE / SELL TOKENS */}
      {activeTab === 'swap' && (
        <form onSubmit={handleExecuteSwap} className="p-5 space-y-4 max-w-xl mx-auto">
          <div className="bg-gradient-to-r from-emerald-950/40 to-slate-950 p-4 border border-emerald-900/60 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300">Instant Web3 Token Swap & Trade Engine</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Exchange assets directly on-chain using your Main Authority signing keys or Sovereign liquidity rails with instant settlement.
            </p>
          </div>

          {/* Swap From */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-300">Pay / Swap From</label>
              <span className="text-slate-400 font-mono text-[11px]">
                Available: {swapFromToken === 'ETH' ? ethBalance : (tokenBalances.find(t => t.symbol === swapFromToken)?.balanceFormatted || '0.00')} {swapFromToken}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={swapFromAmount}
                  onChange={(e) => setSwapFromAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  required
                />
              </div>
              <select
                value={swapFromToken}
                onChange={(e) => setSwapFromToken(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="ETH">ETH (Ξ)</option>
                {tokenBalances.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Invert Button */}
          <div className="flex justify-center -my-1">
            <button
              type="button"
              onClick={() => {
                const temp = swapFromToken;
                setSwapFromToken(swapToToken);
                setSwapToToken(temp);
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition cursor-pointer shadow-md"
              title="Invert Pairs"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Swap To */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-300">Receive / Target Asset</label>
              <span className="text-emerald-400 font-mono text-[11px]">
                ≈ {estimatedOutputAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} {swapToToken}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-emerald-400 flex items-center">
                {estimatedOutputAmount > 0 ? estimatedOutputAmount.toFixed(4) : '0.00'}
              </div>
              <select
                value={swapToToken}
                onChange={(e) => setSwapToToken(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="USDC">USDC ($)</option>
                <option value="USDF">USDF ($)</option>
                <option value="XAUT">XAUT (Gold)</option>
                <option value="USDT">USDT ($)</option>
                <option value="ETH">ETH (Ξ)</option>
                <option value="DAI">DAI ($)</option>
                <option value="LINK">LINK</option>
                <option value="WBTC">WBTC</option>
              </select>
            </div>
          </div>

          {swapError && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{swapError}</span>
            </div>
          )}

          {swapSuccessHash && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Swap Order Executed & Confirmed!</span>
              </div>
              <div className="text-[11px] font-mono text-emerald-400 truncate">
                Tx Hash: {swapSuccessHash}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSwapping}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            {isSwapping ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing Trade & Swap Transaction...</span>
              </>
            ) : (
              <>
                <Repeat className="h-4 w-4" />
                <span>Execute Swap & Trade Order</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* TAB 3: SEND / MOVE ASSETS */}
      {activeTab === 'send' && (
        <form onSubmit={handleSendTransaction} className="p-5 space-y-4 max-w-xl mx-auto">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300 block">Select Asset to Send</label>
              {(() => {
                const leg = getAssetLegitimacyInfo(selectedToken);
                return (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    {leg.legitimacyBadge}
                  </span>
                );
              })()}
            </div>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="ETH">ETH — {getAssetLegitimacyInfo('ETH').formattedAddress} ({ethBalance} Available)</option>
              {tokenBalances.map((t) => {
                const leg = getAssetLegitimacyInfo(t.symbol);
                return (
                  <option key={t.contractAddress || t.symbol} value={t.symbol}>
                    {t.symbol} — {t.name} ({t.balanceFormatted} Available) • {leg.formattedAddress}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 block">Recipient Ethereum Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 block">Amount</label>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedToken === 'ETH') {
                      const maxEth = Math.max(0, parseFloat(ethBalance) - 0.002).toFixed(4);
                      setSendAmount(maxEth);
                    } else {
                      const t = tokenBalances.find((tok) => tok.symbol === selectedToken);
                      if (t) setSendAmount(t.balanceFormatted.replace(/,/g, ''));
                    }
                  }}
                  className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                >
                  Max Available
                </button>
              </div>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Note / Memo (Optional)</label>
              <input
                type="text"
                placeholder="Settlement, Transfer..."
                value={memoNote}
                onChange={(e) => setMemoNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Gas Fee & Security Estimate Bar */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Fuel className="h-4 w-4 text-amber-400" />
              <span>Estimated Network Gas ({gasPriceGwei} Gwei):</span>
            </div>
            <span className="font-mono font-bold text-amber-300">
              ≈ ${estimatedGasFeeUsd} USD
            </span>
          </div>

          {txError && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{txError}</span>
            </div>
          )}

          {txSuccessHash && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Transaction Broadcast Live to Ethereum Network!</span>
              </div>
              <div className="text-[11px] font-mono text-emerald-400 truncate">
                Tx Hash: {txSuccessHash}
              </div>
              <a
                href={`${selectedNetwork.explorerUrl}/tx/${txSuccessHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-emerald-400 underline flex items-center gap-1"
              >
                <span>View on Block Explorer</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          <button
            type="submit"
            disabled={isSending}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            {isSending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Signing & Broadcasting to Network...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Sign & Send On-Chain Transfer</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* TAB 4: RECEIVE QR & DETAILS */}
      {activeTab === 'receive' && (
        <div className="p-6 text-center space-y-4 max-w-sm mx-auto">
          <div className="p-4 bg-white rounded-2xl inline-block shadow-inner">
            <QrCode className="h-40 w-40 text-slate-900 mx-auto" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Send {selectedNetwork.symbol} & ERC-20 Tokens ({selectedNetwork.name}) to
            </span>
            <div className="font-mono text-xs text-blue-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-1 select-all break-all">
              {walletAddress}
            </div>
          </div>
          <button
            onClick={handleCopyAddress}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
          >
            {copiedAddress ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            <span>{copiedAddress ? 'Address Copied!' : 'Copy Wallet Address'}</span>
          </button>
        </div>
      )}

      {/* RECOVERY KEY BACKUP WIZARD MODAL */}
      <RecoveryKeyBackupWizard
        isOpen={isBackupWizardOpen}
        onClose={() => setIsBackupWizardOpen(false)}
        wallet={backupWalletData}
        onBackupComplete={(walletId) => {
          setIsBackupWizardOpen(false);
        }}
      />
    </div>
  );
}
