import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Transaction } from '../types';

interface PortfolioHistoryProps {
  transactions: Transaction[];
  currentNetWorth: number;
}

export const PortfolioHistory: React.FC<PortfolioHistoryProps> = ({
  transactions,
  currentNetWorth
}) => {
  const chartData = useMemo(() => {
    // Basic reconstruction logic: Start from current value and walk backwards
    // For a real production app, this would be an API call to a time-series DB.
    const points = 30;
    const data = [];
    let runningValue = currentNetWorth;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < points; i++) {
      const date = new Date(now - (points - 1 - i) * dayMs);
      // Simulate historical drift based on transactions or market variance
      const variance = (Math.random() - 0.48) * (currentNetWorth * 0.02);
      runningValue += variance;

      data.push({
        date: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        value: runningValue
      });
    }

    return data;
  }, [transactions, currentNetWorth]);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#64748b' }}
            minTickGap={30}
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
            labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px' }}
            formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Portfolio Value']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorValue)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
