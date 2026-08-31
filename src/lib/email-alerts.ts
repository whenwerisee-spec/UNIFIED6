/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import nodemailer from 'nodemailer';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

export interface AlertNotificationOptions {
  subject: string;
  message: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  recipientEmail?: string;
  metadata?: Record<string, any>;
}

export async function sendSovereignAlert(options: AlertNotificationOptions): Promise<{ success: boolean; channel: string; error?: string }> {
  const recipient = options.recipientEmail || process.env.ALERT_RECIPIENT_EMAIL || process.env.OWNER_EMAIL || 'mlaframboisemm@gmail.com';
  const senderEmail = process.env.SMTP_FROM || 'alerts@paydirect.sovereign';
  const severityTag = `[${options.severity || 'INFO'}]`;
  const fullSubject = `${severityTag} PayDirect Sovereign Gateway Alert: ${options.subject}`;
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #08111f; color: #f3f4f6; padding: 32px; border-radius: 12px;">
      <h2 style="color: #38bdf8; margin-top: 0;">PayDirect Sovereign Gateway</h2>
      <p style="font-size: 16px; line-height: 1.5; color: #e2e8f0;">${options.message}</p>
      ${options.metadata ? `<pre style="background: #0f172a; padding: 16px; border-radius: 8px; color: #38bdf8; font-size: 12px; overflow-x: auto;">${JSON.stringify(options.metadata, null, 2)}</pre>` : ''}
      <hr style="border: 0; border-top: 1px solid #1e293b; margin: 24px 0;" />
      <p style="font-size: 12px; color: #64748b;">Secure Sovereign Ledger Notification Service • Automated Dispatch</p>
    </div>
  `;

  // 1. Try MailerSend API if configured
  const mailerSendKey = process.env.MAILERSEND_API_KEY;
  if (mailerSendKey) {
    try {
      const mailersend = new MailerSend({ apiKey: mailerSendKey });
      const sentFrom = new Sender(senderEmail, 'PayDirect Sovereign');
      const recipients = [new Recipient(recipient, 'Sovereign Administrator')];
      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(fullSubject)
        .setHtml(htmlContent)
        .setText(options.message);

      await mailersend.email.send(emailParams);
      return { success: true, channel: 'mailersend' };
    } catch (err: any) {
      console.warn('[EmailAlerts] MailerSend dispatch failed, falling back to SMTP:', err?.message || err);
    }
  }

  // 2. Try Nodemailer SMTP if configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'PayDirect Sovereign'}" <${senderEmail}>`,
        to: recipient,
        subject: fullSubject,
        text: options.message,
        html: htmlContent,
      });

      return { success: true, channel: 'smtp' };
    } catch (err: any) {
      console.warn('[EmailAlerts] SMTP dispatch failed:', err?.message || err);
      return { success: false, channel: 'smtp', error: err?.message || String(err) };
    }
  }

  // 3. Strict live-only error reporting when no external provider credentials are configured
  return { success: false, channel: 'unconfigured', error: 'EMAIL_PROVIDER_NOT_CONFIGURED: Set MAILERSEND_API_KEY or SMTP credentials to dispatch live alerts.' };
}
