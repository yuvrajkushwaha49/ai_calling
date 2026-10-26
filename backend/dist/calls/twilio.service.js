"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TwilioService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let TwilioService = TwilioService_1 = class TwilioService {
    config;
    logger = new common_1.Logger(TwilioService_1.name);
    constructor(config) {
        this.config = config;
    }
    isConfigured() {
        return Boolean(this.config.get('TWILIO_ACCOUNT_SID')?.trim() &&
            this.config.get('TWILIO_AUTH_TOKEN')?.trim() &&
            this.config.get('TWILIO_FROM_NUMBER')?.trim());
    }
    getPublicBaseUrl() {
        return (this.config.get('PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
            `http://localhost:${this.config.get('PORT') || 4000}`);
    }
    getStatus() {
        const configured = this.isConfigured();
        const publicBaseUrl = this.getPublicBaseUrl();
        const from = this.config.get('TWILIO_FROM_NUMBER')?.trim() || null;
        const local = /localhost|127\.0\.0\.1/i.test(publicBaseUrl) ||
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
    normalizePhone(raw) {
        const digits = String(raw || '').replace(/[^\d+]/g, '');
        if (!digits) {
            throw new common_1.BadRequestException('Lead phone number is missing');
        }
        if (digits.startsWith('+') && digits.length >= 11)
            return digits;
        const only = digits.replace(/\D/g, '');
        if (only.length === 10)
            return `+91${only}`;
        if (only.length === 12 && only.startsWith('91'))
            return `+${only}`;
        if (only.length === 11 && only.startsWith('0'))
            return `+91${only.slice(1)}`;
        if (only.length >= 11)
            return `+${only}`;
        throw new common_1.BadRequestException(`Phone "${raw}" looks invalid. Use E.164 e.g. +9198XXXXXXXX`);
    }
    authHeader() {
        const sid = this.config.get('TWILIO_ACCOUNT_SID')?.trim();
        const token = this.config.get('TWILIO_AUTH_TOKEN')?.trim();
        if (!sid || !token) {
            throw new common_1.ServiceUnavailableException('Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
        }
        return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
    }
    buildVoiceTwiml(options) {
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
    async createOutboundCall(options) {
        const accountSid = this.config.get('TWILIO_ACCOUNT_SID')?.trim();
        const from = this.config.get('TWILIO_FROM_NUMBER')?.trim();
        if (!accountSid || !from) {
            throw new common_1.ServiceUnavailableException('Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_FROM_NUMBER.');
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
                throw new common_1.BadRequestException(this.extractError(text) || `Twilio call failed (HTTP ${res.status})`);
            }
            const json = JSON.parse(text);
            if (!json.sid) {
                throw new common_1.BadRequestException('Twilio response missing Call SID');
            }
            return { sid: json.sid };
        }
        catch (err) {
            if (err instanceof common_1.BadRequestException)
                throw err;
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Twilio Calls.create failed: ${msg}`);
            throw new common_1.BadRequestException(msg);
        }
    }
    extractError(payload) {
        try {
            const json = JSON.parse(payload);
            return json.message || json.error_message || null;
        }
        catch {
            return null;
        }
    }
};
exports.TwilioService = TwilioService;
exports.TwilioService = TwilioService = TwilioService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TwilioService);
function escapeXml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
//# sourceMappingURL=twilio.service.js.map