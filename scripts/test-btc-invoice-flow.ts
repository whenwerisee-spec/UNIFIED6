import assert from 'node:assert/strict';
import { createBitcoinInvoice, checkBitcoinInvoiceConfirmation } from '../src/lib/bitcoin-invoice.js';

const invoice = await createBitcoinInvoice(0.001);
assert.ok(invoice.invoice.orderId, 'invoice order id should exist');
assert.match(invoice.invoice.address, /^(bc1|[13])[a-zA-Z0-9]{20,90}$/, 'address should be a valid bitcoin address');
assert.match(invoice.qr, /^data:image\/png;base64,/, 'qr should be a data URL');
assert.ok(invoice.invoice.expiresAt > invoice.invoice.createdAt, 'invoice should expire in the future');

const confirmation = await checkBitcoinInvoiceConfirmation(invoice.invoice.address, 0.001, {
  chain_stats: {
    funded_txo_count: 1,
    funded_txo_sum: 100000000
  }
} as any);

assert.equal(confirmation.confirmed, true, 'invoice should confirm when funded_txo_sum covers amount');
assert.equal(confirmation.amountReceived, 1, 'amountReceived should be converted from sats to BTC');

console.log('[btc-invoice-flow] ok');
