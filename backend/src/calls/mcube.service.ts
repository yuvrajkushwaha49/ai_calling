import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class McubeService {
  private readonly logger = new Logger(McubeService.name);

  constructor(private config: ConfigService) {}

  /**
   * Check if MCube credentials/config are provided in environment.
   */
  isConfigured(): boolean {
    return Boolean(
      this.config.get('MCUBE_API_KEY')?.trim() ||
        this.config.get('MCUBE_OUTBOUND_URL')?.trim(),
    );
  }

  getPublicBaseUrl(): string {
    return (
      this.config.get<string>('PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
      `http://localhost:${this.config.get('PORT') || 4000}`
    );
  }

  /**
   * Normalized status for UI/dashboard — never exposes secrets.
   */
  getStatus() {
    const configured = this.isConfigured();
    const publicBaseUrl = this.getPublicBaseUrl();
    const wsBase = publicBaseUrl.replace(/^http/i, 'ws');
    const local =
      /localhost|127\.0\.0\.1/i.test(publicBaseUrl) ||
      publicBaseUrl.startsWith('http://192.') ||
      publicBaseUrl.startsWith('http://10.');

    return {
      configured,
      publicBaseUrl,
      // MCube standard WebSocket endpoints
      websocketUrlTemplate: `${wsBase}/bid/websocket/{callId}`,
      alternativeWsUrl: `${wsBase}/api/calls/mcube-media`,
      webhookReady: configured && !local,
      needsTunnel: local,
      message: !configured
        ? 'MCube WebSocket endpoint is active. Optionally add MCUBE_API_KEY / MCUBE_OUTBOUND_URL to backend/.env for outbound campaigns.'
        : local
          ? 'PUBLIC_BASE_URL is local — MCube telephony requires a public WSS endpoint (e.g. ngrok / Cloudflare tunnel).'
          : 'MCube WebSocket service is ready to accept bidirectional live calls.',
    };
  }

  /**
   * Normalize to E.164. Indian 10-digit numbers -> +91...
   */
  normalizePhone(raw: string): string {
    const digits = String(raw || '').replace(/[^\d+]/g, '');
    if (!digits) {
      throw new BadRequestException('Lead phone number is missing');
    }
    if (digits.startsWith('+') && digits.length >= 11) return digits;
    const only = digits.replace(/\D/g, '');
    if (only.length === 10) return `+91${only}`;
    if (only.length === 12 && only.startsWith('91')) return `+${only}`;
    if (only.length === 11 && only.startsWith('0')) return `+91${only.slice(1)}`;
    if (only.length >= 11) return `+${only}`;
    throw new BadRequestException(
      `Phone "${raw}" looks invalid. Use E.164 format, e.g. +9198XXXXXXXX`,
    );
  }

  /**
   * Outbound call trigger (if MCube REST API is configured for click-to-call)
   */
  async createOutboundCall(options: {
    to: string;
    callId: string;
  }): Promise<{ status: string; callId: string }> {
    const outboundUrl = this.config.get<string>('MCUBE_OUTBOUND_URL')?.trim();
    const apiKey = this.config.get<string>('MCUBE_API_KEY')?.trim();

    if (!outboundUrl) {
      this.logger.warn(
        `MCUBE_OUTBOUND_URL is not set. Call ${options.callId} registered, waiting for incoming MCube stream.`,
      );
      return { status: 'pending_inbound_stream', callId: options.callId };
    }

    const to = this.normalizePhone(options.to);
    const wsUrl = `${this.getPublicBaseUrl().replace(/^http/i, 'ws')}/bid/websocket/${encodeURIComponent(options.callId)}`;

    try {
      const res = await fetch(outboundUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          phone: to,
          callId: options.callId,
          websocketUrl: wsUrl,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`MCube outbound trigger failed (${res.status}): ${text}`);
        throw new BadRequestException(`MCube call trigger failed: ${text}`);
      }

      return { status: 'initiated', callId: options.callId };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`MCube createOutboundCall error: ${msg}`);
      throw new BadRequestException(msg);
    }
  }
}
