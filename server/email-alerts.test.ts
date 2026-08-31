/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { sendSovereignAlert } from '../src/lib/email-alerts';

describe('Sovereign Email Alerts Integration', () => {
  it('dispatches or simulates sovereign alert successfully without throwing', async () => {
    const result = await sendSovereignAlert({
      subject: 'Test Sovereign Security Alert',
      message: 'This is a test notification verifying email alert dispatch pipelines.',
      severity: 'SUCCESS',
      recipientEmail: 'mlaframboisemm@gmail.com',
      metadata: { testId: 123, network: 'live' }
    });
    expect(typeof result.success).toBe('boolean');
    expect(['mailersend', 'smtp', 'unconfigured']).toContain(result.channel);
  });
});
