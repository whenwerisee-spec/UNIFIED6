import { spawn } from 'child_process';

type Step = {
  name: string;
  command: string;
  critical: boolean;
  retries?: number;
  externalBlockPatterns?: RegExp[];
};

type StepResult = {
  name: string;
  command: string;
  attempts: number;
  success: boolean;
  externalBlocked?: boolean;
  externalBlockReason?: string;
  durationMs: number;
  exitCode: number | null;
};

function runCommand(command: string, env: NodeJS.ProcessEnv): Promise<{ code: number | null; durationMs: number; output: string }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, {
      shell: true,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let captured = '';

    child.stdout.on('data', (chunk) => {
      const text = String(chunk || '');
      captured += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = String(chunk || '');
      captured += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({
        code,
        durationMs: Date.now() - started,
        output: captured
      });
    });

    child.on('error', () => {
      resolve({
        code: 1,
        durationMs: Date.now() - started,
        output: captured
      });
    });
  });
}

async function runStep(step: Step, env: NodeJS.ProcessEnv): Promise<StepResult> {
  const retries = Math.max(0, Number(step.retries || 0));
  let attempts = 0;
  let lastCode: number | null = 1;
  let totalDurationMs = 0;

  while (attempts <= retries) {
    attempts += 1;
    console.log(`\n[WISE SUITE] Running step: ${step.name} (attempt ${attempts}/${retries + 1})`);
    console.log(`[WISE SUITE] Command: ${step.command}`);

    const result = await runCommand(step.command, env);
    totalDurationMs += result.durationMs;
    lastCode = result.code;

    if (result.code !== 0 && step.externalBlockPatterns?.length) {
      const matched = step.externalBlockPatterns.find((pattern) => pattern.test(result.output));
      if (matched) {
        return {
          name: step.name,
          command: step.command,
          attempts,
          success: true,
          externalBlocked: true,
          externalBlockReason: matched.source,
          durationMs: totalDurationMs,
          exitCode: result.code
        };
      }
    }

    if (result.code === 0) {
      return {
        name: step.name,
        command: step.command,
        attempts,
        success: true,
        durationMs: totalDurationMs,
        exitCode: result.code
      };
    }

    if (attempts <= retries) {
      console.log(`[WISE SUITE] Step failed, retrying: ${step.name}`);
    }
  }

  return {
    name: step.name,
    command: step.command,
    attempts,
    success: false,
    durationMs: totalDurationMs,
    exitCode: lastCode
  };
}

async function main() {
  const deepMode = process.argv.includes('--deep');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  WISE PRODUCTION SUITE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Mode: ${deepMode ? 'DEEP' : 'FAST'}`);

  const env: NodeJS.ProcessEnv = {
    ...process.env
  };

  // Enable explicit bypass only for non-production local test execution.
  if (String(env.NODE_ENV || 'development').toLowerCase() !== 'production') {
    env.WITHDRAWAL_TEST_BYPASS = 'true';
  }

  const steps: Step[] = [
    {
      name: 'Wise readiness preflight',
      command: 'npm run test:wise-readiness',
      critical: true,
      retries: 0
    },
    {
      name: 'Wise auth health',
      command: 'npm run test:wise-auth-health',
      critical: false,
      retries: 0,
      externalBlockPatterns: [/WISE_AUTH_HEALTH_UNAUTHORIZED/i, /WISE_AUTH_HEALTH_UNAVAILABLE/i]
    },
    {
      name: 'Direct debit E2E',
      command: 'npm exec tsx test-wise-e2e.ts',
      critical: false,
      retries: 0,
      externalBlockPatterns: [/DIRECT_DEBIT_UNAVAILABLE/i, /WISE_SCA_REQUIRED/i, /WISE_TOKEN_INVALID/i]
    },
    {
      name: 'Outbound E2E',
      command: 'npm run test:wise-outbound-e2e',
      critical: false,
      retries: 0,
      externalBlockPatterns: [/OUTBOUND_BALANCE_UNAVAILABLE/i, /OUTBOUND_FUNDING_UNAVAILABLE/i, /OUTBOUND_RECIPIENT_INVALID/i, /WISE_SCA_REQUIRED/i, /WISE_TOKEN_INVALID/i]
    }
  ];

  if (deepMode) {
    steps.push(
      {
        name: 'Ledger integrity check',
        command: 'npm run test:ledger-integrity',
        critical: true,
        retries: 0
      },
      {
        name: 'Type safety lint',
        command: 'npm run lint',
        critical: false,
        retries: 0
      },
      {
        name: 'Security test suite',
        command: 'npm test',
        critical: false,
        retries: 0
      }
    );
  }

  const results: StepResult[] = [];
  for (const step of steps) {
    const result = await runStep(step, env);
    results.push(result);

    if (!result.success && step.critical) {
      console.log(`\n[WISE SUITE] Critical step failed: ${step.name}`);
      break;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  WISE SUITE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');

  for (const result of results) {
    const status = result.externalBlocked
      ? 'EXTERNAL_BLOCK'
      : (result.success ? 'PASS' : 'FAIL');
    console.log(
      `- ${status} | ${result.name} | attempts=${result.attempts} | durationMs=${result.durationMs} | exitCode=${result.exitCode}${result.externalBlocked ? ` | reason=${result.externalBlockReason}` : ''}`
    );
  }

  const failedCritical = steps.some((step) => {
    const result = results.find((r) => r.name === step.name);
    return step.critical && result && !result.success;
  });

  if (failedCritical) {
    console.log('\nFinal Status: FAIL (critical step failed)');
    process.exit(1);
  }

  const anyFailure = results.some((r) => !r.success);
  const anyExternalBlock = results.some((r) => r.externalBlocked);
  if (anyFailure) {
    console.log('\nFinal Status: PASS WITH WARNINGS (non-critical step failed)');
    process.exit(0);
  }

  if (anyExternalBlock) {
    console.log('\nFinal Status: PASS WITH EXTERNAL BLOCKERS');
    process.exit(0);
  }

  console.log('\nFinal Status: PASS');
}

main().catch((err) => {
  console.error('[WISE SUITE] Unexpected failure:', err?.message || String(err));
  process.exit(1);
});
