import { ConfigService } from '@nestjs/config';
import type { WebSocket } from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { VoiceService } from '../voice/voice.service';
import { ConversationService } from '../conversation/conversation.service';
export declare class ExotelStreamService {
    private config;
    private prisma;
    private ai;
    private voice;
    private conversation;
    private readonly logger;
    private readonly uploadsDir;
    private fillerPcm;
    private fillerLoading;
    constructor(config: ConfigService, prisma: PrismaService, ai: AiService, voice: VoiceService, conversation: ConversationService);
    getPublicBaseUrl(): string;
    resolveVoicebotWsUrl(query: Record<string, string>): {
        url: string;
    };
    attachClient(ws: WebSocket, callIdHint?: string): void;
    private flushTurn;
    private getFillerPcm;
    private playFiller;
    private resolveCallIdByProvider;
    private streamPcmToExotel;
}
