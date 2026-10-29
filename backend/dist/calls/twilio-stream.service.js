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
var TwilioStreamService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioStreamService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const voice_service_1 = require("../voice/voice.service");
const conversation_service_1 = require("../conversation/conversation.service");
const client_1 = require("@prisma/client");
const call_scripts_1 = require("./call-scripts");
const phone_audio_1 = require("./phone-audio");
let TwilioStreamService = TwilioStreamService_1 = class TwilioStreamService {
    config;
    prisma;
    ai;
    voice;
    conversation;
    logger = new common_1.Logger(TwilioStreamService_1.name);
    uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
    fillerMulaw = null;
    fillerLoading = null;
    constructor(config, prisma, ai, voice, conversation) {
        this.config = config;
        this.prisma = prisma;
        this.ai = ai;
        this.voice = voice;
        this.conversation = conversation;
        fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    attachClient(ws, callIdHint) {
        const session = {
            streamSid: '',
            callSid: '',
            callId: callIdHint || '',
            sampleRate: 8000,
            mulawChunks: [],
            speaking: false,
            lastVoiceAt: 0,
            speechStartedAt: 0,
            silenceTimer: null,
            busy: false,
            closed: false,
            listenAfter: 0,
            agentPlaying: false,
            cancelPlay: false,
            bargeHits: 0,
            flushGen: 0,
            lastAgentText: '',
            lastUserText: '',
            turnCount: 0,
        };
        const clearSilence = () => {
            if (session.silenceTimer) {
                clearTimeout(session.silenceTimer);
                session.silenceTimer = null;
            }
        };
        const scheduleFlush = (delayMs) => {
            clearSilence();
            session.silenceTimer = setTimeout(() => {
                void this.flushTurn(ws, session);
            }, delayMs);
        };
        const bargeIn = () => {
            if (!session.agentPlaying)
                return;
            session.bargeHits += 1;
            if (session.bargeHits < 2)
                return;
            session.cancelPlay = true;
            session.agentPlaying = false;
            try {
                if (ws.readyState === ws.OPEN && session.streamSid) {
                    ws.send(JSON.stringify({ event: 'clear', streamSid: session.streamSid }));
                }
            }
            catch {
            }
        };
        ws.on('message', (raw) => {
            if (session.closed)
                return;
            let msg;
            try {
                msg = JSON.parse(String(raw));
            }
            catch {
                return;
            }
            if (msg.event === 'connected')
                return;
            if (msg.event === 'start' && msg.start) {
                session.streamSid = msg.start.streamSid || '';
                session.callSid = msg.start.callSid || '';
                const params = msg.start.customParameters || {};
                session.callId =
                    params.callId || params.CallId || callIdHint || session.callId || '';
                session.sampleRate = Number(msg.start.mediaFormat?.sampleRate) || 8000;
                this.logger.log(`Twilio stream start sid=${session.streamSid} callId=${session.callId}`);
                if (session.callId) {
                    void this.prisma.call
                        .update({
                        where: { id: session.callId },
                        data: {
                            providerCallId: session.callSid || undefined,
                            status: client_1.CallStatus.IN_PROGRESS,
                        },
                    })
                        .catch(() => undefined);
                }
                return;
            }
            if (msg.event === 'media' && msg.media?.payload) {
                const track = (msg.media.track || 'inbound').toLowerCase();
                if (track.includes('outbound'))
                    return;
                const mulaw = Buffer.from(msg.media.payload, 'base64');
                const pcm = (0, phone_audio_1.mulawToPcm16)(mulaw);
                const energy = (0, phone_audio_1.pcmEnergy)(pcm);
                const now = Date.now();
                if (session.agentPlaying && energy > 900 && now > session.listenAfter) {
                    bargeIn();
                }
                if (now < session.listenAfter && !session.agentPlaying)
                    return;
                if (energy > 450) {
                    if (!session.speaking) {
                        session.speaking = true;
                        session.speechStartedAt = now;
                    }
                    session.lastVoiceAt = now;
                    session.mulawChunks.push(mulaw);
                    scheduleFlush(420);
                    if (now - session.speechStartedAt > 6500) {
                        void this.flushTurn(ws, session);
                    }
                }
                else if (session.speaking) {
                    if (now - session.lastVoiceAt < 300) {
                        session.mulawChunks.push(mulaw);
                    }
                }
                return;
            }
            if (msg.event === 'stop') {
                session.closed = true;
                clearSilence();
            }
        });
        ws.on('close', () => {
            session.closed = true;
            clearSilence();
        });
        ws.on('error', () => {
            session.closed = true;
            clearSilence();
        });
    }
    async resolveCallIdByProvider(callSid) {
        if (!callSid)
            return null;
        const call = await this.prisma.call.findFirst({
            where: { providerCallId: callSid },
            select: { id: true },
        });
        return call?.id || null;
    }
    async flushTurn(ws, session) {
        if (session.busy || session.closed)
            return;
        session.busy = true;
        const myGen = ++session.flushGen;
        if (session.silenceTimer) {
            clearTimeout(session.silenceTimer);
            session.silenceTimer = null;
        }
        session.speaking = false;
        session.speechStartedAt = 0;
        session.bargeHits = 0;
        const mulawIn = (0, phone_audio_1.asNodeBuffer)(Buffer.concat(session.mulawChunks));
        session.mulawChunks = [];
        const aborted = () => session.closed || session.flushGen !== myGen || session.cancelPlay;
        try {
            const t0 = Date.now();
            if (mulawIn.length < 8000 * 0.45) {
                session.busy = false;
                return;
            }
            const pcm = (0, phone_audio_1.boostPcm16)((0, phone_audio_1.mulawToPcm16)(mulawIn), 2.2);
            const wavPath = path.join(this.uploadsDir, `twilio-in-${(0, crypto_1.randomUUID)()}.wav`);
            fs.writeFileSync(wavPath, (0, phone_audio_1.pcm16ToWav)(pcm, session.sampleRate || 8000));
            const callIdHint = session.callId ||
                (await this.resolveCallIdByProvider(session.callSid));
            const [stt, context] = await Promise.all([
                this.voice.speechToText({ filePath: wavPath, language: 'hi-IN' }),
                callIdHint
                    ? Promise.all([
                        this.prisma.call.findUnique({
                            where: { id: callIdHint },
                            include: { lead: { include: { project: true } } },
                        }),
                        this.ai.getSettings(),
                    ])
                    : Promise.resolve([null, null]),
            ]);
            if (aborted()) {
                session.busy = false;
                return;
            }
            const userMessage = (stt.transcript || '').trim();
            this.logger.log(`Twilio STT (${Date.now() - t0}ms): ${userMessage.slice(0, 160)}`);
            if (!userMessage || userMessage.length < 2) {
                session.busy = false;
                return;
            }
            const call = context?.[0];
            const settings = context?.[1];
            const callId = call?.id || callIdHint;
            if (!callId || !call?.lead || !settings) {
                session.busy = false;
                return;
            }
            const follow = (0, call_scripts_1.buildFollowUpReply)({
                transcript: userMessage,
                leadName: call.lead.name,
                language: call.languageDetected || 'hi-IN',
                tone: settings.tone || 'friendly',
                priorTranscript: call.transcript,
                agentVoice: settings.agentVoice || 'custom',
            });
            let replyText = follow.text;
            let languageDetected = call.languageDetected || 'hi-IN';
            void this.playFiller(ws, session);
            try {
                const result = await Promise.race([
                    this.conversation.reply({
                        lead: call.lead,
                        userMessage,
                        priorTranscript: call.transcript,
                        agentName: settings.agentName || 'Neha',
                        companyName: settings.companyName ||
                            call.lead.project?.companyName ||
                            call.lead.project?.builder ||
                            'Saya Group',
                        defaultLanguage: call.languageDetected || 'hi-IN',
                        tone: settings.tone || 'friendly',
                        systemPrompt: settings.systemPrompt || undefined,
                        llmModel: settings.llmModel ||
                            'gemini-3.8-flash',
                        approvedPlaybook: settings
                            .approvedPlaybook,
                        agentVoice: settings.agentVoice || 'custom',
                        phoneLatency: true,
                    }),
                    new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
                ]);
                if (aborted()) {
                    session.cancelPlay = false;
                    session.busy = false;
                    return;
                }
                if (result?.replyText?.trim()) {
                    replyText = result.replyText.trim();
                    languageDetected = result.languageDetected || languageDetected;
                }
            }
            catch (err) {
                this.logger.warn(`Twilio LLM failed: ${err instanceof Error ? err.message : err}`);
            }
            session.lastUserText = userMessage;
            session.lastAgentText = replyText;
            session.turnCount += 1;
            void this.prisma.call
                .update({
                where: { id: callId },
                data: {
                    transcript: [
                        call.transcript || '',
                        `Lead: ${userMessage}`,
                        `Agent: ${replyText}`,
                    ]
                        .filter(Boolean)
                        .join('\n'),
                    languageDetected,
                    status: client_1.CallStatus.IN_PROGRESS,
                },
            })
                .catch(() => undefined);
            if (session.closed || ws.readyState !== ws.OPEN || aborted()) {
                session.cancelPlay = false;
                session.busy = false;
                return;
            }
            const spoken = (0, phone_audio_1.truncateForPhone)(replyText);
            const mulawOut = await this.ttsToMulaw(spoken, settings.agentVoice || 'custom', languageDetected);
            if (!mulawOut || aborted()) {
                session.cancelPlay = false;
                session.busy = false;
                return;
            }
            session.cancelPlay = false;
            session.agentPlaying = true;
            session.listenAfter = Date.now() + 900;
            await this.streamMulawToTwilio(ws, session.streamSid, mulawOut, () => Boolean(session.cancelPlay || session.closed));
            session.agentPlaying = false;
            session.cancelPlay = false;
            session.listenAfter = Date.now() + 800;
            session.mulawChunks = [];
            session.speaking = false;
        }
        catch (err) {
            this.logger.error(`Twilio turn failed: ${err instanceof Error ? err.message : err}`);
        }
        finally {
            session.agentPlaying = false;
            session.speaking = false;
            session.busy = false;
        }
    }
    async ttsToMulaw(text, speaker, language) {
        try {
            const tts = await this.voice.textToSpeech({
                text,
                speaker,
                language,
                outputFormat: 'ulaw_8000',
                skipSave: true,
                pace: 1.0,
                modelId: 'eleven_flash_v2_5',
                optimizeStreamingLatency: 4,
            });
            return (0, phone_audio_1.asNodeBuffer)(Buffer.from(tts.audioBase64, 'base64'));
        }
        catch {
            try {
                const tts = await this.voice.textToSpeech({
                    text,
                    speaker,
                    language,
                    outputFormat: 'pcm_16000',
                    skipSave: true,
                    pace: 1.0,
                    modelId: 'eleven_flash_v2_5',
                    optimizeStreamingLatency: 4,
                });
                const pcm16k = (0, phone_audio_1.boostPcm16)((0, phone_audio_1.asNodeBuffer)(Buffer.from(tts.audioBase64, 'base64')), 1.05);
                return (0, phone_audio_1.pcm16ToMulaw)((0, phone_audio_1.downsamplePcm16)(pcm16k, 16000, 8000));
            }
            catch (err) {
                this.logger.warn(`Twilio TTS failed: ${err instanceof Error ? err.message : err}`);
                return null;
            }
        }
    }
    async getFillerMulaw() {
        if (this.fillerMulaw)
            return this.fillerMulaw;
        if (this.fillerLoading)
            return this.fillerLoading;
        this.fillerLoading = (async () => {
            this.fillerMulaw = await this.ttsToMulaw('जी।', 'custom', 'hi-IN');
            return this.fillerMulaw;
        })();
        return this.fillerLoading;
    }
    async playFiller(ws, session) {
        try {
            const filler = await this.getFillerMulaw();
            if (!filler || session.closed || !session.streamSid)
                return;
            if (ws.readyState !== ws.OPEN)
                return;
            await this.streamMulawToTwilio(ws, session.streamSid, filler, () => Boolean(session.closed));
        }
        catch {
        }
    }
    async streamMulawToTwilio(ws, streamSid, mulaw, shouldCancel) {
        const frameSize = 160;
        const data = (0, phone_audio_1.asNodeBuffer)(mulaw);
        for (let i = 0; i < data.length; i += frameSize) {
            if (shouldCancel?.())
                return;
            if (ws.readyState !== ws.OPEN)
                return;
            const chunk = data.subarray(i, Math.min(i + frameSize, data.length));
            ws.send(JSON.stringify({
                event: 'media',
                streamSid,
                media: { payload: chunk.toString('base64') },
            }));
            await new Promise((r) => setTimeout(r, 18));
        }
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                event: 'mark',
                streamSid,
                mark: { name: `agent-${Date.now()}` },
            }));
        }
    }
};
exports.TwilioStreamService = TwilioStreamService;
exports.TwilioStreamService = TwilioStreamService = TwilioStreamService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        ai_service_1.AiService,
        voice_service_1.VoiceService,
        conversation_service_1.ConversationService])
], TwilioStreamService);
//# sourceMappingURL=twilio-stream.service.js.map