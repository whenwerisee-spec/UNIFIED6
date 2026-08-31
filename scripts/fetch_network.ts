import { ethers } from 'ethers';

async function run() {
  const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');
  const network = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Block Number: ${blockNumber}`);
}
run();
