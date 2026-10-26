import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CallOutcome, CallStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCallDto, UpdateCallDto } from './dto/call.dto';
import { AiService } from '../ai/ai.service';
import { VoiceService } from '../voice/voice.service';
import { ExotelService } from './exotel.service';
import { TwilioService } from './twilio.service';
import { McubeService } from './mcube.service';
import { ConversationService } from '../conversation/conversation.service';
import { AppointmentsService } from '../appointments/appointments.service';
import {
  computeInterestScore,
  interestLevelFromScore,
} from '../conversation/interest-score';
import {
  hasDevanagari,
  devanagariToRoman,
} from '../elevenlabs/hindi-romanize';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private voice: VoiceService,
    private exotel: ExotelService,
    private twilio: TwilioService,
    private mcube: McubeService,
    private conversation: ConversationService,
    private appointments: AppointmentsService,
  ) {}

  private elapsedSeconds(createdAt: Date, previous = 0): number {
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

  async findOne(id: string) {
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
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  async create(dto: CreateCallDto) {
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

  async update(id: string, dto: UpdateCallDto) {
    await this.findOne(id);
    return this.prisma.call.update({
      where: { id },
      data: dto,
      include: { lead: { select: { id: true, name: true, phone: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.call.delete({ where: { id } });
  }

  async startOutboundCall(
    leadId: string,
    options?: {
      browserDemo?: boolean;
      campaignId?: string;
      provider?: 'twilio' | 'exotel' | 'mcube' | 'browser-demo';
    },
  ) {
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
    if (!lead) throw new NotFoundException('Lead not found');
    if (!lead.phone?.trim()) {
      throw new BadRequestException('Lead does not have a phone number');
    }
    // Project is optional — agent discovers property on the call and answers from KB
    if (lead.doNotCall) {
      throw new BadRequestException('Lead is on Do Not Call list');
    }
    if (!lead.consentToCall) {
      throw new BadRequestException('Lead has not consented to calls');
    }

    const settings = await this.aiService.getSettings();
    if (!settings.isActive) {
      throw new BadRequestException('AI agent is inactive. Enable it in AI Settings.');
    }

    // Prefetch project website knowledge once at call start (non-blocking if already READY)
    if (lead.projectId) {
      void this.conversation
        .ensureProjectKnowledge(lead.projectId)
        .catch((err) =>
          this.logger.warn(
            `Knowledge prefetch failed: ${err instanceof Error ? err.message : err}`,
          ),
        );
    }

    const agentName = settings.agentName || 'Real Estate AI Agent';
    const opening = await this.conversation.buildOpening({
      lead,
      agentName,
      companyName:
        (settings as { companyName?: string }).companyName ||
        lead.project?.companyName ||
        lead.project?.builder ||
        'Saya Group',
      // Agent setting controls start language (Hindi) — not lead CRM preference
      language: settings.language || lead.preferredLanguage || 'hi-IN',
      tone: (settings as { tone?: string }).tone || 'friendly',
      agentVoice: settings.agentVoice || 'rachel',
      openerLearning: (settings as { approvedPlaybook?: unknown }).approvedPlaybook,
    });
    const greetingText = opening.text;

    const tts = await this.voice.textToSpeech({
      text: greetingText,
      speaker: settings.agentVoice || 'rachel',
      language: opening.language || settings.language || 'hi-IN',
    });

    const audioUrl = `${this.twilio.getPublicBaseUrl()}/api/calls/audio/${tts.fileName}`;

    const requestedProvider = options?.provider;
    const isBrowserDemo =
      options?.browserDemo === true ||
      requestedProvider === 'browser-demo' ||
      (!requestedProvider &&
        !this.twilio.isConfigured() &&
        !this.mcube.isConfigured() &&
        !this.exotel.isConfigured());

    const activeProvider: 'browser-demo' | 'twilio' | 'exotel' | 'mcube' =
      isBrowserDemo
        ? 'browser-demo'
        : requestedProvider
          ? requestedProvider
          : this.mcube.isConfigured()
            ? 'mcube'
            : this.twilio.isConfigured()
              ? 'twilio'
              : 'exotel';

    // Track which opener was used (wins recorded after customer engages)
    void this.aiService.recordOpenerUse(opening.openerStyle).catch(() => undefined);

    const call = await this.prisma.call.create({
      data: {
        leadId,
        projectId: lead.projectId || undefined,
        campaignId: options?.campaignId,
        status: isBrowserDemo ? CallStatus.COMPLETED : CallStatus.INITIATED,
        outcome: CallOutcome.CONNECTED,
        provider: activeProvider,
        greetingText,
        recordingUrl: audioUrl,
        transcript: `Agent: ${greetingText}`,
        languageDetected: opening.language,
        qualificationJson: {
          openerStyle: opening.openerStyle,
          needsProjectDiscovery: !lead.projectId,
        } as unknown as Prisma.InputJsonValue,
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
        status: CallStatus.COMPLETED,
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
            status: CallStatus.INITIATED,
            summary: 'Live MCube outbound call initiated',
          },
          include: {
            lead: { select: { id: true, name: true, phone: true } },
            project: { select: { id: true, name: true } },
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'MCube call failed';
        this.logger.error(message);
        await this.prisma.call.update({
          where: { id: call.id },
          data: {
            status: CallStatus.FAILED,
            outcome: CallOutcome.NO_ANSWER,
            summary: message,
          },
        });
        throw new BadRequestException(message);
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
            status: CallStatus.RINGING,
            summary: 'Live Exotel outbound call ringing',
          },
          include: {
            lead: { select: { id: true, name: true, phone: true } },
            project: { select: { id: true, name: true } },
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Exotel call failed';
        this.logger.error(message);
        await this.prisma.call.update({
          where: { id: call.id },
          data: {
            status: CallStatus.FAILED,
            outcome: CallOutcome.NO_ANSWER,
            summary: message,
          },
        });
        throw new BadRequestException(message);
      }
    }

    // Default: Twilio
    try {
      const { sid } = await this.twilio.createOutboundCall({
        to: lead.phone,
        callId: call.id,
      });

      return this.prisma.call.update({
        where: { id: call.id },
        data: {
          providerCallId: sid,
          status: CallStatus.RINGING,
          summary: 'Live Twilio outbound call ringing',
        },
        include: {
          lead: { select: { id: true, name: true, phone: true } },
          project: { select: { id: true, name: true } },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Twilio call failed';
      this.logger.error(message);
      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          status: CallStatus.FAILED,
          outcome: CallOutcome.NO_ANSWER,
          summary: message,
        },
      });
      throw new BadRequestException(message);
    }
  }

  /** Resolve call id from CustomField or by matching CallFrom phone. */
  private async resolveExotelCallId(
    callId: string,
    params: Record<string, string>,
  ) {
    if (callId?.trim()) return callId.trim();
    const from =
      params.CallFrom ||
      params.From ||
      params.from ||
      params.CallFromNumber ||
      '';
    if (!from) return null;
    const digits = from.replace(/\D/g, '');
    const last10 = digits.slice(-10);
    if (last10.length < 10) return null;
    const recent = await this.prisma.call.findFirst({
      where: {
        provider: 'exotel',
        status: {
          in: [
            CallStatus.INITIATED,
            CallStatus.RINGING,
            CallStatus.IN_PROGRESS,
          ],
        },
        lead: { phone: { contains: last10 } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return recent?.id || null;
  }

  /**
   * Exotel Greeting applet URL response (text/plain body).
   * Default = ElevenLabs audio URL (same agent voice as browser demo).
   * Set EXOTEL_GREETING_MODE=text only as fallback (Exotel robotic TTS).
   */
  async getExotelGreetingPayload(
    callId: string,
    params: Record<string, string> = {},
  ) {
    const resolved = await this.resolveExotelCallId(callId, params);
    this.logger.log(
      `Exotel greeting hit callId=${callId || '-'} resolved=${resolved || '-'} from=${params.CallFrom || params.From || '-'}`,
    );

    const mode = String(process.env.EXOTEL_GREETING_MODE || 'audio').toLowerCase();
    const preferAudio = mode !== 'text';
    const fallbackText =
      'Namaste, main Neha bol rahi hoon Saya Group se. Kya abhi do minute baat ho sakti hai?';

    // Never 404 to Exotel — invalid/missing callId must still return playable text/audio
    const call = resolved
      ? await this.prisma.call.findUnique({ where: { id: resolved } })
      : null;

    if (!call) {
      this.logger.warn(
        `Exotel greeting without known call — using fallback (resolved=${resolved || '-'})`,
      );
      return {
        type: 'text',
        value: fallbackText,
      };
    }

    const settings = await this.aiService.getSettings();
    const greeting = call.greetingText?.trim() || fallbackText;

    await this.prisma.call.update({
      where: { id: call.id },
      data: { status: CallStatus.IN_PROGRESS },
    });

    if (preferAudio) {
      // Always synthesize phone-grade MP3 with the configured ElevenLabs voice
      const tts = await this.voice.textToSpeech({
        text: greeting,
        speaker: settings.agentVoice || 'rachel',
        language: call.languageDetected || settings.language || 'hi-IN',
        // Exotel-friendly rate; mp3_16000_32 is NOT in ElevenLabs allow-list
        outputFormat: 'mp3_22050_32',
      });
      const audioUrl = `${this.exotel.getPublicBaseUrl()}/api/calls/audio/${tts.fileName}`;
      await this.prisma.call.update({
        where: { id: call.id },
        data: { recordingUrl: audioUrl },
      });
      // Plain URL only (no ?query) — Exotel must treat body as audio URL, not TTS text
      this.logger.log(`Exotel greeting audio → ${audioUrl}`);
      return {
        type: 'audio_url',
        value: audioUrl,
      };
    }

    // Fallback: Exotel built-in TTS (different voice — avoid unless needed)
    const spoken = hasDevanagari(greeting)
      ? devanagariToRoman(greeting)
      : greeting;
    return {
      type: 'text',
      value: spoken.replace(/\s+/g, ' ').trim().slice(0, 500),
    };
  }

  async handleExotelPassthru(params: Record<string, string>) {
    const callId =
      params.CustomField || params.customField || params.callId || '';
    const id = await this.resolveExotelCallId(callId, params);
    if (id && params.CallSid) {
      await this.prisma.call.update({
        where: { id },
        data: {
          providerCallId: params.CallSid,
          status: CallStatus.IN_PROGRESS,
        },
      });
    }
    return { ok: true };
  }

  /** Twilio Voice webhook → TwiML (Play greeting + Connect Stream). */
  async getTwilioVoiceTwiml(
    callId: string,
    params: Record<string, string> = {},
  ) {
    const id = callId?.trim() || params.callId || params.CallId || '';
    const call = id
      ? await this.prisma.call.findUnique({ where: { id } })
      : null;

    if (call) {
      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          status: CallStatus.IN_PROGRESS,
          providerCallId: params.CallSid || call.providerCallId || undefined,
        },
      });
    }

    return this.twilio.buildVoiceTwiml({
      callId: call?.id || id || 'unknown',
      greetingAudioUrl: call?.recordingUrl || null,
      greetingText:
        call?.greetingText ||
        'Namaste, main Neha bol rahi hoon Saya Group se. Kya abhi do minute baat ho sakti hai?',
    });
  }

  async handleTwilioStatusWebhook(
    callId: string,
    body: Record<string, string>,
  ) {
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
    const map: Record<string, CallStatus> = {
      queued: CallStatus.INITIATED,
      initiated: CallStatus.INITIATED,
      ringing: CallStatus.RINGING,
      'in-progress': CallStatus.IN_PROGRESS,
      completed: CallStatus.COMPLETED,
      busy: CallStatus.FAILED,
      failed: CallStatus.FAILED,
      'no-answer': CallStatus.NO_ANSWER,
      canceled: CallStatus.FAILED,
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
          ...(mapped === CallStatus.NO_ANSWER || mapped === CallStatus.FAILED
            ? { outcome: CallOutcome.NO_ANSWER }
            : {}),
          ...(mapped === CallStatus.COMPLETED
            ? { summary: call.summary || 'Twilio call completed' }
            : {}),
        },
      });
    }
    return { ok: true };
  }

  /**
   * Exotel StatusCallback — update CRM status; on completed + RecordingUrl, run STT/qualify.
   */
  async handleExotelStatusWebhook(
    callId: string,
    body: Record<string, string>,
  ) {
    const id = await this.resolveExotelCallId(callId, body);
    if (!id) {
      this.logger.warn('Exotel status webhook without matching call id');
      return { ok: true };
    }

    const status = String(
      body.Status || body.CallStatus || body.status || '',
    ).toLowerCase();
    const map: Record<string, CallStatus> = {
      queued: CallStatus.INITIATED,
      'in-progress': CallStatus.IN_PROGRESS,
      'in_progress': CallStatus.IN_PROGRESS,
      ringing: CallStatus.RINGING,
      completed: CallStatus.COMPLETED,
      busy: CallStatus.FAILED,
      failed: CallStatus.FAILED,
      'no-answer': CallStatus.NO_ANSWER,
      'no_answer': CallStatus.NO_ANSWER,
      canceled: CallStatus.FAILED,
      cancelled: CallStatus.FAILED,
    };

    const mapped = map[status];
    const duration = Number(
      body.ConversationDuration ||
        body.DialCallDuration ||
        body.Duration ||
        body.CallDuration ||
        NaN,
    );

    if (mapped && mapped !== CallStatus.COMPLETED) {
      const data: {
        status: CallStatus;
        outcome?: CallOutcome;
        providerCallId?: string;
        duration?: number;
      } = { status: mapped };
      if (body.CallSid) data.providerCallId = body.CallSid;
      if (Number.isFinite(duration)) data.duration = duration;
      if (mapped === CallStatus.NO_ANSWER) data.outcome = CallOutcome.NO_ANSWER;
      if (mapped === CallStatus.FAILED) data.outcome = CallOutcome.NO_ANSWER;

      await this.prisma.call.update({ where: { id }, data });
      return { ok: true };
    }

    const recordingUrl = body.RecordingUrl || body.recording_url || '';
    if (recordingUrl || mapped === CallStatus.COMPLETED || !mapped) {
      await this.processExotelRecording(id, {
        RecordingUrl: recordingUrl,
        RecordingDuration: String(
          Number.isFinite(duration) ? duration : body.RecordingDuration || '',
        ),
        CallSid: body.CallSid,
      });
    }

    return { ok: true };
  }

  private async processExotelRecording(
    callId: string,
    body: Record<string, string>,
  ) {
    const call = await this.findOne(callId);
    const settings = await this.aiService.getSettings();
    const recordingUrl = body.RecordingUrl;
    const duration = Number(body.RecordingDuration || 0);

    let leadTranscript = '';
    let followUpText = '';
    let outcome: CallOutcome = CallOutcome.CONNECTED;

    if (recordingUrl) {
      try {
        const candidates = [
          recordingUrl,
          recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`,
          recordingUrl.endsWith('.wav') ? recordingUrl : `${recordingUrl}.wav`,
        ];
        let buffer: Buffer | null = null;
        for (const url of candidates) {
          try {
            const audioRes = await fetch(url);
            if (!audioRes.ok) continue;
            buffer = Buffer.from(await audioRes.arrayBuffer());
            if (buffer.length > 0) break;
          } catch {
            // try next
          }
        }
        if (!buffer?.length) {
          throw new Error('Could not download Exotel recording');
        }

        const fileName = `stt-${randomUUID()}.wav`;
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
            lead: fullLead!,
            userMessage: leadTranscript,
            priorTranscript: call.transcript,
            agentName: settings.agentName || 'Real Estate AI Agent',
            companyName:
              (settings as { companyName?: string }).companyName ||
              fullLead?.project?.companyName ||
              fullLead?.project?.builder,
            defaultLanguage:
              call.languageDetected || settings.language || 'hi-IN',
            tone: (settings as { tone?: string }).tone || 'friendly',
            systemPrompt: settings.systemPrompt || undefined,
            llmModel:
              (settings as { llmModel?: string }).llmModel ||
              'gemini-3.5-flash-lite',
            approvedPlaybook: (settings as { approvedPlaybook?: unknown })
              .approvedPlaybook,
            agentVoice: settings.agentVoice || 'rachel',
          });
          followUpText = result.replyText;
          outcome = this.conversation.mapOutcomeEnum(
            String(result.qualification.outcome || 'CONNECTED'),
          );

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

          await this.conversation.applyQualificationToLead(
            call.leadId,
            result.qualification as Record<string, unknown>,
          );

          const booking = await this.appointments.maybeBookFromCall({
            leadId: call.leadId,
            projectId:
              call.projectId ||
              fullLead?.projectId ||
              result.resolvedProjectId,
            userMessage: leadTranscript,
            priorTranscript: call.transcript,
            qualification: result.qualification as Record<string, unknown>,
          });
          if (booking.booked) {
            outcome = CallOutcome.SITE_VISIT_INTERESTED;
            const confirm = this.appointments.confirmationLine(
              booking,
              result.languageDetected,
            );
            if (
              confirm &&
              !/calendar|मीटिंग.*सेट|booked your meeting/i.test(followUpText)
            ) {
              followUpText = `${followUpText.replace(/\s+$/, '')} ${confirm}`;
            }
          }
        }
      } catch (error) {
        this.logger.error(
          `Exotel STT/follow-up failed: ${error instanceof Error ? error.message : error}`,
        );
        followUpText =
          'Thank you for your time. Our team will follow up with you shortly.';
        outcome = CallOutcome.CONNECTED;
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
        status: CallStatus.COMPLETED,
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
      .catch((err) =>
        this.logger.warn(
          `Auto-learn failed: ${err instanceof Error ? err.message : err}`,
        ),
      );
  }

  async demoTurn(
    body: {
      callId: string;
      message?: string;
      audioBase64?: string;
      fileName?: string;
    },
    onEvent?: (event: Record<string, unknown>) => void | Promise<void>,
  ) {
    const emit = async (event: Record<string, unknown>) => {
      if (!onEvent) return;
      await onEvent(event);
    };
    const streamMode = Boolean(onEvent);
    const [call, settings] = await Promise.all([
      this.findOne(body.callId),
      this.aiService.getSettings(),
    ]);
    const lead = call.lead;
    if (!lead) throw new NotFoundException('Lead missing on call');

    let userMessage = body.message?.trim() || '';

    if (!userMessage && body.audioBase64) {
      const fileName = body.fileName || `demo-${randomUUID()}.webm`;
      const filePath = path.join(process.cwd(), 'uploads', 'audio', fileName);
      fs.writeFileSync(filePath, Buffer.from(body.audioBase64, 'base64'));
      const stt = await this.voice.speechToText({
        filePath,
        language:
          call.languageDetected ||
          lead.preferredLanguage ||
          settings.language ||
          'hi-IN',
      });
      userMessage = stt.transcript.trim();
    }

    if (!userMessage) {
      throw new BadRequestException('Please type a message or record audio');
    }

    // Only ignore near-full copies of agent TTS (speaker echo), not real answers
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
    const norm = (t: string) =>
      t
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const userN = norm(userMessage);
    const agentN = norm(previousAgent);
    const leadN = norm(lead.name || '');
    const looksEcho =
      (leadN && userN === leadN) ||
      (agentN.length > 40 &&
        userN.length >= 30 &&
        (agentN === userN ||
          (agentN.includes(userN) && userN.length >= agentN.length * 0.4)));

    if (looksEcho) {
      const language =
        call.languageDetected ||
        lead.preferredLanguage ||
        settings.language ||
        'hinglish';
      const clarify: Record<string, string> = {
        'en-IN':
          'Sorry, I caught some background noise. Please say that again — what is your budget?',
        'hi-IN':
          'माफ़ कीजिए, थोड़ा noise आ गया। कृपया दोबारा बोलिए — आपका budget कितना है?',
        hinglish:
          'Sorry, थोड़ा noise आ गया। Please दोबारा बोलिए — आपका budget कितना है?',
        'mr-IN':
          'माफ करा, थोडा आवाज आला. कृपया पुन्हा सांगा — तुमचे बजेट किती आहे?',
        'gu-IN':
          'માફ કરજો, થોડો અવાજ આવ્યો. કૃપા કરીને ફરી કહો — તમારું બજેટ કેટલું છે?',
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
    let ttsChain: Promise<void> = Promise.resolve();

    // Parallel soft ack — only plays if real reply audio hasn't started yet
    if (streamMode) {
      const ackLang =
        call.languageDetected ||
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
          if (streamedAnyAudio) return;
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
      companyName:
        (settings as { companyName?: string }).companyName ||
        lead.project?.companyName ||
        lead.project?.builder,
      defaultLanguage:
        call.languageDetected ||
        lead.preferredLanguage ||
        settings.language ||
        'hi-IN',
      tone: (settings as { tone?: string }).tone || 'friendly',
      systemPrompt: settings.systemPrompt || undefined,
      llmModel:
        (settings as { llmModel?: string }).llmModel ||
        'gemini-3.5-flash-lite',
      approvedPlaybook: (settings as { approvedPlaybook?: unknown })
        .approvedPlaybook,
      agentVoice: settings.agentVoice || 'rachel',
      // Browser demo: always low-latency path (script-fast + short Gemini budget)
      // SSE stream adds early TTS; non-stream still must not wait 8s on Gemini
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
            if (!cleaned) return;
            // Ordered TTS queue — does not block LLM stream
            ttsChain = ttsChain
              .then(async () => {
                const tts = await this.voice.textToSpeech({
                  text: cleaned,
                  speaker: settings.agentVoice || 'rachel',
                  language:
                    call.languageDetected ||
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
                this.logger.warn(
                  `Stream TTS failed: ${err instanceof Error ? err.message : err}`,
                );
              });
          }
        : undefined,
    });

    // Wait for queued sentence audio before booking / done
    await ttsChain;

    // Mid-call: customer named a project → link lead + call for KB answers
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
    let outcome = this.conversation.mapOutcomeEnum(
      String(result.qualification.outcome || 'CONNECTED'),
    );

    const booking = await this.appointments.maybeBookFromCall({
      leadId: lead.id,
      projectId: lead.projectId || call.projectId || resolvedProjectId,
      userMessage,
      priorTranscript: call.transcript,
      qualification: result.qualification as Record<string, unknown>,
    });
    if (booking.booked) {
      outcome = CallOutcome.SITE_VISIT_INTERESTED;
      const confirm = this.appointments.confirmationLine(
        booking,
        result.languageDetected,
      );
      if (
        confirm &&
        !/calendar|मीटिंग.*सेट|booked your meeting/i.test(replyText)
      ) {
        replyText = `${replyText.replace(/\s+$/, '')} ${confirm}`;
      }
      (result.qualification as Record<string, unknown>).meetingBooked = true;
      (result.qualification as Record<string, unknown>).meetingAt = booking.label;
      (result.qualification as Record<string, unknown>).googleCalendarSynced =
        booking.calendarSynced;
      (result.qualification as Record<string, unknown>).googleLink =
        booking.googleLink || null;
    }

    const nextTranscript = [
      call.transcript || '',
      `Lead: ${userMessage}`,
      `Agent: ${replyText}`,
    ]
      .filter(Boolean)
      .join('\n');

    const prevQual =
      call.qualificationJson && typeof call.qualificationJson === 'object'
        ? (call.qualificationJson as Record<string, unknown>)
        : {};
    const openerStyle = String(prevQual.openerStyle || '');
    const engagedWin =
      ['QUALIFIED', 'SITE_VISIT_INTERESTED', 'CALLBACK_REQUESTED'].includes(
        String(result.qualification.outcome || ''),
      ) ||
      Boolean(result.known?.budgetLabel || result.known?.location || result.known?.bhk) ||
      /interested|haan|हां|हाँ|sure|ok|okay|tell me|batao|बताओ|ha[a]?n/i.test(
        userMessage,
      );

    const prevScore =
      typeof prevQual.interestScore === 'number'
        ? Number(prevQual.interestScore)
        : typeof call.interestScore === 'number'
          ? call.interestScore
          : null;
    const interestScore = computeInterestScore({
      userMessage,
      priorTranscript: nextTranscript,
      known: result.known,
      outcome: String(result.qualification.outcome || outcome),
      siteVisitInterest: Boolean(
        (result.qualification as Record<string, unknown>).siteVisitInterest,
      ),
      meetingBooked: booking.booked,
      previousScore: prevScore,
    });
    const interestLevel = `${interestLevelFromScore(interestScore)} (${interestScore}/10)`;

    const mergedQual = {
      ...prevQual,
      ...result.qualification,
      interestScore,
      interestLevel,
      openerStyle: openerStyle || prevQual.openerStyle,
      openerWinRecorded: prevQual.openerWinRecorded || engagedWin || false,
      meetingBooked: booking.booked || prevQual.meetingBooked || false,
      meetingAt: booking.label || prevQual.meetingAt || null,
      googleCalendarSynced:
        booking.calendarSynced || prevQual.googleCalendarSynced || false,
      googleLink: booking.googleLink || prevQual.googleLink || null,
    };

    const durationSecs = this.elapsedSeconds(call.createdAt, call.duration);

    // Persist in background — never block audio return on DB writes
    void (async () => {
      if (engagedWin && openerStyle && !prevQual.openerWinRecorded) {
        await this.aiService
          .recordOpenerWin(openerStyle as import('../calls/opener-bank').OpenerStyle)
          .catch(() => undefined);
      }

      await this.prisma.call.update({
        where: { id: call.id },
        data: {
          transcript: nextTranscript,
          summary: String(result.qualification.summary || '').slice(0, 500),
          outcome,
          status: CallStatus.IN_PROGRESS,
          duration: durationSecs,
          interestScore,
          provider: 'browser-demo',
          languageDetected: result.languageDetected,
          qualificationJson: mergedQual as unknown as Prisma.InputJsonValue,
          sourcesJson: result.sources as unknown as Prisma.InputJsonValue,
          suggestedNextAction: String(
            result.qualification.suggestedNextAction ||
              (booking.booked ? `Meeting ${booking.label}` : ''),
          ),
          projectId: lead.projectId || call.projectId,
        },
      });

      await this.conversation.applyQualificationToLead(lead.id, {
        ...(result.qualification as Record<string, unknown>),
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
          } as unknown as Prisma.InputJsonValue,
        },
      });
    })().catch((err) =>
      this.logger.warn(
        `Demo turn persist failed: ${err instanceof Error ? err.message : err}`,
      ),
    );

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

    // If booking confirmation was appended after streamed LLM text, speak the tail
    if (streamedAnyAudio && booking.booked) {
      const confirm = this.appointments.confirmationLine(
        booking,
        result.languageDetected,
      );
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
    } else if (tts) {
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

    // Learn during live turns too (not only End Call) so playbook keeps updating
    void this.aiService
      .learnFromCompletedCall({
        callId: call.id,
        outcome: String(outcome),
        transcript: nextTranscript,
        interestScore,
      })
      .catch((err) =>
        this.logger.warn(
          `Auto-learn (turn) failed: ${err instanceof Error ? err.message : err}`,
        ),
      );

    return payload;
  }

  async endDemo(callId: string) {
    const call = await this.findOne(callId);
    const duration = this.elapsedSeconds(call.createdAt, call.duration);
    const prevQual =
      call.qualificationJson && typeof call.qualificationJson === 'object'
        ? (call.qualificationJson as Record<string, unknown>)
        : {};
    let interestScore =
      typeof call.interestScore === 'number'
        ? call.interestScore
        : typeof prevQual.interestScore === 'number'
          ? Number(prevQual.interestScore)
          : computeInterestScore({
              userMessage: '',
              priorTranscript: call.transcript,
              outcome: String(call.outcome || 'CONNECTED'),
              meetingBooked: Boolean(prevQual.meetingBooked),
              siteVisitInterest: Boolean(prevQual.siteVisitInterest),
            });
    interestScore = Math.max(0, Math.min(10, Math.round(interestScore)));
    const interestLevel = `${interestLevelFromScore(interestScore)} (${interestScore}/10)`;

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        duration,
        interestScore,
        status: CallStatus.COMPLETED,
        qualificationJson: {
          ...prevQual,
          interestScore,
          interestLevel,
        } as unknown as Prisma.InputJsonValue,
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
      .catch((err) =>
        this.logger.warn(
          `Auto-learn failed: ${err instanceof Error ? err.message : err}`,
        ),
      );

    return updated;
  }
}

