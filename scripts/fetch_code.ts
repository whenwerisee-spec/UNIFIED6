import { ethers } from 'ethers';

async function run() {
  const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');
  const addrs = [
    '0xae7ab96520de3a18e5e111b5eaac095312d7fe84', // stETH
    '0x7712c34205737192402172409a8f7ccef8aa2aec', // BUIDL
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'  // USDC
  ];
  for (const addr of addrs) {
    const code = await provider.getCode(addr);
    console.log(`${addr} code length: ${code.length}`);
  }
}
run();
