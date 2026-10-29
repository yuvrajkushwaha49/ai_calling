import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { WebSocket } from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { VoiceService } from '../voice/voice.service';
import { ConversationService } from '../conversation/conversation.service';
import { CallStatus } from '@prisma/client';
import { buildFollowUpReply } from './call-scripts';
import {
  asNodeBuffer,
  boostPcm16,
  downsamplePcm16,
  mulawToPcm16,
  pcm16ToMulaw,
  pcm16ToWav,
  pcmEnergy,
  truncateForPhone,
} from './phone-audio';

type TwilioMsg = {
  event?: string;
  streamSid?: string;
  start?: {
    streamSid?: string;
    callSid?: string;
    customParameters?: Record<string, string>;
    mediaFormat?: { sampleRate?: number };
  };
  media?: { payload?: string; track?: string };
};

type StreamSession = {
  streamSid: string;
  callSid: string;
  callId: string;
  sampleRate: number;
  mulawChunks: Buffer[];
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
};

@Injectable()
export class TwilioStreamService {
  private readonly logger = new Logger(TwilioStreamService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
  private fillerMulaw: Buffer | null = null;
  private fillerLoading: Promise<Buffer | null> | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private ai: AiService,
    private voice: VoiceService,
    private conversation: ConversationService,
  ) {
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  attachClient(ws: WebSocket, callIdHint?: string) {
    const session: StreamSession = {
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

    const scheduleFlush = (delayMs: number) => {
      clearSilence();
      session.silenceTimer = setTimeout(() => {
        void this.flushTurn(ws, session);
      }, delayMs);
    };

    const bargeIn = () => {
      if (!session.agentPlaying) return;
      session.bargeHits += 1;
      if (session.bargeHits < 2) return;
      session.cancelPlay = true;
      session.agentPlaying = false;
      try {
        if (ws.readyState === ws.OPEN && session.streamSid) {
          ws.send(
            JSON.stringify({ event: 'clear', streamSid: session.streamSid }),
          );
        }
      } catch {
        /* ignore */
      }
    };

    ws.on('message', (raw) => {
      if (session.closed) return;
      let msg: TwilioMsg;
      try {
        msg = JSON.parse(String(raw)) as TwilioMsg;
      } catch {
        return;
      }

      if (msg.event === 'connected') return;

      if (msg.event === 'start' && msg.start) {
        session.streamSid = msg.start.streamSid || '';
        session.callSid = msg.start.callSid || '';
        const params = msg.start.customParameters || {};
        session.callId =
          params.callId || params.CallId || callIdHint || session.callId || '';
        session.sampleRate = Number(msg.start.mediaFormat?.sampleRate) || 8000;
        this.logger.log(
          `Twilio stream start sid=${session.streamSid} callId=${session.callId}`,
        );
        if (session.callId) {
          void this.prisma.call
            .update({
              where: { id: session.callId },
              data: {
                providerCallId: session.callSid || undefined,
                status: CallStatus.IN_PROGRESS,
              },
            })
            .catch(() => undefined);
        }
        return;
      }

      if (msg.event === 'media' && msg.media?.payload) {
        const track = (msg.media.track || 'inbound').toLowerCase();
        if (track.includes('outbound')) return;

        const mulaw = Buffer.from(msg.media.payload, 'base64');
        const pcm = mulawToPcm16(mulaw);
        const energy = pcmEnergy(pcm);
        const now = Date.now();

        if (session.agentPlaying && energy > 900 && now > session.listenAfter) {
          bargeIn();
        }
        if (now < session.listenAfter && !session.agentPlaying) return;

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
        } else if (session.speaking) {
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

  private async resolveCallIdByProvider(callSid: string) {
    if (!callSid) return null;
    const call = await this.prisma.call.findFirst({
      where: { providerCallId: callSid },
      select: { id: true },
    });
    return call?.id || null;
  }

  private async flushTurn(ws: WebSocket, session: StreamSession) {
    if (session.busy || session.closed) return;
    session.busy = true;
    const myGen = ++session.flushGen;
    if (session.silenceTimer) {
      clearTimeout(session.silenceTimer);
      session.silenceTimer = null;
    }
    session.speaking = false;
    session.speechStartedAt = 0;
    session.bargeHits = 0;

    const mulawIn = asNodeBuffer(Buffer.concat(session.mulawChunks));
    session.mulawChunks = [];
    const aborted = () =>
      session.closed || session.flushGen !== myGen || session.cancelPlay;

    try {
      const t0 = Date.now();
      if (mulawIn.length < 8000 * 0.45) {
        session.busy = false;
        return;
      }

      const pcm = boostPcm16(mulawToPcm16(mulawIn), 2.2);
      const wavPath = path.join(
        this.uploadsDir,
        `twilio-in-${randomUUID()}.wav`,
      );
      fs.writeFileSync(wavPath, pcm16ToWav(pcm, session.sampleRate || 8000));

      const callIdHint =
        session.callId ||
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
          : Promise.resolve([null, null] as const),
      ]);
      if (aborted()) {
        session.busy = false;
        return;
      }

      const userMessage = (stt.transcript || '').trim();
      this.logger.log(
        `Twilio STT (${Date.now() - t0}ms): ${userMessage.slice(0, 160)}`,
      );
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

      const follow = buildFollowUpReply({
        transcript: userMessage,
        leadName: call.lead.name,
        language: call.languageDetected || 'hi-IN',
        tone: (settings as { tone?: string }).tone || 'friendly',
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
            companyName:
              (settings as { companyName?: string }).companyName ||
              call.lead.project?.companyName ||
              call.lead.project?.builder ||
              'Saya Group',
            defaultLanguage: call.languageDetected || 'hi-IN',
            tone: (settings as { tone?: string }).tone || 'friendly',
            systemPrompt: settings.systemPrompt || undefined,
            llmModel:
              (settings as { llmModel?: string }).llmModel ||
              'gemini-flash-lite-latest',
            approvedPlaybook: (settings as { approvedPlaybook?: unknown })
              .approvedPlaybook,
            agentVoice: settings.agentVoice || 'custom',
            phoneLatency: true,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
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
      } catch (err) {
        this.logger.warn(
          `Twilio LLM failed: ${err instanceof Error ? err.message : err}`,
        );
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
            status: CallStatus.IN_PROGRESS,
          },
        })
        .catch(() => undefined);

      if (session.closed || ws.readyState !== ws.OPEN || aborted()) {
        session.cancelPlay = false;
        session.busy = false;
        return;
      }

      const spoken = truncateForPhone(replyText);
      const mulawOut = await this.ttsToMulaw(
        spoken,
        settings.agentVoice || 'custom',
        languageDetected,
      );
      if (!mulawOut || aborted()) {
        session.cancelPlay = false;
        session.busy = false;
        return;
      }

      session.cancelPlay = false;
      session.agentPlaying = true;
      session.listenAfter = Date.now() + 900;
      await this.streamMulawToTwilio(ws, session.streamSid, mulawOut, () =>
        Boolean(session.cancelPlay || session.closed),
      );
      session.agentPlaying = false;
      session.cancelPlay = false;
      session.listenAfter = Date.now() + 800;
      session.mulawChunks = [];
      session.speaking = false;
    } catch (err) {
      this.logger.error(
        `Twilio turn failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      session.agentPlaying = false;
      session.speaking = false;
      session.busy = false;
    }
  }

  private async ttsToMulaw(
    text: string,
    speaker: string,
    language: string,
  ): Promise<Buffer | null> {
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
      return asNodeBuffer(Buffer.from(tts.audioBase64, 'base64'));
    } catch {
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
        const pcm16k = boostPcm16(
          asNodeBuffer(Buffer.from(tts.audioBase64, 'base64')),
          1.05,
        );
        return pcm16ToMulaw(downsamplePcm16(pcm16k, 16000, 8000));
      } catch (err) {
        this.logger.warn(
          `Twilio TTS failed: ${err instanceof Error ? err.message : err}`,
        );
        return null;
      }
    }
  }

  private async getFillerMulaw(): Promise<Buffer | null> {
    if (this.fillerMulaw) return this.fillerMulaw;
    if (this.fillerLoading) return this.fillerLoading;
    this.fillerLoading = (async () => {
      this.fillerMulaw = await this.ttsToMulaw('जी।', 'custom', 'hi-IN');
      return this.fillerMulaw;
    })();
    return this.fillerLoading;
  }

  private async playFiller(ws: WebSocket, session: StreamSession) {
    try {
      const filler = await this.getFillerMulaw();
      if (!filler || session.closed || !session.streamSid) return;
      if (ws.readyState !== ws.OPEN) return;
      await this.streamMulawToTwilio(ws, session.streamSid, filler, () =>
        Boolean(session.closed),
      );
    } catch {
      /* ignore */
    }
  }

  private async streamMulawToTwilio(
    ws: WebSocket,
    streamSid: string,
    mulaw: Buffer,
    shouldCancel?: () => boolean,
  ) {
    const frameSize = 160;
    const data = asNodeBuffer(mulaw);
    for (let i = 0; i < data.length; i += frameSize) {
      if (shouldCancel?.()) return;
      if (ws.readyState !== ws.OPEN) return;
      const chunk = data.subarray(i, Math.min(i + frameSize, data.length));
      ws.send(
        JSON.stringify({
          event: 'media',
          streamSid,
          media: { payload: chunk.toString('base64') },
        }),
      );
      await new Promise((r) => setTimeout(r, 18));
    }
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          event: 'mark',
          streamSid,
          mark: { name: `agent-${Date.now()}` },
        }),
      );
    }
  }
}
