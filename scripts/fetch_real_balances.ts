import { ethers } from 'ethers';

async function run() {
  const address = ethers.getAddress(process.env.VITE_MARSHALL_ADDRESS || '0x742d35cc6634c0532925a3b844bc454e4438f44e');
  const providerUrl = process.env.VITE_RPC_ETHEREUM || 'https://ethereum-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(providerUrl);

  console.log(`Querying real yield/staking rewards on-chain for address: ${address}`);

  // 1. ETH Balance
  try {
    const balance = await provider.getBalance(address);
    console.log(`Real ETH Balance: ${ethers.formatEther(balance)} ETH`);
  } catch (e: any) {
    console.error('Failed to fetch ETH balance:', e.message || e);
  }

  // 2. Lido stETH Balance
  const LIDO_STETH = ethers.getAddress('0xae7ab96520de3a18e5e111b5eaac095312d7fe84');
  const LIDO_ABI = [
    'function balanceOf(address account) view returns (uint256)',
    'function getPooledEthByShares(uint256 _sharesAmount) view returns (uint256)',
  ];
  try {
    const lidoContract = new ethers.Contract(LIDO_STETH, LIDO_ABI, provider);
    const stethBalance = await lidoContract.balanceOf(address);
    console.log(`Lido stETH Balance: ${ethers.formatEther(stethBalance)} stETH`);
    if (stethBalance > 0n) {
      const pooledEth = await lidoContract.getPooledEthByShares(stethBalance);
      console.log(`Lido Pooled ETH Equivalent: ${ethers.formatEther(pooledEth)} ETH`);
      console.log(`Estimated APY: 3.00%`);
      const yearlyYield = parseFloat(ethers.formatEther(pooledEth)) * 0.03;
      console.log(`Estimated Yearly Yield: ${yearlyYield.toFixed(6)} ETH`);
    }
  } catch (e: any) {
    console.error('Failed to fetch Lido stETH balance:', e.message || e);
  }

  // 3. Aave Position
  const AAVE_POOL = ethers.getAddress('0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9');
  const AAVE_ABI = [
    'function getUserAccountData(address user) view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  ];
  try {
    const aaveContract = new ethers.Contract(AAVE_POOL, AAVE_ABI, provider);
    const accountData = await aaveContract.getUserAccountData(address);
    const [totalCollateralETH, totalDebtETH] = accountData;
    console.log(`Aave Total Collateral: ${ethers.formatEther(totalCollateralETH)} ETH`);
    console.log(`Aave Total Debt: ${ethers.formatEther(totalDebtETH)} ETH`);
    const netETH = totalCollateralETH - totalDebtETH;
    console.log(`Aave Net Position: ${ethers.formatEther(netETH)} ETH`);
    if (netETH > 0n) {
      console.log(`Estimated APY: 2.00%`);
      const yearlyYield = parseFloat(ethers.formatEther(netETH)) * 0.02;
      console.log(`Estimated Yearly Yield: ${yearlyYield.toFixed(6)} ETH`);
    }
  } catch (e: any) {
    console.error('Failed to fetch Aave user account data:', e.message || e);
  }
}

run().catch(console.error);
