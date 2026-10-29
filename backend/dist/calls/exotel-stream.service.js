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
var ExotelStreamService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExotelStreamService = void 0;
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
let ExotelStreamService = ExotelStreamService_1 = class ExotelStreamService {
    config;
    prisma;
    ai;
    voice;
    conversation;
    logger = new common_1.Logger(ExotelStreamService_1.name);
    uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
    fillerPcm = null;
    fillerLoading = null;
    constructor(config, prisma, ai, voice, conversation) {
        this.config = config;
        this.prisma = prisma;
        this.ai = ai;
        this.voice = voice;
        this.conversation = conversation;
        fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    getPublicBaseUrl() {
        return (this.config.get('PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
            `http://localhost:${this.config.get('PORT') || 4000}`);
    }
    resolveVoicebotWsUrl(query) {
        const base = this.getPublicBaseUrl().replace(/^http/i, 'ws');
        const callId = query.callId || query.CustomField || query.customField || '';
        const sampleRate = query['sample-rate'] || '16000';
        const qs = new URLSearchParams({
            'sample-rate': sampleRate,
        });
        if (callId)
            qs.set('callId', callId);
        return {
            url: `${base}/api/calls/exotel-media?${qs.toString()}`,
        };
    }
    attachClient(ws, callIdHint) {
        const session = {
            streamSid: '',
            callSid: '',
            callId: callIdHint || '',
            sampleRate: 16000,
            pcmChunks: [],
            speaking: false,
            lastVoiceAt: 0,
            speechStartedAt: 0,
            silenceTimer: null,
            busy: false,
            closed: false,
            mediaCount: 0,
            maxEnergy: 0,
            listenAfter: 0,
            agentPlaying: false,
            agentPlayStartedAt: 0,
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
            if (!session.agentPlaying && !session.busy)
                return;
            this.logger.log('Exotel Voicebot barge-in — user interrupting');
            session.cancelPlay = true;
            session.flushGen += 1;
            session.agentPlaying = false;
            session.busy = false;
            if (session.streamSid && ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    event: 'clear',
                    stream_sid: session.streamSid,
                }));
            }
            session.speaking = true;
            session.speechStartedAt = session.speechStartedAt || Date.now();
            session.lastVoiceAt = Date.now();
            session.listenAfter = 0;
            scheduleFlush(650);
        };
        ws.on('message', async (raw) => {
            if (session.closed)
                return;
            let msg;
            try {
                const text = typeof raw === 'string'
                    ? raw
                    : Buffer.isBuffer(raw)
                        ? raw.toString('utf8')
                        : Buffer.from(raw).toString('utf8');
                msg = JSON.parse(text);
            }
            catch {
                return;
            }
            const event = (msg.event || '').toLowerCase();
            if (event === 'connected') {
                this.logger.log('Exotel Voicebot connected');
                return;
            }
            if (event === 'start') {
                session.streamSid =
                    msg.start?.stream_sid ||
                        msg.start?.streamSid ||
                        msg.stream_sid ||
                        '';
                session.callSid = msg.start?.call_sid || msg.start?.callSid || '';
                const customRaw = msg.start?.custom_parameters || msg.start?.customParameters || {};
                const custom = typeof customRaw === 'string'
                    ? Object.fromEntries(new URLSearchParams(customRaw))
                    : { ...customRaw };
                session.callId =
                    custom.callId ||
                        custom.CustomField ||
                        custom.customField ||
                        callIdHint ||
                        session.callId;
                const rateRaw = msg.start?.media_format?.sample_rate ??
                    msg.start?.mediaFormat?.sampleRate ??
                    16000;
                session.sampleRate = Number(rateRaw) || 16000;
                session.listenAfter = Date.now() + 400;
                this.logger.log(`Exotel Voicebot start stream=${session.streamSid} callSid=${session.callSid} callId=${session.callId || '-'} rate=${session.sampleRate}`);
                if (!session.callId && session.callSid) {
                    void this.resolveCallIdByProvider(session.callSid).then((id) => {
                        if (id)
                            session.callId = id;
                    });
                }
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
            if (event === 'media' && msg.media?.payload) {
                const chunk = Buffer.from(msg.media.payload, 'base64');
                if (!chunk.length)
                    return;
                session.mediaCount += 1;
                const energy = pcmEnergy(chunk);
                if (energy > session.maxEnergy)
                    session.maxEnergy = energy;
                if (session.mediaCount === 1 || session.mediaCount % 50 === 0) {
                    this.logger.log(`Exotel media #${session.mediaCount} bytes=${chunk.length} energy=${Math.round(energy)} max=${Math.round(session.maxEnergy)} busy=${session.busy} playing=${session.agentPlaying}`);
                }
                if (Date.now() < session.listenAfter) {
                    return;
                }
                if (session.agentPlaying) {
                    const playedFor = Date.now() - (session.agentPlayStartedAt || 0);
                    if (playedFor < 900) {
                        return;
                    }
                    if (energy > 650) {
                        session.bargeHits += 1;
                        session.pcmChunks.push(chunk);
                        if (session.bargeHits >= 6) {
                            bargeIn();
                        }
                    }
                    else {
                        session.bargeHits = Math.max(0, session.bargeHits - 2);
                    }
                    return;
                }
                if (session.busy) {
                    if (energy > 650) {
                        session.bargeHits += 1;
                        session.pcmChunks.push(chunk);
                        if (session.bargeHits >= 6) {
                            bargeIn();
                        }
                    }
                    return;
                }
                session.pcmChunks.push(chunk);
                const totalBytes = session.pcmChunks.reduce((n, b) => n + b.length, 0);
                const durationSec = totalBytes / (session.sampleRate * 2);
                if (energy > 280) {
                    if (!session.speaking) {
                        session.speechStartedAt = Date.now();
                    }
                    session.speaking = true;
                    session.lastVoiceAt = Date.now();
                    scheduleFlush(450);
                }
                if (session.speaking &&
                    session.speechStartedAt &&
                    Date.now() - session.speechStartedAt > 6000) {
                    void this.flushTurn(ws, session);
                }
                else if (session.speaking && durationSec >= 7) {
                    void this.flushTurn(ws, session);
                }
                return;
            }
            if (event === 'mark') {
                if (session.agentPlaying) {
                    session.agentPlaying = false;
                    session.cancelPlay = false;
                    session.busy = false;
                    session.listenAfter = Date.now() + 900;
                    session.pcmChunks = [];
                    session.speaking = false;
                    session.bargeHits = 0;
                    clearSilence();
                }
                return;
            }
            if (event === 'stop' || event === 'closed') {
                clearSilence();
                this.logger.log(`Exotel Voicebot stop media=${session.mediaCount} maxEnergy=${Math.round(session.maxEnergy)}`);
                session.closed = true;
            }
        });
        ws.on('close', () => {
            clearSilence();
            session.closed = true;
            this.logger.log(`Exotel Voicebot WS closed media=${session.mediaCount} maxEnergy=${Math.round(session.maxEnergy)}`);
        });
        ws.on('error', (err) => {
            this.logger.warn(`Exotel Voicebot WS error: ${err instanceof Error ? err.message : err}`);
        });
    }
    async flushTurn(ws, session) {
        if (session.closed || session.busy || !session.speaking)
            return;
        if (!session.pcmChunks.length)
            return;
        const myGen = session.flushGen;
        session.busy = true;
        session.speaking = false;
        session.speechStartedAt = 0;
        session.bargeHits = 0;
        if (session.silenceTimer) {
            clearTimeout(session.silenceTimer);
            session.silenceTimer = null;
        }
        let pcm = asNodeBuffer(Buffer.concat(session.pcmChunks));
        session.pcmChunks = [];
        const aborted = () => session.closed || session.flushGen !== myGen || session.cancelPlay;
        try {
            const t0 = Date.now();
            if (pcm.length < session.sampleRate * 2 * 0.45) {
                session.busy = false;
                return;
            }
            pcm = boostPcm16(pcm, 2.2);
            const wavPath = path.join(this.uploadsDir, `exotel-in-${(0, crypto_1.randomUUID)()}.wav`);
            fs.writeFileSync(wavPath, pcm16ToWav(pcm, session.sampleRate));
            const callIdHint = session.callId ||
                (await this.resolveCallIdByProvider(session.callSid));
            const sttPromise = this.voice.speechToText({
                filePath: wavPath,
                language: 'hi-IN',
            });
            const contextPromise = callIdHint
                ? Promise.all([
                    this.prisma.call.findUnique({
                        where: { id: callIdHint },
                        include: {
                            lead: {
                                include: {
                                    project: true,
                                },
                            },
                        },
                    }),
                    this.ai.getSettings(),
                ])
                : Promise.resolve([null, null]);
            const [stt, context] = await Promise.all([sttPromise, contextPromise]);
            if (aborted()) {
                session.busy = false;
                return;
            }
            const userMessage = (stt.transcript || '').trim();
            this.logger.log(`Exotel Voicebot STT (${Date.now() - t0}ms): ${userMessage.slice(0, 160)}`);
            if (!userMessage || userMessage.length < 2) {
                session.busy = false;
                return;
            }
            if (isWeakAck(userMessage) && session.turnCount > 0) {
                this.logger.log(`Ignoring weak/echo STT: ${userMessage}`);
                session.busy = false;
                return;
            }
            if (session.lastUserText &&
                normalizeTalk(session.lastUserText) === normalizeTalk(userMessage)) {
                this.logger.log(`Ignoring duplicate user STT: ${userMessage}`);
                session.busy = false;
                return;
            }
            const call = context?.[0];
            const settings = context?.[1];
            const callId = call?.id || callIdHint;
            if (!callId || !call?.lead || !settings) {
                this.logger.warn('Voicebot turn without callId/lead');
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
            void this.playFiller(ws, session.streamSid, session.sampleRate);
            try {
                const llmPromise = this.conversation.reply({
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
                        'gemini-flash-latest',
                    approvedPlaybook: settings
                        .approvedPlaybook,
                    agentVoice: settings.agentVoice || 'custom',
                    phoneLatency: true,
                });
                const result = await Promise.race([
                    llmPromise,
                    new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
                ]);
                if (aborted()) {
                    session.cancelPlay = false;
                    session.busy = false;
                    return;
                }
                if (result && result.replyText?.trim()) {
                    replyText = result.replyText.trim();
                    languageDetected = result.languageDetected || languageDetected;
                }
                else if (!result) {
                    this.logger.warn('LLM slow — using sample-flow script fallback');
                }
                if (result?.resolvedProjectId && !call.lead.projectId) {
                    void this.prisma.lead
                        .update({
                        where: { id: call.leadId },
                        data: { projectId: result.resolvedProjectId },
                    })
                        .catch(() => undefined);
                    void this.prisma.call
                        .update({
                        where: { id: callId },
                        data: { projectId: result.resolvedProjectId },
                    })
                        .catch(() => undefined);
                }
            }
            catch (err) {
                this.logger.warn(`LLM reply failed, using script: ${err instanceof Error ? err.message : err}`);
            }
            if (session.lastAgentText &&
                normalizeTalk(session.lastAgentText) === normalizeTalk(replyText)) {
                replyText =
                    session.turnCount % 2 === 0
                        ? `Accha — configuration कौनसी सोच रहे हो, दो bedroom या तीन?`
                        : `Possession कब चाहिए — तुरंत move-in या थोड़ा wait construction में?`;
            }
            session.lastUserText = userMessage;
            session.lastAgentText = replyText;
            session.turnCount += 1;
            this.logger.log(`Exotel Voicebot reply (${Date.now() - t0}ms): ${replyText.slice(0, 100)}`);
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
            if (session.closed || ws.readyState !== ws.OPEN) {
                this.logger.warn('Skipping ElevenLabs reply — Voicebot socket already closed');
                return;
            }
            if (aborted()) {
                session.cancelPlay = false;
                session.busy = false;
                return;
            }
            const spoken = truncateForPhone(replyText);
            const tts = await this.voice.textToSpeech({
                text: spoken,
                speaker: settings.agentVoice || 'custom',
                language: languageDetected,
                outputFormat: 'pcm_16000',
                skipSave: true,
                pace: 1.0,
                modelId: 'eleven_flash_v2_5',
                optimizeStreamingLatency: 4,
            });
            if (aborted()) {
                session.cancelPlay = false;
                session.busy = false;
                return;
            }
            const pcmOut = boostPcm16(asNodeBuffer(Buffer.from(tts.audioBase64, 'base64')), 1.05);
            this.logger.log(`Exotel Voicebot playing (${Date.now() - t0}ms, ${pcmOut.length} bytes): ${spoken.slice(0, 80)}`);
            session.cancelPlay = false;
            session.agentPlaying = true;
            session.agentPlayStartedAt = Date.now();
            session.bargeHits = 0;
            session.listenAfter = Date.now() + 900;
            await this.streamPcmToExotel(ws, session.streamSid, pcmOut, session.sampleRate, false, () => session.cancelPlay || session.closed);
            session.agentPlaying = false;
            if (session.cancelPlay) {
                this.logger.log('TTS stopped early (barge-in)');
                session.cancelPlay = false;
                session.busy = false;
                return;
            }
            session.listenAfter = Date.now() + 900;
            session.pcmChunks = [];
            session.speaking = false;
        }
        catch (err) {
            this.logger.error(`Voicebot turn failed: ${err instanceof Error ? err.message : err}`);
        }
        finally {
            session.agentPlaying = false;
            session.speaking = false;
            session.speechStartedAt = 0;
            session.busy = false;
        }
    }
    async getFillerPcm() {
        if (this.fillerPcm)
            return this.fillerPcm;
        if (this.fillerLoading)
            return this.fillerLoading;
        this.fillerLoading = (async () => {
            try {
                const tts = await this.voice.textToSpeech({
                    text: 'जी।',
                    language: 'hi-IN',
                    outputFormat: 'pcm_16000',
                    skipSave: true,
                    pace: 1.0,
                    modelId: 'eleven_flash_v2_5',
                    optimizeStreamingLatency: 4,
                });
                this.fillerPcm = boostPcm16(asNodeBuffer(Buffer.from(tts.audioBase64, 'base64')), 1.05);
                return this.fillerPcm;
            }
            catch (err) {
                this.logger.warn(`Filler TTS failed: ${err instanceof Error ? err.message : err}`);
                return null;
            }
            finally {
                this.fillerLoading = null;
            }
        })();
        return this.fillerLoading;
    }
    async playFiller(ws, streamSid, sampleRate) {
        if (!streamSid || ws.readyState !== ws.OPEN)
            return;
        const pcm = await this.getFillerPcm();
        if (!pcm || ws.readyState !== ws.OPEN)
            return;
        await this.streamPcmToExotel(ws, streamSid, pcm, sampleRate, true);
    }
    async resolveCallIdByProvider(callSid) {
        if (!callSid)
            return null;
        const call = await this.prisma.call.findFirst({
            where: { providerCallId: callSid },
            orderBy: { createdAt: 'desc' },
        });
        return call?.id || null;
    }
    async streamPcmToExotel(ws, streamSid, pcm, sampleRate, skipClear = false, shouldCancel) {
        if (!streamSid || ws.readyState !== ws.OPEN)
            return;
        if (!skipClear) {
            ws.send(JSON.stringify({
                event: 'clear',
                stream_sid: streamSid,
            }));
        }
        const frameSize = sampleRate >= 16000 ? 3200 : 1600;
        const paceMs = 55;
        const pcmBuf = asNodeBuffer(pcm);
        for (let i = 0; i < pcmBuf.length; i += frameSize) {
            if (ws.readyState !== ws.OPEN)
                break;
            if (shouldCancel?.())
                break;
            const slice = asNodeBuffer(pcmBuf.subarray(i, Math.min(i + frameSize, pcmBuf.length)));
            const frame = slice.length === frameSize
                ? slice
                : asNodeBuffer(Buffer.concat([
                    slice,
                    Buffer.alloc(frameSize - slice.length),
                ]));
            ws.send(JSON.stringify({
                event: 'media',
                stream_sid: streamSid,
                media: {
                    payload: frame.toString('base64'),
                },
            }));
            await delay(paceMs);
        }
        if (ws.readyState === ws.OPEN && !shouldCancel?.()) {
            ws.send(JSON.stringify({
                event: 'mark',
                stream_sid: streamSid,
                mark: { name: `tts-${Date.now()}` },
            }));
        }
    }
};
exports.ExotelStreamService = ExotelStreamService;
exports.ExotelStreamService = ExotelStreamService = ExotelStreamService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        ai_service_1.AiService,
        voice_service_1.VoiceService,
        conversation_service_1.ConversationService])
], ExotelStreamService);
function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function normalizeTalk(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function isWeakAck(text) {
    const compact = String(text || '')
        .toLowerCase()
        .replace(/[।.!?,،\s'"]/g, '')
        .replace(/[\u0900-\u0903\u093A-\u094D]/g, '');
    const letters = compact.replace(/[^\p{L}\p{N}]/gu, '');
    if (!letters)
        return true;
    if (letters.length <= 3)
        return true;
    const weak = new Set([
        'ha',
        'haan',
        'han',
        'ji',
        'jee',
        'yes',
        'ok',
        'okay',
        'hmm',
        'aha',
        'हा',
        'हां',
        'हाँ',
        'जी',
        'हाजी',
        'हाँजी',
        'हांजी',
        'ठीक',
        'ठीकहै',
        'ओके',
        'आहा',
        'हम्म',
    ]);
    if (weak.has(letters) || weak.has(compact))
        return true;
    return /^(ha|han|haan|ji|yes|ok|hello|hi|हा|हां|हाँ|जी)+$/i.test(letters);
}
function pcmEnergy(buf) {
    let sum = 0;
    const n = Math.floor(buf.length / 2);
    if (!n)
        return 0;
    for (let i = 0; i + 1 < buf.length; i += 2) {
        sum += Math.abs(buf.readInt16LE(i));
    }
    return sum / n;
}
function asNodeBuffer(data) {
    if (Buffer.isBuffer(data))
        return data;
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
function boostPcm16(pcm, gain) {
    const src = asNodeBuffer(pcm);
    const out = Buffer.alloc(src.length);
    for (let i = 0; i + 1 < src.length; i += 2) {
        const sample = Math.round(src.readInt16LE(i) * gain);
        const clipped = Math.max(-32768, Math.min(32767, sample));
        out.writeInt16LE(clipped, i);
    }
    return out;
}
function truncateForPhone(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= 85)
        return clean;
    const cut = clean.slice(0, 85);
    const lastStop = Math.max(cut.lastIndexOf('।'), cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    return (lastStop > 30 ? cut.slice(0, lastStop + 1) : cut).trim();
}
function pcm16ToWav(pcm, sampleRate) {
    const body = asNodeBuffer(pcm);
    const header = Buffer.alloc(44);
    const dataSize = body.length;
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    return asNodeBuffer(Buffer.concat([header, body]));
}
//# sourceMappingURL=exotel-stream.service.js.map