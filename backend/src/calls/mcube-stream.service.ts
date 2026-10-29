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
import { CallOutcome, CallStatus } from '@prisma/client';
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

export type McubeMediaFormat = {
  encoding?: string; // 'audio/x-mulaw' | 'audio/x-l16'
  sampleRate?: number; // 8000 | 16000
};

export type McubeInboundMsg = {
  event?: string; // 'start' | 'media' | 'playedStream'
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
    payload?: string; // base64 encoded audio
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
  pendingSegments: Set<string>;
};

@Injectable()
export class McubeStreamService {
  private readonly logger = new Logger(McubeStreamService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'audio');

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private ai: AiService,
    private voice: VoiceService,
    private conversation: ConversationService,
  ) {
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  /**
   * Attach a WebSocket client connecting to MCube bidirectional voice stream.
   * Path: /bid/websocket/{callId} or /api/calls/mcube-media
   */
  attachClient(
    ws: WebSocket,
    callIdHint?: string,
    queryParams?: Record<string, string>,
  ) {
    const session: McubeSession = {
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
      lastAgentText: '',
      lastUserText: '',
      turnCount: 0,
      pendingSegments: new Set(),
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
      if (!session.agentPlaying && !session.busy) return;
      session.bargeHits += 1;
      if (session.bargeHits < 2) return;

      this.logger.log(`[MCube] Caller barge-in on stream=${session.streamId}`);
      session.cancelPlay = true;
      session.agentPlaying = false;
      session.flushGen += 1;

      // Send clearAudio to immediately interrupt playback on caller's phone
      this.sendClearAudio(ws, session.streamId);
    };

    ws.on('message', (raw) => {
      if (session.closed) return;
      try {
        let msg: McubeInboundMsg;
        try {
          const text =
            typeof raw === 'string'
              ? raw
              : Buffer.isBuffer(raw)
                ? raw.toString('utf8')
                : String(raw);
          msg = JSON.parse(text) as McubeInboundMsg;
        } catch {
          return;
        }

        // 1. "start" event
      if (msg.event === 'start' && msg.start) {
        session.streamId = msg.start.streamId || session.streamId || '';
        session.callId =
          msg.start.callId || callIdHint || session.callId || `inbound_${Date.now()}`;

        const format = msg.start.mediaFormat;
        if (format?.encoding?.includes('l16')) {
          session.encoding = 'audio/x-l16';
          session.sampleRate = format.sampleRate || 16000;
        } else {
          session.encoding = 'audio/x-mulaw';
          session.sampleRate = format?.sampleRate || 8000;
        }

        this.logger.log(
          `[MCube] Inbound stream started streamId=${session.streamId} callId=${session.callId} format=${session.encoding}@${session.sampleRate}Hz`,
        );

        // Ensure Call and Lead exist in DB (handles Inbound calls automatically)
        void (async () => {
          try {
            let call = await this.prisma.call.findUnique({
              where: { id: session.callId },
              include: { lead: { include: { project: true } } },
            });

            // If call doesn't exist, this is an incoming call from a customer on our MCube number
            if (!call) {
              const callerPhone =
                queryParams?.from ||
                queryParams?.caller ||
                queryParams?.callerNumber ||
                queryParams?.phone ||
                'Inbound Caller';

              let lead =
                callerPhone && callerPhone !== 'Inbound Caller'
                  ? await this.prisma.lead.findFirst({
                      where: { phone: { contains: callerPhone.slice(-10) } },
                      include: { project: true },
                    })
                  : null;

              if (!lead) {
                lead = await this.prisma.lead.create({
                  data: {
                    name: 'Inbound Caller',
                    phone:
                      callerPhone !== 'Inbound Caller'
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
                  status: CallStatus.IN_PROGRESS,
                  outcome: CallOutcome.CONNECTED,
                  provider: 'mcube',
                  providerCallId: session.streamId || session.callId,
                  summary: `Incoming call from ${lead.phone}`,
                  transcript: 'Agent: Hello?\n',
                  greetingText: 'Hello?',
                },
                include: { lead: { include: { project: true } } },
              });
              this.logger.log(
                `[MCube] Created Inbound Call record id=${call.id} for lead=${lead.name}`,
              );
            } else {
              await this.prisma.call.update({
                where: { id: session.callId },
                data: {
                  provider: 'mcube',
                  providerCallId: session.streamId || undefined,
                  status: CallStatus.IN_PROGRESS,
                },
              });
            }

            // Natural human telecaller: start with a soft, warm "Hello?"
            const settings = await this.ai.getSettings();
            const initialOpener = 'Hello?';
            session.lastAgentText = initialOpener;
            session.turnCount = 1;

            const audioBuf = await this.synthesizeForSession(
              initialOpener,
              session,
              settings,
            );
            if (audioBuf && ws.readyState === ws.OPEN) {
              await this.sendPlayAudio(ws, session, audioBuf);
            }
          } catch (err) {
            this.logger.warn(`[MCube] Inbound greeting error: ${err}`);
          }
        })();
        return;
      }

      // 2. "playedStream" event
      if (msg.event === 'playedStream') {
        const segName = msg.name || '';
        session.pendingSegments.delete(segName);
        if (session.pendingSegments.size === 0) {
          session.agentPlaying = false;
        }
        this.logger.debug(
          `[MCube] playedStream finished name=${segName} streamId=${msg.streamId}`,
        );
        return;
      }

      // 3. "media" event
      if (msg.event === 'media' && msg.media?.payload) {
        const track = (msg.media.track || 'inbound').toLowerCase();
        if (track.includes('outbound')) return;

        if (msg.streamId && !session.streamId) {
          session.streamId = msg.streamId;
        }

        const chunk = Buffer.from(msg.media.payload, 'base64');
        const pcm =
          session.encoding === 'audio/x-l16'
            ? asNodeBuffer(chunk)
            : mulawToPcm16(chunk);

        const energy = pcmEnergy(pcm);
        const now = Date.now();

        // Barge-in check while agent is speaking
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
          session.rawChunks.push(chunk);
          scheduleFlush(420);
          if (now - session.speechStartedAt > 6500) {
            void this.flushTurn(ws, session);
          }
        } else if (session.speaking) {
          // Trailing silence buffer (up to 300ms) so end syllables are not chopped
          if (now - session.lastVoiceAt < 300) {
            session.rawChunks.push(chunk);
          }
          // Do NOT reset silenceTimer here — let the timer started on last voice packet fire after 420ms!
        }
        return;
      }
    } catch (err) {
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
            where: { id: session.callId, status: CallStatus.IN_PROGRESS },
            data: { status: CallStatus.COMPLETED },
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

  /**
   * Process accumulated caller speech turn -> STT -> LLM -> TTS -> send playAudio & checkpoint
   */
  private async flushTurn(ws: WebSocket, session: McubeSession) {
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

    const rawIn = asNodeBuffer(Buffer.concat(session.rawChunks));
    session.rawChunks = [];
    const aborted = () =>
      session.closed || session.flushGen !== myGen || session.cancelPlay;

    try {
      const minLength =
        session.encoding === 'audio/x-l16'
          ? session.sampleRate * 2 * 0.45 // 16-bit PCM = 2 bytes/sample
          : (session.sampleRate || 8000) * 0.45; // 8-bit mulaw = 1 byte/sample

      if (rawIn.length < minLength) {
        session.busy = false;
        return;
      }

      const pcm16 =
        session.encoding === 'audio/x-l16'
          ? boostPcm16(rawIn, 1.2)
          : boostPcm16(mulawToPcm16(rawIn), 2.2);

      const wavBuffer = pcm16ToWav(pcm16, session.sampleRate);

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
          : Promise.resolve([null, null] as const),
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

      const lead = (call?.lead as any) || {
        id: 'guest-lead',
        name: 'Guest',
        phone: '9999999999',
        source: 'OTHER',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
        project: null,
      };

      const companyName =
        (settings as { companyName?: string })?.companyName ||
        lead.project?.companyName ||
        lead.project?.builder ||
        'Saya Group';
      const agentName = settings?.agentName || 'Neha';

      const follow = buildFollowUpReply({
        transcript: userMessage,
        leadName: lead.name,
        language: call?.languageDetected || 'hi-IN',
        tone: (settings as { tone?: string }).tone || 'friendly',
        priorTranscript: call?.transcript,
        agentVoice: settings?.agentVoice || 'rachel',
        agentName,
        companyName,
        isInbound: true,
      });

      let replyText = follow.text;
      let languageDetected = call?.languageDetected || 'hi-IN';

      let ttsChain = Promise.resolve();
      let streamedAnyAudio = false;

      let fillerTimeout: ReturnType<typeof setTimeout> | null = setTimeout(async () => {
        if (streamedAnyAudio || aborted() || ws.readyState !== ws.OPEN) return;
        try {
          const filler = 'Haan ji, main dekh rahi hoon...';
          const audioBuffer = await this.synthesizeForSession(
            filler,
            session,
            settings,
          );
          if (audioBuffer && !streamedAnyAudio && !aborted() && ws.readyState === ws.OPEN) {
            await this.sendPlayAudio(ws, session, audioBuffer);
          }
        } catch {
          // ignore filler failure
        }
      }, 1800);

      try {
        const result = await this.conversation.reply({
          lead,
          userMessage,
          priorTranscript: call?.transcript,
          agentName: settings?.agentName || 'Neha',
          companyName:
            (settings as { companyName?: string })?.companyName ||
            lead.project?.companyName ||
            lead.project?.builder ||
            'Saya Group',
          defaultLanguage: call?.languageDetected || 'hi-IN',
          tone: (settings as { tone?: string })?.tone || 'friendly',
          systemPrompt: settings?.systemPrompt || undefined,
          llmModel:
            (settings as { llmModel?: string })?.llmModel ||
            'gemini-flash-lite-latest',
          approvedPlaybook: (settings as { approvedPlaybook?: unknown })
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
            const cleaned = truncateForPhone(String(sentence || '').trim(), 120);
            if (!cleaned) return;
            ttsChain = ttsChain
              .then(async () => {
                if (aborted() || ws.readyState !== ws.OPEN) return;
                const audioBuffer = await this.synthesizeForSession(
                  cleaned,
                  session,
                  settings,
                );
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

        // Real-time CRM lead update with customer details (name, BHK, budget, project, site visit)
        if (result?.qualification && lead?.id && lead.id !== 'guest-lead') {
          void this.conversation
            .applyQualificationToLead(lead.id, {
              ...result.qualification,
              projectId: result.resolvedProjectId || undefined,
            })
            .catch(() => undefined);
        }

        // Wait for all queued sentence audio to finish playing
        await ttsChain;
      } catch (err) {
        if (fillerTimeout) {
          clearTimeout(fillerTimeout);
          fillerTimeout = null;
        }
        this.logger.warn(`[MCube] LLM failed: ${err instanceof Error ? err.message : err}`);
      }

      session.lastUserText = userMessage;
      session.lastAgentText = replyText;
      session.turnCount += 1;

      // Update call record transcript in background
      void this.prisma.call
        .update({
          where: { id: callId },
          data: {
            transcript: [
              call?.transcript || '',
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

      // If streaming didn't output audio (e.g. scripted fallback), send full audio
      if (!streamedAnyAudio && !aborted() && ws.readyState === ws.OPEN) {
        const cleanReply = truncateForPhone(replyText, 140);
        const audioBuffer = await this.synthesizeForSession(
          cleanReply,
          session,
          settings,
        );
        if (audioBuffer && !aborted() && ws.readyState === ws.OPEN) {
          await this.sendPlayAudio(ws, session, audioBuffer);
        }
      }
    } catch (err) {
      this.logger.error(`[MCube] Turn failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      session.busy = false;
    }
  }

  /**
   * Synthesize audio matching the active session's encoding and sample rate.
   */
  private async synthesizeForSession(
    text: string,
    session: McubeSession,
    settings: any,
  ): Promise<Buffer | null> {
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
        return asNodeBuffer(Buffer.from(tts.audioBase64, 'base64'));
      } else {
        // audio/x-mulaw at 8000Hz
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
          return asNodeBuffer(Buffer.from(tts.audioBase64, 'base64'));
        } catch {
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
          const pcm16k = asNodeBuffer(Buffer.from(tts.audioBase64, 'base64'));
          return pcm16ToMulaw(downsamplePcm16(pcm16k, 16000, 8000));
        }
      }
    } catch (err) {
      this.logger.error(`[MCube] TTS failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /**
   * Send playAudio event followed by checkpoint event per MCube specification.
   */
  async sendPlayAudio(ws: WebSocket, session: McubeSession, audioBuffer: Buffer) {
    if (ws.readyState !== ws.OPEN || !session.streamId) return;

    const segmentName = `seg_${randomUUID().slice(0, 8)}`;
    session.pendingSegments.add(segmentName);
    session.agentPlaying = true;
    session.cancelPlay = false;

    // 1. playAudio
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

    // 2. checkpoint directly after playAudio
    const checkpointMsg = {
      event: 'checkpoint',
      streamId: session.streamId,
      name: segmentName,
    };
    ws.send(JSON.stringify(checkpointMsg));

    this.logger.debug(
      `[MCube] Sent playAudio and checkpoint name=${segmentName} streamId=${session.streamId}`,
    );
  }

  /**
   * Send clearAudio to stop all current audio playing to caller (used for barge-in / interruptions).
   */
  sendClearAudio(ws: WebSocket, streamId: string) {
    if (ws.readyState !== ws.OPEN || !streamId) return;
    const msg = {
      event: 'clearAudio',
      streamId,
    };
    ws.send(JSON.stringify(msg));
  }

  /**
   * Send transfer event to route call to a human agent in E.164 format.
   */
  sendTransfer(
    ws: WebSocket,
    streamId: string,
    transferTo: string,
    showOriginalCallerId = true,
  ) {
    if (ws.readyState !== ws.OPEN || !streamId) return;
    const msg = {
      event: 'transfer',
      streamId,
      transferTo,
      showOriginalCallerId,
    };
    ws.send(JSON.stringify(msg));
    this.logger.log(
      `[MCube] Transferred call streamId=${streamId} to ${transferTo}`,
    );
  }

  /**
   * Send terminate event to hang up ongoing call.
   */
  sendTerminate(ws: WebSocket, streamId: string) {
    if (ws.readyState !== ws.OPEN || !streamId) return;
    const msg = {
      event: 'terminate',
      streamId,
    };
    ws.send(JSON.stringify(msg));
    this.logger.log(`[MCube] Terminated call streamId=${streamId}`);
  }
}
