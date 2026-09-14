import React, { useState, useEffect } from 'react';
import { Fuel, Zap, Globe, ArrowRightLeft, ShieldCheck, Wallet, RefreshCw, CheckCircle2, Layers } from 'lucide-react';
import { NetworkGasInfo } from '../types';

interface Web3GasHubProps {
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export default function Web3GasHub({ showToast }: Web3GasHubProps) {
  // Live gas ticker state
  const [gasData, setGasData] = useState<NetworkGasInfo[]>([
    {
      network: 'Ethereum Mainnet',
      symbol: 'ETH',
      gweiStandard: 14,
      gweiFast: 18,
      usdEstimatedTransferFee: 1.15,
      blockTimeSeconds: 12,
      status: 'optimal'
    },
    {
      network: 'Base (Coinbase L2)',
      symbol: 'ETH (Base)',
      gweiStandard: 0.004,
      gweiFast: 0.006,
      usdEstimatedTransferFee: 0.003,
      blockTimeSeconds: 2,
      status: 'optimal'
    },
    {
      network: 'Solana High-Throughput',
      symbol: 'SOL',
      gweiStandard: 0.0001,
      gweiFast: 0.0002,
      usdEstimatedTransferFee: 0.00025,
      blockTimeSeconds: 0.4,
      status: 'optimal'
    },
    {
      network: 'Arbitrum One',
      symbol: 'ARB-ETH',
      gweiStandard: 0.1,
      gweiFast: 0.15,
      usdEstimatedTransferFee: 0.04,
      blockTimeSeconds: 0.25,
      status: 'optimal'
    },
    {
      network: 'Polygon PoS',
      symbol: 'POL',
      gweiStandard: 32,
      gweiFast: 45,
      usdEstimatedTransferFee: 0.015,
      blockTimeSeconds: 2.1,
      status: 'optimal'
    }
  ]);

  // Bridge calculator state
  const [bridgeFrom, setBridgeFrom] = useState('Ethereum Mainnet');
  const [bridgeTo, setBridgeTo] = useState('Base (Coinbase L2)');
  const [bridgeAsset, setBridgeAsset] = useState('USDC');
  const [bridgeAmount, setBridgeAmount] = useState('500');

  // Web3 Wallet state
  const [connectedWallet, setConnectedWallet] = useState<string | null>('Coinbase Smart Wallet (0x71C7...476B)');

  // Gas refresh simulation
  const handleRefreshGas = () => {
    setGasData((prev) =>
      prev.map((g) => ({
        ...g,
        gweiStandard: Math.max(0.001, +(g.gweiStandard + (Math.random() - 0.5) * (g.gweiStandard * 0.1)).toFixed(3)),
        gweiFast: Math.max(0.002, +(g.gweiFast + (Math.random() - 0.5) * (g.gweiFast * 0.1)).toFixed(3))
      }))
    );
    showToast('Network gas metrics refreshed from mempool', 'info');
  };

  const handleSimulateBridge = () => {
    showToast(`Simulated bridge of ${bridgeAmount} ${bridgeAsset} from ${bridgeFrom} to ${bridgeTo} completed in 1.4s!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-semibold mb-3">
              <Fuel className="w-3.5 h-3.5" />
              On-Chain Mempool & Gas Tracker
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Web3 Ecosystem & Multi-Chain Gas Hub
            </h1>
            <p className="text-gray-500 text-sm sm:text-base mt-1 max-w-2xl">
              Real-time gas price tracking across Ethereum L1, Base L2, Solana, and rollup ecosystems. Plan your decentralized transactions and bridge assets with minimal slippage.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshGas}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Mempool
            </button>
          </div>
        </div>

        {/* Highlight: Base L2 savings */}
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0052FF] flex items-center justify-center text-white font-bold text-base shadow-xs">
              B
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                Base L2 Network by Coinbase
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                  99.4% Cheaper than L1
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                Standard transfer fee: <strong>$0.003</strong> • Finality time: <strong>&lt; 2 seconds</strong>
              </div>
            </div>
          </div>

          <button
            onClick={() => showToast('Switched default network preference to Base L2', 'success')}
            className="px-4 py-2 rounded-xl bg-[#0052FF] text-white text-xs font-semibold hover:bg-blue-600 cursor-pointer shrink-0"
          >
            Route via Base L2
          </button>
        </div>
      </div>

      {/* Multi-chain Gas Comparison Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Live Multi-Chain Gas Rates</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gasData.map((net) => (
            <div
              key={net.network}
              className="p-5 rounded-xl border border-gray-200 hover:border-blue-300 transition-all bg-white shadow-xs"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-gray-900 text-sm">{net.network}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold uppercase">
                  {net.status}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Standard Gas:</span>
                  <span className="font-semibold text-gray-900">{net.gweiStandard} Gwei</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Priority (Fast):</span>
                  <span className="font-semibold text-gray-900">{net.gweiFast} Gwei</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Est. Transfer Cost:</span>
                  <span className="font-bold text-emerald-600">${net.usdEstimatedTransferFee}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Average Block Time:</span>
                  <span className="text-gray-700">{net.blockTimeSeconds}s</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-Chain Bridge Estimator */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <ArrowRightLeft className="w-5 h-5 text-[#0052FF]" />
          <h2 className="text-lg font-bold text-gray-900">Cross-Chain Bridge & Hop Estimator</h2>
        </div>
        <p className="text-xs text-gray-500 mb-6">
          Calculate native bridge fees and liquidity times between Layer-1 and Layer-2 rollups.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Origin Network</label>
            <select
              value={bridgeFrom}
              onChange={(e) => setBridgeFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
            >
              <option value="Ethereum Mainnet">Ethereum Mainnet (L1)</option>
              <option value="Base (Coinbase L2)">Base (Coinbase L2)</option>
              <option value="Arbitrum One">Arbitrum One</option>
              <option value="Polygon PoS">Polygon PoS</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Destination Network</label>
            <select
              value={bridgeTo}
              onChange={(e) => setBridgeTo(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
            >
              <option value="Base (Coinbase L2)">Base (Coinbase L2)</option>
              <option value="Ethereum Mainnet">Ethereum Mainnet (L1)</option>
              <option value="Arbitrum One">Arbitrum One</option>
              <option value="Polygon PoS">Polygon PoS</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Amount ({bridgeAsset})</label>
            <input
              type="number"
              value={bridgeAmount}
              onChange={(e) => setBridgeAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
              placeholder="100"
            />
          </div>

          <div>
            <button
              onClick={handleSimulateBridge}
              className="w-full py-2.5 rounded-xl bg-[#0052FF] text-white text-xs font-semibold hover:bg-blue-600 transition-colors cursor-pointer shadow-xs"
            >
              Estimate & Simulate Bridge
            </button>
          </div>
        </div>

        <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-200/70 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-gray-500">Estimated Duration:</span>
            <div className="font-bold text-gray-900 text-sm mt-0.5">~1-2 minutes (Optimistic Relay)</div>
          </div>
          <div>
            <span className="text-gray-500">Protocol Bridge Fee:</span>
            <div className="font-bold text-emerald-600 text-sm mt-0.5">$0.00 (Zero Fee Promotion)</div>
          </div>
          <div>
            <span className="text-gray-500">Net Arrival:</span>
            <div className="font-bold text-gray-900 text-sm mt-0.5">
              {bridgeAmount} {bridgeAsset}
            </div>
          </div>
        </div>
      </div>

      {/* Web3 Wallet Simulator Card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-[#0052FF]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Self-Custodial Web3 Wallet Status</h3>
              <p className="text-xs text-gray-500">Connected: {connectedWallet || 'None'}</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (connectedWallet) {
                setConnectedWallet(null);
                showToast('Disconnected Web3 self-custody wallet', 'info');
              } else {
                setConnectedWallet('Coinbase Smart Wallet (0x71C7...476B)');
                showToast('Connected to Coinbase Smart Wallet via passkey', 'success');
              }
            }}
            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            {connectedWallet ? 'Disconnect' : 'Connect Smart Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}
