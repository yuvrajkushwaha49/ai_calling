import { ConfigService } from '@nestjs/config';
import type { WebSocket } from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { VoiceService } from '../voice/voice.service';
import { ConversationService } from '../conversation/conversation.service';
import { CustomerMemoryService } from '../memory/customer-memory.service';
import { FactExtractorService } from '../memory/fact-extractor.service';
import { QuestionValidatorService } from '../memory/question-validator.service';
import { ConversationState } from '../memory/memory.types';
export type McubeMediaFormat = {
    encoding?: string;
    sampleRate?: number;
};
export type McubeInboundMsg = {
    event?: string;
    streamId?: string;
    name?: string;
    start?: {
        callId?: string;
        streamId?: string;
        tracks?: string[];
        mediaFormat?: McubeMediaFormat;
    };
    media?: {
        track?: string;
        timestamp?: string;
        payload?: string;
    };
};
type McubeSession = {
    streamId: string;
    callId: string;
    encoding: 'audio/x-mulaw' | 'audio/x-l16';
    sampleRate: number;
    rawChunks: Buffer[];
    speaking: boolean;
    lastVoiceAt: number;
    speechStartedAt: number;
    silenceTimer: ReturnType<typeof setTimeout> | null;
    busy: boolean;
    closed: boolean;
    listenAfter: number;
    agentPlaying: boolean;
    cancelPlay: boolean;
    bargeHits: number;
    flushGen: number;
    lastAgentText: string;
    lastUserText: string;
    turnCount: number;
    transcript: string;
    pendingSegments: Set<string>;
    memory?: ConversationState;
};
export declare class McubeStreamService {
    private config;
    private prisma;
    private ai;
    private voice;
    private conversation;
    private customerMemory;
    private factExtractor;
    private questionValidator;
    private readonly logger;
    private readonly uploadsDir;
    constructor(config: ConfigService, prisma: PrismaService, ai: AiService, voice: VoiceService, conversation: ConversationService, customerMemory: CustomerMemoryService, factExtractor: FactExtractorService, questionValidator: QuestionValidatorService);
    attachClient(ws: WebSocket, callIdHint?: string, queryParams?: Record<string, string>): void;
    private flushTurn;
    private synthesizeForSession;
    sendPlayAudio(ws: WebSocket, session: McubeSession, audioBuffer: Buffer): Promise<void>;
    sendClearAudio(ws: WebSocket, streamId: string): void;
    sendTransfer(ws: WebSocket, streamId: string, transferTo: string, showOriginalCallerId?: boolean): void;
    sendTerminate(ws: WebSocket, streamId: string): void;
}
export {};
