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
var McubeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.McubeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let McubeService = McubeService_1 = class McubeService {
    config;
    logger = new common_1.Logger(McubeService_1.name);
    constructor(config) {
        this.config = config;
    }
    isConfigured() {
        return Boolean(this.config.get('MCUBE_API_KEY')?.trim() ||
            this.config.get('MCUBE_OUTBOUND_URL')?.trim());
    }
    getPublicBaseUrl() {
        return (this.config.get('PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
            `http://localhost:${this.config.get('PORT') || 4000}`);
    }
    getStatus() {
        const configured = this.isConfigured();
        const publicBaseUrl = this.getPublicBaseUrl();
        const wsBase = publicBaseUrl.replace(/^http/i, 'ws');
        const local = /localhost|127\.0\.0\.1/i.test(publicBaseUrl) ||
            publicBaseUrl.startsWith('http://192.') ||
            publicBaseUrl.startsWith('http://10.');
        return {
            configured,
            publicBaseUrl,
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
        throw new common_1.BadRequestException(`Phone "${raw}" looks invalid. Use E.164 format, e.g. +9198XXXXXXXX`);
    }
    async createOutboundCall(options) {
        const outboundUrl = this.config.get('MCUBE_OUTBOUND_URL')?.trim();
        const apiKey = this.config.get('MCUBE_API_KEY')?.trim();
        if (!outboundUrl) {
            this.logger.warn(`MCUBE_OUTBOUND_URL is not set. Call ${options.callId} registered, waiting for incoming MCube stream.`);
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
                throw new common_1.BadRequestException(`MCube call trigger failed: ${text}`);
            }
            return { status: 'initiated', callId: options.callId };
        }
        catch (err) {
            if (err instanceof common_1.BadRequestException)
                throw err;
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`MCube createOutboundCall error: ${msg}`);
            throw new common_1.BadRequestException(msg);
        }
    }
};
exports.McubeService = McubeService;
exports.McubeService = McubeService = McubeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], McubeService);
//# sourceMappingURL=mcube.service.js.map