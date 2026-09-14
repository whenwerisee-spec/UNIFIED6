import React, { useState } from 'react';
import { Bell, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2, Volume2, VolumeX, AlertCircle, Clock } from 'lucide-react';
import { Coin, PriceAlert } from '../types';

interface PriceAlertsHubProps {
  coins: Coin[];
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export default function PriceAlertsHub({
  coins,
  showToast
}: PriceAlertsHubProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const saved = localStorage.getItem('cb_price_alerts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [
      {
        id: 'alert-1',
        symbol: 'BTC',
        condition: 'ABOVE',
        targetValue: 66000,
        createdAt: Date.now() - 86400000 * 2,
        active: true,
        note: 'Breakout above resistance level'
      },
      {
        id: 'alert-2',
        symbol: 'ETH',
        condition: 'BELOW',
        targetValue: 3300,
        createdAt: Date.now() - 86400000 * 1,
        active: true,
        note: 'Buy the dip accumulation zone'
      },
      {
        id: 'alert-3',
        symbol: 'SOL',
        condition: 'PERCENT_SWING',
        targetValue: 5,
        createdAt: Date.now() - 86400000 * 3,
        active: true,
        note: 'High volatility notification'
      }
    ];
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState('BTC');
  const [newCondition, setNewCondition] = useState<'ABOVE' | 'BELOW' | 'PERCENT_SWING'>('ABOVE');
  const [newTargetValue, setNewTargetValue] = useState('68000');
  const [newNote, setNewNote] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const saveAlerts = (updated: PriceAlert[]) => {
    setAlerts(updated);
    localStorage.setItem('cb_price_alerts', JSON.stringify(updated));
  };

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newTargetValue);
    if (!val || val <= 0) {
      showToast('Please enter a valid target value', 'error');
      return;
    }

    const newAlert: PriceAlert = {
      id: `alert-${Date.now()}`,
      symbol: newSymbol,
      condition: newCondition,
      targetValue: val,
      createdAt: Date.now(),
      active: true,
      note: newNote || `${newSymbol} ${newCondition.toLowerCase()} ${val}`
    };

    const updated = [newAlert, ...alerts];
    saveAlerts(updated);
    setIsCreateOpen(false);
    setNewNote('');
    showToast(`Created price alert for ${newSymbol}`, 'success');
  };

  const handleToggleAlert = (id: string) => {
    const updated = alerts.map((a) => (a.id === id ? { ...a, active: !a.active } : a));
    saveAlerts(updated);
  };

  const handleDeleteAlert = (id: string) => {
    const updated = alerts.filter((a) => a.id !== id);
    saveAlerts(updated);
    showToast('Alert removed', 'info');
  };

  const handleTestPing = () => {
    showToast('🔔 TEST ALERT: Bitcoin reached $64,250.00 (+3.42%)', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold mb-3">
              <Bell className="w-3.5 h-3.5" />
              Real-Time Market Watcher
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Price Alerts & Volatility Signals
            </h1>
            <p className="text-gray-500 text-sm sm:text-base mt-1 max-w-2xl">
              Never miss a market move. Receive instantaneous notifications when assets hit your defined target prices or experience rapid volatility swings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
              title={soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
            </button>
            <button
              onClick={handleTestPing}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 cursor-pointer"
            >
              Test Notification
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0052FF] text-white font-medium hover:bg-blue-600 transition-colors shadow-xs cursor-pointer text-sm"
              id="create-alert-btn"
            >
              <Plus className="w-4 h-4" />
              Create Alert
            </button>
          </div>
        </div>
      </div>

      {/* Active Alerts List */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Configured Alerts ({alerts.length})</h2>
          <span className="text-xs text-gray-500">Monitored 24/7 across exchange order books</span>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No price alerts set</p>
            <p className="text-gray-400 text-xs mt-1">Set an alert to receive alerts when crypto prices rise or fall.</p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 px-4 py-2 rounded-full bg-[#0052FF] text-white text-xs font-medium hover:bg-blue-600 cursor-pointer"
            >
              Create Price Alert
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {alerts.map((alert) => {
              const coin = coins.find((c) => c.symbol === alert.symbol);
              const currentPrice = coin?.price || 0;
              let distanceText = '';

              if (alert.condition === 'ABOVE') {
                const diff = alert.targetValue - currentPrice;
                const pct = (diff / currentPrice) * 100;
                distanceText = diff > 0 ? `${pct.toFixed(2)}% away ($${diff.toFixed(2)} to go)` : 'Triggered!';
              } else if (alert.condition === 'BELOW') {
                const diff = currentPrice - alert.targetValue;
                const pct = (diff / currentPrice) * 100;
                distanceText = diff > 0 ? `${pct.toFixed(2)}% away ($${diff.toFixed(2)} drop needed)` : 'Triggered!';
              } else {
                distanceText = `Triggers on 24h shift > ±${alert.targetValue}%`;
              }

              return (
                <div
                  key={alert.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 -mx-4 px-4 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs"
                      style={{ backgroundColor: coin?.color || '#0052FF' }}
                    >
                      {alert.symbol}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{alert.symbol}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
                          Current: ${currentPrice.toLocaleString()}
                        </span>
                        {alert.condition === 'ABOVE' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium inline-flex items-center gap-1">
                            <ArrowUp className="w-3 h-3" /> Rises above ${alert.targetValue.toLocaleString()}
                          </span>
                        )}
                        {alert.condition === 'BELOW' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium inline-flex items-center gap-1">
                            <ArrowDown className="w-3 h-3" /> Drops below ${alert.targetValue.toLocaleString()}
                          </span>
                        )}
                        {alert.condition === 'PERCENT_SWING' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
                            24h Swing ±{alert.targetValue}%
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                        <span className="text-blue-600 font-medium">{distanceText}</span>
                        {alert.note && <span className="text-gray-400">• {alert.note}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <button
                      onClick={() => handleToggleAlert(alert.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        alert.active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {alert.active ? 'Active' : 'Paused'}
                    </button>

                    <button
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-blue-50 text-[#0052FF]">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Create Price Alert</h3>
                  <p className="text-xs text-gray-500">Configure target thresholds</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cryptocurrency</label>
                <select
                  value={newSymbol}
                  onChange={(e) => {
                    setNewSymbol(e.target.value);
                    const coin = coins.find((c) => c.symbol === e.target.value);
                    if (coin) {
                      setNewTargetValue((coin.price * 1.05).toFixed(coin.price > 10 ? 2 : 4));
                    }
                  }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
                >
                  {coins.map((c) => (
                    <option key={c.symbol} value={c.symbol}>
                      {c.name} ({c.symbol}) — Current: ${c.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Condition</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'ABOVE', label: 'Rises Above' },
                    { id: 'BELOW', label: 'Drops Below' },
                    { id: 'PERCENT_SWING', label: '± % Swing' }
                  ].map((cond) => (
                    <button
                      key={cond.id}
                      type="button"
                      onClick={() => setNewCondition(cond.id as any)}
                      className={`py-2 text-xs font-semibold rounded-xl border cursor-pointer transition-colors ${
                        newCondition === cond.id
                          ? 'border-[#0052FF] bg-blue-50 text-[#0052FF]'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {cond.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {newCondition === 'PERCENT_SWING' ? 'Threshold Percentage (%)' : 'Target Price (USD)'}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newTargetValue}
                  onChange={(e) => setNewTargetValue(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Custom Note (Optional)</label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
                  placeholder="e.g. Target profit taking level"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0052FF] text-white font-medium hover:bg-blue-600 text-sm shadow-xs cursor-pointer"
                >
                  Set Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
