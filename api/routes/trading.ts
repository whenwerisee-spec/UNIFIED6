import { Router } from 'express';
import { globalOrderBook } from '../engine/orderbook';
import { globalLedger } from '../../ledger/accounting';

export const tradingRouter = Router();

// GET /api/v1/orders - Retrieve open & recent orders
tradingRouter.get('/orders', (req, res) => {
  const symbol = req.query.symbol as string | undefined;
  const orders = globalOrderBook.getOrders(symbol);
  res.json({
    success: true,
    data: orders
  });
});

// POST /api/v1/orders - Submit limit/market/stop-limit order
tradingRouter.post('/orders', (req, res) => {
  const { symbol, side, type, price, size } = req.body;

  if (!symbol || !side || !type || !price || !size) {
    return res.status(400).json({
      success: false,
      error: 'Missing required order fields: symbol, side, type, price, size'
    });
  }

  const order = globalOrderBook.placeOrder({
    symbol,
    side,
    type,
    price: Number(price),
    size: Number(size)
  });

  // Record into Double-Entry Ledger
  const fiatTotal = Number(price) * Number(size);
  const baseAsset = symbol.split('-')[0] || symbol;

  globalLedger.recordTransaction({
    transactionId: order.id,
    memo: `Advanced Order ${side} ${size} ${symbol} @ $${price} (${type})`,
    lines: [
      {
        accountCode: side === 'BUY' ? `1010-VAULT-${baseAsset}` : '1040-CASH-USD',
        accountName: side === 'BUY' ? `${baseAsset} Custody Reserve` : 'Customer USD Cash Holding',
        accountType: 'ASSET',
        debit: fiatTotal,
        credit: 0,
        currency: 'USD'
      },
      {
        accountCode: side === 'BUY' ? '1040-CASH-USD' : `1010-VAULT-${baseAsset}`,
        accountName: side === 'BUY' ? 'Customer USD Cash Holding' : `${baseAsset} Custody Reserve`,
        accountType: 'ASSET',
        debit: 0,
        credit: fiatTotal,
        currency: 'USD'
      }
    ]
  });

  res.json({
    success: true,
    data: order
  });
});

// DELETE /api/v1/orders/:id - Cancel open order
tradingRouter.delete('/orders/:id', (req, res) => {
  const cancelled = globalOrderBook.cancelOrder(req.params.id);
  if (!cancelled) {
    return res.status(404).json({
      success: false,
      error: 'Order not found or cannot be cancelled'
    });
  }
  res.json({
    success: true,
    message: `Order ${req.params.id} cancelled`
  });
});
