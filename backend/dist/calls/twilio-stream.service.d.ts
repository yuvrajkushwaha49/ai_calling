import { ConfigService } from '@nestjs/config';
import type { WebSocket } from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { VoiceService } from '../voice/voice.service';
import { ConversationService } from '../conversation/conversation.service';
export declare class TwilioStreamService {
    private config;
    private prisma;
    private ai;
    private voice;
    private conversation;
    private readonly logger;
    private readonly uploadsDir;
    private fillerMulaw;
    private fillerLoading;
    constructor(config: ConfigService, prisma: PrismaService, ai: AiService, voice: VoiceService, conversation: ConversationService);
    attachClient(ws: WebSocket, callIdHint?: string): void;
    private resolveCallIdByProvider;
    private flushTurn;
    private ttsToMulaw;
    private getFillerMulaw;
    private playFiller;
    private streamMulawToTwilio;
}
