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
var McubeStreamService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.McubeStreamService = void 0;
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
let McubeStreamService = McubeStreamService_1 = class McubeStreamService {
    config;
    prisma;
    ai;
    voice;
    conversation;
    logger = new common_1.Logger(McubeStreamService_1.name);
    uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
    constructor(config, prisma, ai, voice, conversation) {
        this.config = config;
        this.prisma = prisma;
        this.ai = ai;
        this.voice = voice;
        this.conversation = conversation;
        fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    attachClient(ws, callIdHint, queryParams) {
        const session = {
            streamId: '',
            callId: callIdHint || '',
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            rawChunks: [],
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
            lastAgentText: 'Hello?',
            lastUserText: '',
            turnCount: 0,
            transcript: 'Agent: Hello?\n',
            pendingSegments: new Set(),
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
            session.bargeHits += 1;
            if (session.bargeHits < 2)
                return;
            this.logger.log(`[MCube] Caller barge-in on stream=${session.streamId}`);
            session.cancelPlay = true;
            session.agentPlaying = false;
            session.flushGen += 1;
            this.sendClearAudio(ws, session.streamId);
        };
        ws.on('message', (raw) => {
            if (session.closed)
                return;
            try {
                let msg;
                try {
                    const text = typeof raw === 'string'
                        ? raw
                        : Buffer.isBuffer(raw)
                            ? raw.toString('utf8')
                            : String(raw);
                    msg = JSON.parse(text);
                }
                catch {
                    return;
                }
                if (msg.event === 'start' && msg.start) {
                    session.streamId = msg.start.streamId || session.streamId || '';
                    session.callId =
                        msg.start.callId || callIdHint || session.callId || `inbound_${Date.now()}`;
                    const format = msg.start.mediaFormat;
                    if (format?.encoding?.includes('l16')) {
                        session.encoding = 'audio/x-l16';
                        session.sampleRate = format.sampleRate || 16000;
                    }
                    else {
                        session.encoding = 'audio/x-mulaw';
                        session.sampleRate = format?.sampleRate || 8000;
                    }
                    this.logger.log(`[MCube] Inbound stream started streamId=${session.streamId} callId=${session.callId} format=${session.encoding}@${session.sampleRate}Hz`);
                    void (async () => {
                        try {
                            let call = await this.prisma.call.findUnique({
                                where: { id: session.callId },
                                include: { lead: { include: { project: true } } },
                            });
                            if (!call) {
                                const callerPhone = queryParams?.from ||
                                    queryParams?.caller ||
                                    queryParams?.callerNumber ||
                                    queryParams?.phone ||
                                    'Inbound Caller';
                                let lead = callerPhone && callerPhone !== 'Inbound Caller'
                                    ? await this.prisma.lead.findFirst({
                                        where: { phone: { contains: callerPhone.slice(-10) } },
                                        include: { project: true },
                                    })
                                    : null;
                                if (!lead) {
                                    lead = await this.prisma.lead.create({
                                        data: {
                                            name: 'Inbound Caller',
                                            phone: callerPhone !== 'Inbound Caller'
                                                ? callerPhone
                                                : 'Unknown',
                                            source: 'COLD_CALL',
                                            status: 'NEW',
                                            notes: 'Incoming call received via MCube telephony',
                                        },
                                        include: { project: true },
                                    });
                                }
                                call = await this.prisma.call.create({
                                    data: {
                                        id: session.callId,
                                        leadId: lead.id,
                                        status: client_1.CallStatus.IN_PROGRESS,
                                        outcome: client_1.CallOutcome.CONNECTED,
                                        provider: 'mcube',
                                        providerCallId: session.streamId || session.callId,
                                        summary: `Incoming call from ${lead.phone}`,
                                        transcript: 'Agent: Hello?\n',
                                        greetingText: 'Hello?',
                                    },
                                    include: { lead: { include: { project: true } } },
                                });
                                this.logger.log(`[MCube] Created Inbound Call record id=${call.id} for lead=${lead.name}`);
                            }
                            else {
                                await this.prisma.call.update({
                                    where: { id: session.callId },
                                    data: {
                                        provider: 'mcube',
                                        providerCallId: session.streamId || undefined,
                                        status: client_1.CallStatus.IN_PROGRESS,
                                    },
                                });
                            }
                            const settings = await this.ai.getSettings();
                            const initialOpener = 'Hello?';
                            session.lastAgentText = initialOpener;
                            session.turnCount = 1;
                            const audioBuf = await this.synthesizeForSession(initialOpener, session, settings);
                            if (audioBuf && ws.readyState === ws.OPEN) {
                                await this.sendPlayAudio(ws, session, audioBuf);
                            }
                        }
                        catch (err) {
                            this.logger.warn(`[MCube] Inbound greeting error: ${err}`);
                        }
                    })();
                    return;
                }
                if (msg.event === 'playedStream') {
                    const segName = msg.name || '';
                    session.pendingSegments.delete(segName);
                    if (session.pendingSegments.size === 0) {
                        session.agentPlaying = false;
                    }
                    this.logger.debug(`[MCube] playedStream finished name=${segName} streamId=${msg.streamId}`);
                    return;
                }
                if (msg.event === 'media' && msg.media?.payload) {
                    const track = (msg.media.track || 'inbound').toLowerCase();
                    if (track.includes('outbound'))
                        return;
                    if (msg.streamId && !session.streamId) {
                        session.streamId = msg.streamId;
                    }
                    const chunk = Buffer.from(msg.media.payload, 'base64');
                    const pcm = session.encoding === 'audio/x-l16'
                        ? (0, phone_audio_1.asNodeBuffer)(chunk)
                        : (0, phone_audio_1.mulawToPcm16)(chunk);
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
                        session.rawChunks.push(chunk);
                        scheduleFlush(420);
                        if (now - session.speechStartedAt > 6500) {
                            void this.flushTurn(ws, session);
                        }
                    }
                    else if (session.speaking) {
                        if (now - session.lastVoiceAt < 300) {
                            session.rawChunks.push(chunk);
                        }
                    }
                    return;
                }
            }
            catch (err) {
                this.logger.error(`[MCube] Error processing message: ${err instanceof Error ? err.message : err}`);
            }
        });
        ws.on('close', () => {
            session.closed = true;
            clearSilence();
            this.logger.log(`[MCube] WebSocket closed for callId=${session.callId}`);
            if (session.callId) {
                void this.prisma.call
                    .updateMany({
                    where: { id: session.callId, status: client_1.CallStatus.IN_PROGRESS },
                    data: { status: client_1.CallStatus.COMPLETED },
                })
                    .catch(() => undefined);
            }
        });
        ws.on('error', (err) => {
            session.closed = true;
            clearSilence();
            this.logger.warn(`[MCube] WebSocket error: ${err.message}`);
        });
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
        const rawIn = (0, phone_audio_1.asNodeBuffer)(Buffer.concat(session.rawChunks));
        session.rawChunks = [];
        const aborted = () => session.closed || session.flushGen !== myGen || session.cancelPlay;
        try {
            const minLength = session.encoding === 'audio/x-l16'
                ? session.sampleRate * 2 * 0.45
                : (session.sampleRate || 8000) * 0.45;
            if (rawIn.length < minLength) {
                session.busy = false;
                return;
            }
            const pcm16 = session.encoding === 'audio/x-l16'
                ? (0, phone_audio_1.boostPcm16)(rawIn, 1.2)
                : (0, phone_audio_1.boostPcm16)((0, phone_audio_1.mulawToPcm16)(rawIn), 2.2);
            const wavBuffer = (0, phone_audio_1.pcm16ToWav)(pcm16, session.sampleRate);
            const [stt, context] = await Promise.all([
                this.voice.speechToText({
                    buffer: wavBuffer,
                    fileName: 'mcube-in.wav',
                    language: 'hi-IN',
                }),
                session.callId
                    ? Promise.all([
                        this.prisma.call.findUnique({
                            where: { id: session.callId },
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
            this.logger.log(`[MCube] STT: "${userMessage}"`);
            if (!userMessage || userMessage.length < 2) {
                session.busy = false;
                return;
            }
            const call = context?.[0];
            const settings = context?.[1] || (await this.ai.getSettings());
            const callId = call?.id || session.callId;
            const lead = call?.lead || {
                id: 'guest-lead',
                name: 'Guest',
                phone: '9999999999',
                source: 'OTHER',
                status: 'NEW',
                createdAt: new Date(),
                updatedAt: new Date(),
                project: null,
            };
            const companyName = settings?.companyName ||
                lead.project?.companyName ||
                lead.project?.builder ||
                'Saya Group';
            const agentName = settings?.agentName || 'Neha';
            const liveTranscript = session.transcript || call?.transcript || 'Agent: Hello?\n';
            const follow = (0, call_scripts_1.buildFollowUpReply)({
                transcript: userMessage,
                leadName: lead.name,
                language: call?.languageDetected || 'hi-IN',
                tone: settings.tone || 'friendly',
                priorTranscript: liveTranscript,
                agentVoice: settings?.agentVoice || 'rachel',
                agentName,
                companyName,
                isInbound: true,
            });
            let replyText = follow.text;
            let languageDetected = call?.languageDetected || 'hi-IN';
            let ttsChain = Promise.resolve();
            let streamedAnyAudio = false;
            let fillerTimeout = setTimeout(async () => {
                if (streamedAnyAudio || aborted() || ws.readyState !== ws.OPEN)
                    return;
                try {
                    const filler = 'Haan ji, main dekh rahi hoon...';
                    const audioBuffer = await this.synthesizeForSession(filler, session, settings);
                    if (audioBuffer && !streamedAnyAudio && !aborted() && ws.readyState === ws.OPEN) {
                        await this.sendPlayAudio(ws, session, audioBuffer);
                    }
                }
                catch {
                }
            }, 1800);
            try {
                const result = await this.conversation.reply({
                    lead,
                    userMessage,
                    priorTranscript: liveTranscript,
                    agentName: settings?.agentName || 'Neha',
                    companyName: settings?.companyName ||
                        lead.project?.companyName ||
                        lead.project?.builder ||
                        'Saya Group',
                    defaultLanguage: call?.languageDetected || 'hi-IN',
                    tone: settings?.tone || 'friendly',
                    systemPrompt: settings?.systemPrompt || undefined,
                    llmModel: settings?.llmModel ||
                        'gemini-flash-lite-latest',
                    approvedPlaybook: settings
                        ?.approvedPlaybook,
                    agentVoice: settings?.agentVoice || 'rachel',
                    phoneLatency: true,
                    stream: true,
                    isInbound: true,
                    onSentence: (sentence) => {
                        if (fillerTimeout) {
                            clearTimeout(fillerTimeout);
                            fillerTimeout = null;
                        }
                        const cleaned = (0, phone_audio_1.truncateForPhone)(String(sentence || '').trim(), 120);
                        if (!cleaned)
                            return;
                        ttsChain = ttsChain
                            .then(async () => {
                            if (aborted() || ws.readyState !== ws.OPEN)
                                return;
                            const audioBuffer = await this.synthesizeForSession(cleaned, session, settings);
                            if (audioBuffer && !aborted() && ws.readyState === ws.OPEN) {
                                streamedAnyAudio = true;
                                await this.sendPlayAudio(ws, session, audioBuffer);
                            }
                        })
                            .catch((err) => {
                            this.logger.warn(`[MCube] Streamed sentence TTS error: ${err}`);
                        });
                    },
                });
                if (fillerTimeout) {
                    clearTimeout(fillerTimeout);
                    fillerTimeout = null;
                }
                if (aborted()) {
                    session.cancelPlay = false;
                    session.busy = false;
                    return;
                }
                if (result?.replyText?.trim()) {
                    replyText = result.replyText.trim();
                    languageDetected = result.languageDetected || languageDetected;
                }
                if (result?.qualification && lead?.id && lead.id !== 'guest-lead') {
                    void this.conversation
                        .applyQualificationToLead(lead.id, {
                        ...result.qualification,
                        projectId: result.resolvedProjectId || undefined,
                    })
                        .catch(() => undefined);
                }
                await ttsChain;
            }
            catch (err) {
                if (fillerTimeout) {
                    clearTimeout(fillerTimeout);
                    fillerTimeout = null;
                }
                this.logger.warn(`[MCube] LLM failed: ${err instanceof Error ? err.message : err}`);
            }
            session.lastUserText = userMessage;
            session.lastAgentText = replyText;
            session.turnCount += 1;
            session.transcript = [
                session.transcript || call?.transcript || '',
                `Lead: ${userMessage}`,
                `Agent: ${replyText}`,
            ]
                .filter(Boolean)
                .join('\n') + '\n';
            void this.prisma.call
                .update({
                where: { id: callId },
                data: {
                    transcript: session.transcript,
                    languageDetected,
                    status: client_1.CallStatus.IN_PROGRESS,
                },
            })
                .catch(() => undefined);
            if (!streamedAnyAudio && !aborted() && ws.readyState === ws.OPEN) {
                const cleanReply = (0, phone_audio_1.truncateForPhone)(replyText, 140);
                const audioBuffer = await this.synthesizeForSession(cleanReply, session, settings);
                if (audioBuffer && !aborted() && ws.readyState === ws.OPEN) {
                    await this.sendPlayAudio(ws, session, audioBuffer);
                }
            }
        }
        catch (err) {
            this.logger.error(`[MCube] Turn failed: ${err instanceof Error ? err.message : err}`);
        }
        finally {
            session.busy = false;
        }
    }
    async synthesizeForSession(text, session, settings) {
        try {
            if (session.encoding === 'audio/x-l16') {
                const tts = await this.voice.textToSpeech({
                    text,
                    speaker: settings?.agentVoice || 'rachel',
                    language: session.lastAgentText ? 'hi-IN' : 'en-US',
                    outputFormat: 'pcm_16000',
                    skipSave: true,
                    pace: 1.0,
                    modelId: 'eleven_flash_v2_5',
                    optimizeStreamingLatency: 4,
                });
                return (0, phone_audio_1.asNodeBuffer)(Buffer.from(tts.audioBase64, 'base64'));
            }
            else {
                try {
                    const tts = await this.voice.textToSpeech({
                        text,
                        speaker: settings?.agentVoice || 'rachel',
                        language: 'hi-IN',
                        outputFormat: 'ulaw_8000',
                        skipSave: true,
                        pace: 1.0,
                        modelId: 'eleven_flash_v2_5',
                        optimizeStreamingLatency: 4,
                    });
                    return (0, phone_audio_1.asNodeBuffer)(Buffer.from(tts.audioBase64, 'base64'));
                }
                catch {
                    const tts = await this.voice.textToSpeech({
                        text,
                        speaker: settings?.agentVoice || 'rachel',
                        language: 'hi-IN',
                        outputFormat: 'pcm_16000',
                        skipSave: true,
                        pace: 1.0,
                        modelId: 'eleven_flash_v2_5',
                        optimizeStreamingLatency: 4,
                    });
                    const pcm16k = (0, phone_audio_1.asNodeBuffer)(Buffer.from(tts.audioBase64, 'base64'));
                    return (0, phone_audio_1.pcm16ToMulaw)((0, phone_audio_1.downsamplePcm16)(pcm16k, 16000, 8000));
                }
            }
        }
        catch (err) {
            this.logger.error(`[MCube] TTS failed: ${err instanceof Error ? err.message : err}`);
            return null;
        }
    }
    async sendPlayAudio(ws, session, audioBuffer) {
        if (ws.readyState !== ws.OPEN || !session.streamId)
            return;
        const segmentName = `seg_${(0, crypto_1.randomUUID)().slice(0, 8)}`;
        session.pendingSegments.add(segmentName);
        session.agentPlaying = true;
        session.cancelPlay = false;
        const playMsg = {
            event: 'playAudio',
            media: {
                contentType: session.encoding,
                sampleRate: session.sampleRate,
                payload: audioBuffer.toString('base64'),
                name: segmentName,
            },
        };
        ws.send(JSON.stringify(playMsg));
        const checkpointMsg = {
            event: 'checkpoint',
            streamId: session.streamId,
            name: segmentName,
        };
        ws.send(JSON.stringify(checkpointMsg));
        this.logger.debug(`[MCube] Sent playAudio and checkpoint name=${segmentName} streamId=${session.streamId}`);
    }
    sendClearAudio(ws, streamId) {
        if (ws.readyState !== ws.OPEN || !streamId)
            return;
        const msg = {
            event: 'clearAudio',
            streamId,
        };
        ws.send(JSON.stringify(msg));
    }
    sendTransfer(ws, streamId, transferTo, showOriginalCallerId = true) {
        if (ws.readyState !== ws.OPEN || !streamId)
            return;
        const msg = {
            event: 'transfer',
            streamId,
            transferTo,
            showOriginalCallerId,
        };
        ws.send(JSON.stringify(msg));
        this.logger.log(`[MCube] Transferred call streamId=${streamId} to ${transferTo}`);
    }
    sendTerminate(ws, streamId) {
        if (ws.readyState !== ws.OPEN || !streamId)
            return;
        const msg = {
            event: 'terminate',
            streamId,
        };
        ws.send(JSON.stringify(msg));
        this.logger.log(`[MCube] Terminated call streamId=${streamId}`);
    }
};
exports.McubeStreamService = McubeStreamService;
exports.McubeStreamService = McubeStreamService = McubeStreamService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        ai_service_1.AiService,
        voice_service_1.VoiceService,
        conversation_service_1.ConversationService])
], McubeStreamService);
//# sourceMappingURL=mcube-stream.service.js.map