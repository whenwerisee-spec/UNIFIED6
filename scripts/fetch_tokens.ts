import { ethers } from 'ethers';

async function run() {
  const address = ethers.getAddress(process.env.VITE_MARSHALL_ADDRESS || '0x742d35cc6634c0532925a3b844bc454e4438f44e');
  const providerUrl = process.env.VITE_RPC_ETHEREUM || 'https://ethereum-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(providerUrl);

  console.log(`Querying balances on-chain for address: ${address}`);

  // 1. ETH Balance
  try {
    const balance = await provider.getBalance(address);
    console.log(`ETH Balance: ${ethers.formatEther(balance)} ETH`);
  } catch (e: any) {
    console.error('Failed to fetch ETH balance:', e.message || e);
  }

  const ERC20_ABI = [
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ];

  const tokens = [
    { name: 'Lido stETH', address: '0xae7ab96520de3a18e5e111b5eaac095312d7fe84' },
    { name: 'BlackRock BUIDL', address: '0x7712c34205737192402172409a8f7ccef8aa2aec' },
    { name: 'Ondo USDY', address: '0x96f6ef951840721adbf46ac996b59e0235cb985c' },
    { name: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
    { name: 'USDT', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' }
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
}

run().catch(console.error);
