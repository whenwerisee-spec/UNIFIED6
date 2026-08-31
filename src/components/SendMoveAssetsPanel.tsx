import React, { useState } from 'react';
import { ethers } from 'ethers';
import { Send, ArrowRight, ShieldCheck, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePortfolioStore } from '../store/portfolio-store';
import { useTransactionExecutor } from '../hooks/useTransactionExecutor';

interface SendMoveAssetsPanelProps {
  refetchBalancesNow: () => Promise<void>;
}

export const SendMoveAssetsPanel: React.FC<SendMoveAssetsPanelProps> = ({ refetchBalancesNow }) => {
  const { executeStandardTransfer, isProcessing, activeTxHash } = useTransactionExecutor(refetchBalancesNow);
  const activeAddresses = usePortfolioStore((state) => state.activeAddresses);
  const balances = usePortfolioStore((state) => state.balances);

  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [successTx, setSuccessTx] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentEthBalance = balances['ETH'] ? parseFloat(balances['ETH'].balanceFormatted) : 0;

  // Gas-Buffered Max Calculations: Leaves 0.005 ETH for gas
  const handleSetMax = () => {
    const gasBuffer = 0.005;
    const maxSendable = Math.max(0, currentEthBalance - gasBuffer);
    setSendAmount(maxSendable > 0 ? maxSendable.toFixed(4) : '0');
  };

  const handleExecuteSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessTx(null);

    if (!recipientAddress.trim() || !ethers.isAddress(recipientAddress.trim())) {
      setErrorMessage('Please provide a valid Ethereum recipient address (0x...).');
      return;
    }

    const numAmount = parseFloat(sendAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid transfer amount greater than 0.');
      return;
    }

    if (numAmount > currentEthBalance) {
      setErrorMessage(`Insufficient funds. Your available ETH balance is ${currentEthBalance} ETH.`);
      return;
    }

    try {
      const txHash = await executeStandardTransfer({
        toAddress: recipientAddress.trim(),
        amountEth: sendAmount
      });
      setSuccessTx(txHash);
      setSendAmount('');
      setRecipientAddress('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Transaction submission failed.');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 text-slate-100 shadow-2xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Send & Move Assets</h3>
            <p className="text-xs text-slate-400">Native EIP-1193 transfer pipeline with gas-buffered auto max</p>
          </div>
        </div>
        <div className="text-right text-xs">
          <span className="text-slate-400">Available ETH: </span>
          <span className="font-mono font-bold text-emerald-400">{currentEthBalance.toFixed(4)} ETH</span>
        </div>
      </div>

      <form onSubmit={handleExecuteSend} className="space-y-4">
        {/* Recipient Address */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-slate-300">Recipient Address</label>
            {activeAddresses.selectedVault && (
              <button
                type="button"
                onClick={() => setRecipientAddress(activeAddresses.selectedVault || '')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
              >
                Send to My Vault
              </button>
            )}
          </div>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x..."
            disabled={isProcessing}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        {/* Amount with Gas-Buffered Max */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-medium text-slate-300">Amount (ETH)</label>
            <button
              type="button"
              onClick={handleSetMax}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono border border-slate-700"
            >
              MAX (with 0.005 buffer)
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.0001"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              placeholder="0.00"
              disabled={isProcessing}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">ETH</span>
          </div>
        </div>

        {/* Status Banners */}
        {errorMessage && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successTx && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-xs text-emerald-300 flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>Transaction confirmed on-chain!</div>
              <div className="font-mono text-[11px] text-emerald-400 break-all">{successTx}</div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20"
        >
          {isProcessing ? (
            <span>Signing & Broadcasting Transaction...</span>
          ) : (
            <>
              <span>Sign & Broadcast Transfer</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
