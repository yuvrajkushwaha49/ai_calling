import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  constructor(private config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get('TWILIO_ACCOUNT_SID')?.trim() &&
        this.config.get('TWILIO_AUTH_TOKEN')?.trim() &&
        this.config.get('TWILIO_FROM_NUMBER')?.trim(),
    );
  }

  getPublicBaseUrl() {
    return (
      this.config.get<string>('PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
      `http://localhost:${this.config.get('PORT') || 4000}`
    );
  }

  getStatus() {
    const configured = this.isConfigured();
    const publicBaseUrl = this.getPublicBaseUrl();
    const from =
      this.config.get<string>('TWILIO_FROM_NUMBER')?.trim() || null;
    const local =
      /localhost|127\.0\.0\.1/i.test(publicBaseUrl) ||
      publicBaseUrl.startsWith('http://192.') ||
      publicBaseUrl.startsWith('http://10.');
    return {
      configured,
      fromNumber: from,
      publicBaseUrl,
      webhookVoice: `${publicBaseUrl}/api/calls/webhooks/twilio/voice`,
      webhookStatus: `${publicBaseUrl}/api/calls/webhooks/twilio/status`,
      mediaWs: `${publicBaseUrl.replace(/^http/i, 'ws')}/api/calls/twilio-media`,
      webhookReady: configured && !local,
      needsTunnel: configured && local,
      message: !configured
        ? 'Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to backend/.env'
        : local
          ? 'PUBLIC_BASE_URL is local — Twilio cannot reach Voice/Status webhooks. Use ngrok/Cloudflare HTTPS.'
          : 'Twilio ready — outbound plays greeting then Connect Media Stream for two-way talk',
    };
  }

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
      `Phone "${raw}" looks invalid. Use E.164 e.g. +9198XXXXXXXX`,
    );
  }

  private authHeader() {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID')?.trim();
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN')?.trim();
    if (!sid || !token) {
      throw new ServiceUnavailableException(
        'Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
      );
    }
    return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
  }

  buildVoiceTwiml(options: {
    callId: string;
    greetingAudioUrl?: string | null;
    greetingText?: string | null;
  }): string {
    const base = this.getPublicBaseUrl();
    const wsBase = base.replace(/^http/i, 'ws');
    const streamUrl = `${wsBase}/api/calls/twilio-media?callId=${encodeURIComponent(options.callId)}`;
    const play = options.greetingAudioUrl
      ? `<Play>${escapeXml(options.greetingAudioUrl)}</Play>`
      : options.greetingText
        ? `<Say language="hi-IN">${escapeXml(options.greetingText.slice(0, 400))}</Say>`
        : `<Say>Namaste</Say>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${play}
  <Connect>
    <Stream url="${escapeXml(streamUrl)}">
      <Parameter name="callId" value="${escapeXml(options.callId)}" />
    </Stream>
  </Connect>
</Response>`;
  }

  async createOutboundCall(options: {
    to: string;
    callId: string;
  }): Promise<{ sid: string }> {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID')?.trim();
    const from = this.config.get<string>('TWILIO_FROM_NUMBER')?.trim();
    if (!accountSid || !from) {
      throw new ServiceUnavailableException(
        'Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_FROM_NUMBER.',
      );
    }

    const base = this.getPublicBaseUrl();
    const to = this.normalizePhone(options.to);
    const voiceUrl = `${base}/api/calls/webhooks/twilio/voice?callId=${encodeURIComponent(options.callId)}`;
    const statusCallback = `${base}/api/calls/webhooks/twilio/status?callId=${encodeURIComponent(options.callId)}`;

    this.logger.log(`Starting Twilio call to ${to} for call ${options.callId}`);

    const body = new URLSearchParams({
      To: to,
      From: from,
      Url: voiceUrl,
      Method: 'POST',
      StatusCallback: statusCallback,
      StatusCallbackMethod: 'POST',
      StatusCallbackEvent: 'initiated ringing answered completed',
    });

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls.json`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.error(`Twilio create call failed (${res.status}): ${text}`);
        throw new BadRequestException(
          this.extractError(text) || `Twilio call failed (HTTP ${res.status})`,
        );
      }
      const json = JSON.parse(text) as { sid?: string };
      if (!json.sid) {
        throw new BadRequestException('Twilio response missing Call SID');
      }
      return { sid: json.sid };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Twilio Calls.create failed: ${msg}`);
      throw new BadRequestException(msg);
    }
  }

  private extractError(payload: string): string | null {
    try {
      const json = JSON.parse(payload) as {
        message?: string;
        error_message?: string;
      };
      return json.message || json.error_message || null;
    } catch {
      return null;
    }
  }
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
