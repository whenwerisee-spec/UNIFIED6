import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  Key, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Wallet,
  ExternalLink,
  Loader2,
  Globe2,
  Zap,
  ArrowRight,
  Info,
  Download,
  FileCode,
  Binary,
  Cpu,
  Fingerprint
} from 'lucide-react';
import { ethers } from 'ethers';
import { 
  generateAndVaultBip39Wallet, 
  loadAndDecryptVault, 
  listVaultMetadata, 
  VaultMetadata, 
  VaultSecrets,
  PRIMARY_WEB3_AUTHORITY_ADDRESS,
  STANDARD_HD_DERIVATION_PATH,
  deriveDeterministicHDWallet,
  deriveAndVaultDeterministicWallet,
  createDeterministicSigner,
  verifySignerAndAddressSync
} from '../lib/vault-storage';
import { 
  SUPPORTED_WORMHOLE_CHAINS, 
  calculateWormholeBridgeQuote, 
  BridgeQuote,
  formatWormholeRecipientAddress
} from '../lib/wormhole-bridge';
import { KeystoreBackupModal } from './KeystoreBackupModal';

export const VaultSecurityPanel: React.FC = () => {
  const [vaults, setVaults] = useState<VaultMetadata[]>([]);
  const [selectedVaultId, setSelectedVaultId] = useState<string>('');
  const [passphrase, setPassphrase] = useState<string>('');
  const [decryptedSecrets, setDecryptedSecrets] = useState<VaultSecrets | null>(null);
  const [showPhrase, setShowPhrase] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);

  // Deterministic Derivation & Signer Sync State
  const [showDeterministicModal, setShowDeterministicModal] = useState<boolean>(false);
  const [deterministicSeedInput, setDeterministicSeedInput] = useState<string>('');
  const [deterministicPathInput, setDeterministicPathInput] = useState<string>(STANDARD_HD_DERIVATION_PATH);
  const [deterministicVaultLabel, setDeterministicVaultLabel] = useState<string>('Deterministic Authority Signer');
  const [syncProof, setSyncProof] = useState<{
    isValid: boolean;
    signerAddress: string;
    expectedAddress: string;
    isChecksumMatch: boolean;
    recoveredSigner: string;
    signature: string;
  } | null>(null);
  const [isVerifyingSync, setIsVerifyingSync] = useState<boolean>(false);

  // Web3 Provider & Live Balance State
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [connectedBalance, setConnectedBalance] = useState<string>('0.0000');
  const [vaultBalance, setVaultBalance] = useState<string>('0.0000');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Wormhole Cross-Chain Bridging State
  const [sourceChain, setSourceChain] = useState<string>('ethereum');
  const [targetChain, setTargetChain] = useState<string>('base');
  const [bridgeAmount, setBridgeAmount] = useState<string>('0.01');
  const [bridgeToken, setBridgeToken] = useState<string>('ETH');
  const [isBridging, setIsBridging] = useState<boolean>(false);
  const [bridgeQuote, setBridgeQuote] = useState<BridgeQuote | null>(null);
  const [bridgeTxHash, setBridgeTxHash] = useState<string | null>(null);

  const selectedVault = vaults.find((v) => v.id === selectedVaultId);

  // Refresh stored vaults from local encrypted IndexedDB
  const refreshVaults = useCallback(async () => {
    try {
      const list = await listVaultMetadata();
      setVaults(list);
      if (list.length > 0 && !selectedVaultId) {
        setSelectedVaultId(list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to list local vaults.');
    }
  }, [selectedVaultId]);

  useEffect(() => {
    refreshVaults();
  }, [refreshVaults]);

  // Recalculate Wormhole bridge quote whenever parameters change
  useEffect(() => {
    const quote = calculateWormholeBridgeQuote(
      sourceChain,
      targetChain,
      bridgeAmount,
      bridgeToken,
      selectedVault?.address || connectedAccount || undefined
    );
    setBridgeQuote(quote);
  }, [sourceChain, targetChain, bridgeAmount, bridgeToken, selectedVault, connectedAccount]);

  // Connect to injected browser wallet extension (EIP-1193)
  const connectWallet = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      setError('No Web3 wallet extension found. Please install MetaMask, Coinbase Wallet, or another EIP-1193 provider.');
      return;
    }

    try {
      setError(null);
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts && accounts.length > 0) {
        setConnectedAccount(accounts[0]);
        await fetchLiveBalances(accounts[0], selectedVault?.address);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect external wallet.');
    }
  };

  // Fetch live network balances via ethers Provider
  const fetchLiveBalances = async (accountAddress?: string | null, targetVaultAddress?: string) => {
    try {
      const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');

      const targetAccount = accountAddress || connectedAccount;
      if (targetAccount && ethers.isAddress(targetAccount)) {
        const bal = await provider.getBalance(targetAccount);
        setConnectedBalance(parseFloat(ethers.formatEther(bal)).toFixed(4));
      }

      const targetVault = targetVaultAddress || selectedVault?.address || PRIMARY_WEB3_AUTHORITY_ADDRESS;
      if (targetVault && ethers.isAddress(targetVault)) {
        const vBal = await provider.getBalance(targetVault);
        setVaultBalance(parseFloat(ethers.formatEther(vBal)).toFixed(4));
      }
    } catch (err: any) {
      console.error('Failed to fetch live on-chain balances:', err);
    }
  };

  useEffect(() => {
    if (connectedAccount || selectedVault?.address) {
      fetchLiveBalances(connectedAccount, selectedVault?.address);
    }
  }, [connectedAccount, selectedVaultId]);

  // Generate a new BIP-39 Vault and persist encrypted in IndexedDB
  const handleCreateNewVault = async () => {
    if (!passphrase || passphrase.length < 6) {
      setError('Please enter a passphrase of at least 6 characters to encrypt the vault.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await generateAndVaultBip39Wallet(
        `Primary Vault (${new Date().toLocaleDateString()})`,
        passphrase,
        { coinSymbol: 'ETH', network: 'Ethereum' }
      );
      setSuccessMessage(`New BIP-39 Vault generated and encrypted at rest: ${result.address.slice(0, 6)}...${result.address.slice(-4)}`);
      await refreshVaults();
      setSelectedVaultId(result.vaultRecord.id);
      setDecryptedSecrets({
        mnemonic: result.mnemonicPhrase,
        privateKey: result.vaultRecord.metadata.id
      });
      setShowPhrase(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate vault.');
    } finally {
      setIsLoading(false);
    }
  };

  // Derive Deterministic HD Vault from Master Secret Seed or BIP-39 Phrase
  const handleDeriveAndVault = async () => {
    if (!deterministicSeedInput.trim()) {
      setError('Please enter a master secret seed, BIP-39 phrase, or private key.');
      return;
    }
    if (!passphrase || passphrase.length < 6) {
      setError('Please enter a passphrase of at least 6 characters to encrypt the deterministic vault.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await deriveAndVaultDeterministicWallet(
        deterministicVaultLabel || 'Deterministic HD Signer Authority',
        passphrase,
        deterministicSeedInput.trim(),
        {
          derivationPath: deterministicPathInput.trim() || STANDARD_HD_DERIVATION_PATH,
          targetAddress: PRIMARY_WEB3_AUTHORITY_ADDRESS,
          coinSymbol: 'ETH',
          network: 'Ethereum'
        }
      );

      setSuccessMessage(`Deterministic HD Signer derived & encrypted: ${result.derivation.address} (Path: ${result.derivation.derivationPath})`);
      await refreshVaults();
      setSelectedVaultId(result.vaultRecord.id);
      setDecryptedSecrets({
        mnemonic: result.derivation.mnemonicPhrase,
        privateKey: result.derivation.privateKey
      });
      setShowPhrase(true);
      setShowDeterministicModal(false);
      setDeterministicSeedInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to derive deterministic vault.');
    } finally {
      setIsLoading(false);
    }
  };

  // Run Cryptographic Signer & Address Sync Verification Suite
  const handleVerifySignerSync = async () => {
    setIsVerifyingSync(true);
    setError(null);
    try {
      let activeSigner: ethers.Wallet | ethers.HDNodeWallet | ethers.Signer | null = null;

      if (decryptedSecrets?.mnemonic) {
        activeSigner = createDeterministicSigner(decryptedSecrets.mnemonic, STANDARD_HD_DERIVATION_PATH);
      } else if (decryptedSecrets?.privateKey) {
        activeSigner = createDeterministicSigner(decryptedSecrets.privateKey);
      } else if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
          activeSigner = await browserProvider.getSigner();
        } catch {
          activeSigner = null;
        }
      }

      if (!activeSigner) {
        setError(`No active unlocked vault or Web3 wallet connected. Please unlock your stored vault or derive from your secret seed below to verify your key signature against ${PRIMARY_WEB3_AUTHORITY_ADDRESS || 'your configured authority address'}.`);
        setSyncProof(null);
        return;
      }

      const proof = await verifySignerAndAddressSync(activeSigner, selectedVault?.address || PRIMARY_WEB3_AUTHORITY_ADDRESS);
      setSyncProof(proof);
      if (proof.isChecksumMatch) {
        setSuccessMessage(`Signer Verified: Key for ${proof.signerAddress} is 100% synchronized with your account authority.`);
      } else {
        setError(`Signer Mismatch: Active signer is ${proof.signerAddress}, but target authority is ${proof.expectedAddress}.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete cryptographic verification check.');
    } finally {
      setIsVerifyingSync(false);
    }
  };

  // Unlock and decrypt existing vault from local IndexedDB
  const handleUnlockVault = async () => {
    if (!selectedVaultId) {
      setError('Please select a vault to unlock.');
      return;
    }
    if (!passphrase) {
      setError('Please enter your vault passphrase.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { secrets } = await loadAndDecryptVault(selectedVaultId, passphrase);
      setDecryptedSecrets(secrets);
      setShowPhrase(true);
      setSuccessMessage('Vault successfully unlocked and decrypted in memory.');
    } catch (err: any) {
      setError('Incorrect passphrase or corrupted vault record.');
      setDecryptedSecrets(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute standard transfer to the Vault address via connected Web3 Signer
  const handleInitiateTransfer = async () => {
    if (!connectedAccount) {
      setError('Please connect your external Web3 wallet first.');
      return;
    }
    if (!selectedVault?.address || !ethers.isAddress(selectedVault.address)) {
      setError('Please select a valid destination vault address.');
      return;
    }
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setError('Please specify a valid transfer amount.');
      return;
    }

    setIsTransferring(true);
    setError(null);
    setSuccessMessage(null);
    setTxHash(null);

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      // Request user confirmation in wallet
      const tx = await signer.sendTransaction({
        to: selectedVault.address,
        value: ethers.parseEther(transferAmount)
      });

      setTxHash(tx.hash);
      setSuccessMessage(`Transaction broadcasted (${tx.hash.slice(0, 10)}...). Awaiting on-chain confirmation...`);

      // Wait for 1 block confirmation
      const receipt = await tx.wait(1);
      if (receipt && receipt.status === 1) {
        setSuccessMessage(`Transfer confirmed in block ${receipt.blockNumber}! Balances updated.`);
        await fetchLiveBalances(connectedAccount, selectedVault.address);
        setTransferAmount('');
      } else {
        setError('Transaction execution reverted on-chain.');
      }
    } catch (err: any) {
      setError(err.message || 'Transaction was rejected or failed.');
    } finally {
      setIsTransferring(false);
    }
  };

  // Initiate Cross-Chain Bridge via Wormhole Portal
  const handleInitiateWormholeBridge = async () => {
    if (!connectedAccount) {
      setError('Please connect your Web3 wallet to prepare the cross-chain bridge transaction.');
      return;
    }

    const targetAddress = selectedVault?.address || connectedAccount;
    if (!targetAddress || !ethers.isAddress(targetAddress)) {
      setError('Invalid destination recipient address.');
      return;
    }

    setIsBridging(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Validate recipient address format for 32-byte Wormhole payload
      const encodedRecipient = formatWormholeRecipientAddress(targetAddress);
      
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const srcChainObj = SUPPORTED_WORMHOLE_CHAINS.find((c) => c.id === sourceChain);
      const targetChainObj = SUPPORTED_WORMHOLE_CHAINS.find((c) => c.id === targetChain);

      if (!srcChainObj || !targetChainObj) {
        throw new Error('Invalid bridge chain selection.');
      }

      setSuccessMessage(
        `Wormhole route validated for ${bridgeAmount} ${bridgeToken} -> ${targetChainObj.name}. Launching Wormhole Portal Bridge with prefilled recipient ${encodedRecipient.slice(0, 10)}...`
      );

      // Open Wormhole Portal in a secure external tab
      if (bridgeQuote?.portalUrl) {
        window.open(bridgeQuote.portalUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to prepare Wormhole cross-chain bridge.');
    } finally {
      setIsBridging(false);
    }
  };

  const words = decryptedSecrets?.mnemonic ? decryptedSecrets.mnemonic.trim().split(/\s+/) : [];

  return (
    <div id="vault-security-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 max-w-4xl mx-auto shadow-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Vault Security & Key Management</h2>
            <p className="text-sm text-slate-400">PBKDF2/AES-GCM client-side encryption & Wormhole cross-chain bridge</p>
          </div>
        </div>
        <button 
          onClick={refreshVaults}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          title="Refresh Vaults"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Target Authority Address & Deterministic Sync Banner */}
      <div className="p-4 bg-slate-950/80 border border-indigo-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Fingerprint className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-indigo-300">Target Signer Authority (EIP-55 Validated)</span>
            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono rounded-full font-bold">
              DETERMINISTIC SYNC
            </span>
          </div>
          <p className="font-mono text-xs text-slate-300 select-all">
            {PRIMARY_WEB3_AUTHORITY_ADDRESS}
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleVerifySignerSync}
            disabled={isVerifyingSync}
            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
          >
            {isVerifyingSync ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
            <span>Verify Signer Sync</span>
          </button>
        </div>
      </div>

      {/* Cryptographic Sync Proof Result */}
      {syncProof && (
        <div className={`p-4 bg-slate-950 border ${syncProof.isChecksumMatch ? 'border-emerald-500/40' : 'border-amber-500/40'} rounded-xl space-y-2 text-xs`}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className={`flex items-center space-x-2 ${syncProof.isChecksumMatch ? 'text-emerald-400' : 'text-amber-400'} font-bold`}>
              {syncProof.isChecksumMatch ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{syncProof.isChecksumMatch ? 'Cryptographic Proof: Signer & Address 100% Synchronized' : 'Cryptographic Verification: Key Belongs to Different Address'}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">secp256k1 verified</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
            <div><span className="text-slate-500">Signer Address:</span> {syncProof.signerAddress}</div>
            <div><span className="text-slate-500">Expected Address:</span> {syncProof.expectedAddress}</div>
            <div>
              <span className="text-slate-500">Address Match: </span>
              <span className={syncProof.isChecksumMatch ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {syncProof.isChecksumMatch ? 'VALID (100% MATCH)' : 'MISMATCH (Signer key does not match target)'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Signature Proof: </span>
              <span className="text-emerald-400 font-bold">
                {syncProof.recoveredSigner === syncProof.signerAddress ? 'VERIFIED (Valid secp256k1 key)' : 'FAILED'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Alert Banners */}
      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-lg flex items-center space-x-3 text-red-200 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex items-center space-x-3 text-emerald-200 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span className="break-all">{successMessage}</span>
        </div>
      )}

      {/* Vault Selection & Passphrase */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Select Stored Vault</label>
          <select 
            value={selectedVaultId}
            onChange={(e) => {
              setSelectedVaultId(e.target.value);
              setDecryptedSecrets(null);
              setShowPhrase(false);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {vaults.length === 0 && <option value="">No stored vaults found (Generate one below)</option>}
            {vaults.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} - {v.address ? `${v.address.slice(0, 6)}...${v.address.slice(-4)}` : v.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Master Vault Passphrase</label>
          <div className="relative">
            <input 
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase to encrypt/decrypt..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleUnlockVault}
          disabled={isLoading || !selectedVaultId}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition flex items-center space-x-2 cursor-pointer shadow-md shadow-indigo-600/20"
        >
          <Unlock className="w-4 h-4" />
          <span>Unlock & View Recovery Phrase</span>
        </button>

        <button
          onClick={() => setShowDeterministicModal(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-sm font-medium rounded-lg transition flex items-center space-x-2 border border-indigo-500/30 cursor-pointer"
        >
          <Binary className="w-4 h-4 text-indigo-400" />
          <span>Derive from Master Secret Seed</span>
        </button>

        <button
          onClick={handleCreateNewVault}
          disabled={isLoading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition flex items-center space-x-2 border border-slate-700 cursor-pointer"
        >
          <Key className="w-4 h-4" />
          <span>Generate New BIP-39 Vault</span>
        </button>

        <button
          onClick={() => setShowBackupModal(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition flex items-center space-x-2 border border-slate-700 cursor-pointer"
        >
          <FileCode className="w-4 h-4 text-indigo-400" />
          <span>Keystore Backup & Recovery</span>
        </button>
      </div>

      {/* Deterministic Derivation Modal / Dialog */}
      {showDeterministicModal && (
        <div className="p-5 bg-slate-950 border border-indigo-500/40 rounded-xl space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Binary className="w-4 h-4 text-indigo-400" />
              <h4 className="text-sm font-bold text-white">Deterministic HD Wallet Derivation</h4>
            </div>
            <button
              onClick={() => setShowDeterministicModal(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Master Secret Seed / BIP-39 Words / Key</label>
              <input
                type="password"
                value={deterministicSeedInput}
                onChange={(e) => setDeterministicSeedInput(e.target.value)}
                placeholder="Enter master secret seed or 12/24-word phrase..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">HD Derivation Path (BIP-44 Standard)</label>
              <input
                type="text"
                value={deterministicPathInput}
                onChange={(e) => setDeterministicPathInput(e.target.value)}
                placeholder="m/44'/60'/0'/0/0"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Vault Label</label>
            <input
              type="text"
              value={deterministicVaultLabel}
              onChange={(e) => setDeterministicVaultLabel(e.target.value)}
              placeholder="e.g. Master Sovereign Authority"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={() => setShowDeterministicModal(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDeriveAndVault}
              disabled={isLoading || !deterministicSeedInput.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg transition flex items-center space-x-1.5 cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              <span>Derive & Vault Deterministic Key</span>
            </button>
          </div>
        </div>
      )}

      {/* Decrypted Recovery Words Display */}
      {decryptedSecrets?.mnemonic && (
        <div className="border border-slate-800 bg-slate-950 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-slate-200">12-Word Recovery Phrase (Decrypted In-Memory)</span>
            </div>
            <button 
              onClick={() => setShowPhrase(!showPhrase)}
              className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
            >
              {showPhrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPhrase ? 'Hide Words' : 'Show Words'}</span>
            </button>
          </div>

          {showPhrase ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {words.map((word, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5 flex items-center space-x-2 select-all"
                >
                  <span className="text-xs text-slate-500 font-mono w-4">{idx + 1}.</span>
                  <span className="text-sm font-mono text-amber-200">{word}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-900/50 rounded-lg text-center text-xs text-slate-500 italic">
              Recovery words are hidden for screen privacy. Click "Show Words" above to reveal.
            </div>
          )}
        </div>
      )}

      {/* Web3 Live Balances & Transfer Section */}
      <div className="pt-6 border-t border-slate-800 space-y-4 bg-slate-950/40 p-5 rounded-xl border border-slate-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Live On-Chain Transfer Bridge</h3>
          </div>
          {!connectedAccount ? (
            <button
              onClick={connectWallet}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition flex items-center space-x-1.5"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect Wallet Extension</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                {connectedAccount.slice(0, 6)}...{connectedAccount.slice(-4)}
              </span>
              <button
                onClick={() => fetchLiveBalances(connectedAccount, selectedVault?.address)}
                className="p-1 text-slate-400 hover:text-white"
                title="Refresh Balances"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 bg-slate-900 rounded-lg border border-slate-800">
            <div className="text-xs text-slate-400">Connected Wallet Balance</div>
            <div className="text-lg font-semibold text-slate-200 font-mono">{connectedBalance} ETH</div>
          </div>
          <div className="p-3.5 bg-slate-900 rounded-lg border border-slate-800">
            <div className="text-xs text-slate-400">Selected Vault Balance</div>
            <div className="text-lg font-semibold text-emerald-400 font-mono">{vaultBalance} ETH</div>
          </div>
        </div>

        {/* Transfer Input & Action */}
        {connectedAccount && selectedVault?.address && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Amount to send (ETH)"
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 sm:w-1/2"
              />
              <button
                onClick={handleInitiateTransfer}
                disabled={isTransferring || !transferAmount || parseFloat(transferAmount) <= 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition flex items-center justify-center space-x-2 sm:w-1/2"
              >
                {isTransferring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming on Network...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Send to Vault Address</span>
                  </>
                )}
              </button>
            </div>

            {txHash && (
              <div className="text-xs text-slate-400 flex items-center space-x-1">
                <span>Transaction Hash:</span>
                <span className="font-mono text-indigo-400">{txHash}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cross-Chain Bridge (Wormhole Protocol) Section */}
      <div className="pt-6 border-t border-slate-800 space-y-5 bg-gradient-to-br from-slate-950/80 to-indigo-950/20 p-5 rounded-xl border border-indigo-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400 border border-indigo-500/30">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Wormhole Cross-Chain Bridge</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-2 py-0.5 rounded-full border border-indigo-500/30">
                  L2 Interoperability
                </span>
              </h3>
              <p className="text-xs text-slate-400">Route assets between Ethereum L1 and low-fee Layer 2 networks</p>
            </div>
          </div>
        </div>

        {/* Source & Destination Chain Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Source Network</label>
            <select
              value={sourceChain}
              onChange={(e) => setSourceChain(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {SUPPORTED_WORMHOLE_CHAINS.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === targetChain}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Target Destination Network</label>
            <select
              value={targetChain}
              onChange={(e) => setTargetChain(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {SUPPORTED_WORMHOLE_CHAINS.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === sourceChain}>
                  {c.icon} {c.name} (Low Fee)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bridge Amount & Asset Input */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Bridge Amount</label>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                min="0"
                value={bridgeAmount}
                onChange={(e) => setBridgeAmount(e.target.value)}
                placeholder="Amount to bridge..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
              <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">{bridgeToken}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Token</label>
            <select
              value={bridgeToken}
              onChange={(e) => setBridgeToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ETH">ETH (Native)</option>
              <option value="USDC">USDC (Stable)</option>
              <option value="WBTC">WBTC</option>
            </select>
          </div>
        </div>

        {/* Wormhole Route & Fee Breakdown Card */}
        {bridgeQuote && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs text-slate-300">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
              <span className="text-slate-400 font-medium">Route Path</span>
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span>{bridgeQuote.sourceChain.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                <span>{bridgeQuote.targetChain.name}</span>
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Estimated L2 Finality Time</span>
              <span className="font-mono text-emerald-400">{bridgeQuote.estimatedArrival}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Estimated Relayer Gas</span>
              <span className="font-mono text-slate-200">~${bridgeQuote.relayerFeeUsd.toFixed(2)} USD</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Destination Recipient</span>
              <span className="font-mono text-slate-300 truncate max-w-[200px]">
                {selectedVault?.address || connectedAccount || 'Select or connect account'}
              </span>
            </div>
          </div>
        )}

        {/* Bridge Action Button */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            onClick={handleInitiateWormholeBridge}
            disabled={isBridging || !bridgeAmount || parseFloat(bridgeAmount) <= 0}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20"
          >
            {isBridging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validating Wormhole Route...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Bridge via Wormhole Portal</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </>
            )}
          </button>

          {bridgeQuote?.portalUrl && (
            <a
              href={bridgeQuote.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-2 border border-slate-700"
            >
              <span>Open Portal UI</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          )}
        </div>

        <div className="text-[11px] text-slate-500 flex items-start gap-1.5 pt-1">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Wormhole uses decentralized guardians to attest cross-chain VAAs (Verified Action Approvals). Once emitted on {SUPPORTED_WORMHOLE_CHAINS.find(c => c.id === sourceChain)?.name || 'the source chain'}, your funds are minted or unlocked on {SUPPORTED_WORMHOLE_CHAINS.find(c => c.id === targetChain)?.name || 'the target chain'}.
          </span>
        </div>
      </div>

      {/* Keystore Backup & Recovery Modal */}
      <KeystoreBackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        vaults={vaults}
        selectedVaultId={selectedVaultId}
        onVaultImported={async () => {
          await refreshVaults();
          setSuccessMessage('Keystore imported successfully! Vault list updated.');
        }}
      />
    </div>
  );
};
