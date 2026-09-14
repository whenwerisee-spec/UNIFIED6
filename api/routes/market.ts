import { Router } from 'express';
import { globalOrderBook } from '../engine/orderbook';
import { initialCoins } from '../../src/data/assets';

export const marketRouter = Router();

// GET /api/v1/prices - Returns real-time market prices for all supported assets
marketRouter.get('/prices', (req, res) => {
  res.json({
    success: true,
    timestamp: Date.now(),
    data: initialCoins.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      price: coin.price,
      change24h: coin.change24h,
      volume24h: coin.volume24h,
      marketCap: coin.marketCap
    }))
  });
});

// GET /api/v1/orderbook/:pair - Level 2 Order Book for pair (e.g. BTC-USD)
marketRouter.get('/orderbook/:pair', (req, res) => {
  const pair = (req.params.pair || 'BTC-USD').toUpperCase();
  const book = globalOrderBook.getOrderBook(pair);
  res.json({
    success: true,
    data: book
  });
});

// GET /api/v1/trades/:pair - Live trade tape
marketRouter.get('/trades/:pair', (req, res) => {
  const pair = (req.params.pair || 'BTC-USD').toUpperCase();
  const trades = globalOrderBook.getTradeTape(pair);
  res.json({
    success: true,
    data: trades
  });
});

// GET /api/v1/candles/:pair - Historical candlestick data
marketRouter.get('/candles/:pair', (req, res) => {
  const pair = (req.params.pair || 'BTC-USD').toUpperCase();
  const timeframe = (req.query.timeframe as string) || '1h';
  const candles = globalOrderBook.getCandles(pair, timeframe);
  res.json({
    success: true,
    data: candles
  });
});
