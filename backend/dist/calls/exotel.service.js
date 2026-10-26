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
var ExotelService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExotelService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ExotelService = ExotelService_1 = class ExotelService {
    config;
    logger = new common_1.Logger(ExotelService_1.name);
    constructor(config) {
        this.config = config;
    }
    isConfigured() {
        return Boolean(this.config.get('EXOTEL_SID')?.trim() &&
            this.config.get('EXOTEL_API_KEY')?.trim() &&
            this.config.get('EXOTEL_API_TOKEN')?.trim() &&
            this.config.get('EXOTEL_VIRTUAL_NUMBER')?.trim() &&
            this.config.get('EXOTEL_APP_ID')?.trim());
    }
    getStatus() {
        const configured = this.isConfigured();
        const publicBaseUrl = this.getPublicBaseUrl();
        const from = this.config.get('EXOTEL_VIRTUAL_NUMBER')?.trim() || null;
        const appId = this.config.get('EXOTEL_APP_ID')?.trim() || null;
        const local = /localhost|127\.0\.0\.1/i.test(publicBaseUrl) ||
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
    toExotelFrom(raw) {
        const e164 = this.normalizePhone(raw);
        if (e164.startsWith('+91') && e164.length === 13) {
            return `0${e164.slice(3)}`;
        }
        return e164;
    }
    getPublicBaseUrl() {
        return (this.config.get('PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
            `http://localhost:${this.config.get('PORT') || 4000}`);
    }
    getApiHost() {
        const region = (this.config.get('EXOTEL_REGION')?.trim() || 'mumbai').toLowerCase();
        return region === 'singapore' || region === 'sg'
            ? 'api.exotel.com'
            : 'api.in.exotel.com';
    }
    authHeader() {
        const key = this.config.get('EXOTEL_API_KEY')?.trim();
        const token = this.config.get('EXOTEL_API_TOKEN')?.trim();
        if (!key || !token) {
            throw new common_1.ServiceUnavailableException('Exotel is not configured. Set EXOTEL_API_KEY and EXOTEL_API_TOKEN in backend/.env');
        }
        return `Basic ${Buffer.from(`${key}:${token}`).toString('base64')}`;
    }
    flowUrl() {
        const sid = this.config.get('EXOTEL_SID')?.trim();
        const appId = this.config.get('EXOTEL_APP_ID')?.trim();
        if (!sid || !appId) {
            throw new common_1.ServiceUnavailableException('EXOTEL_SID and EXOTEL_APP_ID are required');
        }
        return `http://my.exotel.com/${sid}/exoml/start_voice/${appId}`;
    }
    async createOutboundCall(options) {
        const sid = this.config.get('EXOTEL_SID')?.trim();
        const callerId = this.config.get('EXOTEL_VIRTUAL_NUMBER')?.trim();
        if (!sid || !callerId) {
            throw new common_1.ServiceUnavailableException('Exotel is not configured. Set EXOTEL_SID and EXOTEL_VIRTUAL_NUMBER in backend/.env');
        }
        const base = this.getPublicBaseUrl();
        const from = this.toExotelFrom(options.to);
        const statusCallback = `${base}/api/calls/webhooks/exotel/status?callId=${encodeURIComponent(options.callId)}`;
        this.logger.log(`Starting Exotel call to ${from} for call ${options.callId}`);
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
                throw new common_1.BadRequestException(this.extractErrorMessage(text) ||
                    `Exotel call failed (HTTP ${res.status})`);
            }
            const callSid = this.extractCallSid(text);
            if (!callSid) {
                this.logger.error(`Exotel response missing Call Sid: ${text}`);
                throw new common_1.BadRequestException('Exotel response missing Call Sid');
            }
            return { sid: callSid };
        }
        catch (err) {
            if (err instanceof common_1.BadRequestException)
                throw err;
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Exotel calls.connect failed: ${msg}`);
            throw new common_1.BadRequestException(msg);
        }
    }
    extractCallSid(payload) {
        try {
            const json = JSON.parse(payload);
            if (json?.Call?.Sid)
                return json.Call.Sid;
            if (json?.sid)
                return json.sid;
        }
        catch {
        }
        const m = payload.match(/<Sid>([^<]+)<\/Sid>/i);
        return m?.[1] || null;
    }
    extractErrorMessage(payload) {
        try {
            const json = JSON.parse(payload);
            return (json?.RestException?.Message ||
                json?.message ||
                json?.error_data?.description ||
                null);
        }
        catch {
            const m = payload.match(/<Message>([^<]+)<\/Message>/i);
            return m?.[1] || null;
        }
    }
};
exports.ExotelService = ExotelService;
exports.ExotelService = ExotelService = ExotelService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ExotelService);
//# sourceMappingURL=exotel.service.js.map