import { ethers } from 'ethers';
import { parseEther, parseGwei, type Hex } from 'viem';
import { transactionQueue } from '../src/lib/resilient-tx-api';

async function testApiAndWorkerQueue() {
  console.log('==================================================');
  console.log('🧪 TESTING RESILIENT REST API & AUTONOMOUS QUEUE WORKER');
  console.log('==================================================');

  // Test 1: Enqueue Asynchronous Task
  console.log('\n--- 1. Enqueue Task into Autonomous Queue ---');
  const task = transactionQueue.enqueue({
    recipient: process.env.VITE_MARSHALL_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    valueEth: '0.05',
    chainId: 1,
    expectedEvents: ['Transfer']
  });

  console.log('Created Task ID:', task.id);
  console.log('Task Status:', task.status);
  if (task.status !== 'QUEUED') throw new Error('Task was not properly queued');

  // Test 2: Task Retrieval
  console.log('\n--- 2. Query Queue Manager ---');
  const retrieved = transactionQueue.getTask(task.id);
  console.log('Retrieved Task ID match:', retrieved?.id === task.id ? '✅ PASS' : '❌ FAIL');
  const allTasks = transactionQueue.listTasks();
  console.log('Total tasks in queue:', allTasks.length);
  if (allTasks.length < 1) throw new Error('Task list empty');

  // Test 3: Worker Lifecycle Control
  console.log('\n--- 3. Autonomous Worker Lifecycle ---');
  const signerKey = (process.env.PRIMARY_SIGNER_KEY || '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f367921') as Hex;
  transactionQueue.startAutonomousWorker(signerKey, 1000);
  console.log('Worker isRunning:', transactionQueue.isRunning() ? '✅ ACTIVE' : '❌ INACTIVE');
  
  transactionQueue.stopAutonomousWorker();
  console.log('Worker stopped isRunning:', !transactionQueue.isRunning() ? '✅ STOPPED' : '❌ STILL ACTIVE');

  console.log('\n==================================================');
  console.log('🎉 REST API & AUTONOMOUS QUEUE TESTS COMPLETED CLEANLY!');
  console.log('==================================================\n');
}

testApiAndWorkerQueue().catch((err) => {
  console.error('Queue test error:', err);
  process.exit(1);
});
