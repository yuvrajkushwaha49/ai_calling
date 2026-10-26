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
var CallsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const voice_service_1 = require("../voice/voice.service");
const exotel_service_1 = require("./exotel.service");
const twilio_service_1 = require("./twilio.service");
const mcube_service_1 = require("./mcube.service");
const conversation_service_1 = require("../conversation/conversation.service");
const appointments_service_1 = require("../appointments/appointments.service");
const interest_score_1 = require("../conversation/interest-score");
const hindi_romanize_1 = require("../elevenlabs/hindi-romanize");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
let CallsService = CallsService_1 = class CallsService {
    prisma;
    aiService;
    voice;
    exotel;
    twilio;
    mcube;
    conversation;
    appointments;
    logger = new common_1.Logger(CallsService_1.name);
    constructor(prisma, aiService, voice, exotel, twilio, mcube, conversation, appointments) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.voice = voice;
        this.exotel = exotel;
        this.twilio = twilio;
        this.mcube = mcube;
        this.conversation = conversation;
        this.appointments = appointments;
    }
    elapsedSeconds(createdAt, previous = 0) {
        const elapsed = Math.floor((Date.now() - createdAt.getTime()) / 1000);
        return Math.max(previous || 0, elapsed, 0);
    }
    findAll() {
        return this.prisma.call.findMany({
            include: {
                lead: { select: { id: true, name: true, phone: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id) {
        const call = await this.prisma.call.findUnique({
            where: { id },
            include: {
                lead: {
                    include: {
                        project: {
                            select: {
                                id: true,
                                name: true,
                                companyName: true,
                                builder: true,
                                location: true,
                                startingPrice: true,
                                endingPrice: true,
                                reraNumber: true,
                                possessionDate: true,
                                amenities: true,
                                description: true,
                            },
                        },
                    },
                },
            },
        });
        if (!call)
            throw new common_1.NotFoundException('Call not found');
        return call;
    }
    async create(dto) {
        const call = await this.prisma.call.create({
            data: dto,
            include: { lead: { select: { id: true, name: true, phone: true } } },
        });
        await this.prisma.activity.create({
            data: {
                leadId: dto.leadId,
                type: 'CALL_LOGGED',
                description: `Call logged - ${dto.outcome || 'CONNECTED'}`,
            },
        });
        return call;
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.call.update({
            where: { id },
            data: dto,
            include: { lead: { select: { id: true, name: true, phone: true } } },
        });
    }
    async remove(id) {
        await this.findOne(id);
        return this.prisma.call.delete({ where: { id } });
    }
    async startOutboundCall(leadId, options) {
        const lead = await this.prisma.lead.findUnique({
            where: { id: leadId },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        companyName: true,
                        builder: true,
                        location: true,
                        startingPrice: true,
                        endingPrice: true,
                        reraNumber: true,
                        possessionDate: true,
                        amenities: true,
                        description: true,
                    },
                },
            },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        if (!lead.phone?.trim()) {
            throw new common_1.BadRequestException('Lead does not have a phone number');
        }
        if (lead.doNotCall) {
            throw new common_1.BadRequestException('Lead is on Do Not Call list');
        }
        if (!lead.consentToCall) {
            throw new common_1.BadRequestException('Lead has not consented to calls');
        }
        const settings = await this.aiService.getSettings();
        if (!settings.isActive) {
            throw new common_1.BadRequestException('AI agent is inactive. Enable it in AI Settings.');
        }
        if (lead.projectId) {
            void this.conversation
                .ensureProjectKnowledge(lead.projectId)
                .catch((err) => this.logger.warn(`Knowledge prefetch failed: ${err instanceof Error ? err.message : err}`));
        }
        const agentName = settings.agentName || 'Real Estate AI Agent';
        const opening = await this.conversation.buildOpening({
            lead,
            agentName,
            companyName: settings.companyName ||
                lead.project?.companyName ||
                lead.project?.builder ||
                'Saya Group',
            language: settings.language || lead.preferredLanguage || 'hi-IN',
            tone: settings.tone || 'friendly',
            agentVoice: settings.agentVoice || 'rachel',
            openerLearning: settings.approvedPlaybook,
        });
        const greetingText = opening.text;
        const tts = await this.voice.textToSpeech({
            text: greetingText,
            speaker: settings.agentVoice || 'rachel',
            language: opening.language || settings.language || 'hi-IN',
        });
        const audioUrl = `${this.twilio.getPublicBaseUrl()}/api/calls/audio/${tts.fileName}`;
        const requestedProvider = options?.provider;
        const isBrowserDemo = options?.browserDemo === true ||
            requestedProvider === 'browser-demo' ||
            (!requestedProvider &&
                !this.twilio.isConfigured() &&
                !this.mcube.isConfigured() &&
                !this.exotel.isConfigured());
        const activeProvider = isBrowserDemo
            ? 'browser-demo'
            : requestedProvider
                ? requestedProvider
                : this.mcube.isConfigured()
                    ? 'mcube'
                    : this.twilio.isConfigured()
                        ? 'twilio'
                        : 'exotel';
        void this.aiService.recordOpenerUse(opening.openerStyle).catch(() => undefined);
        const call = await this.prisma.call.create({
            data: {
                leadId,
                projectId: lead.projectId || undefined,
                campaignId: options?.campaignId,
                status: isBrowserDemo ? client_1.CallStatus.COMPLETED : client_1.CallStatus.INITIATED,
                outcome: client_1.CallOutcome.CONNECTED,
                provider: activeProvider,
                greetingText,
                recordingUrl: audioUrl,
                transcript: `Agent: ${greetingText}`,
                languageDetected: opening.language,
                qualificationJson: {
                    openerStyle: opening.openerStyle,
                    needsProjectDiscovery: !lead.projectId,
                },
                summary: isBrowserDemo
                    ? lead.projectId
                        ? 'Browser demo call with AI voice greeting'
                        : 'Browser demo — agent will discover project on call'
                    : `Outbound AI call initiated via ${activeProvider.toUpperCase()}`,
            },
            include: {
                lead: {
                    select: { id: true, name: true, phone: true, projectId: true },
                },
                project: { select: { id: true, name: true, location: true } },
            },
        });
        const projectLabel = lead.project?.name || 'no project linked';
        await this.prisma.activity.create({
            data: {
                leadId,
                type: 'CALL_STARTED',
                description: isBrowserDemo
                    ? `Browser AI voice demo started for ${lead.name} (${projectLabel})`
                    : `AI outbound call (${activeProvider}) started to ${lead.phone} (${projectLabel})`,
            },
        });
        const knowledgeSources = lead.projectId
            ? await this.prisma.projectKnowledgeSource.findMany({
                where: { projectId: lead.projectId, status: 'READY' },
                select: {
                    id: true,
                    title: true,
                    sourceType: true,
                    fileName: true,
                    sourceUrl: true,
                },
                take: 20,
            })
            : [];
        if (isBrowserDemo) {
            return {
                ...call,
                status: client_1.CallStatus.COMPLETED,
                demoMode: true,
                audioUrl,
                audioBase64: tts.audioBase64,
                mimeType: tts.mimeType || 'audio/mpeg',
                greetingText,
                agentName,
                agentVoice: settings.agentVoice || 'rachel',
                project: lead.project,
                knowledgeSources,
                message: 'Browser demo ready. Listen to the AI agent greeting.',
            };
        }
        if (activeProvider === 'mcube') {
            try {
                const mcubeRes = await this.mcube.createOutboundCall({
                    to: lead.phone,
                    callId: call.id,
                });
                return this.prisma.call.update({
                    where: { id: call.id },
                    data: {
                        providerCallId: mcubeRes.callId,
                        status: client_1.CallStatus.INITIATED,
                        summary: 'Live MCube outbound call initiated',
                    },
                    include: {
                        lead: { select: { id: true, name: true, phone: true } },
                        project: { select: { id: true, name: true } },
                    },
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'MCube call failed';
                this.logger.error(message);
                await this.prisma.call.update({
                    where: { id: call.id },
                    data: {
                        status: client_1.CallStatus.FAILED,
                        outcome: client_1.CallOutcome.NO_ANSWER,
                        summary: message,
                    },
                });
                throw new common_1.BadRequestException(message);
            }
        }
        if (activeProvider === 'exotel') {
            try {
                const { sid } = await this.exotel.createOutboundCall({
                    to: lead.phone,
                    callId: call.id,
                });
                return this.prisma.call.update({
                    where: { id: call.id },
                    data: {
                        providerCallId: sid,
                        status: client_1.CallStatus.RINGING,
                        summary: 'Live Exotel outbound call ringing',
                    },
                    include: {
                        lead: { select: { id: true, name: true, phone: true } },
                        project: { select: { id: true, name: true } },
                    },
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Exotel call failed';
                this.logger.error(message);
                await this.prisma.call.update({
                    where: { id: call.id },
                    data: {
                        status: client_1.CallStatus.FAILED,
                        outcome: client_1.CallOutcome.NO_ANSWER,
                        summary: message,
                    },
                });
                throw new common_1.BadRequestException(message);
            }
        }
        try {
            const { sid } = await this.twilio.createOutboundCall({
                to: lead.phone,
                callId: call.id,
            });
            return this.prisma.call.update({
                where: { id: call.id },
                data: {
                    providerCallId: sid,
                    status: client_1.CallStatus.RINGING,
                    summary: 'Live Twilio outbound call ringing',
                },
                include: {
                    lead: { select: { id: true, name: true, phone: true } },
                    project: { select: { id: true, name: true } },
                },
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Twilio call failed';
            this.logger.error(message);
            await this.prisma.call.update({
                where: { id: call.id },
                data: {
                    status: client_1.CallStatus.FAILED,
                    outcome: client_1.CallOutcome.NO_ANSWER,
                    summary: message,
                },
            });
            throw new common_1.BadRequestException(message);
        }
    }
    async resolveExotelCallId(callId, params) {
        if (callId?.trim())
            return callId.trim();
        const from = params.CallFrom ||
            params.From ||
            params.from ||
            params.CallFromNumber ||
            '';
        if (!from)
            return null;
        const digits = from.replace(/\D/g, '');
        const last10 = digits.slice(-10);
        if (last10.length < 10)
            return null;
        const recent = await this.prisma.call.findFirst({
            where: {
                provider: 'exotel',
                status: {
                    in: [
                        client_1.CallStatus.INITIATED,
                        client_1.CallStatus.RINGING,
                        client_1.CallStatus.IN_PROGRESS,
                    ],
                },
                lead: { phone: { contains: last10 } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return recent?.id || null;
    }
    async getExotelGreetingPayload(callId, params = {}) {
        const resolved = await this.resolveExotelCallId(callId, params);
        this.logger.log(`Exotel greeting hit callId=${callId || '-'} resolved=${resolved || '-'} from=${params.CallFrom || params.From || '-'}`);
        const mode = String(process.env.EXOTEL_GREETING_MODE || 'audio').toLowerCase();
        const preferAudio = mode !== 'text';
        const fallbackText = 'Namaste, main Neha bol rahi hoon Saya Group se. Kya abhi do minute baat ho sakti hai?';
        const call = resolved
            ? await this.prisma.call.findUnique({ where: { id: resolved } })
            : null;
        if (!call) {
            this.logger.warn(`Exotel greeting without known call — using fallback (resolved=${resolved || '-'})`);
            return {
                type: 'text',
                value: fallbackText,
            };
        }
        const settings = await this.aiService.getSettings();
        const greeting = call.greetingText?.trim() || fallbackText;
        await this.prisma.call.update({
            where: { id: call.id },
            data: { status: client_1.CallStatus.IN_PROGRESS },
        });
        if (preferAudio) {
            const tts = await this.voice.textToSpeech({
                text: greeting,
                speaker: settings.agentVoice || 'rachel',
                language: call.languageDetected || settings.language || 'hi-IN',
                outputFormat: 'mp3_22050_32',
            });
            const audioUrl = `${this.exotel.getPublicBaseUrl()}/api/calls/audio/${tts.fileName}`;
            await this.prisma.call.update({
                where: { id: call.id },
                data: { recordingUrl: audioUrl },
            });
            this.logger.log(`Exotel greeting audio → ${audioUrl}`);
            return {
                type: 'audio_url',
                value: audioUrl,
            };
        }
        const spoken = (0, hindi_romanize_1.hasDevanagari)(greeting)
            ? (0, hindi_romanize_1.devanagariToRoman)(greeting)
            : greeting;
        return {
            type: 'text',
            value: spoken.replace(/\s+/g, ' ').trim().slice(0, 500),
        };
    }
    async handleExotelPassthru(params) {
        const callId = params.CustomField || params.customField || params.callId || '';
        const id = await this.resolveExotelCallId(callId, params);
        if (id && params.CallSid) {
            await this.prisma.call.update({
                where: { id },
                data: {
                    providerCallId: params.CallSid,
                    status: client_1.CallStatus.IN_PROGRESS,
                },
            });
        }
        return { ok: true };
    }
    async getTwilioVoiceTwiml(callId, params = {}) {
        const id = callId?.trim() || params.callId || params.CallId || '';
        const call = id
            ? await this.prisma.call.findUnique({ where: { id } })
            : null;
        if (call) {
            await this.prisma.call.update({
                where: { id: call.id },
                data: {
                    status: client_1.CallStatus.IN_PROGRESS,
                    providerCallId: params.CallSid || call.providerCallId || undefined,
                },
            });
        }
        return this.twilio.buildVoiceTwiml({
            callId: call?.id || id || 'unknown',
            greetingAudioUrl: call?.recordingUrl || null,
            greetingText: call?.greetingText ||
                'Namaste, main Neha bol rahi hoon Saya Group se. Kya abhi do minute baat ho sakti hai?',
        });
    }
    async handleTwilioStatusWebhook(callId, body) {
        const id = callId?.trim() || body.callId || body.CallId || '';
        let call = id
            ? await this.prisma.call.findUnique({ where: { id } })
            : null;
        if (!call && body.CallSid) {
            call = await this.prisma.call.findFirst({
                where: { providerCallId: body.CallSid },
            });
        }
        if (!call) {
            this.logger.warn('Twilio status webhook without matching call');
            return { ok: true };
        }
        const status = String(body.CallStatus || body.Status || '').toLowerCase();
        const map = {
            queued: client_1.CallStatus.INITIATED,
            initiated: client_1.CallStatus.INITIATED,
            ringing: client_1.CallStatus.RINGING,
            'in-progress': client_1.CallStatus.IN_PROGRESS,
            completed: client_1.CallStatus.COMPLETED,
            busy: client_1.CallStatus.FAILED,
            failed: client_1.CallStatus.FAILED,
            'no-answer': client_1.CallStatus.NO_ANSWER,
            canceled: client_1.CallStatus.FAILED,
        };
        const mapped = map[status];
        const duration = Number(body.CallDuration || body.Duration || NaN);
        if (mapped) {
            await this.prisma.call.update({
                where: { id: call.id },
                data: {
                    status: mapped,
                    providerCallId: body.CallSid || call.providerCallId || undefined,
                    ...(Number.isFinite(duration)
                        ? { duration: Math.round(duration) }
                        : {}),
                    ...(mapped === client_1.CallStatus.NO_ANSWER || mapped === client_1.CallStatus.FAILED
                        ? { outcome: client_1.CallOutcome.NO_ANSWER }
                        : {}),
                    ...(mapped === client_1.CallStatus.COMPLETED
                        ? { summary: call.summary || 'Twilio call completed' }
                        : {}),
                },
            });
        }
        return { ok: true };
    }
    async handleExotelStatusWebhook(callId, body) {
        const id = await this.resolveExotelCallId(callId, body);
        if (!id) {
            this.logger.warn('Exotel status webhook without matching call id');
            return { ok: true };
        }
        const status = String(body.Status || body.CallStatus || body.status || '').toLowerCase();
        const map = {
            queued: client_1.CallStatus.INITIATED,
            'in-progress': client_1.CallStatus.IN_PROGRESS,
            'in_progress': client_1.CallStatus.IN_PROGRESS,
            ringing: client_1.CallStatus.RINGING,
            completed: client_1.CallStatus.COMPLETED,
            busy: client_1.CallStatus.FAILED,
            failed: client_1.CallStatus.FAILED,
            'no-answer': client_1.CallStatus.NO_ANSWER,
            'no_answer': client_1.CallStatus.NO_ANSWER,
            canceled: client_1.CallStatus.FAILED,
            cancelled: client_1.CallStatus.FAILED,
        };
        const mapped = map[status];
        const duration = Number(body.ConversationDuration ||
            body.DialCallDuration ||
            body.Duration ||
            body.CallDuration ||
            NaN);
        if (mapped && mapped !== client_1.CallStatus.COMPLETED) {
            const data = { status: mapped };
            if (body.CallSid)
                data.providerCallId = body.CallSid;
            if (Number.isFinite(duration))
                data.duration = duration;
            if (mapped === client_1.CallStatus.NO_ANSWER)
                data.outcome = client_1.CallOutcome.NO_ANSWER;
            if (mapped === client_1.CallStatus.FAILED)
                data.outcome = client_1.CallOutcome.NO_ANSWER;
            await this.prisma.call.update({ where: { id }, data });
            return { ok: true };
        }
        const recordingUrl = body.RecordingUrl || body.recording_url || '';
        if (recordingUrl || mapped === client_1.CallStatus.COMPLETED || !mapped) {
            await this.processExotelRecording(id, {
                RecordingUrl: recordingUrl,
                RecordingDuration: String(Number.isFinite(duration) ? duration : body.RecordingDuration || ''),
                CallSid: body.CallSid,
            });
        }
        return { ok: true };
    }
    async processExotelRecording(callId, body) {
        const call = await this.findOne(callId);
        const settings = await this.aiService.getSettings();
        const recordingUrl = body.RecordingUrl;
        const duration = Number(body.RecordingDuration || 0);
        let leadTranscript = '';
        let followUpText = '';
        let outcome = client_1.CallOutcome.CONNECTED;
        if (recordingUrl) {
            try {
                const candidates = [
                    recordingUrl,
                    recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`,
                    recordingUrl.endsWith('.wav') ? recordingUrl : `${recordingUrl}.wav`,
                ];
                let buffer = null;
                for (const url of candidates) {
                    try {
                        const audioRes = await fetch(url);
                        if (!audioRes.ok)
                            continue;
                        buffer = Buffer.from(await audioRes.arrayBuffer());
                        if (buffer.length > 0)
                            break;
                    }
                    catch {
                    }
                }
                if (!buffer?.length) {
                    throw new Error('Could not download Exotel recording');
                }
                const fileName = `stt-${(0, crypto_1.randomUUID)()}.wav`;
                const filePath = path.join(process.cwd(), 'uploads', 'audio', fileName);
                fs.writeFileSync(filePath, buffer);
                const stt = await this.voice.speechToText({
                    filePath,
                    language: call.languageDetected || settings.language || 'hi-IN',
                });
                leadTranscript = stt.transcript.trim();
                const fullLead = await this.prisma.lead.findUnique({
                    where: { id: call.leadId },
                    include: {
                        project: {
                            select: {
                                id: true,
                                name: true,
                                companyName: true,
                                builder: true,
                                location: true,
                                startingPrice: true,
                                endingPrice: true,
                                reraNumber: true,
                                possessionDate: true,
                                amenities: true,
                                description: true,
                            },
                        },
                    },
                });
                if (leadTranscript) {
                    const result = await this.conversation.reply({
                        lead: fullLead,
                        userMessage: leadTranscript,
                        priorTranscript: call.transcript,
                        agentName: settings.agentName || 'Real Estate AI Agent',
                        companyName: settings.companyName ||
                            fullLead?.project?.companyName ||
                            fullLead?.project?.builder,
                        defaultLanguage: call.languageDetected || settings.language || 'hi-IN',
                        tone: settings.tone || 'friendly',
                        systemPrompt: settings.systemPrompt || undefined,
                        llmModel: settings.llmModel ||
                            'gemini-3.5-flash-lite',
                        approvedPlaybook: settings
                            .approvedPlaybook,
                        agentVoice: settings.agentVoice || 'rachel',
                    });
                    followUpText = result.replyText;
                    outcome = this.conversation.mapOutcomeEnum(String(result.qualification.outcome || 'CONNECTED'));
                    if (result.resolvedProjectId && !fullLead?.projectId) {
                        await this.prisma.lead.update({
                            where: { id: call.leadId },
                            data: { projectId: result.resolvedProjectId },
                        });
                        await this.prisma.call.update({
                            where: { id: callId },
                            data: { projectId: result.resolvedProjectId },
                        });
                    }
                    await this.conversation.applyQualificationToLead(call.leadId, result.qualification);
                    const booking = await this.appointments.maybeBookFromCall({
                        leadId: call.leadId,
                        projectId: call.projectId ||
                            fullLead?.projectId ||
                            result.resolvedProjectId,
                        userMessage: leadTranscript,
                        priorTranscript: call.transcript,
                        qualification: result.qualification,
                    });
                    if (booking.booked) {
                        outcome = client_1.CallOutcome.SITE_VISIT_INTERESTED;
                        const confirm = this.appointments.confirmationLine(booking, result.languageDetected);
                        if (confirm &&
                            !/calendar|मीटिंग.*सेट|booked your meeting/i.test(followUpText)) {
                            followUpText = `${followUpText.replace(/\s+$/, '')} ${confirm}`;
                        }
                    }
                }
            }
            catch (error) {
                this.logger.error(`Exotel STT/follow-up failed: ${error instanceof Error ? error.message : error}`);
                followUpText =
                    'Thank you for your time. Our team will follow up with you shortly.';
                outcome = client_1.CallOutcome.CONNECTED;
            }
        }
        const transcriptParts = [
            call.transcript ||
                (call.greetingText ? `Agent: ${call.greetingText}` : ''),
            leadTranscript ? `Lead: ${leadTranscript}` : '',
            followUpText ? `Agent: ${followUpText}` : '',
        ].filter(Boolean);
        await this.prisma.call.update({
            where: { id: callId },
            data: {
                duration: Number.isFinite(duration) && duration > 0 ? duration : call.duration,
                transcript: transcriptParts.join('\n'),
                summary: leadTranscript
                    ? `Lead said: ${leadTranscript.slice(0, 180)}`
                    : 'Exotel call completed',
                recordingUrl: recordingUrl || call.recordingUrl,
                outcome,
                status: client_1.CallStatus.COMPLETED,
                providerCallId: body.CallSid || call.providerCallId,
            },
        });
        await this.prisma.activity.create({
            data: {
                leadId: call.leadId,
                type: 'CALL_COMPLETED',
                description: 'AI outbound call completed via Exotel (STT + LLM/RAG)',
            },
        });
        void this.aiService
            .learnFromCompletedCall({
            callId,
            outcome: String(outcome),
            transcript: transcriptParts.join('\n'),
            interestScore: call.interestScore,
        })
            .catch((err) => this.logger.warn(`Auto-learn failed: ${err instanceof Error ? err.message : err}`));
    }
    async demoTurn(body, onEvent) {
        const emit = async (event) => {
            if (!onEvent)
                return;
            await onEvent(event);
        };
        const streamMode = Boolean(onEvent);
        const [call, settings] = await Promise.all([
            this.findOne(body.callId),
            this.aiService.getSettings(),
        ]);
        const lead = call.lead;
        if (!lead)
            throw new common_1.NotFoundException('Lead missing on call');
        let userMessage = body.message?.trim() || '';
        if (!userMessage && body.audioBase64) {
            const fileName = body.fileName || `demo-${(0, crypto_1.randomUUID)()}.webm`;
            const filePath = path.join(process.cwd(), 'uploads', 'audio', fileName);
            fs.writeFileSync(filePath, Buffer.from(body.audioBase64, 'base64'));
            const stt = await this.voice.speechToText({
                filePath,
                language: call.languageDetected ||
                    lead.preferredLanguage ||
                    settings.language ||
                    'hi-IN',
            });
            userMessage = stt.transcript.trim();
        }
        if (!userMessage) {
            throw new common_1.BadRequestException('Please type a message or record audio');
        }
        const previousAgent = (() => {
            const lines = (call.transcript || '')
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);
            for (let i = lines.length - 1; i >= 0; i--) {
                if (/^agent:/i.test(lines[i])) {
                    return lines[i].replace(/^agent:\s*/i, '').trim();
                }
            }
            return '';
        })();
        const norm = (t) => t
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const userN = norm(userMessage);
        const agentN = norm(previousAgent);
        const leadN = norm(lead.name || '');
        const looksEcho = (leadN && userN === leadN) ||
            (agentN.length > 40 &&
                userN.length >= 30 &&
                (agentN === userN ||
                    (agentN.includes(userN) && userN.length >= agentN.length * 0.4)));
        if (looksEcho) {
            const language = call.languageDetected ||
                lead.preferredLanguage ||
                settings.language ||
                'hinglish';
            const clarify = {
                'en-IN': 'Sorry, I caught some background noise. Please say that again — what is your budget?',
                'hi-IN': 'माफ़ कीजिए, थोड़ा noise आ गया। कृपया दोबारा बोलिए — आपका budget कितना है?',
                hinglish: 'Sorry, थोड़ा noise आ गया। Please दोबारा बोलिए — आपका budget कितना है?',
                'mr-IN': 'माफ करा, थोडा आवाज आला. कृपया पुन्हा सांगा — तुमचे बजेट किती आहे?',
                'gu-IN': 'માફ કરજો, થોડો અવાજ આવ્યો. કૃપા કરીને ફરી કહો — તમારું બજેટ કેટલું છે?',
            };
            const replyText = clarify[language] || clarify.hinglish;
            const tts = await this.voice.textToSpeech({
                text: replyText,
                speaker: settings.agentVoice || 'rachel',
                language,
                pace: 1.0,
                skipSave: true,
                optimizeStreamingLatency: streamMode ? 3 : undefined,
            });
            await emit({ type: 'user', text: userMessage });
            await emit({
                type: 'sentence',
                index: 0,
                text: replyText,
                audioBase64: tts.audioBase64,
                mimeType: tts.mimeType || 'audio/mpeg',
            });
            const echoPayload = {
                callId: call.id,
                userMessage,
                replyText,
                outcome: call.outcome,
                audioBase64: tts.audioBase64,
                mimeType: tts.mimeType || 'audio/mpeg',
                transcript: call.transcript,
                languageDetected: language,
                sources: [],
                qualification: call.qualificationJson || {},
                usedLlm: false,
                ignoredEcho: true,
            };
            await emit({ type: 'done', ...echoPayload });
            return echoPayload;
        }
        await emit({ type: 'user', text: userMessage });
        let sentenceIndex = 0;
        let streamedAnyAudio = false;
        let ttsChain = Promise.resolve();
        if (streamMode) {
            const ackLang = call.languageDetected ||
                lead.preferredLanguage ||
                settings.language ||
                'hi-IN';
            const ackText = /en/i.test(ackLang) ? 'Yes…' : 'जी…';
            void this.voice
                .textToSpeech({
                text: ackText,
                speaker: settings.agentVoice || 'rachel',
                language: ackLang,
                pace: 1.15,
                skipSave: true,
                modelId: 'eleven_flash_v2_5',
                outputFormat: 'mp3_22050_32',
                optimizeStreamingLatency: 4,
            })
                .then(async (tts) => {
                if (streamedAnyAudio)
                    return;
                await emit({
                    type: 'sentence',
                    index: sentenceIndex++,
                    text: ackText,
                    audioBase64: tts.audioBase64,
                    mimeType: tts.mimeType || 'audio/mpeg',
                    ack: true,
                });
            })
                .catch(() => undefined);
        }
        const result = await this.conversation.reply({
            lead,
            userMessage,
            priorTranscript: call.transcript,
            agentName: settings.agentName || 'Real Estate AI Agent',
            companyName: settings.companyName ||
                lead.project?.companyName ||
                lead.project?.builder,
            defaultLanguage: call.languageDetected ||
                lead.preferredLanguage ||
                settings.language ||
                'hi-IN',
            tone: settings.tone || 'friendly',
            systemPrompt: settings.systemPrompt || undefined,
            llmModel: settings.llmModel ||
                'gemini-3.5-flash-lite',
            approvedPlaybook: settings
                .approvedPlaybook,
            agentVoice: settings.agentVoice || 'rachel',
            phoneLatency: true,
            stream: streamMode,
            onTextDelta: streamMode
                ? (delta) => {
                    void emit({ type: 'text', delta });
                }
                : undefined,
            onSentence: streamMode
                ? (sentence) => {
                    const cleaned = String(sentence || '').trim();
                    if (!cleaned)
                        return;
                    ttsChain = ttsChain
                        .then(async () => {
                        const tts = await this.voice.textToSpeech({
                            text: cleaned,
                            speaker: settings.agentVoice || 'rachel',
                            language: call.languageDetected ||
                                lead.preferredLanguage ||
                                settings.language ||
                                'hi-IN',
                            pace: 1.05,
                            skipSave: true,
                            modelId: 'eleven_flash_v2_5',
                            outputFormat: 'mp3_22050_32',
                            optimizeStreamingLatency: 4,
                        });
                        streamedAnyAudio = true;
                        await emit({
                            type: 'sentence',
                            index: sentenceIndex++,
                            text: cleaned,
                            audioBase64: tts.audioBase64,
                            mimeType: tts.mimeType || 'audio/mpeg',
                        });
                    })
                        .catch((err) => {
                        this.logger.warn(`Stream TTS failed: ${err instanceof Error ? err.message : err}`);
                    });
                }
                : undefined,
        });
        await ttsChain;
        const resolvedProjectId = result.resolvedProjectId || null;
        if (resolvedProjectId && !lead.projectId) {
            await this.prisma.lead.update({
                where: { id: lead.id },
                data: { projectId: resolvedProjectId },
            });
            await this.prisma.call.update({
                where: { id: call.id },
                data: { projectId: resolvedProjectId },
            });
            lead.projectId = resolvedProjectId;
            void this.conversation
                .ensureProjectKnowledge(resolvedProjectId)
                .catch(() => undefined);
            await this.prisma.activity.create({
                data: {
                    leadId: lead.id,
                    type: 'LEAD_UPDATED',
                    description: `AI linked project from call: ${result.resolvedProjectName || resolvedProjectId}`,
                },
            });
        }
        let replyText = result.replyText;
        let outcome = this.conversation.mapOutcomeEnum(String(result.qualification.outcome || 'CONNECTED'));
        const booking = await this.appointments.maybeBookFromCall({
            leadId: lead.id,
            projectId: lead.projectId || call.projectId || resolvedProjectId,
            userMessage,
            priorTranscript: call.transcript,
            qualification: result.qualification,
        });
        if (booking.booked) {
            outcome = client_1.CallOutcome.SITE_VISIT_INTERESTED;
            const confirm = this.appointments.confirmationLine(booking, result.languageDetected);
            if (confirm &&
                !/calendar|मीटिंग.*सेट|booked your meeting/i.test(replyText)) {
                replyText = `${replyText.replace(/\s+$/, '')} ${confirm}`;
            }
            result.qualification.meetingBooked = true;
            result.qualification.meetingAt = booking.label;
            result.qualification.googleCalendarSynced =
                booking.calendarSynced;
            result.qualification.googleLink =
                booking.googleLink || null;
        }
        const nextTranscript = [
            call.transcript || '',
            `Lead: ${userMessage}`,
            `Agent: ${replyText}`,
        ]
            .filter(Boolean)
            .join('\n');
        const prevQual = call.qualificationJson && typeof call.qualificationJson === 'object'
            ? call.qualificationJson
            : {};
        const openerStyle = String(prevQual.openerStyle || '');
        const engagedWin = ['QUALIFIED', 'SITE_VISIT_INTERESTED', 'CALLBACK_REQUESTED'].includes(String(result.qualification.outcome || '')) ||
            Boolean(result.known?.budgetLabel || result.known?.location || result.known?.bhk) ||
            /interested|haan|हां|हाँ|sure|ok|okay|tell me|batao|बताओ|ha[a]?n/i.test(userMessage);
        const prevScore = typeof prevQual.interestScore === 'number'
            ? Number(prevQual.interestScore)
            : typeof call.interestScore === 'number'
                ? call.interestScore
                : null;
        const interestScore = (0, interest_score_1.computeInterestScore)({
            userMessage,
            priorTranscript: nextTranscript,
            known: result.known,
            outcome: String(result.qualification.outcome || outcome),
            siteVisitInterest: Boolean(result.qualification.siteVisitInterest),
            meetingBooked: booking.booked,
            previousScore: prevScore,
        });
        const interestLevel = `${(0, interest_score_1.interestLevelFromScore)(interestScore)} (${interestScore}/10)`;
        const mergedQual = {
            ...prevQual,
            ...result.qualification,
            interestScore,
            interestLevel,
            openerStyle: openerStyle || prevQual.openerStyle,
            openerWinRecorded: prevQual.openerWinRecorded || engagedWin || false,
            meetingBooked: booking.booked || prevQual.meetingBooked || false,
            meetingAt: booking.label || prevQual.meetingAt || null,
            googleCalendarSynced: booking.calendarSynced || prevQual.googleCalendarSynced || false,
            googleLink: booking.googleLink || prevQual.googleLink || null,
        };
        const durationSecs = this.elapsedSeconds(call.createdAt, call.duration);
        void (async () => {
            if (engagedWin && openerStyle && !prevQual.openerWinRecorded) {
                await this.aiService
                    .recordOpenerWin(openerStyle)
                    .catch(() => undefined);
            }
            await this.prisma.call.update({
                where: { id: call.id },
                data: {
                    transcript: nextTranscript,
                    summary: String(result.qualification.summary || '').slice(0, 500),
                    outcome,
                    status: client_1.CallStatus.IN_PROGRESS,
                    duration: durationSecs,
                    interestScore,
                    provider: 'browser-demo',
                    languageDetected: result.languageDetected,
                    qualificationJson: mergedQual,
                    sourcesJson: result.sources,
                    suggestedNextAction: String(result.qualification.suggestedNextAction ||
                        (booking.booked ? `Meeting ${booking.label}` : '')),
                    projectId: lead.projectId || call.projectId,
                },
            });
            await this.conversation.applyQualificationToLead(lead.id, {
                ...result.qualification,
                interestScore,
                interestLevel,
            });
            await this.prisma.activity.create({
                data: {
                    leadId: lead.id,
                    type: 'CALL_TURN',
                    description: `AI turn (${result.languageDetected}): ${userMessage.slice(0, 80)}`,
                    metadata: {
                        sources: result.sources,
                        usedLlm: result.usedLlm,
                        openerStyle,
                        meetingBooked: booking.booked,
                        googleCalendarSynced: booking.calendarSynced,
                        interestScore,
                    },
                },
            });
        })().catch((err) => this.logger.warn(`Demo turn persist failed: ${err instanceof Error ? err.message : err}`));
        const tts = streamedAnyAudio
            ? null
            : await this.voice.textToSpeech({
                text: replyText,
                speaker: settings.agentVoice || 'rachel',
                language: result.languageDetected || settings.language || 'hi-IN',
                pace: 1.05,
                skipSave: true,
                modelId: 'eleven_flash_v2_5',
                outputFormat: 'mp3_22050_32',
                optimizeStreamingLatency: 4,
            });
        if (streamedAnyAudio && booking.booked) {
            const confirm = this.appointments.confirmationLine(booking, result.languageDetected);
            if (confirm) {
                const confirmTts = await this.voice.textToSpeech({
                    text: confirm,
                    speaker: settings.agentVoice || 'rachel',
                    language: result.languageDetected || settings.language || 'hi-IN',
                    pace: 1.0,
                    skipSave: true,
                    modelId: 'eleven_flash_v2_5',
                    outputFormat: 'mp3_22050_32',
                    optimizeStreamingLatency: 4,
                });
                await emit({
                    type: 'sentence',
                    index: sentenceIndex++,
                    text: confirm,
                    audioBase64: confirmTts.audioBase64,
                    mimeType: confirmTts.mimeType || 'audio/mpeg',
                });
            }
        }
        else if (tts) {
            await emit({
                type: 'sentence',
                index: 0,
                text: replyText,
                audioBase64: tts.audioBase64,
                mimeType: tts.mimeType || 'audio/mpeg',
            });
        }
        const payload = {
            callId: call.id,
            userMessage,
            replyText,
            outcome,
            audioBase64: tts?.audioBase64 || '',
            mimeType: tts?.mimeType || 'audio/mpeg',
            transcript: nextTranscript,
            languageDetected: result.languageDetected,
            sources: result.sources,
            qualification: mergedQual,
            interestScore,
            duration: durationSecs,
            meetingBooked: booking.booked,
            googleCalendarSynced: booking.calendarSynced,
            googleLink: booking.googleLink || null,
            usedLlm: result.usedLlm,
            streamed: streamedAnyAudio,
        };
        await emit({ type: 'done', ...payload });
        void this.aiService
            .learnFromCompletedCall({
            callId: call.id,
            outcome: String(outcome),
            transcript: nextTranscript,
            interestScore,
        })
            .catch((err) => this.logger.warn(`Auto-learn (turn) failed: ${err instanceof Error ? err.message : err}`));
        return payload;
    }
    async endDemo(callId) {
        const call = await this.findOne(callId);
        const duration = this.elapsedSeconds(call.createdAt, call.duration);
        const prevQual = call.qualificationJson && typeof call.qualificationJson === 'object'
            ? call.qualificationJson
            : {};
        let interestScore = typeof call.interestScore === 'number'
            ? call.interestScore
            : typeof prevQual.interestScore === 'number'
                ? Number(prevQual.interestScore)
                : (0, interest_score_1.computeInterestScore)({
                    userMessage: '',
                    priorTranscript: call.transcript,
                    outcome: String(call.outcome || 'CONNECTED'),
                    meetingBooked: Boolean(prevQual.meetingBooked),
                    siteVisitInterest: Boolean(prevQual.siteVisitInterest),
                });
        interestScore = Math.max(0, Math.min(10, Math.round(interestScore)));
        const interestLevel = `${(0, interest_score_1.interestLevelFromScore)(interestScore)} (${interestScore}/10)`;
        const updated = await this.prisma.call.update({
            where: { id: callId },
            data: {
                duration,
                interestScore,
                status: client_1.CallStatus.COMPLETED,
                qualificationJson: {
                    ...prevQual,
                    interestScore,
                    interestLevel,
                },
            },
            include: {
                lead: { select: { id: true, name: true, phone: true, email: true } },
            },
        });
        void this.aiService
            .learnFromCompletedCall({
            callId,
            outcome: String(updated.outcome || call.outcome || 'CONNECTED'),
            transcript: call.transcript,
            interestScore,
        })
            .catch((err) => this.logger.warn(`Auto-learn failed: ${err instanceof Error ? err.message : err}`));
        return updated;
    }
};
exports.CallsService = CallsService;
exports.CallsService = CallsService = CallsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        voice_service_1.VoiceService,
        exotel_service_1.ExotelService,
        twilio_service_1.TwilioService,
        mcube_service_1.McubeService,
        conversation_service_1.ConversationService,
        appointments_service_1.AppointmentsService])
], CallsService);
//# sourceMappingURL=calls.service.js.map