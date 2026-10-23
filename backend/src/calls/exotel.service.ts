import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExotelService {
  private readonly logger = new Logger(ExotelService.name);

  constructor(private config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get('EXOTEL_SID')?.trim() &&
        this.config.get('EXOTEL_API_KEY')?.trim() &&
        this.config.get('EXOTEL_API_TOKEN')?.trim() &&
        this.config.get('EXOTEL_VIRTUAL_NUMBER')?.trim() &&
        this.config.get('EXOTEL_APP_ID')?.trim(),
    );
  }

  /** Status for UI — never exposes secrets. */
  getStatus() {
    const configured = this.isConfigured();
    const publicBaseUrl = this.getPublicBaseUrl();
    const from =
      this.config.get<string>('EXOTEL_VIRTUAL_NUMBER')?.trim() || null;
    const appId = this.config.get<string>('EXOTEL_APP_ID')?.trim() || null;
    const local =
      /localhost|127\.0\.0\.1/i.test(publicBaseUrl) ||
      publicBaseUrl.startsWith('http://192.') ||
      publicBaseUrl.startsWith('http://10.');
    return {
      configured,
      fromNumber: from,
      appId,
      publicBaseUrl,
      webhookStatus: `${publicBaseUrl}/api/calls/webhooks/exotel/status`,
      webhookGreeting: `${publicBaseUrl}/api/calls/webhooks/exotel/greeting`,
      webhookVoicebot: `${publicBaseUrl}/api/calls/webhooks/exotel/voicebot`,
      voicebotWs: `${publicBaseUrl.replace(/^http/i, 'ws')}/api/calls/exotel-media`,
      webhookReady: configured && !local,
      needsTunnel: configured && local,
      message: !configured
        ? 'Add EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_VIRTUAL_NUMBER, and EXOTEL_APP_ID to backend/.env'
        : local
          ? 'PUBLIC_BASE_URL is local — Exotel cannot reach StatusCallback. Use a Cloudflare/ngrok HTTPS URL.'
          : 'Exotel ready — App flow must be Greeting → Voicebot (not Hangup) for two-way talk',
    };
  }

  /**
   * Normalize to E.164. Indian 10-digit numbers → +91…
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
      `Phone "${raw}" looks invalid. Use E.164 e.g. +9198XXXXXXXX`,
    );
  }

  /** Exotel India often expects 0XXXXXXXXXX on From. */
  toExotelFrom(raw: string): string {
    const e164 = this.normalizePhone(raw);
    if (e164.startsWith('+91') && e164.length === 13) {
      return `0${e164.slice(3)}`;
    }
    return e164;
  }

  getPublicBaseUrl() {
    return (
      this.config.get<string>('PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
      `http://localhost:${this.config.get('PORT') || 4000}`
    );
  }

  private getApiHost() {
    const region = (
      this.config.get<string>('EXOTEL_REGION')?.trim() || 'mumbai'
    ).toLowerCase();
    return region === 'singapore' || region === 'sg'
      ? 'api.exotel.com'
      : 'api.in.exotel.com';
  }

  private authHeader() {
    const key = this.config.get<string>('EXOTEL_API_KEY')?.trim();
    const token = this.config.get<string>('EXOTEL_API_TOKEN')?.trim();
    if (!key || !token) {
      throw new ServiceUnavailableException(
        'Exotel is not configured. Set EXOTEL_API_KEY and EXOTEL_API_TOKEN in backend/.env',
      );
    }
    return `Basic ${Buffer.from(`${key}:${token}`).toString('base64')}`;
  }

  flowUrl() {
    const sid = this.config.get<string>('EXOTEL_SID')?.trim();
    const appId = this.config.get<string>('EXOTEL_APP_ID')?.trim();
    if (!sid || !appId) {
      throw new ServiceUnavailableException(
        'EXOTEL_SID and EXOTEL_APP_ID are required',
      );
    }
    return `http://my.exotel.com/${sid}/exoml/start_voice/${appId}`;
  }

  async createOutboundCall(options: {
    to: string;
    callId: string;
  }): Promise<{ sid: string }> {
    const sid = this.config.get<string>('EXOTEL_SID')?.trim();
    const callerId = this.config.get<string>('EXOTEL_VIRTUAL_NUMBER')?.trim();
    if (!sid || !callerId) {
      throw new ServiceUnavailableException(
        'Exotel is not configured. Set EXOTEL_SID and EXOTEL_VIRTUAL_NUMBER in backend/.env',
      );
    }

    const base = this.getPublicBaseUrl();
    const from = this.toExotelFrom(options.to);
    const statusCallback = `${base}/api/calls/webhooks/exotel/status?callId=${encodeURIComponent(options.callId)}`;

    this.logger.log(
      `Starting Exotel call to ${from} for call ${options.callId}`,
    );

    const body = new URLSearchParams({
      From: from,
      CallerId: callerId,
      Url: this.flowUrl(),
      CallType: 'trans',
      StatusCallback: statusCallback,
      CustomField: options.callId,
    });

    const url = `https://${this.getApiHost()}/v1/Accounts/${encodeURIComponent(sid)}/Calls/connect.json`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
      });
      const text = await res.text();
      if (!res.ok) {
        this.logger.error(`Exotel connect failed (${res.status}): ${text}`);
        throw new BadRequestException(
          this.extractErrorMessage(text) ||
            `Exotel call failed (HTTP ${res.status})`,
        );
      }
      const callSid = this.extractCallSid(text);
      if (!callSid) {
        this.logger.error(`Exotel response missing Call Sid: ${text}`);
        throw new BadRequestException('Exotel response missing Call Sid');
      }
      return { sid: callSid };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Exotel calls.connect failed: ${msg}`);
      throw new BadRequestException(msg);
    }
  }

  private extractCallSid(payload: string): string | null {
    try {
      const json = JSON.parse(payload) as {
        Call?: { Sid?: string };
        sid?: string;
      };
      if (json?.Call?.Sid) return json.Call.Sid;
      if (json?.sid) return json.sid;
    } catch {
      // XML fallback
    }
    const m = payload.match(/<Sid>([^<]+)<\/Sid>/i);
    return m?.[1] || null;
  }

  private extractErrorMessage(payload: string): string | null {
    try {
      const json = JSON.parse(payload) as {
        RestException?: { Message?: string };
        message?: string;
        error_data?: { description?: string };
      };
      return (
        json?.RestException?.Message ||
        json?.message ||
        json?.error_data?.description ||
        null
      );
    } catch {
      const m = payload.match(/<Message>([^<]+)<\/Message>/i);
      return m?.[1] || null;
    }
  }
}
