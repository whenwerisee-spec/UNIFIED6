import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  TrendingUp,
  Award,
  Layers,
  Calendar,
  DollarSign,
  Percent,
  Info,
  Check
} from 'lucide-react';

export interface StakedYieldD3ChartProps {
  portfolioApy: number;
  totalStakedUsd: number;
}

interface HistoricalDataPoint {
  date: Date;
  timestamp: number;
  stakedPct: number;
  sp500Pct: number;
  cashPct: number;
  unstakedPct: number;
  stakedUsd: number;
  sp500Usd: number;
  cashUsd: number;
  unstakedUsd: number;
}

type Timeframe = '30D' | '90D' | '180D' | '1Y' | 'ALL';
type DisplayMode = 'percent' | 'usd';

export default function StakedYieldD3Chart({
  portfolioApy,
  totalStakedUsd
}: StakedYieldD3ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>('1Y');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('percent');

  // Benchmark Series Visibility Toggles
  const [showSp500, setShowSp500] = useState<boolean>(true);
  const [showCash, setShowCash] = useState<boolean>(true);
  const [showUnstaked, setShowUnstaked] = useState<boolean>(true);

  // Hover Tooltip State
  const [hoveredPoint, setHoveredPoint] = useState<HistoricalDataPoint | null>(null);

  // Generate deterministic, realistic historical benchmark timeseries
  const chartData: HistoricalDataPoint[] = useMemo(() => {
    const now = new Date();
    let days = 365;
    if (timeframe === '30D') days = 30;
    else if (timeframe === '90D') days = 90;
    else if (timeframe === '180D') days = 180;
    else if (timeframe === '1Y') days = 365;
    else if (timeframe === 'ALL') days = 730;

    const basePrincipal = totalStakedUsd > 0 ? totalStakedUsd : 15000;
    const apyRate = portfolioApy > 0 ? portfolioApy / 100 : 0.062;
    const dailyApyRate = apyRate / 365;
    const cashDailyRate = 0.045 / 365; // 4.5% HYSA/Treasury benchmark

    const points: HistoricalDataPoint[] = [];

    // Seeded random walk generator for organic market movement
    let seed = 42 + days;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    let cumStakedYield = 1.0;
    let cumCash = 1.0;
    let cumSp500 = 1.0;
    let cumMarketSpot = 1.0;

    for (let i = days; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

      // Micro volatility noise for realistic charting
      const marketNoise = (pseudoRandom() - 0.485) * 0.015;
      const sp500Noise = (pseudoRandom() - 0.48) * 0.009;

      // Compounded yield addition
      cumStakedYield *= 1 + dailyApyRate;
      cumCash *= 1 + cashDailyRate;
      cumMarketSpot *= 1 + marketNoise;
      cumSp500 *= 1 + 0.115 / 365 + sp500Noise; // ~11.5% annualized S&P total return

      // Staked total return combines spot market growth + compounded staking yield
      const stakedTotalMultiplier = cumMarketSpot * cumStakedYield;

      const stakedPct = (stakedTotalMultiplier - 1) * 100;
      const sp500Pct = (cumSp500 - 1) * 100;
      const cashPct = (cumCash - 1) * 100;
      const unstakedPct = (cumMarketSpot - 1) * 100;

      points.push({
        date,
        timestamp: date.getTime(),
        stakedPct,
        sp500Pct,
        cashPct,
        unstakedPct,
        stakedUsd: basePrincipal * stakedTotalMultiplier,
        sp500Usd: basePrincipal * cumSp500,
        cashUsd: basePrincipal * cumCash,
        unstakedUsd: basePrincipal * cumMarketSpot
      });
    }

    return points;
  }, [timeframe, portfolioApy, totalStakedUsd]);

  // Overall performance metrics
  const latestPoint = chartData[chartData.length - 1];
  const alphaVsSp500 = latestPoint ? latestPoint.stakedPct - latestPoint.sp500Pct : 0;
  const alphaVsCash = latestPoint ? latestPoint.stakedPct - latestPoint.cashPct : 0;

  // D3 Rendering Hook
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || chartData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const containerWidth = containerRef.current.clientWidth || 800;
    const height = 360;
    const margin = { top: 20, right: 30, bottom: 40, left: 55 };
    const innerWidth = containerWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${containerWidth} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(chartData, (d) => d.date) as [Date, Date])
      .range([0, innerWidth]);

    // Y Scale Domain calculation based on active series
    let allValues: number[] = [];
    chartData.forEach((d) => {
      if (displayMode === 'percent') {
        allValues.push(d.stakedPct);
        if (showSp500) allValues.push(d.sp500Pct);
        if (showCash) allValues.push(d.cashPct);
        if (showUnstaked) allValues.push(d.unstakedPct);
      } else {
        allValues.push(d.stakedUsd);
        if (showSp500) allValues.push(d.sp500Usd);
        if (showCash) allValues.push(d.cashUsd);
        if (showUnstaked) allValues.push(d.unstakedUsd);
      }
    });

    const minY = d3.min(allValues) ?? 0;
    const maxY = d3.max(allValues) ?? 100;
    const yPadding = (maxY - minY) * 0.1 || 5;

    const yScale = d3
      .scaleLinear()
      .domain([minY - yPadding, maxY + yPadding])
      .range([innerHeight, 0])
      .nice();

    // Defs for Gradients
    const defs = svg.append('defs');

    // Staked Area Gradient
    const stakedGradient = defs
      .append('linearGradient')
      .attr('id', 'staked-area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    stakedGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#0052FF')
      .attr('stop-opacity', 0.28);

    stakedGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#0052FF')
      .attr('stop-opacity', 0.0);

    // Horizontal Grid Lines
    const yTicks = yScale.ticks(6);
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#f1f5f9')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    // Baseline 0% / Starting Value line
    const zeroVal = displayMode === 'percent' ? 0 : chartData[0]?.stakedUsd || 0;
    if (zeroVal >= minY - yPadding && zeroVal <= maxY + yPadding) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(zeroVal))
        .attr('y2', yScale(zeroVal))
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 1.5);
    }

    // Area Generator for Staked Portfolio
    const areaGenerator = d3
      .area<HistoricalDataPoint>()
      .x((d) => xScale(d.date))
      .y0(innerHeight)
      .y1((d) => yScale(displayMode === 'percent' ? d.stakedPct : d.stakedUsd))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chartData)
      .attr('class', 'staked-area')
      .attr('fill', 'url(#staked-area-gradient)')
      .attr('d', areaGenerator);

    // Line Generators
    const createLine = (fieldPct: keyof HistoricalDataPoint, fieldUsd: keyof HistoricalDataPoint) =>
      d3
        .line<HistoricalDataPoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(displayMode === 'percent' ? (d[fieldPct] as number) : (d[fieldUsd] as number)))
        .curve(d3.curveMonotoneX);

    // 1. Unstaked Spot Holding Line (Purple)
    if (showUnstaked) {
      g.append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', '#a855f7')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3')
        .attr('d', createLine('unstakedPct', 'unstakedUsd'));
    }

    // 2. High-Yield Cash Baseline (Amber)
    if (showCash) {
      g.append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,4')
        .attr('d', createLine('cashPct', 'cashUsd'));
    }

    // 3. S&P 500 Index Baseline (Emerald)
    if (showSp500) {
      g.append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2.2)
        .attr('d', createLine('sp500Pct', 'sp500Usd'));
    }

    // 4. Staked Portfolio (Primary Blue - Solid)
    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', '#0052FF')
      .attr('stroke-width', 3)
      .attr('d', createLine('stakedPct', 'stakedUsd'));

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(containerWidth > 600 ? 6 : 4)
      .tickFormat((d) => {
        const dateObj = d as Date;
        return timeframe === '30D' || timeframe === '90D'
          ? d3.timeFormat('%b %d')(dateObj)
          : d3.timeFormat('%b %Y')(dateObj);
      });

    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('font-weight', '600');

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(6)
      .tickFormat((d) => {
        const val = d as number;
        if (displayMode === 'percent') {
          return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
        }
        return `$${(val / 1000).toFixed(1)}k`;
      });

    g.append('g')
      .call(yAxis)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('font-weight', '600');

    // Remove default axis domain lines for cleaner aesthetic
    g.selectAll('.domain').attr('stroke', 'none');

    // Interactive Crosshair Elements
    const focusGroup = g.append('g').attr('class', 'focus-group').style('display', 'none');

    // Vertical line
    const crosshairLine = focusGroup
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#64748b')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3');

    // Circle markers for each series
    const stakedCircle = focusGroup
      .append('circle')
      .attr('r', 5.5)
      .attr('fill', '#0052FF')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2.5);

    const sp500Circle = focusGroup
      .append('circle')
      .attr('r', 4.5)
      .attr('fill', '#10b981')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    const cashCircle = focusGroup
      .append('circle')
      .attr('r', 4.5)
      .attr('fill', '#f59e0b')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    const unstakedCircle = focusGroup
      .append('circle')
      .attr('r', 4.5)
      .attr('fill', '#a855f7')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Bisector for tracking mouse position
    const bisectDate = d3.bisector<HistoricalDataPoint, Date>((d) => d.date).left;

    // Overlay for mouse events
    svg
      .append('rect')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair')
      .on('mouseenter', () => focusGroup.style('display', null))
      .on('mouseleave', () => {
        focusGroup.style('display', 'none');
        setHoveredPoint(null);
      })
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const x0 = xScale.invert(mx);
        const index = bisectDate(chartData, x0, 1);
        const d0 = chartData[index - 1];
        const d1 = chartData[index];
        if (!d0) return;
        const d = d1 && x0.getTime() - d0.date.getTime() > d1.date.getTime() - x0.getTime() ? d1 : d0;

        setHoveredPoint(d);

        const xPos = xScale(d.date);
        crosshairLine.attr('x1', xPos).attr('x2', xPos);

        const yStaked = yScale(displayMode === 'percent' ? d.stakedPct : d.stakedUsd);
        stakedCircle.attr('cx', xPos).attr('cy', yStaked);

        if (showSp500) {
          sp500Circle
            .style('display', null)
            .attr('cx', xPos)
            .attr('cy', yScale(displayMode === 'percent' ? d.sp500Pct : d.sp500Usd));
        } else {
          sp500Circle.style('display', 'none');
        }

        if (showCash) {
          cashCircle
            .style('display', null)
            .attr('cx', xPos)
            .attr('cy', yScale(displayMode === 'percent' ? d.cashPct : d.cashUsd));
        } else {
          cashCircle.style('display', 'none');
        }

        if (showUnstaked) {
          unstakedCircle
            .style('display', null)
            .attr('cx', xPos)
            .attr('cy', yScale(displayMode === 'percent' ? d.unstakedPct : d.unstakedUsd));
        } else {
          unstakedCircle.style('display', 'none');
        }
      });
  }, [chartData, displayMode, showSp500, showCash, showUnstaked, timeframe]);

  const activePoint = hoveredPoint || latestPoint;

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6"
      id="staked-yield-d3-chart-section"
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0052FF] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Historical Growth vs. Benchmark Indices</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            D3-powered comparative analysis: Staked asset yield performance versus equity and cash baselines
          </p>
        </div>

        {/* Timeframe & Mode Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Display Mode Toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setDisplayMode('percent')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                displayMode === 'percent' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Percent className="w-3 h-3" />
              <span>% Gain</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('usd')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                displayMode === 'usd' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <DollarSign className="w-3 h-3" />
              <span>$ Value</span>
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            {(['30D', '90D', '180D', '1Y', 'ALL'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  timeframe === tf ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Alpha Callout Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Staked Portfolio Gain</div>
            <div className="text-xl font-black text-blue-900 font-mono mt-0.5">
              +{activePoint ? activePoint.stakedPct.toFixed(2) : '0.00'}%
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            <Award className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Alpha vs. S&P 500</div>
            <div className="text-xl font-black text-emerald-800 font-mono mt-0.5">
              {alphaVsSp500 >= 0 ? `+${alphaVsSp500.toFixed(2)}%` : `${alphaVsSp500.toFixed(2)}%`}
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg">
            {alphaVsSp500 >= 0 ? 'Outperforming' : 'Lagging'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Alpha vs. High-Yield Cash</div>
            <div className="text-xl font-black text-amber-800 font-mono mt-0.5">
              +{alphaVsCash.toFixed(2)}% Spread
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-800 rounded-lg">
            +{((portfolioApy || 5.5) - 4.5).toFixed(1)}% Real APY
          </span>
        </div>
      </div>

      {/* D3 SVG Canvas Container */}
      <div className="relative w-full overflow-hidden">
        <svg ref={svgRef} className="w-full h-auto overflow-visible select-none" />

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-2 right-4 bg-slate-900/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs pointer-events-none space-y-1.5 min-w-[200px] z-20">
            <div className="flex justify-between items-center pb-1 border-b border-slate-800 text-slate-300 font-semibold">
              <span>{hoveredPoint.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="text-[10px] text-blue-400 font-mono font-bold">SNAPSHOT</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-blue-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-[#0052FF]" />
                Staked Yield
              </span>
              <span className="font-mono font-black text-white">
                {displayMode === 'percent'
                  ? `+${hoveredPoint.stakedPct.toFixed(2)}%`
                  : `$${hoveredPoint.stakedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </span>
            </div>

            {showSp500 && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  S&P 500 (SPY)
                </span>
                <span className="font-mono text-emerald-400">
                  {displayMode === 'percent'
                    ? `${hoveredPoint.sp500Pct >= 0 ? '+' : ''}${hoveredPoint.sp500Pct.toFixed(2)}%`
                    : `$${hoveredPoint.sp500Usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </span>
              </div>
            )}

            {showCash && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Cash (4.5% HYSA)
                </span>
                <span className="font-mono text-amber-400">
                  {displayMode === 'percent'
                    ? `+${hoveredPoint.cashPct.toFixed(2)}%`
                    : `$${hoveredPoint.cashUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </span>
              </div>
            )}

            {showUnstaked && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Unstaked Spot
                </span>
                <span className="font-mono text-purple-400">
                  {displayMode === 'percent'
                    ? `${hoveredPoint.unstakedPct >= 0 ? '+' : ''}${hoveredPoint.unstakedPct.toFixed(2)}%`
                    : `$${hoveredPoint.unstakedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Legend & Series Toggles */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-gray-600 border-t border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          {/* Primary Staked Portfolio */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-900 rounded-xl font-bold border border-blue-200">
            <span className="w-3 h-3 rounded-full bg-[#0052FF]" />
            <span>Staked Portfolio (Auto-Compounded Yield)</span>
          </div>

          {/* S&P 500 Toggle */}
          <button
            type="button"
            onClick={() => setShowSp500(!showSp500)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition cursor-pointer border ${
              showSp500
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${showSp500 ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span>S&P 500 Index (SPY)</span>
            {showSp500 && <Check className="w-3 h-3 text-emerald-600" />}
          </button>

          {/* Cash Toggle */}
          <button
            type="button"
            onClick={() => setShowCash(!showCash)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition cursor-pointer border ${
              showCash
                ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${showCash ? 'bg-amber-500' : 'bg-gray-300'}`} />
            <span>High-Yield Cash (4.5% HYSA)</span>
            {showCash && <Check className="w-3 h-3 text-amber-600" />}
          </button>

          {/* Unstaked Spot Toggle */}
          <button
            type="button"
            onClick={() => setShowUnstaked(!showUnstaked)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition cursor-pointer border ${
              showUnstaked
                ? 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${showUnstaked ? 'bg-purple-500' : 'bg-gray-300'}`} />
            <span>Unstaked Spot Crypto</span>
            {showUnstaked && <Check className="w-3 h-3 text-purple-600" />}
          </button>
        </div>

        <span className="text-gray-400 text-[11px] font-normal flex items-center gap-1">
          <Info className="w-3.5 h-3.5" />
          Hover over chart curve to view daily snapshot values
        </span>
      </div>
    </div>
  );
}
