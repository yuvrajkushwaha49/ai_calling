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
exports.McubeStreamService = exports.TurnLifecycleState = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const voice_service_1 = require("../voice/voice.service");
const conversation_service_1 = require("../conversation/conversation.service");
const customer_memory_service_1 = require("../memory/customer-memory.service");
const fact_extractor_service_1 = require("../memory/fact-extractor.service");
const question_validator_service_1 = require("../memory/question-validator.service");
const client_1 = require("@prisma/client");
const appointments_service_1 = require("../appointments/appointments.service");
const opener_bank_1 = require("./opener-bank");
const call_scripts_1 = require("./call-scripts");
const version_1 = require("../version");
const phone_audio_1 = require("./phone-audio");
const latency_tracker_1 = require("./latency-tracker");
exports.TurnLifecycleState = {
    IDLE: 'IDLE',
    STT_IN_PROGRESS: 'STT_IN_PROGRESS',
    LLM_IN_PROGRESS: 'LLM_IN_PROGRESS',
    TTS_IN_PROGRESS: 'TTS_IN_PROGRESS',
    AUDIO_BUFFERED: 'AUDIO_BUFFERED',
    CARRIER_PLAYING: 'CARRIER_PLAYING',
    COMPLETED: 'COMPLETED',
    ABORTED: 'ABORTED',
};
let McubeStreamService = McubeStreamService_1 = class McubeStreamService {
    config;
    prisma;
    ai;
    voice;
    conversation;
    customerMemory;
    factExtractor;
    questionValidator;
    appointments;
    logger = new common_1.Logger(McubeStreamService_1.name);
    uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
    activeSessions = new Map();
    reconnectCache = new Map();
    ttsCache = new Map();
    constructor(config, prisma, ai, voice, conversation, customerMemory, factExtractor, questionValidator, appointments) {
        this.config = config;
        this.prisma = prisma;
        this.ai = ai;
        this.voice = voice;
        this.conversation = conversation;
        this.customerMemory = customerMemory;
        this.factExtractor = factExtractor;
        this.questionValidator = questionValidator;
        this.appointments = appointments;
        fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    attachClient(ws, callIdHint, queryParams) {
        let prior;
        const cachedReconnect = callIdHint ? this.reconnectCache.get(callIdHint) : undefined;
        if (cachedReconnect) {
            clearTimeout(cachedReconnect.timer);
            this.reconnectCache.delete(callIdHint);
            prior = cachedReconnect.session;
            this.logger.log(`[MCube-Reconnect] Restored disconnected callId=${callIdHint} from 120s reconnect cache (disconnected ${Date.now() - cachedReconnect.disconnectedAt}ms ago)`);
        }
        else if (callIdHint && this.activeSessions.has(callIdHint)) {
            prior = this.activeSessions.get(callIdHint);
            if (prior) {
                if (prior.heartbeatTimer)
                    clearInterval(prior.heartbeatTimer);
                if (prior.watchdogTimer)
                    clearInterval(prior.watchdogTimer);
                if (prior.silenceTimer)
                    clearTimeout(prior.silenceTimer);
            }
            this.logger.log(`[MCube-Reconnect] Reconnecting existing active callId=${callIdHint}, preserving conversation state and facts`);
        }
        const now = Date.now();
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
            busySince: 0,
            closed: false,
            listenAfter: 0,
            agentPlaying: false,
            cancelPlay: false,
            bargeHits: 0,
            flushGen: prior ? prior.flushGen + 1 : 0,
            lastAgentText: prior?.lastAgentText || 'Hello?',
            lastUserText: prior?.lastUserText || '',
            turnCount: prior?.turnCount || 0,
            transcript: prior?.transcript || 'Agent: Hello?\n',
            pendingSegments: new Set(),
            memory: prior?.memory,
            ambientEnergy: prior?.ambientEnergy || 160,
            ambientSamples: 0,
            ambientCalibrated: false,
            voiceThreshold: prior?.voiceThreshold || 450,
            bargeThreshold: prior?.bargeThreshold || 900,
            filterState: (0, phone_audio_1.createAudioFilterState)(),
            sessionStartedAt: prior?.sessionStartedAt || now,
            lastInboundAudioAt: prior?.lastInboundAudioAt || 0,
            lastOutboundAudioAt: prior?.lastOutboundAudioAt || 0,
            lastTtsSuccessAt: prior?.lastTtsSuccessAt || 0,
            lastMcubeTransmitAt: prior?.lastMcubeTransmitAt || 0,
            lastReceivedEvent: 'connect',
            lastTranscript: prior?.lastTranscript || '',
            lastTranscriptAt: prior?.lastTranscriptAt || 0,
            lastLlmAt: prior?.lastLlmAt || 0,
            lastPlaybackCompleteAt: prior?.lastPlaybackCompleteAt || 0,
            wsReadyState: ws.readyState,
            wsCloseCode: null,
            wsCloseReason: null,
            heartbeatPingAt: 0,
            heartbeatPongAt: 0,
            missedPings: 0,
            inboundFrameCount: prior?.inboundFrameCount || 0,
            outboundFrameCount: prior?.outboundFrameCount || 0,
            recoveryAttempts: prior?.recoveryAttempts || 0,
            lastFailureCondition: null,
            heartbeatTimer: null,
            watchdogTimer: null,
            heartbeatRttMs: prior?.heartbeatRttMs ?? null,
            audioGeneratedCount: prior?.audioGeneratedCount || 0,
            audioGeneratedBytes: prior?.audioGeneratedBytes || 0,
            audioTransmittedCount: prior?.audioTransmittedCount || 0,
            audioTransmittedBytes: prior?.audioTransmittedBytes || 0,
            audioPlayedCount: prior?.audioPlayedCount || 0,
            audioPlayedBytes: prior?.audioPlayedBytes || 0,
            audioProviderAcceptedCount: prior?.audioProviderAcceptedCount || 0,
            audioProviderAcceptedBytes: prior?.audioProviderAcceptedBytes || 0,
            audioConfirmedPlayedCount: prior?.audioConfirmedPlayedCount || 0,
            audioConfirmedPlayedBytes: prior?.audioConfirmedPlayedBytes || 0,
            audioInferredDrainCount: prior?.audioInferredDrainCount || 0,
            audioInferredDrainBytes: prior?.audioInferredDrainBytes || 0,
            segmentBytes: new Map(),
            activeOperationId: null,
            activeGenerationId: 0,
            operationState: 'IDLE',
            lastCancellationReason: null,
            consecutiveLivenessChecks: 0,
            cleanupCompleted: false,
        };
        if (session.callId) {
            this.activeSessions.set(session.callId, session);
        }
        const startHeartbeat = () => {
            if (session.heartbeatTimer)
                clearInterval(session.heartbeatTimer);
            session.heartbeatTimer = setInterval(() => {
                if (session.closed || ws.readyState !== 1)
                    return;
                if (session.heartbeatPingAt > 0 && session.heartbeatPongAt < session.heartbeatPingAt) {
                    session.missedPings++;
                    if (session.missedPings > 1) {
                        this.logger.warn(`[MCube-Heartbeat] Stale connection detected: missed ${session.missedPings} pings callId=${session.callId}`);
                    }
                }
                session.heartbeatPingAt = Date.now();
                if (typeof ws.ping === 'function') {
                    try {
                        ws.ping();
                    }
                    catch (err) {
                        this.logger.warn(`[MCube-Heartbeat] Ping failed callId=${session.callId}: ${err}`);
                    }
                }
            }, 20000);
            if (typeof session.heartbeatTimer?.unref === 'function') {
                session.heartbeatTimer.unref();
            }
        };
        if (typeof ws.on === 'function') {
            ws.on('pong', () => {
                const now = Date.now();
                session.heartbeatPongAt = now;
                session.heartbeatRttMs = session.heartbeatPingAt > 0 ? now - session.heartbeatPingAt : null;
                session.missedPings = 0;
            });
        }
        startHeartbeat();
        const startWatchdog = () => {
            if (session.watchdogTimer)
                clearInterval(session.watchdogTimer);
            session.watchdogTimer = setInterval(() => {
                this.runSessionWatchdog(ws, session);
            }, 10000);
            if (typeof session.watchdogTimer?.unref === 'function') {
                session.watchdogTimer.unref();
            }
        };
        startWatchdog();
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
            const tStart = Date.now();
            session.actualCancellationConfirmed = false;
            const currentOp = session.activeOperationId || 'none';
            const currentGen = session.flushGen;
            this.logger.log(`[Audio-Lifecycle] [Step 8: CUSTOMER_INTERRUPTS] streamId=${session.streamId} callId=${session.callId} operationId=${currentOp} gen=${currentGen} ambient=${Math.round(session.ambientEnergy)} thresh=${session.bargeThreshold}`);
            this.logger.log(`[MCube-BargeIn] [State 1: BARGE_IN_DETECTED] callId=${session.callId} operationId=${currentOp} generationId=${currentGen} reason="CUSTOMER_SPEECH_OVER_AGENT" ambient=${Math.round(session.ambientEnergy)} thresh=${session.bargeThreshold}`);
            this.sendClearAudio(ws, session.streamId);
            this.logger.log(`[MCube-BargeIn] [State 2: CLEAR_COMMAND_SENT] clearAudio & clear frames sent to MCube in ${Date.now() - tStart}ms`);
            const droppedCount = session.pendingSegments.size;
            session.cancelPlay = true;
            session.agentPlaying = false;
            session.pendingSegments.clear();
            session.segmentBytes.clear();
            session.flushGen += 1;
            this.logger.log(`[Audio-Lifecycle] [Step 11: PENDING_QUEUE_CLEARED] Cleared ${droppedCount} pending segments, incremented flushGen=${session.flushGen}`);
            this.logger.log(`[MCube-BargeIn] [State 3: LOCAL_QUEUE_CLEARED] Cleared ${droppedCount} pending segments, incremented flushGen=${session.flushGen}`);
            const priorState = session.operationState;
            session.lastCancellationReason = 'CUSTOMER_INTERRUPT';
            if (session.turnAbortController) {
                session.turnAbortController.abort();
                session.turnAbortController = null;
            }
            if (priorState === 'LLM_IN_PROGRESS') {
                this.logger.log(`[Audio-Lifecycle] [Step 9: LLM_GENERATION_ABORTED] In-flight LLM stream aborted=true operationId=${currentOp} gen=${currentGen}`);
                this.logger.log(`[Audio-Lifecycle] [Step 10: TTS_GENERATION_ABORTED] status=NOT_YET_STARTED operationId=${currentOp}`);
                this.logger.log(`[MCube-BargeIn] [State 4: LLM_GENERATION_ABORTED] status=ACTIVE_ABORTED operationId=${currentOp} generationId=${currentGen} reason=CUSTOMER_INTERRUPT`);
                this.logger.log(`[MCube-BargeIn] [State 5: TTS_GENERATION_ABORTED] status=NOT_YET_STARTED operationId=${currentOp} generationId=${currentGen}`);
            }
            else if (priorState === 'TTS_IN_PROGRESS') {
                this.logger.log(`[Audio-Lifecycle] [Step 9: LLM_GENERATION_ABORTED] status=ALREADY_COMPLETED operationId=${currentOp}`);
                this.logger.log(`[Audio-Lifecycle] [Step 10: TTS_GENERATION_ABORTED] In-flight ElevenLabs synthesis aborted=true operationId=${currentOp} gen=${currentGen}`);
                this.logger.log(`[MCube-BargeIn] [State 4: LLM_GENERATION_ABORTED] status=ALREADY_COMPLETED operationId=${currentOp} generationId=${currentGen}`);
                this.logger.log(`[MCube-BargeIn] [State 5: TTS_GENERATION_ABORTED] status=ACTIVE_ABORTED operationId=${currentOp} generationId=${currentGen} reason=CUSTOMER_INTERRUPT`);
            }
            else if (priorState === 'CARRIER_PLAYING' || priorState === 'AUDIO_BUFFERED' || priorState === 'COMPLETED') {
                this.logger.log(`[Audio-Lifecycle] [Step 9: LLM_GENERATION_ABORTED] status=GENERATION_COMPLETED_EARLIER operationId=${currentOp}`);
                this.logger.log(`[Audio-Lifecycle] [Step 10: TTS_GENERATION_ABORTED] status=GENERATION_COMPLETED_EARLIER operationId=${currentOp}`);
                this.logger.log(`[MCube-BargeIn] [State 4: LLM_GENERATION_ABORTED] status=GENERATION_COMPLETED_EARLIER operationId=${currentOp} generationId=${currentGen}`);
                this.logger.log(`[MCube-BargeIn] [State 5: TTS_GENERATION_ABORTED] status=GENERATION_COMPLETED_EARLIER operationId=${currentOp} generationId=${currentGen}`);
                this.logger.log(`[MCube-BargeIn] [Playback-Drain] Cleared ${droppedCount} queued carrier segments without abort error.`);
            }
            else {
                this.logger.log(`[Audio-Lifecycle] [Step 9: LLM_GENERATION_ABORTED] status=IDLE operationId=${currentOp}`);
                this.logger.log(`[Audio-Lifecycle] [Step 10: TTS_GENERATION_ABORTED] status=IDLE operationId=${currentOp}`);
                this.logger.log(`[MCube-BargeIn] [State 4: LLM_GENERATION_ABORTED] status=IDLE operationId=${currentOp} generationId=${currentGen}`);
                this.logger.log(`[MCube-BargeIn] [State 5: TTS_GENERATION_ABORTED] status=IDLE operationId=${currentOp} generationId=${currentGen}`);
            }
            session.operationState = 'ABORTED';
            this.logger.log(`[MCube-BargeIn] [State 6: LAST_AUDIO_CHUNK_SENT] Last chunk sent was segment=${session.lastAudioChunkSegment || 'none'} (${session.lastAudioChunkSentAt ? `${tStart - session.lastAudioChunkSentAt}ms ago` : 'no previous chunk in turn'})`);
            this.logger.log(`[MCube-BargeIn] [State 8: CARRIER_DRAIN_STATUS] Status: ${session.actualCancellationConfirmed ? 'EXPLICIT_ACK_CONFIRMED' : 'INFERRED_CARRIER_DRAIN'}`);
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
                session.lastReceivedEvent = msg.event || 'unknown';
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
                    const versionTelemetry = (0, version_1.getVersionTelemetry)();
                    this.logger.log(`[MCube-Version] Call Session Initialized: version=${versionTelemetry.version} commit=${versionTelemetry.commitSha} deployment=${versionTelemetry.deploymentId} pid=${versionTelemetry.processPid} callId=${session.callId} streamId=${session.streamId}`);
                    void (async () => {
                        try {
                            let call = await this.prisma.call.findUnique({
                                where: { id: session.callId },
                                include: { lead: { include: { project: true } } },
                            });
                            const rawStart = msg.start || {};
                            let callerPhone = rawStart.callerNumber ||
                                rawStart.from ||
                                rawStart.caller ||
                                rawStart.customerNumber ||
                                rawStart.customParameters?.callerNumber ||
                                rawStart.customParameters?.from ||
                                queryParams?.from ||
                                queryParams?.caller ||
                                queryParams?.callerNumber ||
                                queryParams?.phone ||
                                '';
                            if (!callerPhone && session.callId) {
                                const prefix10 = session.callId.slice(0, 10);
                                if (/^[6-9]\d{9}$/.test(prefix10)) {
                                    callerPhone = prefix10;
                                }
                            }
                            if (!callerPhone) {
                                callerPhone = 'Inbound Caller';
                            }
                            if (!call) {
                                let lead = callerPhone && callerPhone !== 'Inbound Caller'
                                    ? await this.prisma.lead.findFirst({
                                        where: { phone: { contains: callerPhone.slice(-10) } },
                                        include: { project: true },
                                    })
                                    : null;
                                if (!lead) {
                                    lead = await this.prisma.lead.create({
                                        data: {
                                            name: callerPhone !== 'Inbound Caller'
                                                ? `Lead ${callerPhone.slice(-4)}`
                                                : 'Inbound Caller',
                                            phone: callerPhone !== 'Inbound Caller'
                                                ? callerPhone.startsWith('+')
                                                    ? callerPhone
                                                    : `+91${callerPhone.slice(-10)}`
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
                                this.logger.log(`[MCube] Inbound Call id=${call.id} matched lead=${lead.name} phone=${lead.phone}`);
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
                            const activePhone = call?.lead?.phone ||
                                (callerPhone !== 'Inbound Caller' ? callerPhone : '');
                            session.memory = await this.customerMemory.initializeCallMemory(session.callId, activePhone, call?.leadId);
                            if (session.memory?.isReturningCustomer) {
                                this.logger.log(`[MCube] 🌟 Recognized Returning Customer: ${session.memory.customer.name || 'Caller'} (BHK: ${session.memory.customer.bhk || 'N/A'}, Budget: ${session.memory.customer.budgetLabel || 'N/A'}, Calls: ${session.memory.previousCallCount})`);
                            }
                            const settings = await this.ai.getSettings();
                            session.settings = settings;
                            let companyName = settings?.companyName ||
                                call?.lead?.project?.companyName ||
                                'Workains Reality';
                            if (!companyName || /saya\s*group/i.test(companyName) || /rgbil/i.test(companyName)) {
                                companyName = 'Workains Reality';
                            }
                            const rawAgent = settings?.agentName || 'Aria';
                            const agentName = (0, opener_bank_1.speakAgentName)(rawAgent) || 'Aria';
                            let initialOpener;
                            const isReturning = Boolean(session.memory?.isReturningCustomer);
                            const customerName = session.memory?.customer?.name || call?.lead?.name;
                            const hasRealName = customerName && !(0, call_scripts_1.isPlaceholderLeadName)(customerName);
                            if (isReturning) {
                                const pastReq = session.memory?.customer?.bhk ||
                                    session.memory?.customer?.budgetLabel ||
                                    'property requirement';
                                const nameGreet = hasRealName ? `${customerName} ji` : 'ji';
                                initialOpener = `Namaste ${nameGreet}! Main ${agentName}, ${companyName} se bol rahi hoon. Pichhli baar humne aapki ${pastReq} ke baare mein baat ki thi. Kya aaj usi ko continue karein ya koi naya project dekhna chahenge?`;
                            }
                            else {
                                initialOpener = `Namaste ji! Main ${agentName}, ${companyName} se bol rahi hoon. Hum multiple builders ke residential aur commercial projects mein property options provide karte hain. Aap kis location mein property dekh rahe hain?`;
                            }
                            session.lastAgentText = initialOpener;
                            session.turnCount = 1;
                            session.transcript = `Agent: ${initialOpener}\n`;
                            if (session.callId) {
                                void this.customerMemory.recordTurn(session.callId, {
                                    role: 'assistant',
                                    content: initialOpener,
                                    timestamp: Date.now(),
                                }).catch(() => undefined);
                            }
                            const audioBuf = await this.synthesizeForSession(initialOpener, session, settings);
                            if (audioBuf && ws.readyState === ws.OPEN) {
                                this.logger.log(`[MCube] 🤖 AI Opener (${isReturning ? 'Returning' : 'New'}): "${initialOpener}"`);
                                await this.sendPlayAudio(ws, session, audioBuf);
                            }
                        }
                        catch (err) {
                            this.logger.warn(`[MCube] Inbound greeting error: ${err}`);
                        }
                    })();
                    return;
                }
                if (msg.event === 'checkpoint' || msg.event === 'ack') {
                    const segName = msg.name || '';
                    const bytes = session.segmentBytes.get(segName) || 0;
                    session.audioProviderAcceptedCount++;
                    session.audioProviderAcceptedBytes += bytes;
                    this.logger.debug(`[MCube] Provider accepted audio segment=${segName} streamId=${msg.streamId} bytes=${bytes}`);
                    return;
                }
                if (msg.event === 'playedStream') {
                    session.lastPlaybackCompleteAt = Date.now();
                    const segName = msg.name || '';
                    if (session.pendingSegments.has(segName)) {
                        session.pendingSegments.delete(segName);
                        session.audioPlayedCount++;
                        session.audioConfirmedPlayedCount++;
                        const bytes = session.segmentBytes.get(segName) || 0;
                        session.audioPlayedBytes += bytes;
                        session.audioConfirmedPlayedBytes += bytes;
                        session.segmentBytes.delete(segName);
                        if (session.pendingSegments.size === 0) {
                            session.agentPlaying = false;
                            if (session.operationState === 'CARRIER_PLAYING') {
                                session.operationState = 'COMPLETED';
                            }
                        }
                        this.logger.debug(`[MCube] Confirmed carrier playback finished: name=${segName} streamId=${msg.streamId} bytes=${bytes}`);
                    }
                    else {
                        this.logger.debug(`[MCube] Ignored playedStream for old/cancelled segment name=${segName} streamId=${msg.streamId}`);
                    }
                    return;
                }
                if (msg.event === 'cleared' || msg.event === 'clearAudioDone' || msg.event === 'stop') {
                    session.actualCancellationConfirmed = true;
                    this.logger.log(`[MCube-BargeIn] [State 7: MCUBE_ACK_RECEIVED] Carrier explicit playback cancellation confirmed on stream=${session.streamId} event=${msg.event}`);
                    this.logger.log(`[MCube-BargeIn] [State 8: CARRIER_DRAIN_STATUS] EXPLICIT_ACK_CONFIRMED on stream=${session.streamId}`);
                    return;
                }
                if (msg.event === 'media' && msg.media?.payload) {
                    const track = (msg.media.track || 'inbound').toLowerCase();
                    if (track.includes('outbound'))
                        return;
                    if (msg.streamId && !session.streamId) {
                        session.streamId = msg.streamId;
                    }
                    const now = Date.now();
                    session.inboundFrameCount += 1;
                    session.lastInboundAudioAt = now;
                    const chunk = Buffer.from(msg.media.payload, 'base64');
                    const rawPcm = session.encoding === 'audio/x-l16'
                        ? (0, phone_audio_1.asNodeBuffer)(chunk)
                        : (0, phone_audio_1.mulawToPcm16)(chunk);
                    const pcm = (0, phone_audio_1.filterDcBlockPcm16)(rawPcm, session.filterState);
                    const energy = (0, phone_audio_1.pcmEnergy)(pcm);
                    if (!session.ambientCalibrated) {
                        session.ambientSamples += 1;
                        if (energy < 650) {
                            session.ambientEnergy =
                                session.ambientSamples === 1
                                    ? energy
                                    : session.ambientEnergy * 0.85 + energy * 0.15;
                        }
                        if (session.ambientSamples >= 25) {
                            session.ambientCalibrated = true;
                            const thresh = (0, phone_audio_1.calculateDynamicNoiseThresholds)(session.ambientEnergy);
                            session.voiceThreshold = thresh.voiceThreshold;
                            session.bargeThreshold = thresh.bargeThreshold;
                            this.logger.log(`[MCube] 🎛️ Dynamic Noise Gate calibrated: ambient=${Math.round(session.ambientEnergy)} ➔ voiceThreshold=${session.voiceThreshold}, bargeThreshold=${session.bargeThreshold}`);
                        }
                    }
                    else if (!session.speaking && energy < session.voiceThreshold * 0.75) {
                        session.ambientEnergy = session.ambientEnergy * 0.98 + energy * 0.02;
                        const thresh = (0, phone_audio_1.calculateDynamicNoiseThresholds)(session.ambientEnergy);
                        if (Math.abs(thresh.voiceThreshold - session.voiceThreshold) >= 20) {
                            session.voiceThreshold = thresh.voiceThreshold;
                            session.bargeThreshold = thresh.bargeThreshold;
                        }
                    }
                    if (session.agentPlaying &&
                        energy > session.bargeThreshold &&
                        now > session.listenAfter) {
                        bargeIn();
                    }
                    if (now < session.listenAfter && !session.agentPlaying)
                        return;
                    if (energy > session.voiceThreshold) {
                        if (!session.speaking) {
                            session.speaking = true;
                            session.speechStartedAt = now;
                        }
                        session.lastVoiceAt = now;
                        session.rawChunks.push(chunk);
                        scheduleFlush(260);
                        if (now - session.speechStartedAt > 6500) {
                            void this.flushTurn(ws, session);
                        }
                    }
                    else if (session.speaking) {
                        if (now - session.lastVoiceAt < 200) {
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
        ws.on('close', (code, reason) => {
            if (session.cleanupCompleted)
                return;
            session.cleanupCompleted = true;
            session.closed = true;
            session.cancelPlay = true;
            session.agentPlaying = false;
            session.flushGen += 1;
            session.rawChunks = [];
            session.pendingSegments.clear();
            session.segmentBytes.clear();
            session.wsReadyState = 3;
            session.wsCloseCode = typeof code === 'number' ? code : null;
            session.wsCloseReason = reason ? reason.toString() : null;
            clearSilence();
            if (session.heartbeatTimer) {
                clearInterval(session.heartbeatTimer);
                session.heartbeatTimer = null;
            }
            if (session.watchdogTimer) {
                clearInterval(session.watchdogTimer);
                session.watchdogTimer = null;
            }
            if (session.turnAbortController) {
                session.turnAbortController.abort();
                session.turnAbortController = null;
            }
            if (code !== 1000 && code !== 1001 && code !== undefined && code !== null) {
                session.lastFailureCondition = 'WS_UNEXPECTED_CLOSE';
                this.logger.warn(`[MCube-Watchdog] [Condition G: WS_UNEXPECTED_CLOSE] WebSocket closed unexpectedly with code=${code} reason="${reason}" callId=${session.callId}`);
            }
            this.logger.log(`[MCube] WebSocket closed for callId=${session.callId} code=${code} reason=${reason}`);
            this.logCallMetrics(session);
            if (session.callId) {
                this.activeSessions.delete(session.callId);
                const existingCache = this.reconnectCache.get(session.callId);
                if (existingCache) {
                    clearTimeout(existingCache.timer);
                }
                const timer = setTimeout(() => {
                    this.reconnectCache.delete(session.callId);
                    this.logger.log(`[MCube-SessionCache] Reconnect cache expired after 120s for callId=${session.callId}`);
                }, 120000);
                if (typeof timer?.unref === 'function') {
                    timer.unref();
                }
                this.reconnectCache.set(session.callId, {
                    session,
                    disconnectedAt: Date.now(),
                    timer,
                });
                void this.customerMemory.persistMemoryToDb(session.callId).catch(() => undefined);
                void this.prisma.call
                    .updateMany({
                    where: { id: session.callId, status: client_1.CallStatus.IN_PROGRESS },
                    data: { status: client_1.CallStatus.COMPLETED },
                })
                    .catch(() => undefined);
                void (async () => {
                    try {
                        const finalCall = await this.prisma.call.findUnique({
                            where: { id: session.callId },
                            include: { lead: true },
                        });
                        if (finalCall?.lead &&
                            finalCall.lead.id !== 'guest-lead' &&
                            session.transcript) {
                            await this.appointments.maybeBookFromCall({
                                leadId: finalCall.lead.id,
                                projectId: finalCall.lead.projectId || undefined,
                                userMessage: session.lastUserText || '',
                                priorTranscript: session.transcript,
                            });
                        }
                    }
                    catch (err) {
                        this.logger.warn(`[MCube] Close hook appointment check error: ${err}`);
                    }
                })();
            }
        });
        ws.on('error', (err) => {
            session.closed = true;
            session.wsReadyState = 3;
            clearSilence();
            if (session.heartbeatTimer) {
                clearInterval(session.heartbeatTimer);
                session.heartbeatTimer = null;
            }
            if (session.watchdogTimer) {
                clearInterval(session.watchdogTimer);
                session.watchdogTimer = null;
            }
            this.logger.warn(`[MCube] WebSocket error: ${err.message}`);
        });
    }
    async flushTurn(ws, session) {
        if (session.busy || session.closed)
            return;
        const operationId = `op_${(0, crypto_1.randomUUID)().slice(0, 8)}`;
        session.activeOperationId = operationId;
        session.busy = true;
        session.busySince = Date.now();
        const wasInterrupted = session.cancelPlay;
        session.cancelPlay = false;
        const myGen = ++session.flushGen;
        const turnAbort = new AbortController();
        session.turnAbortController = turnAbort;
        if (wasInterrupted) {
            this.logger.log(`[MCube-BargeIn] [State 9: NEXT_CUSTOMER_RESPONSE_STARTED] Customer utterance processing initiated following barge-in streamId=${session.streamId} gen=${myGen}`);
        }
        if (session.silenceTimer) {
            clearTimeout(session.silenceTimer);
            session.silenceTimer = null;
        }
        session.speaking = false;
        session.speechStartedAt = 0;
        session.bargeHits = 0;
        const rawIn = (0, phone_audio_1.asNodeBuffer)(Buffer.concat(session.rawChunks));
        session.rawChunks = [];
        const aborted = () => session.closed ||
            session.flushGen !== myGen ||
            session.cancelPlay ||
            turnAbort.signal.aborted;
        try {
            const minLength = session.encoding === 'audio/x-l16'
                ? session.sampleRate * 2 * 0.45
                : (session.sampleRate || 8000) * 0.45;
            if (rawIn.length < minLength) {
                session.busy = false;
                session.busySince = 0;
                return;
            }
            const boostedPcm = session.encoding === 'audio/x-l16'
                ? (0, phone_audio_1.boostPcm16)(rawIn, 1.2)
                : (0, phone_audio_1.boostPcm16)((0, phone_audio_1.mulawToPcm16)(rawIn), 2.2);
            const pcm16 = (0, phone_audio_1.filterDcBlockPcm16)(boostedPcm);
            const wavBuffer = (0, phone_audio_1.pcm16ToWav)(pcm16, session.sampleRate);
            const turnStartTime = Date.now();
            const sttStart = Date.now();
            const [stt, context] = await Promise.all([
                this.voice.speechToText({
                    buffer: wavBuffer,
                    fileName: 'mcube-in.wav',
                    language: session.settings?.language || 'en-IN',
                }),
                session.cachedCallContext
                    ? Promise.resolve(session.cachedCallContext)
                    : session.callId
                        ? Promise.all([
                            this.prisma.call.findUnique({
                                where: { id: session.callId },
                                include: { lead: { include: { project: true } } },
                            }),
                            this.ai.getSettings(),
                        ]).then((ctx) => {
                            session.cachedCallContext = ctx;
                            return ctx;
                        })
                        : Promise.resolve([null, null]),
            ]);
            const sttDurationMs = Date.now() - sttStart;
            if (rawIn.length >= minLength && (!stt.transcript || !stt.transcript.trim())) {
                session.lastFailureCondition = 'STT_NO_TRANSCRIPT';
                this.logger.warn(`[MCube-Watchdog] [Condition B: STT_NO_TRANSCRIPT] STT produced empty transcript for ${rawIn.length}b audio in ${sttDurationMs}ms callId=${session.callId}`);
            }
            if (aborted()) {
                session.busy = false;
                session.busySince = 0;
                return;
            }
            const rawUserMessage = (stt.transcript || '').trim();
            const cleanUserMessage = rawUserMessage
                .replace(/\[[^\]]*\]/g, '')
                .replace(/\([^)]*\)/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            this.logger.log(`[MCube] 👤 Caller: "${rawUserMessage}"`);
            if (!cleanUserMessage || cleanUserMessage.length < 2) {
                if (rawUserMessage) {
                    this.logger.debug(`[MCube] 🔇 Ignored non-speech audio event: "${rawUserMessage}"`);
                }
                session.busy = false;
                session.busySince = 0;
                return;
            }
            const userMessage = cleanUserMessage;
            session.lastTranscript = userMessage;
            session.lastTranscriptAt = Date.now();
            if (session.callId) {
                void this.customerMemory.recordTurn(session.callId, {
                    role: 'user',
                    content: userMessage,
                    timestamp: Date.now(),
                }).catch(() => undefined);
                const extracted = this.factExtractor.extractFromUtterance(userMessage, {
                    priorAgentText: session.lastAgentText,
                });
                if (extracted && Object.keys(extracted.facts).length > 0) {
                    try {
                        session.memory = await this.customerMemory.applyExtractedFacts(session.callId, extracted);
                        this.logger.log(`[MCube] 🧠 Extracted customer facts: ${JSON.stringify(extracted.facts)}`);
                    }
                    catch {
                    }
                }
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
            if (session.memory?.customer?.name && lead?.id && lead.id !== 'guest-lead') {
                const rawLeadName = (lead.name || '').trim();
                const candidateName = (session.memory.customer.name || '').trim();
                if (candidateName &&
                    (0, call_scripts_1.isPlaceholderLeadName)(rawLeadName) &&
                    !(0, call_scripts_1.isPlaceholderLeadName)(candidateName) &&
                    !call_scripts_1.FORBIDDEN_NAME_WORDS.has(candidateName.toLowerCase())) {
                    lead.name = candidateName;
                    void this.prisma.lead.update({
                        where: { id: lead.id },
                        data: { name: candidateName },
                    }).then(() => {
                        this.logger.log(`[MCube] 👤 Updated lead name in DB from placeholder to: ${candidateName}`);
                    }).catch((e) => this.logger.warn(`[MCube] Failed to update lead name: ${e}`));
                }
            }
            let companyName = settings?.companyName ||
                lead.project?.companyName ||
                lead.project?.builder ||
                'Workains Realty';
            if (!companyName || /saya\s*group/i.test(companyName) || /rgbil/i.test(companyName)) {
                companyName = 'Workains Realty';
            }
            const rawAgent = settings?.agentName || 'Aria';
            const agentName = (0, opener_bank_1.speakAgentName)(rawAgent) || 'Aria';
            const liveTranscript = session.transcript || call?.transcript || 'Agent: Hello?\n';
            const activeLang = settings?.language || call?.languageDetected || 'hinglish';
            const isHinglish = activeLang.toLowerCase().includes('hinglish');
            const speechGender = (0, call_scripts_1.resolveSpeechGender)({
                agentVoice: settings?.agentVoice || 'rachel',
                agentName,
            });
            const userIntent = (0, call_scripts_1.detectIntent)(userMessage);
            if (userIntent.isGreeting) {
                session.consecutiveLivenessChecks = (session.consecutiveLivenessChecks || 0) + 1;
            }
            else {
                session.consecutiveLivenessChecks = 0;
            }
            const follow = (0, call_scripts_1.buildFollowUpReply)({
                transcript: userMessage,
                leadName: (0, call_scripts_1.isPlaceholderLeadName)(lead.name) ? 'जी' : lead.name,
                language: activeLang,
                tone: settings.tone || 'friendly',
                priorTranscript: liveTranscript,
                agentVoice: settings?.agentVoice || 'rachel',
                agentName,
                companyName,
                speechGender,
                isInbound: true,
                consecutiveLivenessChecks: session.consecutiveLivenessChecks,
            });
            let replyText = follow.text;
            let languageDetected = activeLang;
            let ttsChain = Promise.resolve();
            let streamedAnyAudio = false;
            const rawLlmSentences = [];
            const validatedSentences = [];
            const actuallyQueuedSentences = [];
            const actuallySentSentences = [];
            const llmStartTime = Date.now();
            let llmFirstTokenMs = 0;
            let llmFirstSentenceMs = 0;
            let ttsRequestStartMs = null;
            let ttsFirstByteMs = null;
            let ttsFirstAudioMs = null;
            let ttsFirstPlayAudioSentMs = null;
            let fillerTimeout = setTimeout(async () => {
                if (streamedAnyAudio || aborted() || ws.readyState !== ws.OPEN)
                    return;
                try {
                    session.usedFillers = session.usedFillers || [];
                    const filler = (0, call_scripts_1.getThinkingFiller)({
                        language: activeLang,
                        speechGender,
                        userMessage,
                        usedFillers: session.usedFillers,
                    });
                    session.usedFillers.push(filler);
                    this.logger.log(`[MCube] ⏳ AI Filler (Turn #${session.turnCount + 1}): "${filler}"`);
                    const audioBuffer = await this.synthesizeForSession(filler, session, settings);
                    if (audioBuffer && !streamedAnyAudio && !aborted() && ws.readyState === ws.OPEN) {
                        await this.sendPlayAudio(ws, session, audioBuffer);
                    }
                }
                catch {
                }
            }, 800);
            try {
                const result = await this.conversation.reply({
                    lead,
                    userMessage,
                    priorTranscript: liveTranscript,
                    memory: session.memory || (await this.customerMemory.getCallMemory(session.callId)),
                    agentName,
                    companyName,
                    defaultLanguage: activeLang,
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
                    onTextDelta: () => {
                        if (!llmFirstTokenMs) {
                            llmFirstTokenMs = Date.now() - llmStartTime;
                        }
                    },
                    onSentence: (sentence) => {
                        if (!llmFirstTokenMs) {
                            llmFirstTokenMs = Date.now() - llmStartTime;
                        }
                        if (!llmFirstSentenceMs) {
                            llmFirstSentenceMs = Date.now() - llmStartTime;
                        }
                        if (fillerTimeout) {
                            clearTimeout(fillerTimeout);
                            fillerTimeout = null;
                        }
                        const cleaned = (0, phone_audio_1.truncateForPhone)(String(sentence || '').trim(), 300);
                        if (!cleaned)
                            return;
                        rawLlmSentences.push(cleaned);
                        let validatedSentence = cleaned;
                        if (session.memory) {
                            const check = this.questionValidator.validateAndSanitize(session.memory, cleaned);
                            if (check.wasRepeated) {
                                this.logger.log(`[MCube] 🛡️ Anti-Repetition Sanitized: "${cleaned}" ➔ "${check.sanitized}"`);
                            }
                            validatedSentence = check.sanitized;
                        }
                        if (!validatedSentence)
                            return;
                        validatedSentences.push(validatedSentence);
                        actuallyQueuedSentences.push(validatedSentence);
                        this.logger.log(`[MCube] 🤖 AI Speaking: "${validatedSentence}"`);
                        ttsChain = ttsChain
                            .then(async () => {
                            if (aborted() || ws.readyState !== ws.OPEN)
                                return;
                            if (!ttsRequestStartMs)
                                ttsRequestStartMs = Date.now() - llmStartTime;
                            const t0Synth = Date.now();
                            const audioBuffer = await this.synthesizeForSession(validatedSentence, session, settings);
                            if (!ttsFirstByteMs && audioBuffer)
                                ttsFirstByteMs = Date.now() - t0Synth;
                            if (!ttsFirstAudioMs && audioBuffer) {
                                ttsFirstAudioMs = Date.now() - llmStartTime;
                            }
                            if (audioBuffer && !aborted() && ws.readyState === ws.OPEN) {
                                streamedAnyAudio = true;
                                if (!ttsFirstPlayAudioSentMs)
                                    ttsFirstPlayAudioSentMs = Date.now() - llmStartTime;
                                await this.sendPlayAudio(ws, session, audioBuffer, myGen);
                                if (!aborted()) {
                                    actuallySentSentences.push(validatedSentence);
                                    this.logger.log(`[MCube] 🔊 Actually Spoken: "${validatedSentence}"`);
                                }
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
                await ttsChain;
                session.lastLlmAt = Date.now();
                if (rawLlmSentences.length === 0 && !aborted()) {
                    session.lastFailureCondition = 'LLM_NO_RESPONSE';
                    this.logger.warn(`[MCube-Watchdog] [Condition C: LLM_NO_RESPONSE] Gemini LLM produced no sentence for userMessage="${userMessage}" callId=${session.callId}`);
                }
                if (aborted()) {
                    session.cancelPlay = false;
                    session.busy = false;
                    session.busySince = 0;
                    return;
                }
                const rawLlmText = rawLlmSentences.join(' ').trim();
                const validatedText = validatedSentences.join(' ').trim();
                const actuallyQueuedText = actuallyQueuedSentences.join(' ').trim();
                const actuallySentText = actuallySentSentences.join(' ').trim();
                if (actuallySentSentences.length === 0 && aborted()) {
                    this.logger.log(`[MCube] 🛑 Turn cancelled by barge-in before audio was sent. Not recording un-spoken speech.`);
                    session.busy = false;
                    session.busySince = 0;
                    session.cancelPlay = false;
                    return;
                }
                const finalTranscriptText = actuallySentSentences.length > 0
                    ? actuallySentText
                    : (result?.replyText?.trim() || validatedText || rawLlmText);
                replyText = finalTranscriptText;
                this.logger.log(`[MCube] 📝 Transcript Parity: rawLlm="${rawLlmText}" | validated="${validatedText}" | queued="${actuallyQueuedText}" | sent="${actuallySentText}" | final="${finalTranscriptText}"`);
                const llmTotalMs = Date.now() - llmStartTime;
                const turnTotalMs = Date.now() - turnStartTime;
                latency_tracker_1.globalLatencyTracker.recordTurn({
                    sttMs: sttDurationMs,
                    llmFirstTokenMs,
                    llmFirstSentenceMs,
                    ttsFirstByteMs,
                    turnTotalMs,
                });
                const pStats = latency_tracker_1.globalLatencyTracker.getPercentiles();
                this.logger.log(`[MCube] ⚡ Latency Metrics: STT=${sttDurationMs}ms, LLM_first_sentence=${llmFirstSentenceMs ? `${llmFirstSentenceMs}ms` : 'NOT_MEASURED'}, TTS_first_byte=${ttsFirstByteMs != null ? `${ttsFirstByteMs}ms` : 'NOT_MEASURED'}, Turn_total=${turnTotalMs}ms | Rolling (N=${pStats.count}): p50=${pStats.turnTotal.p50}ms, p95=${pStats.turnTotal.p95}ms, p99=${pStats.turnTotal.p99}ms`);
                if (result?.languageDetected) {
                    languageDetected = result.languageDetected;
                }
                if (result?.qualification && lead?.id && lead.id !== 'guest-lead') {
                    if (result.qualification.callerName &&
                        !(0, call_scripts_1.isPlaceholderLeadName)(result.qualification.callerName) &&
                        !call_scripts_1.FORBIDDEN_NAME_WORDS.has(String(result.qualification.callerName).trim().toLowerCase())) {
                        lead.name = result.qualification.callerName;
                    }
                    void this.conversation
                        .applyQualificationToLead(lead.id, {
                        ...result.qualification,
                        projectId: result.resolvedProjectId || undefined,
                    })
                        .catch(() => undefined);
                }
                if (lead?.id && lead.id !== 'guest-lead') {
                    void this.appointments
                        .maybeBookFromCall({
                        leadId: lead.id,
                        projectId: result?.resolvedProjectId || lead.projectId || undefined,
                        userMessage,
                        priorTranscript: session.transcript,
                        qualification: result?.qualification,
                    })
                        .then((booking) => {
                        if (booking.booked) {
                            this.logger.log(`[MCube] 📅 Auto-booked Appointment for lead ${lead.name || lead.phone}: ${booking.date} at ${booking.time} (id=${booking.appointmentId})`);
                        }
                    })
                        .catch((err) => {
                        this.logger.warn(`[MCube] Appointment booking error: ${err}`);
                    });
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
            this.logger.log(`[MCube] 💬 Turn #${session.turnCount + 1}: Caller: "${userMessage}" ➔ AI: "${replyText}"`);
            session.turnCount += 1;
            if (session.callId) {
                void this.customerMemory.recordTurn(session.callId, {
                    role: 'assistant',
                    content: replyText,
                    timestamp: Date.now(),
                }).catch(() => undefined);
                void Promise.resolve(this.customerMemory.updateCallMemory(session.callId, (st) => {
                    st.lastAssistantResponse = replyText;
                })).catch(() => undefined);
                void this.customerMemory.persistMemoryToDb(session.callId).catch(() => undefined);
            }
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
                const cleanReply = (0, phone_audio_1.truncateForPhone)(replyText, 300);
                const audioBuffer = await this.synthesizeForSession(cleanReply, session, settings);
                if (audioBuffer && !aborted() && ws.readyState === ws.OPEN) {
                    await this.sendPlayAudio(ws, session, audioBuffer, myGen);
                }
            }
        }
        catch (err) {
            this.logger.error(`[MCube] Turn failed: ${err instanceof Error ? err.message : err}`);
        }
        finally {
            if (session.turnAbortController === turnAbort) {
                session.turnAbortController = null;
            }
            session.busy = false;
            session.busySince = 0;
            session.activeOperationId = null;
            this.logCallMetrics(session);
        }
    }
    async synthesizeForSession(text, session, settings) {
        const lang = settings?.language || session.settings?.language || 'en-IN';
        const spokenText = (0, phone_audio_1.normalizeTextForSpeech)(text, lang);
        const cacheKey = `${session.encoding}:${lang}:${spokenText}`;
        if (this.ttsCache.has(cacheKey)) {
            const cached = this.ttsCache.get(cacheKey);
            session.lastTtsSuccessAt = Date.now();
            session.audioGeneratedCount++;
            session.audioGeneratedBytes += cached.length;
            return cached;
        }
        try {
            let buf = null;
            if (session.encoding === 'audio/x-l16') {
                const tts = await this.voice.textToSpeech({
                    text: spokenText,
                    speaker: settings?.agentVoice || 'rachel',
                    language: lang,
                    outputFormat: 'pcm_16000',
                    skipSave: true,
                    pace: 1.0,
                    modelId: 'eleven_flash_v2_5',
                    optimizeStreamingLatency: 4,
                });
                buf = (0, phone_audio_1.asNodeBuffer)(Buffer.from(tts.audioBase64, 'base64'));
            }
            else {
                try {
                    const tts = await this.voice.textToSpeech({
                        text: spokenText,
                        speaker: settings?.agentVoice || 'rachel',
                        language: lang,
                        outputFormat: 'ulaw_8000',
                        skipSave: true,
                        pace: 1.0,
                        modelId: 'eleven_flash_v2_5',
                        optimizeStreamingLatency: 4,
                    });
                    buf = (0, phone_audio_1.asNodeBuffer)(Buffer.from(tts.audioBase64, 'base64'));
                }
                catch {
                    const tts = await this.voice.textToSpeech({
                        text: spokenText,
                        speaker: settings?.agentVoice || 'rachel',
                        language: lang,
                        outputFormat: 'pcm_16000',
                        skipSave: true,
                        pace: 1.0,
                        modelId: 'eleven_flash_v2_5',
                        optimizeStreamingLatency: 4,
                    });
                    const pcm16k = (0, phone_audio_1.asNodeBuffer)(Buffer.from(tts.audioBase64, 'base64'));
                    buf = (0, phone_audio_1.pcm16ToMulaw)((0, phone_audio_1.downsamplePcm16)(pcm16k, 16000, 8000));
                }
            }
            if (buf && buf.length > 0) {
                if (this.ttsCache.size < 300 && spokenText.length < 180) {
                    this.ttsCache.set(cacheKey, buf);
                }
                session.lastTtsSuccessAt = Date.now();
                session.audioGeneratedCount++;
                session.audioGeneratedBytes += buf.length;
                return buf;
            }
            session.lastFailureCondition = 'TTS_SYNTHESIS_FAILED';
            this.logger.warn(`[MCube-Watchdog] [Condition D: TTS_SYNTHESIS_FAILED] ElevenLabs returned empty audio for text="${text.slice(0, 60)}" callId=${session.callId}`);
            return null;
        }
        catch (err) {
            session.lastFailureCondition = 'TTS_SYNTHESIS_FAILED';
            this.logger.error(`[MCube-Watchdog] [Condition D: TTS_SYNTHESIS_FAILED] TTS failed: ${err instanceof Error ? err.message : err} callId=${session.callId}`);
            return null;
        }
    }
    async sendPlayAudio(ws, session, audioBuffer, expectedGen) {
        if (ws.readyState !== ws.OPEN ||
            !session.streamId ||
            session.closed ||
            session.cancelPlay ||
            (expectedGen !== undefined && expectedGen !== session.flushGen)) {
            if (audioBuffer && audioBuffer.length > 0 && !session.closed) {
                session.lastFailureCondition = 'TTS_NOT_TRANSMITTED';
                this.logger.warn(`[MCube-Watchdog] [Condition E: TTS_NOT_TRANSMITTED] Audio chunk (${audioBuffer.length}b) dropped: cancelPlay=${session.cancelPlay}, closed=${session.closed}, genMismatch=${expectedGen !== undefined && expectedGen !== session.flushGen} callId=${session.callId}`);
            }
            return;
        }
        const segmentName = `seg_${(0, crypto_1.randomUUID)().slice(0, 8)}`;
        session.pendingSegments.add(segmentName);
        session.segmentBytes.set(segmentName, audioBuffer.length);
        session.agentPlaying = true;
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
        session.lastAudioChunkSentAt = Date.now();
        session.lastAudioChunkSegment = segmentName;
        session.outboundFrameCount++;
        session.audioTransmittedCount++;
        session.audioTransmittedBytes += audioBuffer.length;
        session.lastOutboundAudioAt = Date.now();
        session.lastMcubeTransmitAt = Date.now();
        this.logger.debug(`[MCube-AudioLifecycle] [Step 5: AUDIO_CHUNK_SENT] Sent segment=${segmentName} streamId=${session.streamId} gen=${expectedGen} size=${audioBuffer.length}b`);
    }
    sendClearAudio(ws, streamId) {
        if (ws.readyState !== ws.OPEN || !streamId)
            return;
        try {
            ws.send(JSON.stringify({ event: 'clearAudio', streamId }));
            ws.send(JSON.stringify({ event: 'clear', streamId }));
        }
        catch (err) {
            this.logger.warn(`[MCube] sendClearAudio error: ${err}`);
        }
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
    runSessionWatchdog(ws, session) {
        if (session.closed)
            return;
        const now = Date.now();
        session.wsReadyState = ws.readyState;
        if (ws.readyState === 1 && session.callId && !this.activeSessions.has(session.callId)) {
            session.lastFailureCondition = 'SESSION_EXPIRED_WHILE_ACTIVE';
            this.activeSessions.set(session.callId, session);
            this.logger.error(`[MCube-Watchdog] [Condition H: SESSION_EXPIRED_WHILE_ACTIVE] Active session was missing from map for connected callId=${session.callId}; re-registered.`);
        }
        if (session.inboundFrameCount === 0 && now - session.sessionStartedAt > 30000) {
            session.lastFailureCondition = 'NO_INBOUND_AUDIO';
            this.logger.warn(`[MCube-Watchdog] [Condition A: NO_INBOUND_AUDIO] No inbound audio received after ${now - session.sessionStartedAt}ms callId=${session.callId}`);
        }
        else if (session.inboundFrameCount > 0 &&
            session.lastInboundAudioAt > 0 &&
            now - session.lastInboundAudioAt > 60000) {
            session.lastFailureCondition = 'NO_INBOUND_AUDIO';
            this.logger.debug(`[MCube-Watchdog] [Condition A: NO_INBOUND_AUDIO] Caller audio inactive for ${now - session.lastInboundAudioAt}ms callId=${session.callId}`);
        }
        if (session.pendingSegments.size > 0 &&
            session.lastAudioChunkSentAt &&
            now - session.lastAudioChunkSentAt > 20000) {
            session.lastFailureCondition = 'MCUBE_PLAYBACK_UNACKNOWLEDGED';
            let drainedBytes = 0;
            for (const seg of session.pendingSegments) {
                drainedBytes += session.segmentBytes.get(seg) || 0;
            }
            session.audioInferredDrainCount += session.pendingSegments.size;
            session.audioInferredDrainBytes += drainedBytes;
            this.logger.warn(`[MCube-Watchdog] [Condition F: MCUBE_PLAYBACK_UNACKNOWLEDGED] MCube unacknowledged playback for ${now - session.lastAudioChunkSentAt}ms pending=${session.pendingSegments.size} (${drainedBytes}b inferred drain) callId=${session.callId}`);
            session.pendingSegments.clear();
            session.segmentBytes.clear();
            session.agentPlaying = false;
        }
        if (session.busy && session.busySince > 0 && now - session.busySince > 15000) {
            session.recoveryAttempts++;
            const stuckOp = session.activeOperationId || 'unknown';
            const priorGen = session.flushGen;
            if (session.turnAbortController) {
                session.turnAbortController.abort();
                session.turnAbortController = null;
            }
            session.flushGen++;
            session.pendingSegments.clear();
            session.segmentBytes.clear();
            session.agentPlaying = false;
            session.busy = false;
            session.busySince = 0;
            session.activeOperationId = null;
            this.logger.warn(`[MCube-Watchdog] ⚠️ Pipeline Self-Healing: Aborted stuck operation ${stuckOp} (gen=${priorGen} -> ${session.flushGen}) after ${now - session.busySince}ms for callId=${session.callId}`);
        }
        if (session.cancelPlay &&
            !session.agentPlaying &&
            now - (session.lastAudioChunkSentAt || session.sessionStartedAt) > 10000) {
            session.cancelPlay = false;
            this.logger.log(`[MCube-Watchdog] 🔄 Pipeline Self-Healing: Reset cancelPlay flag after 10s cooldown callId=${session.callId}`);
        }
        if (session.heartbeatPingAt > 0 &&
            session.heartbeatPongAt > 0 &&
            session.heartbeatPingAt - session.heartbeatPongAt > 45000) {
            session.missedPings++;
            this.logger.warn(`[MCube-Watchdog] ⚠️ Stale connection detected: ping/pong latency ${session.heartbeatPingAt - session.heartbeatPongAt}ms callId=${session.callId}`);
        }
    }
    logCallMetrics(session) {
        const versionTelemetry = (0, version_1.getVersionTelemetry)();
        const now = Date.now();
        let heartbeatStatus = 'INITIALIZING';
        if (session.heartbeatPingAt > 0) {
            if (session.missedPings >= 2) {
                heartbeatStatus = 'DEAD';
            }
            else if (session.missedPings === 1) {
                heartbeatStatus = 'DEGRADED';
            }
            else if (session.heartbeatPongAt > 0) {
                heartbeatStatus = 'HEALTHY';
            }
        }
        this.logger.log(`[MCube-Metrics] ${JSON.stringify({
            callId: session.callId,
            streamId: session.streamId,
            appVersion: versionTelemetry.version,
            commitSha: versionTelemetry.commitSha,
            deploymentId: versionTelemetry.deploymentId,
            sessionAgeMs: now - session.sessionStartedAt,
            inboundFrames: session.inboundFrameCount,
            outboundFrames: session.outboundFrameCount,
            audioGeneratedCount: session.audioGeneratedCount,
            audioGeneratedBytes: session.audioGeneratedBytes,
            audioTransmittedCount: session.audioTransmittedCount,
            audioTransmittedBytes: session.audioTransmittedBytes,
            audioProviderAcceptedCount: session.audioProviderAcceptedCount,
            audioProviderAcceptedBytes: session.audioProviderAcceptedBytes,
            audioConfirmedPlayedCount: session.audioConfirmedPlayedCount,
            audioConfirmedPlayedBytes: session.audioConfirmedPlayedBytes,
            audioInferredDrainCount: session.audioInferredDrainCount,
            audioInferredDrainBytes: session.audioInferredDrainBytes,
            audioPlayedCount: session.audioPlayedCount,
            audioPlayedBytes: session.audioPlayedBytes,
            lastInboundAudioAgeMs: session.lastInboundAudioAt ? now - session.lastInboundAudioAt : null,
            lastOutboundAudioAgeMs: session.lastOutboundAudioAt ? now - session.lastOutboundAudioAt : null,
            heartbeatStatus,
            heartbeatRttMs: session.heartbeatRttMs,
            wsCloseCode: session.wsCloseCode,
            audioPipelineState: session.busy ? 'BUSY' : session.agentPlaying ? 'PLAYING' : 'IDLE',
            operationLifecycleState: session.operationState,
            lastCancellationReason: session.lastCancellationReason,
            recoveryAttempts: session.recoveryAttempts,
            failureReason: session.lastFailureCondition || 'NONE',
        })}`);
    }
    getCallMetrics(callId) {
        const session = this.activeSessions.get(callId) || this.reconnectCache.get(callId)?.session;
        if (!session)
            return null;
        const versionTelemetry = (0, version_1.getVersionTelemetry)();
        const now = Date.now();
        let heartbeatStatus = 'INITIALIZING';
        if (session.heartbeatPingAt > 0) {
            if (session.missedPings >= 2) {
                heartbeatStatus = 'DEAD';
            }
            else if (session.missedPings === 1) {
                heartbeatStatus = 'DEGRADED';
            }
            else if (session.heartbeatPongAt > 0) {
                heartbeatStatus = 'HEALTHY';
            }
        }
        return {
            callId: session.callId,
            streamId: session.streamId,
            appVersion: versionTelemetry.version,
            commitSha: versionTelemetry.commitSha,
            deploymentId: versionTelemetry.deploymentId,
            sessionAgeMs: now - session.sessionStartedAt,
            inboundFrames: session.inboundFrameCount,
            outboundFrames: session.outboundFrameCount,
            audioGeneratedCount: session.audioGeneratedCount,
            audioGeneratedBytes: session.audioGeneratedBytes,
            audioTransmittedCount: session.audioTransmittedCount,
            audioTransmittedBytes: session.audioTransmittedBytes,
            audioProviderAcceptedCount: session.audioProviderAcceptedCount,
            audioProviderAcceptedBytes: session.audioProviderAcceptedBytes,
            audioConfirmedPlayedCount: session.audioConfirmedPlayedCount,
            audioConfirmedPlayedBytes: session.audioConfirmedPlayedBytes,
            audioInferredDrainCount: session.audioInferredDrainCount,
            audioInferredDrainBytes: session.audioInferredDrainBytes,
            audioPlayedCount: session.audioPlayedCount,
            audioPlayedBytes: session.audioPlayedBytes,
            lastInboundAudioAgeMs: session.lastInboundAudioAt ? now - session.lastInboundAudioAt : null,
            lastOutboundAudioAgeMs: session.lastOutboundAudioAt ? now - session.lastOutboundAudioAt : null,
            heartbeatStatus,
            heartbeatRttMs: session.heartbeatRttMs,
            wsCloseCode: session.wsCloseCode,
            audioPipelineState: session.busy ? 'BUSY' : session.agentPlaying ? 'PLAYING' : 'IDLE',
            operationLifecycleState: session.operationState,
            lastCancellationReason: session.lastCancellationReason,
            recoveryAttempts: session.recoveryAttempts,
            failureReason: session.lastFailureCondition || 'NONE',
        };
    }
    getActiveSession(callId) {
        return this.activeSessions.get(callId);
    }
    getReconnectCache(callId) {
        return this.reconnectCache.get(callId);
    }
};
exports.McubeStreamService = McubeStreamService;
exports.McubeStreamService = McubeStreamService = McubeStreamService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        ai_service_1.AiService,
        voice_service_1.VoiceService,
        conversation_service_1.ConversationService,
        customer_memory_service_1.CustomerMemoryService,
        fact_extractor_service_1.FactExtractorService,
        question_validator_service_1.QuestionValidatorService,
        appointments_service_1.AppointmentsService])
], McubeStreamService);
//# sourceMappingURL=mcube-stream.service.js.map