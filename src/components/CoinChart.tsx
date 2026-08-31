import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';
import { TimeFrame } from '../types';

interface CoinChartProps {
  data: number[];
  title: string;
  change24h: number;
  symbol: string;
  selectedTimeframe: TimeFrame;
  setSelectedTimeframe: (tf: TimeFrame) => void;
  basePrice: number;
}

export const CoinChart: React.FC<CoinChartProps> = React.memo(({
  data,
  title,
  change24h,
  symbol,
  selectedTimeframe,
  setSelectedTimeframe,
  basePrice,
}: CoinChartProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const height = 220;
  const padding = { top: 15, right: 10, bottom: 15, left: 10 };

  // Track container width for responsive cursor intersection calculations
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      setContainerWidth(containerRef.current?.getBoundingClientRect().width || 600);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isPositive = change24h >= 0;
  const strokeColor = isPositive ? '#098551' : '#DF2020'; // Coinbase Green or Red
  const fillColor = isPositive ? 'url(#greenGradient)' : 'url(#redGradient)';

  // Calculate prices range
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  // Generate SVG Points
  const svgPoints = data.map((val, idx) => {
    const x = padding.left + (idx / (data.length - 1)) * (containerWidth - padding.left - padding.right);
    // Invert Y axis
    const y = padding.top + (1 - (val - minVal) / valRange) * (height - padding.top - padding.bottom);
    return { x, y, val };
  });

  const pathD = svgPoints.reduce((acc, point, idx) => {
    if (idx === 0) return `M ${point.x} ${point.y}`;
    // Simple smooth bezier interpolation
    const prev = svgPoints[idx - 1];
    const cpX1 = prev.x + (point.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (point.x - prev.x) / 2;
    const cpY2 = point.y;
    return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${point.x} ${point.y}`;
  }, '');

  // Fill path requires anchoring to bottom of graph
  const fillD = pathD
    ? `${pathD} L ${svgPoints[svgPoints.length - 1].x} ${height - padding.bottom} L ${svgPoints[0].x} ${height - padding.bottom} Z`
    : '';

  // Handle Mouse Hover/Move
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!containerRef.current || svgPoints.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Find the closest point index based on horizontal x position
    let closestIdx = 0;
    let minDiff = Infinity;
    svgPoints.forEach((p, idx) => {
      const diff = Math.abs(p.x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const displayedPrice = hoveredIndex !== null ? data[hoveredIndex] : basePrice;
  const activePoint = hoveredIndex !== null ? svgPoints[hoveredIndex] : null;

  // Render timeframe label
  const getTimeframeLabel = () => {
    if (hoveredIndex === null) {
      switch (selectedTimeframe) {
        case '1H': return 'Past hour';
        case '1D': return 'Past 24 hours';
        case '1W': return 'Past week';
        case '1M': return 'Past month';
        case '1Y': return 'Past year';
        case 'ALL': return 'All-time history';
      }
    }
    const ratio = hoveredIndex / (data.length - 1);
    switch (selectedTimeframe) {
      case '1H':
        return `${Math.round((1 - ratio) * 60)}m ago`;
      case '1D':
        const hr = Math.round((1 - ratio) * 24);
        return hr === 0 ? 'Just now' : `${hr}h ago`;
      case '1W':
        const d = Math.round((1 - ratio) * 7);
        return d === 0 ? 'Today' : `${d}d ago`;
      case '1M':
        return `${Math.round((1 - ratio) * 30)} days ago`;
      case '1Y':
        return `${Math.round((1 - ratio) * 12)} months ago`;
      case 'ALL':
        return `Segment ${Math.round(ratio * 100)}% of timeline`;
    }
  };

  const timeframes: TimeFrame[] = ['1H', '1D', '1W', '1M', '1Y', 'ALL'];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs relative" id="crypto-chart-container">
      {/* Top Details */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <div>
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500 font-medium">
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-mono text-xs">
              {symbol}
            </span>
            <span>{title} Price Chart</span>
          </div>
          <div className="flex items-baseline space-x-3 mt-1 select-none">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 font-sans">
              ${displayedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={`flex items-center space-x-0.5 text-xs sm:text-sm font-semibold rounded-full px-2 py-0.5 ${
                isPositive ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
              }`}
            >
              {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
              {isPositive ? '+' : ''}
              {change24h.toFixed(2)}%
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-gray-400 font-medium mt-1">
            {getTimeframeLabel()}
          </p>
        </div>

        {/* Timeframe Selectors */}
        <div className="flex items-center bg-gray-50 border border-gray-100 p-1 rounded-xl self-start sm:self-center">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                selectedTimeframe === tf
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Actual SVG Graphic Container */}
      <div ref={containerRef} className="w-full relative h-[220px]">
        {data.length > 0 ? (
          <svg
            width="100%"
            height={height}
            className="overflow-visible cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#098551" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#098551" stopOpacity="0.00" />
              </linearGradient>
              <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#DF2020" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#DF2020" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Grid Line Helpers */}
            <line
              x1={padding.left}
              y1={height / 2}
              x2={containerWidth - padding.right}
              y2={height / 2}
              stroke="#F3F4F6"
              strokeDasharray="4 4"
            />
            <line
              x1={padding.left}
              y1={padding.top}
              x2={containerWidth - padding.right}
              y2={padding.top}
              stroke="#F3F4F6"
              strokeDasharray="4"
            />
            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={containerWidth - padding.right}
              y2={height - padding.bottom}
              stroke="#E5E7EB"
            />

            {/* Filled area gradient */}
            {fillD && <path d={fillD} fill={fillColor} />}

            {/* Price Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Crosshair interactions */}
            {activePoint && (
              <>
                {/* Vertical dash cursor line */}
                <line
                  x1={activePoint.x}
                  y1={padding.top}
                  x2={activePoint.x}
                  y2={height - padding.bottom}
                  stroke="#9CA3AF"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />

                {/* Outer halo */}
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="7"
                  fill={strokeColor}
                  fillOpacity="0.2"
                />

                {/* Inner dot */}
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="3.5"
                  fill={strokeColor}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              </>
            )}
          </svg>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            <Activity className="w-5 h-5 animate-pulse mr-2" />
            Generating telemetry vectors...
          </div>
        )}
      </div>

      {/* Axis Helper Footnotes */}
      <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono mt-1 px-1">
        <span>{selectedTimeframe === '1H' ? '60m ago' : selectedTimeframe === '1D' ? '24h ago' : 'Earlier'}</span>
        <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> Live Market Feed</span>
        <span>Just now</span>
      </div>
    </div>
  );
});

export default CoinChart;
