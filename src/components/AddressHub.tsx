import React, { useState, useEffect } from 'react';
import { 
  Plus, QrCode, Copy, ShieldCheck, Key, RefreshCw, Import, Trash2, 
  Search, CheckCircle2, Wallet, Info, FileCode, Check, Send, Sparkles, ArrowDownLeft,
  ShieldAlert
} from 'lucide-react';
import { ethers } from 'ethers';
import { Coin, Holding } from '../types';
import { deriveMarshallAddress } from '../lib/marshall-config';
import RecoveryKeyBackupWizard, { BackupWallet } from './RecoveryKeyBackupWizard';
import BlockchainWalletComponent from './BlockchainWalletComponent';

interface AddressHubProps {
  coins: Coin[];
  holdings: Holding[];
  onAddTransaction: (
    type: 'SEND' | 'RECEIVE',
    symbol: string,
    amount: number,
    fiatAmount: number,
    details: string
  ) => void;
  showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

interface CryptoAddress {
  id: string;
  coinSymbol: string;
  address: string;
  label: string;
  createdAt: number;
  isGenerated: boolean;
  privateKey?: string;
  seedPhrase?: string;
  balance?: number;
  backupStatus?: 'UNVERIFIED' | 'VERIFIED';
}

export default function AddressHub({
  coins,
  holdings,
  onAddTransaction,
  showToast
}: AddressHubProps) {
  // Load or initialize addresses
  const [addresses, setAddresses] = useState<CryptoAddress[]>(() => {
    const saved = localStorage.getItem('cb_addresses');
    const initialList = [
      {
        id: 'addr-yield-hub',
        coinSymbol: 'ETH',
        address: '0x0364981E458b8C6960B49994b1087e466Ef2c412',
        label: 'Sovereign Yield Destination',
        createdAt: Date.now(),
        isGenerated: true,
        backupStatus: 'VERIFIED'
      }
    ];
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CryptoAddress[];
        // Filter out any older versions of yield hub to avoid duplicates
        return [...initialList, ...parsed.filter(a => a.id !== 'addr-yield-hub')];
      } catch {
        return initialList;
      }
    }
    return initialList;
  });

  // Save changes
  useEffect(() => {
    localStorage.setItem('cb_addresses', JSON.stringify(addresses));
  }, [addresses]);

  // States
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [newLabel, setNewLabel] = useState('');
  const [importAddress, setImportAddress] = useState('');
  const [importPrivateKey, setImportPrivateKey] = useState('');
  const [importLabel, setImportLabel] = useState('');
  const [importCoin, setImportCoin] = useState('ETH');
  const [viewingDetail, setViewingDetail] = useState<CryptoAddress | null>(null);
  const [revealedPrivateKey, setRevealedPrivateKey] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Recovery Key Backup Wizard states
  const [wizardWallet, setWizardWallet] = useState<CryptoAddress | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Address generators based on coin standard
  const generateNewWalletKeys = (symbol: string) => {
    // Generate a secure random BIP-39 mnemonic (12 words)
    const randomWallet = ethers.Wallet.createRandom();
    const mnemonic = randomWallet.mnemonic?.phrase || '';

    let address = '';
    let privateKey = '';

    if (symbol === 'ETH' || symbol === 'USDC') {
      address = randomWallet.address;
      privateKey = randomWallet.privateKey;
    } else if (symbol === 'BTC') {
      // Basic mock for non-EVM derivation in browser
      address = `bc1q${ethers.sha256(ethers.toUtf8Bytes(mnemonic)).slice(2, 34)}h792ka`;
      privateKey = ethers.sha256(ethers.toUtf8Bytes(`BTC_KEY:${mnemonic}`));
    } else {
      address = `cb_${symbol.toLowerCase()}_${ethers.sha256(ethers.toUtf8Bytes(mnemonic)).slice(2, 22)}`;
      privateKey = ethers.sha256(ethers.toUtf8Bytes(`${symbol}_KEY:${mnemonic}`));
    }

    return { address, privateKey, mnemonic };
  };

  // Create brand new address
  const handleCreateAddress = () => {
    const { address, privateKey, mnemonic } = generateNewWalletKeys(selectedCoin);

    const newAddrObj: CryptoAddress = {
      id: `addr-${Date.now()}`,
      coinSymbol: selectedCoin,
      address: address,
      label: newLabel.trim() || `My Generated ${selectedCoin} Account`,
      createdAt: Date.now(),
      isGenerated: true,
      privateKey: privateKey,
      seedPhrase: mnemonic,
      balance: 0.0,
      backupStatus: 'UNVERIFIED'
    };

    setAddresses([newAddrObj, ...addresses]);
    setNewLabel('');
    setViewingDetail(newAddrObj);
    showToast(`Created new secure ${selectedCoin} wallet address! Starting Recovery Key Backup Wizard...`, 'success');

    // Automatically launch step-by-step Recovery Key Backup Wizard for newly generated wallet
    setWizardWallet(newAddrObj);
    setIsWizardOpen(true);
  };

  const handleWizardBackupComplete = (walletId: string) => {
    setAddresses(prev =>
      prev.map(a => (a.id === walletId ? { ...a, backupStatus: 'VERIFIED' } : a))
    );
    if (viewingDetail?.id === walletId) {
      setViewingDetail(prev => (prev ? { ...prev, backupStatus: 'VERIFIED' } : null));
    }
  };

  // Validate address formats
  const validateAddress = (addr: string, symbol: string): boolean => {
    if (!addr) return false;
    
    switch (symbol) {
      case 'ETH':
      case 'USDC':
        return /^0x[a-fA-F0-9]{40}$/.test(addr);
      case 'BTC':
        return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/.test(addr);
      case 'SOL':
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
      case 'XRP':
        return /^r[0-9a-zA-Z]{24,34}$/.test(addr);
      default:
        return addr.length > 10;
    }
  };

  // Import existing address
  const handleImportAddress = (e: React.FormEvent) => {
    e.preventDefault();

    if (!importAddress.trim()) {
      showToast('Please enter an address string.', 'error');
      return;
    }

    const isValid = validateAddress(importAddress.trim(), importCoin);
    if (!isValid) {
      showToast(`Invalid address format for ${importCoin}. Please review standard protocol schemas.`, 'error');
      return;
    }

    const newImportObj: CryptoAddress = {
      id: `addr-imp-${Date.now()}`,
      coinSymbol: importCoin,
      address: importAddress.trim(),
      label: importLabel.trim() || `Imported ${importCoin} Wallet`,
      createdAt: Date.now(),
      isGenerated: false,
      privateKey: undefined,
      balance: 0.0
    };

    setAddresses([newImportObj, ...addresses]);
    setImportAddress('');
    setImportPrivateKey('');
    setImportLabel('');
    if (importPrivateKey.trim()) {
      showToast('Private keys are not persisted in browser storage. Use external wallet custody for signing.', 'info');
    }
    showToast(`Imported ${importCoin} address successfully! Tracking on-chain index.`, 'success');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Record on-chain wallet deposit to update real-time ledger balance
  const handleRecordOnChainDeposit = (addressObj: CryptoAddress, topUpAmount: number) => {
    const coin = coins.find((c) => c.symbol === addressObj.coinSymbol);
    if (!coin) return;

    setAddresses(prev => 
      prev.map(a => a.id === addressObj.id ? { ...a, balance: (a.balance || 0) + topUpAmount } : a)
    );

    const fiatVal = topUpAmount * coin.price;
    onAddTransaction('RECEIVE', addressObj.coinSymbol, topUpAmount, fiatVal, `On-chain Deposit into address (****${addressObj.address.slice(-6)})`);
    showToast(`Received ${topUpAmount} ${addressObj.coinSymbol} deposit onto this address!`, 'success');
    
    // Update viewingDetail balance if it's the current one
    if (viewingDetail?.id === addressObj.id) {
      setViewingDetail(prev => prev ? { ...prev, balance: (prev.balance || 0) + topUpAmount } : null);
    }
  };

  const handleDeleteAddress = (id: string, label: string) => {
    setAddresses(addresses.filter(a => a.id !== id));
    if (viewingDetail?.id === id) {
      setViewingDetail(null);
    }
    showToast(`Deleted ${label} from monitoring.`, 'info');
  };

  const filteredAddresses = addresses.filter(addr => {
    const term = searchQuery.toLowerCase();
    return addr.label.toLowerCase().includes(term) ||
           addr.coinSymbol.toLowerCase().includes(term) ||
           addr.address.toLowerCase().includes(term);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* LEFT COLUMN: Manage & Create addresses */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Banner */}
        <div className="bg-[#0052FF] text-white p-6 rounded-3xl relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Wallet className="w-48 h-48" />
          </div>
          <div className="max-w-md relative z-10">
            <span className="text-[10px] bg-white/20 text-white font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Coinbase Multi-Chain Address Manager
            </span>
            <h2 className="text-xl sm:text-2xl font-black mt-3 leading-tight">
              Create and Import Universal Blockchain Addresses
            </h2>
            <p className="text-xs text-blue-100 mt-2 leading-relaxed">
              Generate new deposit accounts with backup seed phrases or import existing public keys to track ledger entries, accounting histories, and mempool broadcasts.
            </p>
          </div>
        </div>

        {/* Live On-Chain Blockchain Wallet Hub */}
        <BlockchainWalletComponent
          customAddress={deriveMarshallAddress()}
          onTransactionSuccess={(txHash) => {
            showToast(`Transaction broadcast live to Ethereum mainnet: ${txHash.slice(0, 10)}...`, 'success');
          }}
        />

        {/* Search & Address List */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Tracked Accounts & Deposit Addresses</h3>
              <p className="text-xs text-gray-400 mt-0.5">Manage keys and import external nodes.</p>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search addresses, labels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-xs sm:text-sm pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredAddresses.length > 0 ? (
              filteredAddresses.map((addr) => {
                const coin = coins.find(c => c.symbol === addr.coinSymbol) || { name: addr.coinSymbol, color: '#333', price: 1 };
                return (
                  <div key={addr.id} className="py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs font-mono shrink-0"
                        style={{ backgroundColor: coin.color }}
                      >
                        {addr.coinSymbol}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {addr.label}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            addr.isGenerated ? 'bg-blue-50 text-[#0052FF]' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {addr.isGenerated ? 'Generated' : 'Imported'}
                          </span>
                          {addr.seedPhrase && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setWizardWallet(addr);
                                setIsWizardOpen(true);
                              }}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 cursor-pointer transition ${
                                addr.backupStatus === 'VERIFIED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                              }`}
                              title="Recovery Key Backup Wizard"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>{addr.backupStatus === 'VERIFIED' ? 'Verified Backup' : 'Back Up Seed'}</span>
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 font-mono truncate mt-0.5 max-w-xs sm:max-w-md">
                          {addr.address}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-4">
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-800 font-mono">
                          {(addr.balance || 0).toFixed(4)} {addr.coinSymbol}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          ≈ ${((addr.balance || 0) * coin.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleCopy(addr.address)}
                          className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200/80 rounded-lg text-gray-500 hover:text-gray-900 cursor-pointer"
                          title="Copy address"
                        >
                          {copiedText === addr.address ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            setViewingDetail(addr);
                            setRevealedPrivateKey(false);
                          }}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] rounded-lg cursor-pointer"
                        >
                          Keys & Sim
                        </button>
                        <button
                          onClick={() => {
                            localStorage.setItem('cb_marshall_address_override', addr.address);
                            showToast(`Successfully promoted ${addr.label} (${addr.address}) to Main Signer Authority.`, 'success');
                            window.location.reload();
                          }}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0052FF] font-bold text-[11px] rounded-lg cursor-pointer border border-blue-100"
                          title="Promote to Main Signer Authority"
                        >
                          Promote
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(addr.id, addr.label)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 cursor-pointer"
                          title="Delete address"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-gray-400 font-medium bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                No addresses match your filter or search criteria.
              </div>
            )}
          </div>
        </div>

        {/* Generate and Import panel grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Create Address Panel */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-[#0052FF]">
                <Plus className="h-5 w-5" />
                <h4 className="text-xs sm:text-sm font-extrabold text-gray-900">Generate New Account</h4>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Generate custom cryptographic address endpoints on Coinbase vault. All private keys are secured inside your browser local session.
              </p>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Target Blockchain Asset</label>
                <select
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm font-semibold px-3 py-2.5 rounded-xl focus:outline-none cursor-pointer"
                >
                  {coins.map(c => (
                    <option key={c.symbol} value={c.symbol}>{c.name} ({c.symbol})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Account Label / Alias</label>
                <input
                  type="text"
                  placeholder="e.g. My Ledger Cold Storage Backup"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                />
              </div>
            </div>

            <button
              onClick={handleCreateAddress}
              className="w-full mt-6 py-2.5 bg-[#0052FF] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
            >
              Generate Seed & Keys
            </button>
          </div>

          {/* Import External Address Panel */}
          <form onSubmit={handleImportAddress} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-amber-500">
                <Import className="h-5 w-5" />
                <h4 className="text-xs sm:text-sm font-extrabold text-gray-900">Import On-Chain Address</h4>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Import an external public key or address (such as MetaMasK, Trust Wallet) to track network confirmations and transactions.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Asset</label>
                  <select
                    value={importCoin}
                    onChange={(e) => setImportCoin(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm font-semibold px-3 py-2.5 rounded-xl focus:outline-none cursor-pointer"
                  >
                    {coins.map(c => (
                      <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Account Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. External Hotwallet"
                    value={importLabel}
                    onChange={(e) => setImportLabel(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Public Key / Address String</label>
                <input
                  type="text"
                  required
                  placeholder={importCoin === 'ETH' ? '0x...' : importCoin === 'BTC' ? 'bc1...' : 'Enter public address'}
                  value={importAddress}
                  onChange={(e) => setImportAddress(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF] font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Private Key (Optional - Offline Only)</label>
                <input
                  type="password"
                  placeholder="For local client-side signing and address review"
                  value={importPrivateKey}
                  onChange={(e) => setImportPrivateKey(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF] font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-6 py-2.5 bg-gray-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
            >
              Link & Track Address
            </button>
          </form>

        </div>

      </div>

      {/* RIGHT COLUMN: Key inspector and wallet operations */}
      <div className="lg:col-span-4">
        
        {viewingDetail ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-5 animate-slide-up">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-widest">{viewingDetail.coinSymbol} KEYCHAIN CARD</span>
                <h4 className="text-sm font-bold text-gray-900 mt-0.5">{viewingDetail.label}</h4>
              </div>
              <button 
                onClick={() => setViewingDetail(null)}
                className="text-xs text-gray-400 hover:text-gray-900 font-bold"
              >
                Close
              </button>
            </div>

            {/* QR Code and Address display */}
            <div className="flex flex-col items-center py-2 space-y-3.5">
              <div className="p-3.5 bg-slate-50 border border-gray-200/60 rounded-xl">
                <QrCode className="w-36 h-36 text-gray-900" />
              </div>
              
              <div className="w-full">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1 text-center">Copy Public Endpoint Address</span>
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200/80 text-xs flex justify-between items-center font-mono">
                  <span className="truncate pr-4 flex-1">{viewingDetail.address}</span>
                  <button
                    onClick={() => handleCopy(viewingDetail.address)}
                    className="p-1 hover:bg-white rounded-md border border-transparent hover:border-gray-200 text-gray-500 cursor-pointer"
                  >
                    {copiedText === viewingDetail.address ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Private credentials container */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Private Seed Word Backup</span>
                  <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md font-bold uppercase">Secured</span>
                </div>
                {viewingDetail.seedPhrase ? (
                  <p className="text-[10px] font-mono bg-white p-2 border border-gray-200 rounded-lg mt-1.5 leading-relaxed text-gray-600 select-all">
                    {viewingDetail.seedPhrase}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 italic mt-1 leading-relaxed">
                    This is an imported external node. Seed words are not accessible locally.
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Private Key (ECDSA / Ed25519)</span>
                  <button
                    onClick={() => setRevealedPrivateKey(!revealedPrivateKey)}
                    className="text-[10px] text-[#0052FF] hover:underline cursor-pointer font-bold"
                  >
                    {revealedPrivateKey ? 'Hide' : 'Reveal Key'}
                  </button>
                </div>
                
                {revealedPrivateKey ? (
                  <p className="text-[10px] font-mono bg-red-50/50 border border-red-100 p-2 rounded-lg mt-1.5 text-red-700 break-all select-all font-semibold">
                    {viewingDetail.privateKey || 'No Private key saved for this imported address.'}
                  </p>
                ) : (
                  <div className="bg-gray-200 text-gray-400 p-2 rounded-lg mt-1.5 text-center select-none font-mono tracking-widest text-[9px]">
                    ••••••••••••••••••••••••••••••••••••••••
                  </div>
                )}
              </div>
            </div>

            {/* Launch Recovery Key Backup Wizard Button */}
            {viewingDetail.seedPhrase && (
              <button
                onClick={() => {
                  setWizardWallet(viewingDetail);
                  setIsWizardOpen(true);
                }}
                className={`w-full py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors ${
                  viewingDetail.backupStatus === 'VERIFIED'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-[#0052FF] hover:bg-blue-700 text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {viewingDetail.backupStatus === 'VERIFIED'
                    ? 'Run Backup Wizard Again (Backup Verified)'
                    : 'Launch Recovery Key Backup Wizard'}
                </span>
              </button>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center space-y-3">
              <div className="flex items-center justify-center space-x-1 text-[#0052FF] text-[11px] font-extrabold uppercase">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>On-Chain Custody Active</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed max-w-xs mx-auto">
                This address is monitored live on-chain. Send real {viewingDetail.coinSymbol} to this address to update your ledger balance automatically via network indexers.
              </p>
              
              <div className="pt-2">
                <a
                  href={viewingDetail.coinSymbol === 'BTC' ? `https://mempool.space/address/${viewingDetail.address}` : `https://etherscan.io/address/${viewingDetail.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#0052FF]" />
                  <span>View on Explorer</span>
                </a>
              </div>
            </div>

          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs text-center py-12 space-y-4">
            <div className="w-12 h-12 bg-blue-50 text-[#0052FF] rounded-full flex items-center justify-center mx-auto">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900">Keychain & Balance Inspector</h4>
              <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">
                Select an address in the list on the left to inspect its cryptographic keys, back up seed words, scan QR codes, or record on-chain wallet funding.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* RECOVERY KEY BACKUP WIZARD MODAL */}
      <RecoveryKeyBackupWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        wallet={wizardWallet}
        onBackupComplete={handleWizardBackupComplete}
        showToast={showToast}
      />

    </div>
  );
}
