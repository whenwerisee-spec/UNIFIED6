/**
 * Stripe Crypto Payout Service
 * Handles USDC payouts on Polygon and Ethereum networks.
 */

export async function dispatchStripeCryptoPayout(params: {
  stripeKey: string;
  amountUsd: number;
  destinationAddress: string;
  network: 'polygon' | 'ethereum';
  userId: string;
}): Promise<{ payoutId: string; status: string; hash?: string }> {
  const { stripeKey, amountUsd, destinationAddress, network, userId } = params;
  if (!stripeKey) throw new Error('Stripe key is missing.');

  console.log(`[STRIPE CRYPTO] Initiating ${amountUsd} USDC payout on ${network} to ${destinationAddress}`);

  try {
    const res = await fetch('https://api.stripe.com/v1/treasury/outbound_transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        amount: Math.round(amountUsd * 100).toString(),
        currency: 'usd',
        financial_account: process.env.STRIPE_FINANCIAL_ACCOUNT_ID || '',
        'destination_payment_method_data[type]': 'usdc',
        'destination_payment_method_data[usdc][network]': network,
        'destination_payment_method_data[usdc][wallet_address]': destinationAddress,
        description: `Crypto payout for user ${userId}`
      })
    });

    const json = await res.json() as any;
    if (!res.ok) {
      throw new Error(json?.error?.message || 'Stripe crypto payout failed.');
    }

    return {
      payoutId: json.id,
      status: json.status,
      hash: json.tracking_details?.crypto?.transaction_hash
    };
  } catch (err: any) {
    console.error('[STRIPE CRYPTO ERROR]', err);
    throw err;
  }
}
