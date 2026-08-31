import React, { useState, useEffect } from 'react';
import { 
  Plus, Key, Eye, EyeOff, Trash2, ShieldCheck, Terminal, Code2, 
  Play, RefreshCw, Copy, Check, CheckCircle2, Globe, ArrowRight, Sparkles, Send,
  Lock, Building2, CreditCard, Save, Database, ShieldAlert
} from 'lucide-react';
import { Coin, Holding } from '../types';
import { safeCopyToClipboard } from '../lib/clipboard';

interface DeveloperHubProps {
  coins: Coin[];
  holdings: Holding[];
  usdBalance: number;
  showToast: (message: string, type: 'success' | 'info' | 'error') => void;
  onRefreshBalances?: () => void;
}

interface RuntimeConfigStatus {
  environment: string;
  secrets: {
    coinbase: { keyIdConfigured: boolean; secretConfigured: boolean };
    kraken: { keyConfigured: boolean; secretConfigured: boolean };
    wallet: { privateKeyConfigured: boolean };
    email: { mailersendConfigured: boolean; smtpConfigured: boolean };
    admin: { adminEmailsConfigured: boolean };
    ledger: { encryptionConfigured: boolean; jwtConfigured: boolean };
  };
  readiness?: {
    isReady: boolean;
    missingConfig: string[];
    checks: Array<{ name: string; status: 'configured' | 'missing' | 'safe' | 'unsafe'; details?: string }>;
  };
}

interface ApiKey {
  id: string;
  name: string;
  keyId: string;
  keySecret: string;
  permissions: string[]; // 'read' | 'trade' | 'transfer'
  allowedIps: string;
  createdAt: number;
  status: 'active' | 'inactive';
}

export default function DeveloperHub({
  coins,
  holdings,
  usdBalance,
  showToast,
  onRefreshBalances
}: DeveloperHubProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => {
    const saved = localStorage.getItem('cb_api_keys');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Array<Omit<ApiKey, 'keySecret'>>;
        return parsed.map((key) => ({ ...key, keySecret: '' }));
      } catch {
        return [];
      }
    }
    return [
      {
        id: 'key-1',
        name: 'Automated Trading Bot Key',
        keyId: 'cdp_api_83fa10d8a291',
        keySecret: '',
        permissions: ['read', 'trade'],
        allowedIps: '*',
        createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        status: 'active'
      }
    ];
  });

  useEffect(() => {
    // Never persist key secrets in browser storage.
    const sanitized = apiKeys.map(({ keySecret, ...rest }) => rest);
    localStorage.setItem('cb_api_keys', JSON.stringify(sanitized));
  }, [apiKeys]);

  // Key creation inputs
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['read']);
  const [allowedIps, setAllowedIps] = useState('*');
  const [showSecretId, setShowSecretId] = useState<string | null>(null);

  // Playground state
  const [selectedEndpoint, setSelectedEndpoint] = useState<'accounts' | 'prices' | 'createOrder'>('accounts');
  const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'node' | 'python'>('node');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderCoin, setOrderCoin] = useState('BTC');
  const [orderAmount, setOrderAmount] = useState('0.05');
  const [selectedKeyId, setSelectedKeyId] = useState(apiKeys[0]?.keyId || '');
  
  // Terminal response execution states
  const [apiExecutionStatus, setApiExecutionStatus] = useState<'idle' | 'calling' | 'success'>('idle');
  const [httpResponseJson, setHttpResponseJson] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('https://mybackend.example.com/api/coinbase-hook');
  const [webhookEvent, setWebhookEvent] = useState('orders.completed');
  const [webhookLog, setWebhookLog] = useState<Array<{ time: string; status: number; payload: string }>>([]);
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);

  // Handle key creation
  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      showToast('Please enter an API key name.', 'error');
      return;
    }

    const hex = '0123456789abcdef';
    let randKeyId = 'cdp_api_';
    let randSecret = 'cdp_secret_';
    for (let i = 0; i < 12; i++) randKeyId += hex[Math.floor(Math.random() * hex.length)];
    for (let i = 0; i < 32; i++) randSecret += hex[Math.floor(Math.random() * hex.length)];

    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      keyId: randKeyId,
      keySecret: randSecret,
      permissions: selectedPermissions,
      allowedIps: allowedIps.trim() || '*',
      createdAt: Date.now(),
      status: 'active'
    };

    setApiKeys([...apiKeys, newKey]);
    setSelectedKeyId(newKey.keyId);
    setNewKeyName('');
    setSelectedPermissions(['read']);
    setAllowedIps('*');
    showToast(`Created API credential "${newKey.name}" successfully!`, 'success');
  };

  const handleDeleteKey = (id: string, name: string) => {
    setApiKeys(apiKeys.filter(k => k.id !== id));
    showToast(`Deleted API key: ${name}`, 'info');
  };

  const handleCopy = async (text: string) => {
    const success = await safeCopyToClipboard(text);
    if (success) {
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Generate dynamic code templates
  const getCodeSnippet = () => {
    const keyToUse = apiKeys.find(k => k.keyId === selectedKeyId) || { keyId: 'cdp_api_key_id', keySecret: '' };
    const domain = 'https://api.coinbase.com';

    if (selectedEndpoint === 'accounts') {
      if (selectedLanguage === 'curl') {
        return `curl -X GET "${domain}/v3/brokerage/accounts" \\
  -H "CB-ACCESS-KEY: ${keyToUse.keyId}" \\
  -H "CB-ACCESS-SIGN: <HMAC_SHA256_SIGNATURE>" \\
  -H "CB-ACCESS-TIMESTAMP: ${Math.floor(Date.now() / 1000)}" \\
  -H "Content-Type: application/json"`;
      } else if (selectedLanguage === 'node') {
        return `import { CoinbaseApp } from '@coinbase/coinbase-sdk';

const client = new CoinbaseApp({
  apiKeyId: '${keyToUse.keyId}',
  apiSecret: '${keyToUse.keySecret || '<SET_SERVER_SIDE_SECRET>'}'
});

async function getBalances() {
  const accounts = await client.getAccounts();
  console.log('My Coinbase Ledger Accounts:', JSON.stringify(accounts, null, 2));
}

getBalances();`;
      } else {
        return `from coinbase.rest import RESTClient

client = RESTClient(api_key="${keyToUse.keyId}", api_secret="${keyToUse.keySecret || '<SET_SERVER_SIDE_SECRET>'}")

accounts = client.get_accounts()
print("My Coinbase Ledger Accounts:\\n", accounts)`;
      }
    } else if (selectedEndpoint === 'prices') {
      if (selectedLanguage === 'curl') {
        return `curl -X GET "${domain}/v3/brokerage/products/BTC-USD/ticker" \\
  -H "CB-ACCESS-KEY: ${keyToUse.keyId}" \\
  -H "Content-Type: application/json"`;
      } else if (selectedLanguage === 'node') {
        return `import { CoinbaseApp } from '@coinbase/coinbase-sdk';

const client = new CoinbaseApp({ apiKeyId: '${keyToUse.keyId}' });

async function getTicker() {
  const ticker = await client.getProductTicker('BTC-USD');
  console.log('Real-time ticker rate:', ticker.price);
}

getTicker();`;
      } else {
        return `from coinbase.rest import RESTClient

client = RESTClient(api_key="${keyToUse.keyId}")

ticker = client.get_product_ticker(product_id="BTC-USD")
print("Real-time BTC rate:", ticker['price'])`;
      }
    } else {
      // Order creation
      if (selectedLanguage === 'curl') {
        return `curl -X POST "${domain}/v3/brokerage/orders" \\
  -H "CB-ACCESS-KEY: ${keyToUse.keyId}" \\
  -H "CB-ACCESS-SIGN: <HMAC_SHA256_SIGNATURE>" \\
  -H "CB-ACCESS-TIMESTAMP: ${Math.floor(Date.now() / 1000)}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_order_id": "order_${Date.now()}",
    "product_id": "${orderCoin}-USD",
    "side": "${orderSide.toLowerCase()}",
    "order_configuration": {
      "market_market_ioc": {
        "base_size": "${orderAmount}"
      }
    }
  }'`;
      } else if (selectedLanguage === 'node') {
        return `import { CoinbaseApp } from '@coinbase/coinbase-sdk';

const client = new CoinbaseApp({
  apiKeyId: '${keyToUse.keyId}',
  apiSecret: '${keyToUse.keySecret || '<SET_SERVER_SIDE_SECRET>'}'
});

async function placeMarketOrder() {
  const order = await client.createMarketOrder({
    productId: '${orderCoin}-USD',
    side: '${orderSide.toLowerCase()}',
    size: '${orderAmount}'
  });
  console.log('Market order placed! Order ID:', order.order_id);
}

placeMarketOrder();`;
      } else {
        return `from coinbase.rest import RESTClient

client = RESTClient(api_key="${keyToUse.keyId}", api_secret="${keyToUse.keySecret || '<SET_SERVER_SIDE_SECRET>'}")

order = client.create_market_order(
    product_id="${orderCoin}-USD",
    side="${orderSide.toLowerCase()}",
    size="${orderAmount}"
)
print("Order executed:", order['order_id'])`;
      }
    }
  };

  // Run the API request console
  const handleRunPlayground = () => {
    setApiExecutionStatus('calling');
    setHttpResponseJson('');

    const targetKey = apiKeys.find(k => k.keyId === selectedKeyId);
    if (!targetKey) {
      setTimeout(() => {
        setApiExecutionStatus('idle');
        showToast('Please select a valid, active API key.', 'error');
      }, 800);
      return;
    }

    if (selectedEndpoint === 'createOrder' && !targetKey.permissions.includes('trade')) {
      setTimeout(() => {
        setApiExecutionStatus('idle');
        showToast(`API Key "${targetKey.name}" lacks "trade" permission permissions. HTTP 403 Forbidden.`, 'error');
        setHttpResponseJson(JSON.stringify({
          error: "FORBIDDEN_API_SCOPE",
          message: "The provided API credential lacks permissions to make trade operations on accounts.",
          details: "Lacking 'trade' scope inside CB-ACCESS-KEY headers."
        }, null, 2));
      }, 1000);
      return;
    }

    // Generate API responses using the current holdings values
    setTimeout(() => {
      setApiExecutionStatus('success');
      
      if (selectedEndpoint === 'accounts') {
        const payloadAccounts = [
          {
            uuid: "fiat-usd-account-01a2b",
            name: "US Cash Balance Wallet",
            currency: "USD",
            available_balance: {
              value: usdBalance.toFixed(2),
              currency: "USD"
            },
            accounting_ledger: {
              double_entry: "Asset Ledger",
              vault_type: "USD_BANK_ACH"
            }
          },
          ...holdings.map((h, i) => {
            const coinPrice = coins.find(c => c.symbol === h.symbol)?.price || 1;
            return {
              uuid: `crypto-${h.symbol.toLowerCase()}-account-0${i}x`,
              name: `${h.symbol} Ledger Deposit`,
              currency: h.symbol,
              available_balance: {
                value: h.amount.toFixed(6),
                currency: h.symbol
              },
              accounting_ledger: {
                double_entry: "Crypto Asset Holdings",
                fiat_valuation: (h.amount * coinPrice).toFixed(2)
              }
            };
          })
        ];
        
        setHttpResponseJson(JSON.stringify({
          status: "SUCCESS",
          timestamp: new Date().toISOString(),
          headers: {
            "Content-Type": "application/json",
            "Rate-Limit-Remaining": "119",
            "Server": "Coinbase-CDP-Engine"
          },
          data: {
            accounts: payloadAccounts
          }
        }, null, 2));
      } else if (selectedEndpoint === 'prices') {
        const coin = coins.find(c => c.symbol === 'BTC') || { price: 63820, change24h: 1.25, volume24h: 182390123 };
        setHttpResponseJson(JSON.stringify({
          product_id: "BTC-USD",
          price: coin.price.toString(),
          bid: (coin.price * 0.9995).toFixed(2),
          ask: (coin.price * 1.0005).toFixed(2),
          volume_24h: coin.volume24h.toString(),
          price_percentage_change_24h: coin.change24h.toFixed(4),
          accounting_ticker_source: "Universal Coinbase Oracles"
        }, null, 2));
      } else {
        // Submit the order request
        const coin = coins.find(c => c.symbol === orderCoin) || { price: 100, name: orderCoin };
        const sizeNum = parseFloat(orderAmount) || 0;
        const totalCost = sizeNum * coin.price;
        const netFee = totalCost * 0.005; // 0.5% api developer fee

        setHttpResponseJson(JSON.stringify({
          order_id: `cdp_order_${Math.floor(Date.now() / 1000)}_${Math.floor(Math.random() * 90000)}`,
          client_order_id: `order_${Date.now()}`,
          product_id: `${orderCoin}-USD`,
          side: orderSide.toLowerCase(),
          status: "FILLED",
          time_in_force: "IMMEDIATE_OR_CANCEL",
          created_time: new Date().toISOString(),
          completion_time: new Date().toISOString(),
          filled_size: sizeNum.toString(),
          average_filled_price: coin.price.toString(),
          accounting_ledger: {
            debit_account: orderSide === 'BUY' ? `Crypto Asset Holdings (${orderCoin})` : "US Cash Balance Wallet",
            credit_account: orderSide === 'BUY' ? "US Cash Balance Wallet" : `Crypto Asset Holdings (${orderCoin})`,
            fiat_principal_cost: totalCost.toFixed(2),
            coinbase_commission_fee: netFee.toFixed(2),
            settled_net_total: (orderSide === 'BUY' ? totalCost + netFee : totalCost - netFee).toFixed(2)
          }
        }, null, 2));
        showToast(`Order request completed! API key ${targetKey.name} authenticated the action securely.`, 'success');
      }
    }, 1200);
  };

  // Webhook dispatch handler
  const handleTriggerWebhook = () => {
    if (!webhookUrl.trim()) return;
    showToast('Simulated webhook trigger is disabled in production mode. Connect a live provider to test real event streams.', 'info');
  };

  const [hubTab, setHubTab] = useState<'api' | 'cypress' | 'real_coinbase' | 'wise_plaid'>('api');

  // Wise & Plaid Integrations State
  const [wiseApiToken, setWiseApiToken] = useState('');
  const [wiseProfileId, setWiseProfileId] = useState('101924589');
  const [wiseStatus, setWiseStatus] = useState<{ configured: boolean; tokenMasked: string; profileId: string; status: string }>({
    configured: false,
    tokenMasked: '',
    profileId: '101924589',
    status: 'STANDBY'
  });

  const [plaidClientId, setPlaidClientId] = useState('');
  const [plaidSecret, setPlaidSecret] = useState('');
  const [plaidEnv, setPlaidEnv] = useState<'sandbox' | 'development' | 'production'>('sandbox');
  const [plaidStatus, setPlaidStatus] = useState<{ configured: boolean; clientIdMasked: string; hasSecret: boolean; environment: string; status: string }>({
    configured: false,
    clientIdMasked: '',
    hasSecret: false,
    environment: 'sandbox',
    status: 'STANDBY'
  });

  const [showWiseToken, setShowWiseToken] = useState(false);
  const [showPlaidSecret, setShowPlaidSecret] = useState(false);
  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false);
  const [isTestingWise, setIsTestingWise] = useState(false);
  const [isTestingPlaid, setIsTestingPlaid] = useState(false);
  const [integrationLogs, setIntegrationLogs] = useState<string[]>([]);

  // Real Coinbase Connection States
  const [cdpApiKeyName, setCdpApiKeyName] = useState('');
  const [cdpPrivateKey, setCdpPrivateKey] = useState('');
  const [cdpMode, setCdpMode] = useState<'testing' | 'real'>('testing');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [testPassed, setTestPassed] = useState<boolean | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfigStatus | null>(null);

  // Load saved configuration from server
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/coinbase/config', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setCdpApiKeyName(data.apiKeyName || (data.isConfigured ? (data.apiKeyIdPreview || 'Configured via Environment') : ''));
          setCdpMode(data.mode || 'real');
          if (data.isConfigured || data.hasPrivateKey) {
            setCdpPrivateKey('••••••••••••••••••••••••••••••••');
          }
        }
      } catch (e) {
        console.error('Error fetching Coinbase configuration:', e);
      }
    };
    fetchConfig();
  }, [hubTab]);

  useEffect(() => {
    const fetchRuntimeConfig = async () => {
      try {
        const res = await fetch('/api/runtime/config', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.success) {
          setRuntimeConfig(data as RuntimeConfigStatus);
        }
      } catch (e) {
        console.error('Error fetching runtime configuration:', e);
      }
    };

    fetchRuntimeConfig();
  }, []);

  const handleSaveCoinbaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const isPlaceholder = cdpPrivateKey === '••••••••••••••••••••••••••••••••';
      const bodyPayload = {
        apiKeyName: cdpApiKeyName,
        privateKey: isPlaceholder ? undefined : cdpPrivateKey,
        mode: cdpMode
      };

      const res = await fetch('/api/coinbase/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        if (onRefreshBalances) {
          onRefreshBalances();
        }
      } else {
        showToast(data.message || 'Failed to save configuration.', 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestCoinbaseConnection = async () => {
    setIsTestingConnection(true);
    setTestPassed(null);
    setTestLog(['Initializing Coinbase API handshake...', `API Key: ${cdpApiKeyName}`]);
    try {
      const isPlaceholder = cdpPrivateKey === '••••••••••••••••••••••••••••••••';
      if (isPlaceholder) {
        setTestLog(prev => [...prev, 'Fetching securely cached private key...']);
      }

      const res = await fetch('/api/coinbase/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          apiKeyName: cdpApiKeyName,
          privateKey: isPlaceholder ? '' : cdpPrivateKey
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const count = data.health?.accountsCount ?? data.accountsCount ?? 0;
        const keyType = data.health?.keyType || 'cdp_ec';
        setTestLog(prev => [
          ...prev,
          `✅ Cryptographic handshake generated valid ${keyType === 'legacy_hmac' ? 'HS256' : 'ES256'} JWT.`,
          '✅ Handshake request dispatched to: api.coinbase.com/api/v3/brokerage/accounts',
          `✅ Handshake Verified! Reachable Coinbase portfolios: ${count}`,
          'Status Code: 200 OK (Connection Active & Verified)'
        ]);
        setTestPassed(true);
        showToast('Coinbase handshake verified successfully!', 'success');
      } else {
        setTestLog(prev => [
          ...prev,
          `❌ Handshake Rejected: ${data.message || data.health?.error || data.details || 'Connection failed.'}`,
          'Please verify that your API Key Name and Private Key PEM match your Coinbase CDP project.'
        ]);
        setTestPassed(false);
        showToast('Coinbase handshake failed. Check logs.', 'error');
      }
    } catch (err: any) {
      setTestLog(prev => [...prev, `❌ Handshake failed: ${err.message}`]);
      setTestPassed(false);
      showToast(`Connection error: ${err.message}`, 'error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const [cypressRunning, setCypressRunning] = useState(false);
  const [cypressResults, setCypressResults] = useState<{
    success: boolean;
    results: { total: number; passed: number; failed: number; durationMs: number };
    logs: string[];
  } | null>(null);

  const runCypressTests = async () => {
    setCypressRunning(true);
    setCypressResults(null);
    try {
      const response = await fetch('/api/dev/run-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setCypressResults(data);
      if (data.success) {
        showToast('All Cypress integration tests passed successfully!', 'success');
      } else {
        showToast('Cypress test suite completed with failures.', 'error');
      }
    } catch (e: any) {
      showToast('Error connecting to the Cypress test runner endpoint.', 'error');
      setCypressResults({
        success: false,
        results: { total: 6, passed: 0, failed: 6, durationMs: 0 },
        logs: [
          `[ERROR] Connection error: ${e.message}`,
          'Please ensure the Express server is up and running.'
        ]
      });
    } finally {
      setCypressRunning(false);
    }
  };

  // Fetch Wise & Plaid integration credentials
  const fetchIntegrationsConfig = async () => {
    try {
      const res = await fetch('/api/integrations/credentials', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.wise) {
            setWiseStatus(data.wise);
            setWiseProfileId(data.wise.profileId || '101924589');
            if (data.wise.tokenMasked) {
              setWiseApiToken(data.wise.tokenMasked);
            }
          }
          if (data.plaid) {
            setPlaidStatus(data.plaid);
            if (data.plaid.clientIdMasked) {
              setPlaidClientId(data.plaid.clientIdMasked);
            }
            if (data.plaid.hasSecret) {
              setPlaidSecret('••••••••••••••••••••••••••••••••');
            }
            if (data.plaid.environment) {
              setPlaidEnv(data.plaid.environment as any);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching integration config:', err);
    }
  };

  useEffect(() => {
    if (hubTab === 'wise_plaid') {
      fetchIntegrationsConfig();
    }
  }, [hubTab]);

  const handleSaveIntegrationsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingIntegrations(true);
    try {
      const res = await fetch('/api/integrations/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          wiseApiToken: wiseApiToken.includes('••••') ? undefined : wiseApiToken,
          wiseProfileId,
          plaidClientId: plaidClientId.includes('••••') ? undefined : plaidClientId,
          plaidSecret: plaidSecret.includes('••••') ? undefined : plaidSecret,
          plaidEnv
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Wise and Plaid API credentials persisted successfully!', 'success');
        setIntegrationLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ✅ Wise & Plaid credentials saved and persisted into configuration storage.`
        ]);
        await fetchIntegrationsConfig();
      } else {
        showToast(data.message || 'Failed to save integrations config.', 'error');
      }
    } catch (err: any) {
      showToast(`Error saving configuration: ${err.message}`, 'error');
    } finally {
      setIsSavingIntegrations(false);
    }
  };

  const handleTestWiseHandshake = async () => {
    setIsTestingWise(true);
    setIntegrationLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 🚀 Executing Wise API connection handshake...`
    ]);
    try {
      const res = await fetch('/api/integrations/test-wise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          wiseApiToken: wiseApiToken.includes('••••') ? undefined : wiseApiToken,
          wiseProfileId
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        setIntegrationLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ✅ ${data.message}`,
          `[WISE LEDGER] USD Balance: $${data.data?.usdBalance?.toLocaleString() || '0'}, CAD Balance: $${data.data?.cadBalance?.toLocaleString() || '0'}, Total USD Value: $${data.data?.totalUSD?.toLocaleString() || '0'}`
        ]);
      } else {
        showToast(data.message, 'info');
        setIntegrationLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ℹ️ Wise Handshake: ${data.message}`
        ]);
      }
    } catch (err: any) {
      showToast(`Wise handshake test error: ${err.message}`, 'error');
    } finally {
      setIsTestingWise(false);
    }
  };

  const handleTestPlaidHandshake = async () => {
    setIsTestingPlaid(true);
    setIntegrationLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 🚀 Verifying Plaid credentials & environment mode (${plaidEnv})...`
    ]);
    try {
      const res = await fetch('/api/integrations/test-plaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plaidClientId: plaidClientId.includes('••••') ? undefined : plaidClientId,
          plaidSecret: plaidSecret.includes('••••') ? undefined : plaidSecret,
          plaidEnv
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        setIntegrationLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ✅ ${data.message}`
        ]);
      } else {
        showToast(data.message, 'error');
        setIntegrationLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ❌ Plaid Handshake: ${data.message}`
        ]);
      }
    } catch (err: any) {
      showToast(`Plaid handshake test error: ${err.message}`, 'error');
    } finally {
      setIsTestingPlaid(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Level Nav Tabs */}
      <div className="flex border-b border-gray-100 mb-6 space-x-6">
        <button
          onClick={() => setHubTab('api')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            hubTab === 'api' ? 'border-[#0052FF] text-[#0052FF]' : 'border-transparent text-gray-400 hover:text-gray-900'
          }`}
        >
          REST API Credentials & Sandbox
        </button>
        <button
          onClick={() => setHubTab('real_coinbase')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
            hubTab === 'real_coinbase' ? 'border-[#0052FF] text-[#0052FF]' : 'border-transparent text-gray-400 hover:text-gray-900'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${cdpMode === 'real' ? 'animate-spin text-emerald-500' : 'text-[#0052FF]'}`} />
          <span>Live Coinbase API Core</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cdpMode === 'real' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
            {cdpMode === 'real' ? 'Real Mode Active' : 'Configure Connection'}
          </span>
        </button>
        <button
          onClick={() => setHubTab('cypress')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
            hubTab === 'cypress' ? 'border-[#0052FF] text-[#0052FF]' : 'border-transparent text-gray-400 hover:text-gray-900'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Cypress E2E Integration Suite</span>
          <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">Step 6</span>
        </button>
        <button
          onClick={() => setHubTab('wise_plaid')}
          className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
            hubTab === 'wise_plaid' ? 'border-[#0052FF] text-[#0052FF]' : 'border-transparent text-gray-400 hover:text-gray-900'
          }`}
        >
          <Building2 className="h-4 w-4 text-indigo-500" />
          <span>Wise & Plaid API Settings</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${wiseStatus.configured && plaidStatus.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
            {wiseStatus.configured && plaidStatus.configured ? 'Configured' : 'Credentials'}
          </span>
        </button>
      </div>

      {hubTab === 'api' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: API Key Management & Webhooks */}
          <div className="lg:col-span-6 space-y-6">

            {/* Runtime Configuration Snapshot */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
                  <span>Runtime Secret Status</span>
                </h3>
                <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2.5 py-0.5 rounded-full uppercase">
                  {runtimeConfig?.environment || 'unknown'}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                This shows whether the app can see your live credentials at runtime. Secret values are never displayed.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">Safety state</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${runtimeConfig?.readiness?.isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {runtimeConfig?.readiness?.isReady ? 'Ready to operate' : 'Blocked'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  ['Coinbase key ID', runtimeConfig?.secrets?.coinbase?.keyIdConfigured],
                  ['Coinbase secret', runtimeConfig?.secrets?.coinbase?.secretConfigured],
                  ['Kraken key', runtimeConfig?.secrets?.kraken?.keyConfigured],
                  ['Kraken secret', runtimeConfig?.secrets?.kraken?.secretConfigured],
                  ['Wallet private key', runtimeConfig?.secrets?.wallet?.privateKeyConfigured],
                  ['MailerSend', runtimeConfig?.secrets?.email?.mailersendConfigured],
                  ['SMTP', runtimeConfig?.secrets?.email?.smtpConfigured],
                  ['Admin emails', runtimeConfig?.secrets?.admin?.adminEmailsConfigured],
                  ['Ledger encryption', runtimeConfig?.secrets?.ledger?.encryptionConfigured],
                  ['JWT secret', runtimeConfig?.secrets?.ledger?.jwtConfigured]
                ].map(([label, enabled]) => (
                  <div key={String(label)} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2">
                    <span className="text-gray-600">{label}</span>
                    <span className={`font-bold ${enabled ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {enabled ? 'Configured' : 'Missing'}
                    </span>
                  </div>
                ))}
              </div>
              {runtimeConfig?.readiness && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">Operational readiness</span>
                    <span className={`font-bold ${runtimeConfig.readiness.isReady ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {runtimeConfig.readiness.isReady ? 'Safe' : 'Not safe'}
                    </span>
                  </div>
                  {runtimeConfig.readiness.missingConfig.length > 0 ? (
                    <ul className="space-y-1 text-gray-600">
                      {runtimeConfig.readiness.missingConfig.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-600">Configuration and financial proof enforcement are both in place.</p>
                  )}
                </div>
              )}
            </div>
            
            {/* Coinbase Developer Portal Header */}
            <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Terminal className="w-48 h-48 text-[#0052FF]" />
              </div>
              <div className="relative z-10 space-y-2">
                <span className="text-[10px] bg-[#0052FF] text-white font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  CDP (Coinbase Developer Platform)
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                  Universal Endpoint Connections
                </h2>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Integrate Coinbase services directly. Issue secure HMAC-signed API credentials to trade, transfer assets, and read ledger accounts programmatically.
                </p>
              </div>
            </div>

            {/* Create API Keys */}
            <form onSubmit={handleCreateApiKey} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                <Key className="h-4.5 w-4.5 text-[#0052FF]" />
                <span>Generate Connect APIs</span>
              </h3>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">API Key Description Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Algorithmic Trading Script"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">Configure Scopes / Permissions</label>
                  <div className="space-y-1.5">
                    {[
                      { id: 'read', label: 'Read (View Account Balances)' },
                      { id: 'trade', label: 'Trade (Buy, Sell, Convert)' },
                      { id: 'transfer', label: 'Transfer (Deposit, Withdraw)' }
                    ].map((permission) => {
                      const isChecked = selectedPermissions.includes(permission.id);
                      return (
                        <label key={permission.id} className="flex items-center space-x-2 text-xs text-gray-600 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                  setSelectedPermissions(selectedPermissions.filter(p => p !== permission.id));
                              } else {
                                  setSelectedPermissions([...selectedPermissions, permission.id]);
                              }
                            }}
                            className="rounded-sm text-[#0052FF] focus:ring-[#0052FF] h-3.5 w-3.5"
                          />
                          <span>{permission.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">IP Whitelisting Range</label>
                  <input
                    type="text"
                    placeholder="e.g. *, 192.168.1.1 (Use * for all)"
                    value={allowedIps}
                    onChange={(e) => setAllowedIps(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF] font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#0052FF] hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl cursor-pointer"
              >
                Create API Credential
              </button>
            </form>

            {/* Existing Credentials List */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active API Credentials</h4>
              <div className="divide-y divide-gray-100">
                {apiKeys.map((key) => (
                  <div key={key.id} className="py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-xs sm:text-sm font-bold text-gray-900">{key.name}</h5>
                        <span className="text-[9px] text-gray-400 font-mono font-medium block mt-0.5">
                          Issued: {new Date(key.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteKey(key.id, key.name)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 cursor-pointer"
                        title="Revoke Key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2 bg-gray-50/70 p-3 rounded-xl border border-gray-200/60 font-mono text-[11px] leading-relaxed text-gray-600">
                      <div className="flex justify-between items-center">
                        <span>Key ID:</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-800">{key.keyId}</span>
                          <button onClick={() => handleCopy(key.keyId)} className="text-gray-400 hover:text-gray-800">
                            {copiedKey === key.keyId ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <span>Secret Key:</span>
                        <div className="flex items-center space-x-2">
                          {showSecretId === key.id ? (
                            <span className="text-red-700 break-all select-all font-semibold max-w-[180px] truncate">{key.keySecret || 'Not stored client-side'}</span>
                          ) : (
                            <span className="text-gray-400">••••••••••••••••</span>
                          )}
                          <button 
                            onClick={() => setShowSecretId(showSecretId === key.id ? null : key.id)}
                            className="text-gray-400 hover:text-gray-800"
                          >
                            {showSecretId === key.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <span>IP Filter:</span>
                        <span className="text-gray-800">{key.allowedIps}</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Scopes:</span>
                        <span className="text-gray-800 font-semibold uppercase text-[9px]">{key.permissions.join(', ')}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {apiKeys.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400 font-medium bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    No developer keys created yet. Fill out the form above to generate connection pipelines.
                  </div>
                )}
              </div>
            </div>

            {/* Webhook subscriptions */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-900 flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-[#0052FF]" />
                  <span>Universal Outgoing Webhooks</span>
                </h4>
                <span className="text-[9px] bg-green-100 text-green-700 font-bold px-2.5 py-0.5 rounded-full">CDP Stream</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Callback Endpoint Target URL</label>
                  <input
                    type="text"
                    placeholder="https://my-backend.example/api/hooks"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF] font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Listen to Event</label>
                    <select
                      value={webhookEvent}
                      onChange={(e) => setWebhookEvent(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm font-semibold px-3 py-2.5 rounded-xl focus:outline-none cursor-pointer"
                    >
                      <option value="orders.completed">orders.completed</option>
                      <option value="transfers.completed">transfers.completed</option>
                      <option value="fiat_deposit.settled">fiat_deposit.settled</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleTriggerWebhook}
                      disabled={isSendingWebhook}
                      className="w-full py-2.5 bg-gray-800 hover:bg-slate-900 disabled:bg-gray-300 text-white font-bold text-xs sm:text-sm rounded-xl cursor-pointer flex items-center justify-center space-x-1"
                    >
                      {isSendingWebhook ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      <span>Send Test POST</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 text-[10px] font-mono text-gray-300 max-h-[160px] overflow-y-auto space-y-2 leading-relaxed">
                <span className="text-gray-400 text-[9px] uppercase tracking-wider block border-b border-gray-800 pb-1">Incoming Webhook Payload Stream logs</span>
                {webhookLog.map((log, index) => (
                  <div key={index} className="border-b border-gray-800/50 pb-2">
                    <div className="flex justify-between text-green-500">
                      <span>POST {webhookUrl.slice(0, 30)}...</span>
                      <span>HTTP {log.status} - {log.time}</span>
                    </div>
                    <pre className="text-white text-[9px] mt-1 whitespace-pre-wrap">{log.payload}</pre>
                  </div>
                ))}
                {webhookLog.length === 0 && (
                  <span className="text-gray-500 italic">No hook streams triggered yet. Click “Send Test POST” to emit a webhook payload.</span>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Code Playground Console */}
          <div className="lg:col-span-6">
            
            <div className="bg-[#1e1e1e] rounded-3xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col justify-between min-h-[500px]">
              
              {/* Editor Header */}
              <div className="bg-[#121212] px-6 py-4 border-b border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1.5 shrink-0">
                    <span className="w-3 h-3 bg-red-500 rounded-full inline-block" />
                    <span className="w-3 h-3 bg-yellow-500 rounded-full inline-block" />
                    <span className="w-3 h-3 bg-green-500 rounded-full inline-block" />
                  </div>
                  <span className="text-xs font-bold text-gray-400 font-mono ml-2">CDP REST API Interactive Sandbox</span>
                </div>

                <div className="flex bg-[#1e1e1e] p-1 rounded-lg">
                  {(['curl', 'node', 'python'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={`px-2.5 py-1 text-[10px] font-mono rounded-md font-bold transition-all cursor-pointer ${
                        selectedLanguage === lang ? 'bg-[#0052FF] text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {lang === 'node' ? 'Node.js' : lang === 'python' ? 'Python' : 'cURL'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Configuration controls inside Sandbox */}
              <div className="bg-[#1a1a1a] px-6 py-4 border-b border-gray-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">API Method Endpoint</label>
                  <select
                    value={selectedEndpoint}
                    onChange={(e: any) => setSelectedEndpoint(e.target.value)}
                    className="w-full bg-[#252526] border border-gray-800 text-xs text-white font-mono px-2.5 py-2 rounded-lg outline-none cursor-pointer"
                  >
                    <option value="accounts">GET /v3/brokerage/accounts</option>
                    <option value="prices">GET /v3/brokerage/products/BTC-USD/ticker</option>
                    <option value="createOrder">POST /v3/brokerage/orders</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Executing Key Credentials</label>
                  <select
                    value={selectedKeyId}
                    onChange={(e) => setSelectedKeyId(e.target.value)}
                    className="w-full bg-[#252526] border border-gray-800 text-xs text-white font-mono px-2.5 py-2 rounded-lg outline-none cursor-pointer"
                  >
                    {apiKeys.map(k => (
                      <option key={k.id} value={k.keyId}>{k.name} ({k.keyId.slice(0, 11)}...)</option>
                    ))}
                    {apiKeys.length === 0 && <option value="">(No API Keys Created)</option>}
                  </select>
                </div>

                {selectedEndpoint === 'createOrder' && (
                  <div className="sm:col-span-2 grid grid-cols-3 gap-2.5 animate-slide-up bg-[#252526]/40 p-3 rounded-lg border border-gray-800">
                    <div>
                      <label className="text-[9px] font-mono text-gray-500 uppercase block mb-1">Trade Direction</label>
                      <select
                        value={orderSide}
                        onChange={(e: any) => setOrderSide(e.target.value)}
                        className="w-full bg-[#252526] text-white font-mono text-xs px-2 py-1.5 rounded border border-gray-800"
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-gray-500 uppercase block mb-1">Token Product</label>
                      <select
                        value={orderCoin}
                        onChange={(e: any) => setOrderCoin(e.target.value)}
                        className="w-full bg-[#252526] text-white font-mono text-xs px-2 py-1.5 rounded border border-gray-800"
                      >
                        {coins.map(c => <option key={c.symbol} value={c.symbol}>{c.symbol}-USD</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-gray-500 uppercase block mb-1">Target size</label>
                      <input
                        type="number"
                        value={orderAmount}
                        onChange={(e) => setOrderAmount(e.target.value)}
                        className="w-full bg-[#252526] text-white font-mono text-xs px-2 py-1 rounded border border-gray-800 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Editor Code panel */}
              <div className="flex-1 p-6 relative group bg-[#1e1e1e]">
                <button
                  onClick={() => handleCopy(getCodeSnippet())}
                  className="absolute top-4 right-4 p-2 bg-gray-800 text-gray-400 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer border border-gray-700/60"
                  title="Copy code snippet"
                >
                  <Code2 className="h-4 w-4" />
                </button>
                <pre className="text-green-400 font-mono text-xs overflow-x-auto leading-relaxed select-all">
                  {getCodeSnippet()}
                </pre>
              </div>

              {/* Console Execution Display */}
              <div className="bg-[#121212] border-t border-gray-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-widest flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-[#0052FF] rounded-full inline-block animate-pulse" />
                    <span>Console Response Log Terminal</span>
                  </span>
                  
                  <button
                    onClick={handleRunPlayground}
                    disabled={apiExecutionStatus === 'calling'}
                    className="px-4 py-2 bg-[#0052FF] hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center space-x-1.5 transition-colors shadow-lg shadow-blue-500/10"
                  >
                    {apiExecutionStatus === 'calling' ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Executing pipeline...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Run API Call</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-[#1c1c1c] border border-gray-800 rounded-xl p-4 text-[10px] font-mono text-gray-200 overflow-y-auto max-h-[180px] leading-relaxed">
                  {apiExecutionStatus === 'idle' && (
                    <div className="text-gray-500 italic text-center py-6">
                      Press "Run API Call" above to submit the payload using the specified HMAC access-keys.
                    </div>
                  )}
                  {apiExecutionStatus === 'calling' && (
                    <div className="text-[#0052FF] font-semibold flex items-center justify-center py-6 space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Connecting secure SSL pathway... Verifying HMAC sig...</span>
                    </div>
                  )}
                  {apiExecutionStatus === 'success' && (
                    <pre className="text-emerald-400 whitespace-pre">{httpResponseJson}</pre>
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {hubTab === 'cypress' && (
        <div className="space-y-6">
          {/* Header Title Card */}
          <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-xl border border-gray-800">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <ShieldCheck className="w-56 h-56 text-[#0052FF]" />
            </div>
            <div className="relative z-10 space-y-3 max-w-2xl">
              <span className="text-[10px] bg-red-500 text-white font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Cypress Headless Automation Dashboard
              </span>
              <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-tight">
                Quality Assurance Ledger Integrity
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                Run the end-to-end financial transaction pipeline. This script exercises the backend services, validates wallet operations, executes trades, tests secure webhooks, and confirms transactional rollback behavior when errors occur.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT PANEL: Execution Controls & Checklist */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center justify-between">
                  <span>E2E Integration Flow Checklist</span>
                  {cypressResults && (
                    <span className="text-xs font-semibold text-[#0052FF] font-mono">
                      {cypressResults.results.passed}/{cypressResults.results.total} PASSED
                    </span>
                  )}
                </h3>

                <div className="space-y-3 text-xs font-semibold">
                  {[
                    { title: 'User Account Creation & Password Salting', desc: 'Creates Users record. Validates PBKDF2 hashing algorithm.' },
                    { title: 'JWT Handshake Session Authentication', desc: 'Issues access tokens and validates signature expiration.' },
                    { title: 'Webhook Settlement Verification', desc: 'Posts a cleared USD event payload and updates the database cash balance.' },
                    { title: 'Fail-Safe Ledger Rollback Verification', desc: 'Triggers intentional error to test safe database rollback state.' },
                    { title: 'Dual double-entry crypto trade execution', desc: 'Debits Cash, Credits Asset wallet under a single transaction.' },
                    { title: 'Logout Audit Logging Telemetry', desc: 'Terminates JWT session and registers audit record for session.' }
                  ].map((test, i) => {
                    const passed = cypressResults && cypressResults.results.passed > i;
                    const failed = cypressResults && !cypressResults.success && cypressResults.results.passed <= i;
                    
                    return (
                      <div key={i} className={`p-3 rounded-xl border flex items-start space-x-3 transition-colors ${
                        passed ? 'bg-green-50/50 border-green-200 text-green-900' :
                        failed ? 'bg-red-50/50 border-red-200 text-red-900' :
                        cypressRunning && cypressResults?.results.passed === i ? 'bg-blue-50/50 border-blue-200 text-blue-900' :
                        'bg-gray-50/40 border-gray-100 text-gray-500'
                      }`}>
                        <div className="mt-0.5">
                          {passed ? (
                            <CheckCircle2 className="h-4 animate-scale-in text-green-600" />
                          ) : failed ? (
                            <span className="w-4 h-4 bg-red-100 text-red-600 text-[10px] font-black rounded-full flex items-center justify-center">×</span>
                          ) : cypressRunning && (cypressResults?.results.passed || 0) === i ? (
                            <RefreshCw className="h-4 w-4 animate-spin text-[#0052FF]" />
                          ) : (
                            <span className="w-4 h-4 border-2 border-gray-300 rounded-full inline-block" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-bold">{test.title}</p>
                          <p className="text-[10px] text-gray-400 font-medium">{test.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={runCypressTests}
                  disabled={cypressRunning}
                  className="w-full py-3 bg-[#0052FF] hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold text-sm rounded-xl cursor-pointer flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/10"
                >
                  {cypressRunning ? (
                    <>
                      <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                      <span>Starting verification run...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4.5 w-4.5 fill-current" />
                      <span>Run E2E Cypress Tests</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: Live Browser Output / Logs */}
            <div className="lg:col-span-7 space-y-6">
              {/* Verification runner output */}
              <div className="bg-slate-900 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
                <div className="bg-gray-950 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block" />
                    <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full inline-block" />
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block" />
                  </div>
                  <div className="bg-[#1e1e1e] text-gray-400 text-[10px] font-mono px-4 py-1 rounded-md max-w-sm truncate text-center uppercase tracking-tighter">
                    {import.meta.env.VITE_API_BASE_URL || 'PROD-ENDPOINT'}/api/dev/run-tests
                  </div>
                  <span className="text-[10px] text-[#0052FF] font-mono font-bold uppercase">CYPRESS RUNNER</span>
                </div>

                <div className="p-5 space-y-4">
                  {/* Stats Ribbon */}
                  {cypressResults && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-gray-800/50 p-2.5 rounded-xl border border-gray-800">
                        <span className="text-[9px] text-gray-400 uppercase tracking-widest font-mono font-bold block mb-0.5">Total Tests</span>
                        <span className="text-sm font-black text-white font-mono">{cypressResults.results.total}</span>
                      </div>
                      <div className="bg-green-900/20 p-2.5 rounded-xl border border-green-800/30">
                        <span className="text-[9px] text-green-400 uppercase tracking-widest font-mono font-bold block mb-0.5">Passed</span>
                        <span className="text-sm font-black text-green-400 font-mono">{cypressResults.results.passed}</span>
                      </div>
                      <div className="bg-red-900/20 p-2.5 rounded-xl border border-red-800/30">
                        <span className="text-[9px] text-red-400 uppercase tracking-widest font-mono font-bold block mb-0.5">Failed</span>
                        <span className="text-sm font-black text-red-400 font-mono">{cypressResults.results.failed}</span>
                      </div>
                      <div className="bg-blue-900/20 p-2.5 rounded-xl border border-blue-800/30">
                        <span className="text-[9px] text-blue-400 uppercase tracking-widest font-mono font-bold block mb-0.5">Duration</span>
                        <span className="text-sm font-black text-blue-400 font-mono">{cypressResults.results.durationMs}ms</span>
                      </div>
                    </div>
                  )}

                  {/* Shell stdout Terminal */}
                  <div className="bg-[#0c0d10] border border-gray-800 rounded-xl p-4 font-mono text-[11px] leading-relaxed text-gray-200 min-h-[220px] max-h-[300px] overflow-y-auto space-y-1.5 scrollbar-thin">
                    <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest block border-b border-gray-800 pb-1 mb-2">CYPRESS INTEGRATION SHELL STDOUT</span>
                    
                    {cypressRunning && (
                      <div className="text-blue-400 font-bold flex items-center space-x-2 animate-pulse py-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                        <span>Initializing sandboxed database environment... Running Cypress bot loops...</span>
                      </div>
                    )}

                    {cypressResults ? (
                      cypressResults.logs.map((log, index) => {
                        const isSuccess = log.includes('✅');
                        const isError = log.includes('❌') || log.includes('[ERROR]');
                        return (
                          <div key={index} className={`${
                            isSuccess ? 'text-emerald-400 font-semibold' :
                            isError ? 'text-rose-500 font-bold' :
                            log.includes('[RECOVERABLE]') ? 'text-yellow-400 italic' :
                            'text-gray-300'
                          }`}>
                            {log}
                          </div>
                        );
                      })
                    ) : (
                      !cypressRunning && (
                        <div className="text-gray-500 italic text-center py-12">
                          Press "Run E2E Cypress Tests" to start the local browser automation run.
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {hubTab === 'real_coinbase' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: API Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-6">
              <div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Live Bank Rails Connect
                </span>
                <h2 className="text-xl font-black text-gray-900 mt-2">
                  Configure Coinbase CDP Connection
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Connect your application directly to the Coinbase Developer Platform. When active, all trades and balances are settled live using actual bank rails and asset wallets on your account.
                </p>
              </div>

              <form onSubmit={handleSaveCoinbaseConfig} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    CDP API Key Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. organizations/3fa8-10d8/apiKeys/cdp_api_83fa10"
                    value={cdpApiKeyName}
                    onChange={(e) => setCdpApiKeyName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    CDP PEM Private Key
                  </label>
                  <textarea
                    rows={6}
                    required
                    placeholder="-----BEGIN EC PRIVATE KEY-----&#10;MHQCAQEEI...&#10;-----END EC PRIVATE KEY-----"
                    value={cdpPrivateKey}
                    onChange={(e) => setCdpPrivateKey(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-xs font-mono px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1.5">
                    Operational Mode
                  </label>
                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setCdpMode('testing')}
                      className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                        cdpMode === 'testing'
                          ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Globe className="h-4 w-4" />
                      <span>Testing Mode</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCdpMode('real')}
                      className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                        cdpMode === 'real'
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Live Ledger Mode</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex space-x-3">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="flex-1 bg-[#0052FF] hover:bg-[#0040D0] text-white py-3 px-4 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-blue-500/10 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingConfig ? 'Saving Secure Tunnel...' : 'Save Config & Mode'}
                  </button>
                  <button
                    type="button"
                    onClick={handleTestCoinbaseConnection}
                    disabled={isTestingConnection || !cdpApiKeyName}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-5 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {isTestingConnection ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    <span>Verify Connection</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Information & Handshake logs */}
          <div className="lg:col-span-5 space-y-6">
            {/* Handshake Logs Terminal */}
            <div className="bg-[#0f111a] border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="text-xs font-bold text-gray-400 flex items-center space-x-2">
                  <Terminal className="h-4 w-4 text-[#0052FF]" />
                  <span className="font-mono">COINBASE CDP HANDSHAKE LOGS</span>
                </span>
                {testPassed !== null && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    testPassed ? 'bg-green-950 text-green-400 border border-green-800/30' : 'bg-red-950 text-red-400 border border-red-800/30'
                  }`}>
                    {testPassed ? 'HANDSHAKE PASSED' : 'HANDSHAKE REJECTED'}
                  </span>
                )}
              </div>

              <div className="font-mono text-[11px] leading-relaxed text-gray-300 min-h-[180px] max-h-[250px] overflow-y-auto space-y-2 scrollbar-thin">
                {testLog.length > 0 ? (
                  testLog.map((log, index) => (
                    <div key={index} className={
                      log.startsWith('✅') ? 'text-emerald-400' :
                      log.startsWith('❌') ? 'text-rose-400 font-semibold' :
                      'text-gray-400'
                    }>
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 italic text-center py-12">
                    Enter your CDP key, private key, and click "Verify Connection" to test real-time connectivity to Coinbase REST APIs.
                  </div>
                )}
              </div>
            </div>

            {/* Instruction box */}
            <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-gray-900 flex items-center space-x-1.5">
                <Sparkles className="h-4 w-4 text-[#0052FF]" />
                <span>How to obtain CDP API Credentials?</span>
              </h4>
              <ol className="text-[11px] text-gray-500 list-decimal pl-4 space-y-1.5">
                <li>Log into the <a href="https://cdp.coinbase.com/" target="_blank" rel="noreferrer" className="text-[#0052FF] font-semibold underline">Coinbase Developer Platform</a>.</li>
                <li>Navigate to <strong>API Keys</strong> in your dashboard.</li>
                <li>Create a new API Key with permissions for <strong>"Read"</strong> and <strong>"Trade"</strong>.</li>
                <li>Download your private key PEM file (do not lose this file!).</li>
                <li>Copy the <strong>Key Name</strong> (format <code>organizations/...</code>) and paste it here, then copy and paste the entire content of the private key PEM file.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {hubTab === 'wise_plaid' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-950 text-white p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-sm border border-indigo-800/40">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Building2 className="w-56 h-56 text-indigo-400" />
            </div>
            <div className="relative z-10 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] bg-indigo-500 text-white font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Integration Configuration Storage
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold px-2.5 py-1 rounded-full uppercase">
                  Server-Side Encrypted
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                Wise & Plaid API Credentials Settings
              </h2>
              <p className="text-xs text-indigo-200/80 leading-relaxed max-w-3xl">
                Configure and persist your live credentials for Wise multi-currency banking ledger sync and Plaid ACH bank authentication into server process storage.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveIntegrationsConfig} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Wise Credentials */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Wise (TransferWise) API</h3>
                      <p className="text-[11px] text-gray-500">Multi-currency balance & transfer API</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${wiseStatus.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {wiseStatus.configured ? 'ACTIVE' : 'STANDBY'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                      Wise Personal / Business API Bearer Token (<code className="text-indigo-600">WISE_API_TOKEN</code>)
                    </label>
                    <div className="relative">
                      <input
                        type={showWiseToken ? 'text' : 'password'}
                        placeholder="Paste Wise API Token (e.g. wise_live_...)"
                        value={wiseApiToken}
                        onChange={(e) => setWiseApiToken(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWiseToken(!showWiseToken)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                      >
                        {showWiseToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Obtain from Wise Account Settings &gt; API Tokens.</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                      Wise Profile ID (<code className="text-indigo-600">WISE_PROFILE_ID</code>)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 101924589"
                      value={wiseProfileId}
                      onChange={(e) => setWiseProfileId(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleTestWiseHandshake}
                      disabled={isTestingWise}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isTestingWise ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>Test Wise API Handshake</span>
                    </button>
                    <span className="text-[11px] text-gray-400">
                      {wiseStatus.tokenMasked ? `Saved: ${wiseStatus.tokenMasked}` : 'No token saved'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Plaid Credentials */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Plaid Financial API</h3>
                      <p className="text-[11px] text-gray-500">ACH direct bank authentication & Link API</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${plaidStatus.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {plaidStatus.configured ? 'ACTIVE' : 'STANDBY'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                      Plaid Client ID (<code className="text-slate-700">PLAID_CLIENT_ID</code>)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 60a9f821b0213a00..."
                      value={plaidClientId}
                      onChange={(e) => setPlaidClientId(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-700 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                      Plaid API Secret (<code className="text-slate-700">PLAID_SECRET</code>)
                    </label>
                    <div className="relative">
                      <input
                        type={showPlaidSecret ? 'text' : 'password'}
                        placeholder="Paste Plaid API Secret"
                        value={plaidSecret}
                        onChange={(e) => setPlaidSecret(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-700 pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPlaidSecret(!showPlaidSecret)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                      >
                        {showPlaidSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                      Plaid Target Environment (<code className="text-slate-700">PLAID_ENV</code>)
                    </label>
                    <select
                      value={plaidEnv}
                      onChange={(e) => setPlaidEnv(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-200 text-xs sm:text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-700 font-semibold text-gray-800"
                    >
                      <option value="sandbox">Sandbox (Development / Test Environment)</option>
                      <option value="development">Development (Real Accounts / Dev Tier)</option>
                      <option value="production">Production (Live Financial Network)</option>
                    </select>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleTestPlaidHandshake}
                      disabled={isTestingPlaid}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isTestingPlaid ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>Test Plaid Format</span>
                    </button>
                    <span className="text-[11px] font-mono text-gray-400">
                      Env: {plaidEnv.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* FULL-WIDTH SAVE ACTION FOOTER & LOG TERMINAL */}
            <div className="lg:col-span-12 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Save className="w-4 h-4 text-indigo-400" />
                    <span>Persist Configuration to Application Storage</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Saves Wise & Plaid credentials securely into process environment variables and updates runtime configuration storage.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isSavingIntegrations}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingIntegrations ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save & Persist Credentials</span>
                </button>
              </div>

              {/* Real-time Integration Terminal Logs */}
              <div className="bg-[#0f111a] border border-gray-800 rounded-2xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <span className="text-xs font-bold text-gray-400 flex items-center space-x-2">
                    <Terminal className="h-4 w-4 text-indigo-400" />
                    <span className="font-mono">WISE & PLAID INTEGRATION DIAGNOSTIC LOGS</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIntegrationLogs([])}
                    className="text-[10px] text-gray-500 hover:text-gray-300 font-mono"
                  >
                    Clear Logs
                  </button>
                </div>

                <div className="font-mono text-[11px] leading-relaxed text-gray-300 min-h-[120px] max-h-[220px] overflow-y-auto space-y-1.5 scrollbar-thin">
                  {integrationLogs.length > 0 ? (
                    integrationLogs.map((log, index) => (
                      <div key={index} className={
                        log.includes('✅') ? 'text-emerald-400' :
                        log.includes('❌') ? 'text-rose-400 font-semibold' :
                        log.includes('🚀') ? 'text-indigo-300' :
                        'text-gray-400'
                      }>
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 italic text-center py-8">
                      No diagnostic output yet. Click "Test Wise API Handshake" or "Test Plaid Format" to inspect connection response data.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
