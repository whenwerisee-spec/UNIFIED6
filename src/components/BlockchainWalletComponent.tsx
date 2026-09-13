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
  { symbol: 'LDO', name: 'Lido DAO', address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', decimals: 18, estimatedPrice: 1.25 },
  { symbol: 'BONK', name: 'Bonk', address: '0x0000000000000000000000000000000000000000', decimals: 5, estimatedPrice: 0.000022 },
  { symbol: 'FLOKI', name: 'Floki', address: '0xcf0C122c6b955209Ee307f1682569C0b63D7f60A', decimals: 9, estimatedPrice: 0.00016 },
  { symbol: 'TIA', name: 'Celestia', address: '0x0000000000000000000000000000000000000000', decimals: 18, estimatedPrice: 5.80 },
  { symbol: 'GRT', name: 'The Graph', address: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', decimals: 18, estimatedPrice: 0.14 },
  { symbol: 'FET', name: 'Fetch.ai', address: '0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85', decimals: 18, estimatedPrice: 1.15 }
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
  onAddressChange?: (address: string) => void;
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
  onAddressChange,
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
        if (onAddressChange) onAddressChange(primaryAcc);
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
      if (onAddressChange) onAddressChange(randomWallet.address);
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

  // Fetch On-Chain Balances
  const fetchBlockchainBalances = async () => {
    if (!walletAddress || !ethers.isAddress(walletAddress)) return;

    setIsRefreshing(true);
    setRpcError(null);

    try {
      // Connect to resilient provider
      const provider = await getResilientProvider(activeRpc);

      // 1. Fetch Native Currency Balance (ETH/POL/etc.)
      const nativeBalance = await provider.getBalance(walletAddress);
      const nativeBalanceFormatted = ethers.formatEther(nativeBalance);
      setEthBalance(parseFloat(nativeBalanceFormatted).toFixed(4));
      setEthUsdValue(parseFloat(nativeBalanceFormatted) * ethPriceUsd);

      // 2. Fetch Gas Price & Block Number
      const feeData = await provider.getFeeData();
      const currentBlock = await provider.getBlockNumber();
      setBlockNumber(currentBlock);

      if (feeData.gasPrice) {
        setGasPriceGwei(ethers.formatUnits(feeData.gasPrice, 'gwei').split('.')[0]);
      }

      // 3. Scan Common ERC-20 Tokens
      const results: TokenBalance[] = [];
      let discovered = 0;

      // Combine Common + User Imported
      const allTokensToScan = [...COMMON_ERC20_TOKENS, ...userImportedTokens];

      // Multi-call batching simulation
      const promises = allTokensToScan.map(async (token) => {
        try {
          const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
          const bal = await contract.balanceOf(walletAddress);

          if (bal > 0n) {
            const formatted = ethers.formatUnits(bal, token.decimals);
            const unitPrice = resolveTokenPrice(token.symbol, token.estimatedPrice);
            discovered++;
            return {
              symbol: token.symbol,
              name: token.name,
              contractAddress: token.address,
              balance: bal.toString(),
              balanceFormatted: formatted,
              unitPriceUsd: unitPrice,
              fiatValueUsd: parseFloat(formatted) * unitPrice,
              decimals: token.decimals
            };
          }
        } catch (e) {
          // Silent fail for individual tokens
        }
        return null;
      });

      const resolvedBalances = await Promise.all(promises);
      resolvedBalances.forEach(b => { if (b) results.push(b); });

      setTokenBalances(results);
      setDiscoveredCount(discovered);

      // 4. Calculate Total Portfolio USD
      const totalTokensVal = results.reduce((sum, b) => sum + b.fiatValueUsd, 0);
      setTotalPortfolioUsd(totalTokensVal + (parseFloat(nativeBalanceFormatted) * ethPriceUsd));

      setLastRefreshedAt(new Date().toLocaleTimeString());

      // Callback to parent if provided
      if (onSyncBalances) {
        onSyncBalances(results, nativeBalanceFormatted);
      }

    } catch (err: any) {
      console.error('Web3 Refresh Error:', err);
      setRpcError(err.message || 'Failed to connect to RPC endpoint');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Trigger Refresh on load or address change
  useEffect(() => {
    if (walletAddress && ethers.isAddress(walletAddress)) {
      fetchBlockchainBalances();
    }
  }, [walletAddress, activeRpc]);

  // Handle Copy Address
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Handle Token Import
  const handleImportToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customContractInput || !ethers.isAddress(customContractInput)) {
      setImportTokenError('Invalid ERC-20 contract address');
      return;
    }

    setIsImportingToken(true);
    setImportTokenError(null);

    try {
      const provider = await getResilientProvider(activeRpc);
      const contract = new ethers.Contract(customContractInput, ERC20_ABI, provider);

      const [symbol, name, decimals] = await Promise.all([
        contract.symbol(),
        contract.name(),
        contract.decimals()
      ]);

      const newToken = {
        symbol,
        name,
        address: customContractInput,
        decimals: Number(decimals),
        estimatedPrice: resolveTokenPrice(symbol)
      };

      setUserImportedTokens(prev => [...prev, newToken]);
      setImportTokenSuccess(`Successfully imported ${name} (${symbol})`);
      setCustomContractInput('');
      setShowImportForm(false);
      fetchBlockchainBalances();
    } catch (err: any) {
      setImportTokenError('Failed to fetch token metadata. Ensure you are on the correct network.');
    } finally {
      setIsImportingToken(false);
    }
  };

  // Handle Send Transaction
  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientAddress || !sendAmount) return;

    setIsSending(true);
    setTxError(null);
    setTxSuccessHash(null);

    try {
      const provider = await getResilientProvider(activeRpc);
      let signer;

      if (isBrowserWalletConnected && browserWalletAccount) {
        const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
        signer = await browserProvider.getSigner();
      } else if (clientPrivateKey) {
        signer = new ethers.Wallet(clientPrivateKey, provider);
      } else {
        throw new Error('No signing method available. Connect a wallet or enter a private key.');
      }

      let txHash = '';

      if (selectedToken === 'ETH') {
        const tx = await signer.sendTransaction({
          to: recipientAddress,
          value: ethers.parseEther(sendAmount)
        });
        txHash = tx.hash;
        await tx.wait();
      } else {
        const token = [...COMMON_ERC20_TOKENS, ...userImportedTokens].find(t => t.symbol === selectedToken);
        if (!token) throw new Error('Token configuration not found');
        const contract = new ethers.Contract(token.address, ['function transfer(address to, uint256 amount) returns (bool)'], signer);
        const tx = await contract.transfer(recipientAddress, ethers.parseUnits(sendAmount, token.decimals));
        txHash = tx.hash;
        await tx.wait();
      }

      setTxSuccessHash(txHash);
      if (onTransactionSuccess) onTransactionSuccess(txHash);
      if (onAddTransaction) {
        onAddTransaction('SEND', selectedToken, parseFloat(sendAmount), parseFloat(sendAmount) * getTokenUnitPrice(selectedToken), `Sent to ${recipientAddress}`);
      }
      fetchBlockchainBalances();
    } catch (err: any) {
      setTxError(err.message || 'Transaction failed');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl ${className}`}>
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
              {selectedNetwork?.name || 'Unknown Network'} (Chain #{selectedNetwork?.chainId || 0}) • Block #{blockNumber ? blockNumber.toLocaleString() : '...'} • Gas: {gasPriceGwei} Gwei
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
              className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer ${mevShieldActive ? 'bg-amber-500' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${mevShieldActive ? 'translate-x-3' : 'translate-x-0'}`} />
            </button>
          </div>

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
            href={`${selectedNetwork?.explorerUrl || '#'}/address/${walletAddress}`}
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
              Combined On-Chain Balance ({selectedNetwork?.name || 'Active Network'})
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
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Internal Signer Authority</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPrivateKeyInput(!showPrivateKeyInput)}
                className="text-[10px] text-slate-400 hover:text-white font-bold transition flex items-center gap-1 cursor-pointer"
              >
                {showPrivateKeyInput ? 'Close Signer' : 'Import Private Key'}
              </button>
              <div className="w-1 h-1 rounded-full bg-slate-700" />
              <button
                onClick={handleGenerateNewKeypair}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle className="h-3 w-3" />
                <span>Generate New Secure Identity</span>
              </button>
            </div>
          </div>

          {showPrivateKeyInput && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-lg">
              <input
                type={isKeyRevealed ? 'text' : 'password'}
                value={clientPrivateKey}
                onChange={(e) => {
                  setClientPrivateKey(e.target.value);
                  if (ethers.isHexString(e.target.value, 32)) {
                    const wallet = new ethers.Wallet(e.target.value);
                    setWalletAddress(wallet.address);
                    if (onAddressChange) onAddressChange(wallet.address);
                    localStorage.setItem('web3_active_private_key', e.target.value);
                  }
                }}
                placeholder="Enter 0x... Private Key for client-side signing"
                className="bg-transparent border-none focus:ring-0 text-xs text-white flex-1 font-mono"
              />
              <button onClick={() => setIsKeyRevealed(!isKeyRevealed)} className="p-1 hover:bg-slate-800 rounded text-slate-400 cursor-pointer">
                {isKeyRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center bg-slate-950/40 border-b border-slate-800 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 text-xs font-semibold transition border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="h-4 w-4" />
          <span>Holdings</span>
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
          <span>Send Assets</span>
        </button>
        <button
          onClick={() => setActiveTab('swap')}
          className={`px-4 py-3 text-xs font-semibold transition border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'swap'
              ? 'border-blue-500 text-blue-400 bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowRightLeft className="h-4 w-4" />
          <span>Bridge / Swap</span>
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
                <div className="font-bold text-white text-sm">{selectedNetwork?.name || 'Network'} ({selectedNetwork?.symbol || '...'})</div>
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
              <button
                onClick={() => { setActiveTab('send'); setSelectedToken('ETH'); }}
                className="p-2 bg-slate-800 hover:bg-blue-600/30 border border-slate-700 hover:border-blue-500/50 rounded-lg text-slate-300 hover:text-blue-300 transition cursor-pointer"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Token List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Coins className="h-3 w-3" />
                Asset Inventory ({tokenBalances.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowImportForm(!showImportForm)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="h-3 w-3" />
                  Import
                </button>
              </div>
            </div>

            {showImportForm && (
              <form onSubmit={handleImportToken} className="bg-slate-800/40 border border-slate-700 p-4 rounded-xl mb-4 space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Import ERC-20 Token</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customContractInput}
                    onChange={(e) => setCustomContractInput(e.target.value)}
                    placeholder="Enter Contract Address (0x...)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <button
                    disabled={isImportingToken}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    {isImportingToken ? 'Checking...' : 'Import'}
                  </button>
                </div>
                {importTokenError && <p className="text-[10px] text-rose-400 font-bold">{importTokenError}</p>}
                {importTokenSuccess && <p className="text-[10px] text-emerald-400 font-bold">{importTokenSuccess}</p>}
              </form>
            )}

            {tokenBalances.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {tokenBalances.map((token) => (
                  <div key={token.contractAddress} className="bg-slate-900/40 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex items-center justify-between group transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-[10px] text-slate-400">
                        {token.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{token.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                          <span>${token.unitPriceUsd.toLocaleString()}</span>
                          <span>•</span>
                          <span className="text-slate-500">{token.symbol}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs font-bold text-white font-mono">{token.balanceFormatted}</div>
                        <div className="text-[10px] text-emerald-400 font-bold">${token.fiatValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <button
                        onClick={() => { setActiveTab('send'); setSelectedToken(token.symbol); }}
                        className="p-1.5 bg-slate-800 group-hover:bg-blue-600/20 border border-slate-700 group-hover:border-blue-500/40 rounded-lg text-slate-400 group-hover:text-blue-400 transition cursor-pointer"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-950/20 border border-dashed border-slate-800 rounded-2xl">
                <div className="mb-2 flex justify-center">
                  <Coins className="h-6 w-6 text-slate-700" />
                </div>
                <p className="text-xs text-slate-500 font-medium italic">No token balances discovered on this network yet.</p>
                <button
                   onClick={fetchBlockchainBalances}
                   className="mt-3 text-[10px] font-bold text-blue-500 hover:underline cursor-pointer"
                >
                  Scan Network Now
                </button>
              </div>
            )}
          </div>

          {/* Network Selector Cards */}
          <div className="pt-4 border-t border-slate-800">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Switch Network Context</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SUPPORTED_NETWORKS.map(net => (
                <button
                  key={net.id}
                  onClick={() => handleSwitchNetwork(net)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    selectedNetwork.id === net.id
                      ? 'bg-blue-600/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-[10px] font-black truncate">{net.name}</div>
                  <div className="text-[9px] font-bold opacity-60">Chain ID: {net.chainId}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SEND ASSETS FORM */}
      {activeTab === 'send' && (
        <div className="p-6">
           <form onSubmit={handleSendTransaction} className="space-y-5">
              <div className="space-y-4">
                {/* Token Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Select Asset to Move</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedToken('ETH')}
                      className={`p-3 rounded-xl border flex items-center gap-3 transition cursor-pointer ${
                        selectedToken === 'ETH' ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-slate-800/40 border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white text-[10px]">Ξ</div>
                      <div className="text-xs font-bold">{selectedNetwork.symbol}</div>
                    </button>
                    {tokenBalances.slice(0, 1).map(b => (
                      <button
                        key={`sel-${b.symbol}`}
                        type="button"
                        onClick={() => setSelectedToken(b.symbol)}
                        className={`p-3 rounded-xl border flex items-center gap-3 transition cursor-pointer ${
                          selectedToken === b.symbol ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-slate-800/40 border-slate-700 text-slate-400'
                        }`}
                      >
                         <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center font-bold text-white text-[10px]">{b.symbol.slice(0, 1)}</div>
                         <div className="text-xs font-bold">{b.symbol}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient Address */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Destination Address</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder="0x... Recipient Address"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none pr-10 font-mono"
                    />
                    <div className="absolute right-3 top-3">
                       {recognizedRecipientNetwork.isDetected && (
                         <div className="text-[10px] font-black text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-500/30">
                           {recognizedRecipientNetwork.name}
                         </div>
                       )}
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount ({selectedToken})</label>
                    <button
                      type="button"
                      onClick={() => setSendAmount(selectedToken === 'ETH' ? ethBalance : (tokenBalances.find(b => b.symbol === selectedToken)?.balanceFormatted || '0'))}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                    >
                      MAX: {selectedToken === 'ETH' ? ethBalance : (tokenBalances.find(b => b.symbol === selectedToken)?.balanceFormatted || '0.00')}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                    />
                    <div className="absolute right-4 top-3.5 text-xs text-slate-500 font-bold">
                       ≈ ${(parseFloat(sendAmount || '0') * getTokenUnitPrice(selectedToken)).toLocaleString()} USD
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Banner */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3">
                 <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                 <div>
                    <p className="text-[10px] text-white font-bold mb-0.5">Automated Risk Protection Active</p>
                    <p className="text-[9px] text-slate-400">All transactions are scanned for known malicious contracts and drained-wallet patterns before broadcasting.</p>
                 </div>
              </div>

              <button
                disabled={isSending || !sendAmount || !recipientAddress}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition shadow-lg shadow-blue-900/20 disabled:opacity-50 cursor-pointer"
              >
                {isSending ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Broadcasting to {selectedNetwork.name}...</span>
                  </div>
                ) : `Initiate Secure ${selectedToken} Transfer`}
              </button>

              {txError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-[10px] font-bold">{txError}</span>
                </div>
              )}

              {txSuccessHash && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-[10px] font-bold">Transaction Confirmed & Broadcasted</span>
                  </div>
                  <a
                    href={`${selectedNetwork.explorerUrl}/tx/${txSuccessHash}`}
                    target="_blank"
                    className="text-[10px] text-blue-400 hover:underline font-mono truncate"
                  >
                    TX: {txSuccessHash}
                  </a>
                </div>
              )}
           </form>
        </div>
      )}

      {/* TAB 3: BRIDGE / SWAP FORM (Simulation & Execution) */}
      {activeTab === 'swap' && (
        <div className="p-6 space-y-6">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
             <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
               <span>Cross-Chain Smart Routing</span>
               <div className="flex items-center gap-1 text-emerald-500">
                  <Sparkles className="h-3 w-3" />
                  <span>Best Rate Found</span>
               </div>
             </div>

             <div className="space-y-2">
                <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl">
                   <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">You Pay</span>
                      <span className="text-[10px] text-slate-500 font-bold">Balance: {swapFromToken === 'ETH' ? ethBalance : (tokenBalances.find(b => b.symbol === swapFromToken)?.balanceFormatted || '0.00')}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <input
                        type="number"
                        value={swapFromAmount}
                        onChange={(e) => setSwapFromAmount(e.target.value)}
                        placeholder="0.00"
                        className="bg-transparent border-none focus:ring-0 text-xl font-bold text-white placeholder-slate-700 w-1/2"
                      />
                      <select
                        value={swapFromToken}
                        onChange={(e) => setSwapFromToken(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none"
                      >
                         <option value="ETH">ETH</option>
                         {tokenBalances.map(b => <option key={`from-${b.symbol}`} value={b.symbol}>{b.symbol}</option>)}
                      </select>
                   </div>
                </div>

                <div className="flex justify-center -my-3 relative z-10">
                   <button className="bg-blue-600 border-4 border-slate-900 p-2 rounded-xl text-white shadow-xl hover:rotate-180 transition duration-500">
                      <Repeat className="h-5 w-5" />
                   </button>
                </div>

                <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl">
                   <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">You Receive</span>
                      <span className="text-[10px] text-slate-500 font-bold italic">Est. Price Impact: {"<0.1%"}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <div className="text-xl font-bold text-slate-500">
                        {swapFromAmount ? (parseFloat(swapFromAmount) * (getTokenUnitPrice(swapFromToken) / getTokenUnitPrice(swapToToken))).toFixed(6) : '0.00'}
                      </div>
                      <select
                        value={swapToToken}
                        onChange={(e) => setSwapToToken(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none"
                      >
                         <option value="USDC">USDC</option>
                         <option value="ETH">ETH</option>
                         <option value="XAUT">XAUT (Gold)</option>
                         <option value="PEPE">PEPE</option>
                         {tokenBalances.map(b => <option key={`to-${b.symbol}`} value={b.symbol}>{b.symbol}</option>)}
                      </select>
                   </div>
                </div>
             </div>

             <div className="p-3 bg-slate-950/40 rounded-xl space-y-2 border border-slate-800/50">
                <div className="flex justify-between text-[10px]">
                   <span className="text-slate-500 font-bold uppercase">Execution Route</span>
                   <span className="text-blue-400 font-black">UNIFIED-LIQUIDITY (DEX)</span>
                </div>
                <div className="flex justify-between text-[10px]">
                   <span className="text-slate-500 font-bold uppercase">Gas Estimate</span>
                   <span className="text-slate-300 font-bold">~ $1.42 USD</span>
                </div>
             </div>

             <button className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition shadow-lg shadow-blue-900/20 cursor-pointer">
                Swap Assets Now
             </button>
          </div>
        </div>
      )}

      {/* TAB 4: RECEIVE QR COMPONENT */}
      {activeTab === 'receive' && (
        <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
           <div className="p-6 bg-white rounded-3xl shadow-2xl border-8 border-slate-800">
              <QrCode className="h-48 w-48 text-slate-900" />
           </div>

           <div className="space-y-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Your Receiving Address</h3>
              <p className="text-xs text-slate-400 font-medium max-w-xs leading-relaxed">
                Use this address to receive ETH or any ERC-20 tokens on <strong className="text-blue-400">{selectedNetwork.name}</strong>.
              </p>
           </div>

           <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 group">
              <span className="font-mono text-xs text-blue-300 font-semibold truncate select-all">{walletAddress}</span>
              <button
                onClick={handleCopyAddress}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition shrink-0 cursor-pointer"
              >
                {copiedAddress ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
           </div>

           <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-tighter">Verified Private Chain Authority</span>
           </div>
        </div>
      )}

      {/* Footer / Status Bar */}
      <div className="p-3 px-5 bg-slate-950/80 border-t border-slate-800/60 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${rpcError ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`}></span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {rpcError ? 'RPC Connection Failure' : `Connected: ${activeRpc.split('/')[2]}`}
            </span>
         </div>
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
               <Fuel className="h-3 w-3 text-amber-500" />
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{gasPriceGwei} GWEI</span>
            </div>
            {lastRefreshedAt && (
              <span className="text-[9px] font-bold text-slate-500">REFRESHED: {lastRefreshedAt}</span>
            )}
         </div>
      </div>

      {/* Backup Wizard Overlay */}
      {isBackupWizardOpen && backupWalletData && (
        <RecoveryKeyBackupWizard
           wallet={backupWalletData}
           onClose={() => setIsBackupWizardOpen(false)}
        />
      )}
    </div>
  );
}
