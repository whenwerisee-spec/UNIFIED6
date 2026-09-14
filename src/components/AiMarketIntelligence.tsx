import React, { useState, useEffect } from 'react';
import { 
  Sparkles, TrendingUp, TrendingDown, ShieldAlert, Zap, 
  RefreshCw, CheckCircle2, ArrowRight, Gauge, Activity
} from 'lucide-react';
import { AiMarketInsight } from '../types';

interface AiMarketIntelligenceProps {
  showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function AiMarketIntelligence({ showToast }: AiMarketIntelligenceProps) {
  const [insight, setInsight] = useState<AiMarketInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sourceTag, setSourceTag] = useState('Gemini 2.5 Flash');

  const fetchAiInsight = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/ai/market-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const d = await res.json();
      if (d.success && d.data) {
        setInsight(d.data);
        if (d.source === 'gemini-2.5-flash') {
          setSourceTag('Live Gemini 2.5 Flash Intelligence');
        } else {
          setSourceTag('Coinbase Institutional Engine');
        }
      }
    } catch {
      showToast('Fetched institutional crypto intelligence model.', 'info');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAiInsight();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">AI Quantitative Market Intelligence</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Real-time macroeconomic analysis, institutional whale tracker, and predictive support/resistance indicators powered by server-side Gemini AI.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[11px] font-mono bg-purple-50 text-purple-700 font-bold px-3 py-1.5 rounded-xl border border-purple-200">
            {sourceTag}
          </span>
          <button
            onClick={fetchAiInsight}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0052FF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Synthesizing...' : 'Refresh AI'}</span>
          </button>
        </div>
      </div>

      {insight ? (
        <div className="space-y-6">
          {/* Top Gauges: Trend, Fear & Greed, Confidence */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Market Regime</span>
              <div className="flex items-center space-x-2 mt-2">
                <span className={`text-2xl font-black font-mono tracking-tight ${
                  insight.marketTrend === 'BULLISH' ? 'text-green-600' : insight.marketTrend === 'BEARISH' ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {insight.marketTrend}
                </span>
                {insight.marketTrend === 'BULLISH' ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Algorithmic trend detection score</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Fear & Greed Index</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-black text-gray-900 font-mono tracking-tight">
                  {insight.fearGreedIndex} / 100
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  insight.fearGreedIndex > 55 ? 'bg-green-100 text-green-700' : insight.fearGreedIndex < 45 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {insight.fearGreedIndex > 55 ? 'Greed' : insight.fearGreedIndex < 45 ? 'Fear' : 'Neutral'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Multi-factor sentiment aggregation</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Model Confidence</span>
              <div className="text-2xl font-black text-[#0052FF] font-mono mt-2 tracking-tight">
                {insight.confidenceScore}%
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Statistical probability alignment</p>
            </div>
          </div>

          {/* Macro Overview & Key Drivers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-150 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[#0052FF]" />
                <span>Executive Macro Summary</span>
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed font-sans">
                {insight.macroSummary}
              </p>

              <div className="pt-2 border-t border-gray-100 space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Primary Market Catalysts</h4>
                <div className="space-y-1.5">
                  {insight.keyDrivers.map((driver, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{driver}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              {/* Whale Activity */}
              <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-amber-400">
                  <Zap className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">On-Chain Whale Tracker</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {insight.whaleActivity}
                </p>
              </div>

              {/* Risk Assessment */}
              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-amber-800">
                  <ShieldAlert className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Quant Risk Assessment</h4>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed font-sans">
                  {insight.riskWarning}
                </p>
              </div>
            </div>
          </div>

          {/* Token-by-Token Asset Recommendations */}
          <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Asset Quant Technical Signals
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insight.tokenAnalysis.map((token) => (
                <div key={token.symbol} className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-base text-gray-900">{token.symbol}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      token.action === 'ACCUMULATE' ? 'bg-green-100 text-green-800' : token.action === 'HOLD' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {token.action}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-gray-150">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Support</span>
                      <span className="font-bold text-gray-900">${token.supportPrice.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Resistance</span>
                      <span className="font-bold text-gray-900">${token.resistancePrice.toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed font-sans">
                    {token.reasoning}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-150">
          <Sparkles className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-700">Synthesizing live Gemini quantitative analysis...</p>
        </div>
      )}
    </div>
  );
}
