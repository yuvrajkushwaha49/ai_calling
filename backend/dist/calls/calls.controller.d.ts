import type { Response, Request } from 'express';
import { CallsService } from './calls.service';
import { CreateCallDto, UpdateCallDto } from './dto/call.dto';
import { VoiceService } from '../voice/voice.service';
import { ExotelService } from './exotel.service';
import { ExotelStreamService } from './exotel-stream.service';
import { TwilioService } from './twilio.service';
import { McubeService } from './mcube.service';
export declare class CallsController {
    private callsService;
    private voice;
    private exotel;
    private exotelStream;
    private twilio;
    private mcube;
    constructor(callsService: CallsService, voice: VoiceService, exotel: ExotelService, exotelStream: ExotelStreamService, twilio: TwilioService, mcube: McubeService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
        lead: {
            email: string | null;
            name: string;
            id: string;
            phone: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CallStatus;
        projectId: string | null;
        interestScore: number | null;
        suggestedNextAction: string | null;
        leadId: string;
        campaignId: string | null;
        duration: number;
        transcript: string | null;
        summary: string | null;
        recordingUrl: string | null;
        outcome: import("@prisma/client").$Enums.CallOutcome;
        provider: string;
        providerCallId: string | null;
        greetingText: string | null;
        languageDetected: string | null;
        qualificationJson: import("@prisma/client/runtime/library").JsonValue | null;
        sourcesJson: import("@prisma/client/runtime/library").JsonValue | null;
    })[]>;
    getTwilioConfigStatus(): {
        configured: boolean;
        fromNumber: string | null;
        publicBaseUrl: string;
        webhookVoice: string;
        webhookStatus: string;
        mediaWs: string;
        webhookReady: boolean;
        needsTunnel: boolean;
        message: string;
    };
    getExotelConfigStatus(): {
        configured: boolean;
        fromNumber: string | null;
        appId: string | null;
        publicBaseUrl: string;
        webhookStatus: string;
        webhookGreeting: string;
        webhookVoicebot: string;
        voicebotWs: string;
        webhookReady: boolean;
        needsTunnel: boolean;
        message: string;
    };
    getMcubeConfigStatus(): {
        configured: boolean;
        publicBaseUrl: string;
        websocketUrlTemplate: string;
        alternativeWsUrl: string;
        webhookReady: boolean;
        needsTunnel: boolean;
        message: string;
    };
    startOutbound(body: {
        leadId: string;
        browserDemo?: boolean;
        provider?: 'twilio' | 'exotel' | 'mcube' | 'browser-demo';
    }): Promise<({
        project: {
            name: string;
            id: string;
        } | null;
        lead: {
            name: string;
            id: string;
            phone: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CallStatus;
        projectId: string | null;
        interestScore: number | null;
        suggestedNextAction: string | null;
        leadId: string;
        campaignId: string | null;
        duration: number;
        transcript: string | null;
        summary: string | null;
        recordingUrl: string | null;
        outcome: import("@prisma/client").$Enums.CallOutcome;
        provider: string;
        providerCallId: string | null;
        greetingText: string | null;
        languageDetected: string | null;
        qualificationJson: import("@prisma/client/runtime/library").JsonValue | null;
        sourcesJson: import("@prisma/client/runtime/library").JsonValue | null;
    }) | {
        status: "COMPLETED";
        demoMode: boolean;
        audioUrl: string;
        audioBase64: string;
        mimeType: string;
        greetingText: string;
        agentName: string;
        agentVoice: string;
        project: {
            name: string;
            id: string;
            companyName: string;
            location: string;
            builder: string;
            startingPrice: number;
            endingPrice: number;
            possessionDate: Date | null;
            reraNumber: string | null;
            amenities: import("@prisma/client/runtime/library").JsonValue;
            description: string | null;
        } | null;
        knowledgeSources: {
            id: string;
            fileName: string | null;
            title: string;
            sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
            sourceUrl: string | null;
        }[];
        message: string;
        lead: {
            name: string;
            id: string;
            phone: string;
            projectId: string | null;
        };
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string | null;
        interestScore: number | null;
        suggestedNextAction: string | null;
        leadId: string;
        campaignId: string | null;
        duration: number;
        transcript: string | null;
        summary: string | null;
        recordingUrl: string | null;
        outcome: import("@prisma/client").$Enums.CallOutcome;
        provider: string;
        providerCallId: string | null;
        languageDetected: string | null;
        qualificationJson: import("@prisma/client/runtime/library").JsonValue | null;
        sourcesJson: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    demoTurn(body: {
        callId: string;
        message?: string;
        audioBase64?: string;
        fileName?: string;
    }): Promise<{
        callId: string;
        userMessage: string;
        replyText: string;
        outcome: import("@prisma/client").$Enums.CallOutcome;
        audioBase64: string;
        mimeType: string;
        transcript: string | null;
        languageDetected: string;
        sources: never[];
        qualification: string | number | true | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray;
        usedLlm: boolean;
        ignoredEcho: boolean;
    } | {
        callId: string;
        userMessage: string;
        replyText: string;
        outcome: import("@prisma/client").$Enums.CallOutcome;
        audioBase64: string;
        mimeType: string;
        transcript: string;
        languageDetected: "hinglish" | "hi-IN" | "en-IN" | "mr-IN" | "gu-IN" | "ta-IN" | "te-IN" | "kn-IN" | "bn-IN" | "pa-IN";
        sources: {
            chunkId: string;
            score: number;
            title: string;
            sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
            fileName: string | null;
            sourceUrl: string | null;
            excerpt: string;
        }[];
        qualification: {
            interestScore: number;
            interestLevel: string;
            openerStyle: unknown;
            openerWinRecorded: {};
            meetingBooked: {};
            meetingAt: {} | null;
            googleCalendarSynced: {};
            googleLink: {} | null;
        };
        interestScore: number;
        duration: number;
        meetingBooked: boolean;
        googleCalendarSynced: boolean | undefined;
        googleLink: string | null;
        usedLlm: boolean;
        streamed: boolean;
    }>;
    demoTurnStream(body: {
        callId: string;
        message?: string;
        audioBase64?: string;
        fileName?: string;
    }, res: Response): Promise<void>;
    endDemo(id: string): Promise<{
        lead: {
            email: string | null;
            name: string;
            id: string;
            phone: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CallStatus;
        projectId: string | null;
        interestScore: number | null;
        suggestedNextAction: string | null;
        leadId: string;
        campaignId: string | null;
        duration: number;
        transcript: string | null;
        summary: string | null;
        recordingUrl: string | null;
        outcome: import("@prisma/client").$Enums.CallOutcome;
        provider: string;
        providerCallId: string | null;
        greetingText: string | null;
        languageDetected: string | null;
        qualificationJson: import("@prisma/client/runtime/library").JsonValue | null;
        sourcesJson: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    streamAudio(fileName: string, res: Response): void;
    exotelGreeting(callId: string | undefined, req: Request, res: Response): Promise<void>;
    exotelVoicebotResolve(req: Request, res: Response): void;
    exotelPassthru(req: Request): Promise<{
        ok: boolean;
    }>;
    exotelStatusWebhook(callId: string | undefined, req: Request): Promise<{
        ok: boolean;
    }>;
    twilioVoice(callId: string | undefined, req: Request, res: Response): Promise<void>;
    twilioStatusWebhook(callId: string | undefined, req: Request): Promise<{
        ok: boolean;
    }>;
    findOne(id: string): Promise<{
        lead: {
            project: {
                name: string;
                id: string;
                companyName: string;
                location: string;
                builder: string;
                startingPrice: number;
                endingPrice: number;
                possessionDate: Date | null;
                reraNumber: string | null;
                amenities: import("@prisma/client/runtime/library").JsonValue;
                description: string | null;
            } | null;
        } & {
            email: string | null;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            phone: string;
            source: import("@prisma/client").$Enums.LeadSource;
            budget: number | null;
            propertyType: import("@prisma/client").$Enums.PropertyType | null;
            status: import("@prisma/client").$Enums.LeadStatus;
            notes: string | null;
            projectId: string | null;
            aiSummary: string | null;
            preferredLanguage: string | null;
            preferredLocation: string | null;
            bhkPreference: string | null;
            purchaseTimeline: string | null;
            interestLevel: string | null;
            interestScore: number | null;
            objections: string | null;
            siteVisitInterest: boolean;
            callbackAt: Date | null;
            doNotCall: boolean;
            consentToCall: boolean;
            suggestedNextAction: string | null;
            lastQualifiedAt: Date | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CallStatus;
        projectId: string | null;
        interestScore: number | null;
        suggestedNextAction: string | null;
        leadId: string;
        campaignId: string | null;
        duration: number;
        transcript: string | null;
        summary: string | null;
        recordingUrl: string | null;
        outcome: import("@prisma/client").$Enums.CallOutcome;
        provider: string;
        providerCallId: string | null;
        greetingText: string | null;
        languageDetected: string | null;
        qualificationJson: import("@prisma/client/runtime/library").JsonValue | null;
        sourcesJson: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    create(dto: CreateCallDto): Promise<{
        lead: {
            name: string;
            id: string;
            phone: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CallStatus;
        projectId: string | null;
        interestScore: number | null;
        suggestedNextAction: string | null;
        leadId: string;
        campaignId: string | null;
        duration: number;
        transcript: string | null;
        summary: string | null;
        recordingUrl: string | null;
        outcome: import("@prisma/client").$Enums.CallOutcome;
        provider: string;
        providerCallId: string | null;
        greetingText: string | null;
        languageDetected: string | null;
        qualificationJson: import("@prisma/client/runtime/library").JsonValue | null;
        sourcesJson: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    update(id: string, dto: UpdateCallDto): Promise<{
        lead: {
            name: string;
            id: string;
            phone: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CallStatus;
        projectId: string | null;
        interestScore: number | null;
        suggestedNextAction: string | null;
        leadId: string;
        campaignId: string | null;
        duration: number;
        transcript: string | null;
        summary: string | null;
        recordingUrl: string | null;
        outcome: import("@prisma/client").$Enums.CallOutcome;
        provider: string;
        providerCallId: string | null;
        greetingText: string | null;
        languageDetected: string | null;
        qualificationJson: import("@prisma/client/runtime/library").JsonValue | null;
        sourcesJson: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CallStatus;
        projectId: string | null;
        interestScore: number | null;
        suggestedNextAction: string | null;
        leadId: string;
        campaignId: string | null;
        duration: number;
        transcript: string | null;
        summary: string | null;
        recordingUrl: string | null;
        outcome: import("@prisma/client").$Enums.CallOutcome;
        provider: string;
        providerCallId: string | null;
        greetingText: string | null;
        languageDetected: string | null;
        qualificationJson: import("@prisma/client/runtime/library").JsonValue | null;
        sourcesJson: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
}
