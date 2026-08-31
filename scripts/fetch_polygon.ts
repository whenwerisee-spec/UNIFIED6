import { ethers } from 'ethers';

async function tryProvider(url: string, address: string) {
  try {
    const provider = new ethers.JsonRpcProvider(url);
    const balance = await provider.getBalance(address);
    console.log(`Successfully connected to ${url}`);
    console.log(`MATIC Balance: ${ethers.formatEther(balance)} MATIC`);

    const ERC20_ABI = [
      'function balanceOf(address account) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];

    const tokens = [
      { name: 'Bridged USDC (USDC.e)', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
      { name: 'Native USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
      { name: 'Tether USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' }
    ];

    for (const token of tokens) {
      try {
        const contractAddress = ethers.getAddress(token.address);
        const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        const symbol = await contract.symbol();
        const formattedBalance = ethers.formatUnits(balance, decimals);
        console.log(`${token.name} (${symbol}): ${formattedBalance}`);
      } catch (e: any) {
        console.error(`Failed to fetch ${token.name} balance:`, e.message || e);
      }
    }
    return true;
  } catch (err: any) {
    console.error(`Failed to query using ${url}:`, err.message || err);
    return false;
  }
}

async function run() {
  const address = ethers.getAddress(process.env.VITE_MARSHALL_ADDRESS || '0x742d35cc6634c0532925a3b844bc454e4438f44e');
  const urls = [
    'https://polygon-bor.publicnode.com',
    'https://polygon.drpc.org',
    'https://polygon-rpc.com'
  ];

  for (const url of urls) {
    console.log(`\nQuerying Polygon balances using URL: ${url}`);
    const success = await tryProvider(url, address);
    if (success) {
      break;
    }
  }
}

run().catch(console.error);
