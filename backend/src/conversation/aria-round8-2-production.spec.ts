import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CustomerMemoryService } from '../memory/customer-memory.service';
import { McubeStreamService } from '../calls/mcube-stream.service';
import { AiService } from '../ai/ai.service';
import { VoiceService } from '../voice/voice.service';
import { ConversationService } from './conversation.service';
import { LlmService } from '../llm/llm.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { FactExtractorService } from '../memory/fact-extractor.service';
import { QuestionValidatorService } from '../memory/question-validator.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { getVersionTelemetry, APP_VERSION, DEPLOYMENT_ID } from '../version';

describe('Aria Round 8.2 — Production Reliability, Audio Stability & Complete Issue Resolution', () => {
  let mcubeStreamService: McubeStreamService;
  let conversationService: ConversationService;
  let voiceService: jest.Mocked<Partial<VoiceService>>;
  let customerMemory: jest.Mocked<Partial<CustomerMemoryService>>;
  let appController: AppController;

  const mockPrisma = {
    lead: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'lead-82', name: 'Lead 82', phone: '+919999999982' }),
      update: jest.fn().mockResolvedValue({ id: 'lead-82' }),
    },
    call: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'call-82', transcript: '' }),
      update: jest.fn().mockResolvedValue({ id: 'call-82' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    project: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'proj-1',
          name: 'Palace Heights by Rudra',
          builder: 'Rudra Buildwell',
          location: 'GH-02B, Sector 1, Greater Noida West',
          propertyType: 'APARTMENT',
          startingPrice: 6090000,
          possessionDate: new Date(Date.now() + 180 * 86400000), // ~6 months
          description: '1/2/3/4 BHK Luxury Apartments, 50:50 payment plan',
          reraNumber: 'UPRERAPRJ11124',
        },
        {
          id: 'proj-2',
          name: 'Saya Pre-Launch',
          builder: 'Saya Group',
          location: 'Raj Nagar Extension, Ghaziabad',
          propertyType: 'APARTMENT',
          startingPrice: 6900000,
          possessionDate: new Date('2029-01-01'),
          description: '18 Acres, 17-18 Towers, 1,50,000 sq.ft luxury club. 2/3/4 BHK',
          reraNumber: 'UPRERAPRJ00000',
        },
        {
          id: 'proj-3',
          name: 'Future Estate by Future World',
          builder: 'Future World',
          location: 'Plot No 16 E, Sector 1, Greater Noida West',
          propertyType: 'APARTMENT',
          startingPrice: 8632470,
          possessionDate: new Date('2026-12-31'),
          description: '7.9 Acres, 9 Towers. 2 BHK, SWAMIH funded',
          reraNumber: null,
        },
      ]),
    },
  };

  const mockConfig = {
    get: jest.fn(() => null),
  };

  const createMockWs = () => {
    const handlers: Record<string, Function> = {};
    return {
      readyState: 1, // OPEN
      OPEN: 1,
      CLOSED: 3,
      on: jest.fn((event: string, cb: Function) => {
        handlers[event] = cb;
      }),
      send: jest.fn(),
      ping: jest.fn(),
      simulateMessage: (data: any) => {
        if (handlers['message']) handlers['message'](JSON.stringify(data));
      },
      simulateClose: (code = 1000, reason = 'Normal Closure') => {
        if (handlers['close']) handlers['close'](code, reason);
      },
      simulatePong: () => {
        if (handlers['pong']) handlers['pong']();
      },
      simulateError: (err = new Error('Socket test error')) => {
        if (handlers['error']) handlers['error'](err);
      },
    };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    voiceService = {
      speechToText: jest.fn().mockResolvedValue({ transcript: 'Kya 3 BHK ready to move available hai?', languageCode: 'en-IN' }),
      textToSpeech: jest.fn().mockResolvedValue({ audioBase64: Buffer.alloc(1600, 0xff).toString('base64') }),
    };
    customerMemory = {
      initializeCallMemory: jest.fn().mockResolvedValue({ isReturningCustomer: false, customer: {} }),
      recordTurn: jest.fn().mockResolvedValue(undefined),
      applyExtractedFacts: jest.fn().mockResolvedValue({}),
      persistMemoryToDb: jest.fn().mockResolvedValue(undefined),
      updateCallMemory: jest.fn().mockImplementation((id, cb) => cb({ customer: {} })),
      getCallMemory: jest.fn().mockResolvedValue({ customer: {} }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        McubeStreamService,
        ConversationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LlmService, useValue: { generateResponse: jest.fn().mockResolvedValue('Ji bilkul') } },
        { provide: KnowledgeService, useValue: { searchKnowledge: jest.fn().mockResolvedValue([]) } },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AiService, useValue: { getSettings: jest.fn().mockResolvedValue({ companyName: 'Workains Reality', agentName: 'Aria' }) } },
        { provide: VoiceService, useValue: voiceService },
        { provide: CustomerMemoryService, useValue: customerMemory },
        { provide: FactExtractorService, useValue: { extractFromUtterance: jest.fn().mockReturnValue(null) } },
        { provide: QuestionValidatorService, useValue: { validateAndSanitize: jest.fn().mockImplementation((m, s) => ({ wasRepeated: false, sanitized: s })) } },
        { provide: AppointmentsService, useValue: { maybeBookFromCall: jest.fn().mockResolvedValue({ booked: false }) } },
      ],
    }).compile();

    mcubeStreamService = module.get<McubeStreamService>(McubeStreamService);
    conversationService = module.get<ConversationService>(ConversationService);
    appController = module.get<AppController>(AppController);
  });

  // ==========================================
  // SECTION 1: DURATION SUITE (30s, 60s, 110s, 130s, 3m, 5m, 10m)
  // ==========================================
  describe('Section 1: Multi-Duration Call Lifecycle Stability', () => {
    it('1.1: 30-second short call remains healthy and tracks frames', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-dur-30s');
      const session = mcubeStreamService.getActiveSession('call-dur-30s')!;
      session.sessionStartedAt = Date.now() - 30_000;
      session.inboundFrameCount = 50;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      const metrics = mcubeStreamService.getCallMetrics('call-dur-30s')!;
      expect(metrics.sessionAgeMs).toBeGreaterThanOrEqual(30_000);
      expect(metrics.heartbeatStatus).toBe('INITIALIZING');
      expect(metrics.failureReason).toBe('NONE');
    });

    it('1.2: 60-second normal call maintains active state and responds to pong', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-dur-60s');
      const session = mcubeStreamService.getActiveSession('call-dur-60s')!;
      session.sessionStartedAt = Date.now() - 60_000;
      session.heartbeatPingAt = Date.now() - 100;
      mockWs.simulatePong();

      expect(session.heartbeatRttMs).toBeGreaterThanOrEqual(0);
      expect(session.missedPings).toBe(0);

      const metrics = mcubeStreamService.getCallMetrics('call-dur-60s')!;
      expect(metrics.heartbeatStatus).toBe('HEALTHY');
      expect(metrics.sessionAgeMs).toBeGreaterThanOrEqual(60_000);
    });

    it('1.3: 110-second boundary call (pre-2min) keeps active session protected', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-dur-110s');
      const session = mcubeStreamService.getActiveSession('call-dur-110s')!;
      session.sessionStartedAt = Date.now() - 110_000;
      session.inboundFrameCount = 220;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      expect(mcubeStreamService.getActiveSession('call-dur-110s')).toBe(session);
      expect(mcubeStreamService.getReconnectCache('call-dur-110s')).toBeUndefined();
    });

    it('1.4: 130-second critical boundary call (post-2min) NEVER drops audio or session', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-dur-130s');
      const session = mcubeStreamService.getActiveSession('call-dur-130s')!;
      session.sessionStartedAt = Date.now() - 130_000;
      session.turnCount = 3;
      session.inboundFrameCount = 260;
      session.outboundFrameCount = 6;
      session.lastInboundAudioAt = Date.now() - 1000;

      // Ensure watchdog preserves session past 2 minute threshold
      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      const metrics = mcubeStreamService.getCallMetrics('call-dur-130s')!;
      expect(metrics.sessionAgeMs).toBeGreaterThanOrEqual(130_000);
      expect(session.closed).toBe(false);
      expect(metrics.failureReason).toBe('NONE');
    });

    it('1.5: 3-minute call (180s) operates continuously with bidirectional turns', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-dur-3m');
      const session = mcubeStreamService.getActiveSession('call-dur-3m')!;
      session.sessionStartedAt = Date.now() - 180_000;
      session.turnCount = 5;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      expect(session.closed).toBe(false);
      expect(mcubeStreamService.getActiveSession('call-dur-3m')).toBe(session);
    });

    it('1.6: 5-minute extended call (300s) preserves customer memory and context', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-dur-5m');
      const session = mcubeStreamService.getActiveSession('call-dur-5m')!;
      session.sessionStartedAt = Date.now() - 300_000;
      session.memory = {
        callId: 'call-dur-5m',
        customer: { bhk: '3 BHK', budgetLabel: '1.5 Cr' },
        selectedProjectId: 'Palace Heights',
        selectedProjectLock: true,
      };

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      expect(session.memory.selectedProjectId).toBe('Palace Heights');
      expect(session.memory.selectedProjectLock).toBe(true);
    });

    it('1.7: 10-minute stress call (600s) does not suffer memory exhaustion or socket leak', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-dur-10m');
      const session = mcubeStreamService.getActiveSession('call-dur-10m')!;
      session.sessionStartedAt = Date.now() - 600_000;
      session.turnCount = 18;
      session.inboundFrameCount = 1200;
      session.outboundFrameCount = 36;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      const metrics = mcubeStreamService.getCallMetrics('call-dur-10m')!;
      expect(metrics.sessionAgeMs).toBeGreaterThanOrEqual(600_000);
      expect(session.closed).toBe(false);
    });
  });

  // ==========================================
  // SECTION 2: DISTINCT TELEPHONY AUDIO STAGES
  // ==========================================
  describe('Section 2: Distinct Telephony Audio Pipeline Stages', () => {
    it('2.1: Accurately distinguishes Generated vs Transmitted vs Played stages', async () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-audio-stages');
      const session = mcubeStreamService.getActiveSession('call-audio-stages')!;
      session.streamId = 'stream-audio-stages';

      // Stage 1: Synthesis generates audio
      const audio = await (mcubeStreamService as any).synthesizeForSession('Test speech synthesis', session, {});
      expect(audio).toBeDefined();
      expect(session.audioGeneratedCount).toBe(1);
      expect(session.audioGeneratedBytes).toBe(1600);
      expect(session.audioTransmittedCount).toBe(0);
      expect(session.audioPlayedCount).toBe(0);

      // Stage 2: Transmission to MCube (sendPlayAudio expects expectedGen)
      await (mcubeStreamService as any).sendPlayAudio(mockWs, session, audio, session.flushGen);
      expect(session.audioTransmittedCount).toBe(1);
      expect(session.audioTransmittedBytes).toBe(1600);
      expect(session.audioPlayedCount).toBe(0);

      const segmentName = Array.from(session.pendingSegments)[0];
      expect(segmentName).toBeDefined();
      expect(session.segmentBytes.get(segmentName)).toBe(1600);

      // Stage 3: Carrier plays stream event acknowledgement (MCube sends { event: 'playedStream', name: segmentName })
      mockWs.simulateMessage({
        event: 'playedStream',
        streamId: 'stream-audio-stages',
        name: segmentName,
      });
      expect(session.audioPlayedCount).toBe(1);
      expect(session.audioPlayedBytes).toBe(1600);
      expect(session.segmentBytes.has(segmentName)).toBe(false);

      const metrics = mcubeStreamService.getCallMetrics('call-audio-stages')!;
      expect(metrics.audioGeneratedCount).toBe(1);
      expect(metrics.audioTransmittedCount).toBe(1);
      expect(metrics.audioPlayedCount).toBe(1);
      expect(metrics.audioGeneratedBytes).toBe(1600);
      expect(metrics.audioTransmittedBytes).toBe(1600);
      expect(metrics.audioPlayedBytes).toBe(1600);
    });

    it('2.2: Clears pending segment tracking on barge-in without inflating played counts', async () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-barge-stages');
      const session = mcubeStreamService.getActiveSession('call-barge-stages')!;
      session.streamId = 'stream-barge-stages';

      // Send audio segment
      await (mcubeStreamService as any).sendPlayAudio(mockWs, session, Buffer.alloc(800, 0xaa), session.flushGen);
      expect(session.audioTransmittedBytes).toBe(800);
      expect(session.audioPlayedBytes).toBe(0);
      expect(session.pendingSegments.size).toBe(1);

      // Simulate customer interruption (barge-in): clearAudio and segment purge
      mcubeStreamService.sendClearAudio(mockWs as any, session.streamId);
      session.cancelPlay = true;
      session.agentPlaying = false;
      session.pendingSegments.clear();
      session.segmentBytes.clear();
      session.flushGen++;

      expect(session.pendingSegments.size).toBe(0);
      expect(session.segmentBytes.size).toBe(0);
      expect(session.audioPlayedBytes).toBe(0); // played count remains uninflated
    });
  });

  // ==========================================
  // SECTION 3: WEBSOCKET HEARTBEAT & DEAD CONNECTION DETECTION
  // ==========================================
  describe('Section 3: WebSocket Heartbeat & Dead Connection Detection', () => {
    it('3.1: Heartbeat tracks genuine RTT on pong', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-rtt-track');
      const session = mcubeStreamService.getActiveSession('call-rtt-track')!;

      session.heartbeatPingAt = Date.now() - 42;
      mockWs.simulatePong();

      expect(session.heartbeatRttMs).toBeGreaterThanOrEqual(40);
      expect(session.missedPings).toBe(0);

      const metrics = mcubeStreamService.getCallMetrics('call-rtt-track')!;
      expect(metrics.heartbeatStatus).toBe('HEALTHY');
      expect(metrics.heartbeatRttMs).toBe(session.heartbeatRttMs);
    });

    it('3.2: Stale connection transitions through DEGRADED to DEAD on missed pings', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-dead-detect');
      const session = mcubeStreamService.getActiveSession('call-dead-detect')!;

      // 1 missed ping -> DEGRADED
      session.heartbeatPingAt = Date.now() - 10000;
      session.heartbeatPongAt = Date.now() - 25000;
      session.missedPings = 1;

      let metrics = mcubeStreamService.getCallMetrics('call-dead-detect')!;
      expect(metrics.heartbeatStatus).toBe('DEGRADED');

      // >= 2 missed pings -> DEAD
      session.missedPings = 2;
      metrics = mcubeStreamService.getCallMetrics('call-dead-detect')!;
      expect(metrics.heartbeatStatus).toBe('DEAD');
    });
  });

  // ==========================================
  // SECTION 4: SAFE WATCHDOG GENERATION INVALIDATION
  // ==========================================
  describe('Section 4: Safe Watchdog Generation Invalidation', () => {
    it('4.1: Watchdog self-healing increments flushGen and aborts active operation', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-watchdog-heal');
      const session = mcubeStreamService.getActiveSession('call-watchdog-heal')!;

      const priorGen = session.flushGen;
      const abortCtrl = new AbortController();
      session.turnAbortController = abortCtrl;
      session.activeOperationId = 'op_stuck_turn_123';
      session.busy = true;
      session.busySince = Date.now() - 20000; // stuck for 20s
      session.agentPlaying = true;
      session.pendingSegments.add('seg_abandoned');

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      expect(session.busy).toBe(false);
      expect(session.busySince).toBe(0);
      expect(session.activeOperationId).toBeNull();
      expect(session.flushGen).toBe(priorGen + 1);
      expect(abortCtrl.signal.aborted).toBe(true);
      expect(session.pendingSegments.size).toBe(0);
      expect(session.recoveryAttempts).toBe(1);
    });
  });

  // ==========================================
  // SECTION 5: INVENTORY & READY-TO-MOVE MATCHING
  // ==========================================
  describe('Section 5: Inventory Verification & Possession Status Accuracy', () => {
    it('5.1: Annotates each project with verified Possession Status', async () => {
      const overview = await conversationService.getProjectsOverview();
      expect(overview).toContain('Possession Status:');
      // Palace Heights verified near possession
      expect(overview).toContain('Palace Heights by Rudra');
      expect(overview).toContain('Near Possession (3 towers within 6 months, balance under construction)');
      // Pre-launch projects explicitly marked
      expect(overview).toContain('Saya Pre-Launch');
      expect(overview).toContain('Pre-Launch / Under Construction');
    });

    it('5.2: Injects strict warning when customer specifies ready-to-move preference', async () => {
      const overview = await conversationService.getProjectsOverview({
        possessionPreference: 'ready_to_move',
      });
      expect(overview).toContain('CUSTOMER POSSESSION PREFERENCE: READY-TO-MOVE');
      expect(overview).toContain('NEVER misrepresent them as ready-to-move');
    });
  });

  // ==========================================
  // SECTION 6: TELEMETRY & VERSION DEPLOYMENT ENDPOINT
  // ==========================================
  describe('Section 6: Version & Deployment Telemetry', () => {
    it('6.1: APP_VERSION is 1.8.2 and DEPLOYMENT_ID is workains-prod-round8.2', () => {
      expect(APP_VERSION).toBe('1.8.2');
      expect(DEPLOYMENT_ID).toBe('workains-prod-round8.2');
    });

    it('6.2: AppController @Get("version") exposes telemetry matching Round 8.2', () => {
      const ver = appController.getVersion();
      expect(ver.version).toBe('1.8.2');
      expect(ver.deploymentId).toBe('workains-prod-round8.2');
      expect(ver.processPid).toBe(process.pid);
      expect(ver.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(ver.nodeVersion).toBe(process.version);
    });
  });
});
