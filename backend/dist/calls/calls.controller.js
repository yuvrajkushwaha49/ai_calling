"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallsController = void 0;
const common_1 = require("@nestjs/common");
const calls_service_1 = require("./calls.service");
const call_dto_1 = require("./dto/call.dto");
const auth_decorators_1 = require("../common/decorators/auth.decorators");
const voice_service_1 = require("../voice/voice.service");
const exotel_service_1 = require("./exotel.service");
const exotel_stream_service_1 = require("./exotel-stream.service");
const twilio_service_1 = require("./twilio.service");
const mcube_service_1 = require("./mcube.service");
const fs = __importStar(require("fs"));
let CallsController = class CallsController {
    callsService;
    voice;
    exotel;
    exotelStream;
    twilio;
    mcube;
    constructor(callsService, voice, exotel, exotelStream, twilio, mcube) {
        this.callsService = callsService;
        this.voice = voice;
        this.exotel = exotel;
        this.exotelStream = exotelStream;
        this.twilio = twilio;
        this.mcube = mcube;
    }
    findAll() {
        return this.callsService.findAll();
    }
    getTwilioConfigStatus() {
        return this.twilio.getStatus();
    }
    getExotelConfigStatus() {
        return this.exotel.getStatus();
    }
    getMcubeConfigStatus() {
        return this.mcube.getStatus();
    }
    startOutbound(body) {
        return this.callsService.startOutboundCall(body.leadId, {
            browserDemo: body.browserDemo,
            provider: body.provider,
        });
    }
    demoTurn(body) {
        return this.callsService.demoTurn(body);
    }
    async demoTurnStream(body, res) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        if (typeof res.flushHeaders === 'function') {
            res.flushHeaders();
        }
        const write = (event) => {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
            const flushable = res;
            if (typeof flushable.flush === 'function')
                flushable.flush();
        };
        try {
            await this.callsService.demoTurn(body, write);
        }
        catch (err) {
            write({
                type: 'error',
                message: err instanceof Error ? err.message : 'Stream failed',
            });
        }
        finally {
            res.end();
        }
    }
    endDemo(id) {
        return this.callsService.endDemo(id);
    }
    streamAudio(fileName, res) {
        const filePath = this.voice.getAudioAbsolutePath(fileName);
        const lower = fileName.toLowerCase();
        const type = lower.endsWith('.mp3')
            ? 'audio/mpeg'
            : lower.endsWith('.wav')
                ? 'audio/wav'
                : lower.endsWith('.ogg')
                    ? 'audio/ogg'
                    : 'application/octet-stream';
        res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', 'no-cache');
        res.send(fs.readFileSync(filePath));
    }
    async exotelGreeting(callId, req, res) {
        res.setHeader('Content-Type', 'text/plain');
        if (req.method === 'HEAD') {
            res.status(200).end();
            return;
        }
        const body = (req.body || {});
        const query = (req.query || {});
        const id = callId ||
            body.CustomField ||
            query.CustomField ||
            body.customField ||
            query.customField ||
            '';
        const payload = await this.callsService.getExotelGreetingPayload(id, {
            ...query,
            ...body,
        });
        const value = String(payload.value || '').trim();
        res.status(200).send(value);
    }
    exotelVoicebotResolve(req, res) {
        const query = (req.query || {});
        const body = (req.body || {});
        const payload = this.exotelStream.resolveVoicebotWsUrl({
            ...query,
            ...body,
        });
        res.status(200).json(payload);
    }
    async exotelPassthru(req) {
        const body = (req.body || {});
        const query = (req.query || {});
        return this.callsService.handleExotelPassthru({ ...query, ...body });
    }
    async exotelStatusWebhook(callId, req) {
        const body = (req.body || {});
        const query = (req.query || {});
        const merged = { ...query, ...body };
        const id = callId ||
            merged.CustomField ||
            merged.customField ||
            '';
        return this.callsService.handleExotelStatusWebhook(id, merged);
    }
    async twilioVoice(callId, req, res) {
        const body = (req.body || {});
        const query = (req.query || {});
        const id = callId || body.callId || query.callId || '';
        const twiml = await this.callsService.getTwilioVoiceTwiml(id, {
            ...query,
            ...body,
        });
        res.status(200);
        res.setHeader('Content-Type', 'text/xml');
        res.send(twiml);
    }
    async twilioStatusWebhook(callId, req) {
        const body = (req.body || {});
        const query = (req.query || {});
        const merged = { ...query, ...body };
        const id = callId || merged.callId || '';
        return this.callsService.handleTwilioStatusWebhook(id, merged);
    }
    findOne(id) {
        return this.callsService.findOne(id);
    }
    create(dto) {
        return this.callsService.create(dto);
    }
    update(id, dto) {
        return this.callsService.update(id, dto);
    }
    remove(id) {
        return this.callsService.remove(id);
    }
};
exports.CallsController = CallsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "findAll", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.Get)('twilio-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "getTwilioConfigStatus", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.Get)('exotel-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "getExotelConfigStatus", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.Get)('mcube-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "getMcubeConfigStatus", null);
__decorate([
    (0, common_1.Post)('outbound'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "startOutbound", null);
__decorate([
    (0, common_1.Post)('demo-turn'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "demoTurn", null);
__decorate([
    (0, common_1.Post)('demo-turn-stream'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "demoTurnStream", null);
__decorate([
    (0, common_1.Post)(':id/end'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "endDemo", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.Get)('audio/:fileName'),
    __param(0, (0, common_1.Param)('fileName')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "streamAudio", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.All)('webhooks/exotel/greeting'),
    __param(0, (0, common_1.Query)('callId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "exotelGreeting", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.All)('webhooks/exotel/voicebot'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "exotelVoicebotResolve", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.All)('webhooks/exotel/passthru'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "exotelPassthru", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.All)('webhooks/exotel/status'),
    __param(0, (0, common_1.Query)('callId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "exotelStatusWebhook", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.All)('webhooks/twilio/voice'),
    __param(0, (0, common_1.Query)('callId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "twilioVoice", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.All)('webhooks/twilio/status'),
    __param(0, (0, common_1.Query)('callId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "twilioStatusWebhook", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [call_dto_1.CreateCallDto]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, call_dto_1.UpdateCallDto]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "remove", null);
exports.CallsController = CallsController = __decorate([
    (0, common_1.Controller)('calls'),
    __metadata("design:paramtypes", [calls_service_1.CallsService,
        voice_service_1.VoiceService,
        exotel_service_1.ExotelService,
        exotel_stream_service_1.ExotelStreamService,
        twilio_service_1.TwilioService,
        mcube_service_1.McubeService])
], CallsController);
//# sourceMappingURL=calls.controller.js.map