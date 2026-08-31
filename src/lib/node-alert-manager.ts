export interface NodeAlertPayload {
  nodeUrl: string;
  chainId: number;
  reason: string;
  errorDetails?: string;
  timestamp: string;
  severity: 'WARNING' | 'CRITICAL';
}

export class NodeAlertManager {
  private webhookUrl: string | undefined;
  private recentAlerts: Map<string, number> = new Map();
  private throttleMs = 60_000; // Throttle identical node alerts to max 1 per minute

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.NODE_ALERT_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || process.env.TELEGRAM_WEBHOOK_URL;
  }

  public async notifyNodeDemoted(payload: NodeAlertPayload): Promise<boolean> {
    const key = `${payload.chainId}_${payload.nodeUrl}`;
    const lastSent = this.recentAlerts.get(key) || 0;
    const now = Date.now();

    if (now - lastSent < this.throttleMs) {
      console.log(`[🔇 NodeAlert] Throttled duplicate alert for node: ${payload.nodeUrl}`);
      return false;
    }

    this.recentAlerts.set(key, now);
    console.warn(`[🚨 NodeAlert ${payload.severity}] Chain ID ${payload.chainId} - Node degraded/demoted: ${payload.nodeUrl}. Reason: ${payload.reason}`);

    if (!this.webhookUrl) {
      // If no external webhook configured, local console audit logging is preserved safely
      return false;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚨 **[Sovereign Node Alert]** ${payload.severity}\n**Chain ID:** ${payload.chainId}\n**Node:** \`${payload.nodeUrl}\`\n**Reason:** ${payload.reason}\n**Time:** ${payload.timestamp}`
        })
      });
      return response.ok;
    } catch (err) {
      console.warn('[⚠️ NodeAlert] Webhook delivery failed:', err);
      return false;
    }
  }
}

export const nodeAlertManager = new NodeAlertManager();
