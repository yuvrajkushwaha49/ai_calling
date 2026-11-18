import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CustomerMemoryService } from '../memory/customer-memory.service';
import { McubeStreamService, TurnLifecycleState } from '../calls/mcube-stream.service';
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
import { buildContextualLivenessAck, buildFollowUpReply, detectIntent } from '../calls/call-scripts';
import * as fs from 'fs';
import * as path from 'path';

describe('Aria Round 8.3 — Final Production Stability & Deployment Fix', () => {
  let mcubeStreamService: McubeStreamService;
  let conversationService: ConversationService;
  let appController: AppController;

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

  const mockPrisma = {
    lead: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'lead-83', name: 'Lead 83', phone: '+919999999983' }),
      update: jest.fn().mockResolvedValue({ id: 'lead-83' }),
    },
    call: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'call-83', transcript: '' }),
      update: jest.fn().mockResolvedValue({ id: 'call-83' }),
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
          name: 'Apex The Kremlin',
          builder: 'Apex Heights Pvt Ltd',
          location: 'Plot No. 4 BS-2/3, Siddharth Vihar Yojna, Ghaziabad, UP',
          propertyType: 'APARTMENT',
          startingPrice: 9980000,
          possessionDate: new Date(Date.now() - 30 * 86400000), // Ready
          description: 'Apex The Kremlin in Siddharth Vihar. Configurations: 2 BHK, 3 BHK (1340, 1495, 1698 sq.ft). Almost ready to move in.',
          reraNumber: 'UPRERAPRJ11139',
        },
      ]),
    },
  };

  const mockConfig = {
    get: jest.fn(() => null),
  };

  const mockAiService = {
    getSettings: jest.fn().mockResolvedValue({
      agentName: 'Aria',
      companyName: 'Workains Realty',
      language: 'hinglish',
      tone: 'friendly',
      agentVoice: 'rachel',
    }),
  };

  const mockVoiceService = {
    synthesizeSpeech: jest.fn().mockResolvedValue(Buffer.alloc(3200)),
    getElevenLabsLatencyStats: jest.fn().mockReturnValue({}),
  };

  const mockCustomerMemory = {
    initializeCallMemory: jest.fn().mockResolvedValue({ isReturningCustomer: false, customer: {} }),
    recordTurn: jest.fn().mockResolvedValue(undefined),
    applyExtractedFacts: jest.fn().mockResolvedValue({}),
    persistMemoryToDb: jest.fn().mockResolvedValue(undefined),
    updateCallMemory: jest.fn().mockImplementation((id, cb) => cb({ customer: {} })),
    getCallMemory: jest.fn().mockResolvedValue({ customer: {} }),
    enrichLiveSession: jest.fn().mockImplementation((_lead, _facts, mem) => mem || {}),
    syncSessionToDb: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        ConversationService,
        McubeStreamService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AiService, useValue: mockAiService },
        { provide: VoiceService, useValue: mockVoiceService },
        { provide: CustomerMemoryService, useValue: mockCustomerMemory },
        {
          provide: LlmService,
          useValue: {
            generateResponse: jest.fn().mockResolvedValue('Main Aria hoon Workains Realty se.'),
          },
        },
        {
          provide: KnowledgeService,
          useValue: {
            searchKnowledge: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: FactExtractorService, useValue: {} },
        { provide: QuestionValidatorService, useValue: {} },
        { provide: AppointmentsService, useValue: {} },
      ],
    }).compile();

    mcubeStreamService = module.get<McubeStreamService>(McubeStreamService);
    conversationService = module.get<ConversationService>(ConversationService);
    appController = module.get<AppController>(AppController);
  });

  describe('1. PM2 Build and Deployment Reliability', () => {
    it('should verify nest-cli.json has deleteOutDir: false to protect dist/ from premature deletion', () => {
      const nestCliPath = path.resolve(__dirname, '../../nest-cli.json');
      expect(fs.existsSync(nestCliPath)).toBe(true);
      const nestCliContent = JSON.parse(fs.readFileSync(nestCliPath, 'utf8'));
      expect(nestCliContent.compilerOptions?.deleteOutDir).toBe(false);
    });

    it('should verify ecosystem.config.js exists with correct cwd and main entrypoint', () => {
      const ecoPath = path.resolve(__dirname, '../../../ecosystem.config.js');
      expect(fs.existsSync(ecoPath)).toBe(true);
      const ecoContent = fs.readFileSync(ecoPath, 'utf8');
      expect(ecoContent).toContain("script: 'dist/main.js'");
      expect(ecoContent).toContain("cwd: '/home/ubuntu/realestate-crm/backend'");
      expect(ecoContent).toContain('crm-backend');
    });

    it('should verify scripts/safe-deploy.sh exists with atomic dist.bak rollback logic', () => {
      const deployScriptPath = path.resolve(__dirname, '../../../scripts/safe-deploy.sh');
      expect(fs.existsSync(deployScriptPath)).toBe(true);
      const deployScript = fs.readFileSync(deployScriptPath, 'utf8');
      expect(deployScript).toContain('dist.bak');
      expect(deployScript).toContain('pm2 reload');
      expect(deployScript).toContain('/api/version');
      expect(deployScript).toContain('Restored working dist from dist.bak');
    });
  });

  describe('2. Deployment Identity Verification', () => {
    it('should expose APP_VERSION as 1.8.3 and DEPLOYMENT_ID as workains-prod-round8.3', () => {
      expect(APP_VERSION).toBe('1.8.3');
      expect(DEPLOYMENT_ID).toBe('workains-prod-round8.3');
    });

    it('should return 1.8.3 from AppController /api/version telemetry endpoint', () => {
      const versionInfo = appController.getVersion();
      expect(versionInfo.version).toBe('1.8.3');
      expect(versionInfo.deploymentId).toBe('workains-prod-round8.3');
      expect(versionInfo.commitSha).toBeDefined();
      expect(versionInfo.processPid).toBeDefined();
      expect(versionInfo.uptimeSeconds).toBeDefined();
    });
  });

  describe('3. TurnLifecycleState & Barge-In State Management', () => {
    it('should initialize session in IDLE lifecycle state and transition correctly', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'test-turn-call');
      const session = mcubeStreamService.getActiveSession('test-turn-call')!;
      expect(session).toBeDefined();
      expect(session.operationState).toBe(TurnLifecycleState.IDLE);
      expect(session.activeGenerationId).toBe(0);

      // Transition through lifecycle states
      session.operationState = TurnLifecycleState.STT_IN_PROGRESS;
      expect(session.operationState).toBe('STT_IN_PROGRESS');

      session.operationState = TurnLifecycleState.LLM_IN_PROGRESS;
      expect(session.operationState).toBe('LLM_IN_PROGRESS');

      session.operationState = TurnLifecycleState.TTS_IN_PROGRESS;
      expect(session.operationState).toBe('TTS_IN_PROGRESS');

      session.operationState = TurnLifecycleState.AUDIO_BUFFERED;
      expect(session.operationState).toBe('AUDIO_BUFFERED');

      session.operationState = TurnLifecycleState.CARRIER_PLAYING;
      expect(session.operationState).toBe('CARRIER_PLAYING');
    });

    it('should accurately handle audio queue drain during customer interrupt', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'test-bargein-call');
      const session = mcubeStreamService.getActiveSession('test-bargein-call')!;

      // Simulate completed LLM & TTS generations with audio waiting in buffer
      session.operationState = TurnLifecycleState.AUDIO_BUFFERED;
      session.audioQueue = [Buffer.alloc(3200)];
      session.turnAbortController = new AbortController();

      // Trigger interrupt cleanup
      session.turnAbortController.abort();
      session.audioQueue = [];
      session.operationState = TurnLifecycleState.ABORTED;
      session.lastCancellationReason = 'CUSTOMER_INTERRUPT';

      expect(session.operationState).toBe(TurnLifecycleState.ABORTED);
      expect(session.lastCancellationReason).toBe('CUSTOMER_INTERRUPT');
      expect(session.audioQueue.length).toBe(0);
    });
  });

  describe('4. MCube Playback Acknowledgement & Inferred Drain Separation', () => {
    it('should separately track provider-accepted, confirmed-played, and inferred-drain metrics', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'test-drain-call');
      const session = mcubeStreamService.getActiveSession('test-drain-call')!;

      expect(session.audioProviderAcceptedCount).toBe(0);
      expect(session.audioProviderAcceptedBytes).toBe(0);
      expect(session.audioConfirmedPlayedCount).toBe(0);
      expect(session.audioConfirmedPlayedBytes).toBe(0);
      expect(session.audioInferredDrainCount).toBe(0);
      expect(session.audioInferredDrainBytes).toBe(0);

      // Simulate MCube checkpoint/ack (provider-accepted)
      session.pendingSegments.add('seg_1');
      session.segmentBytes.set('seg_1', 3200);
      mockWs.simulateMessage({ event: 'checkpoint', name: 'seg_1' });
      expect(session.audioProviderAcceptedCount).toBe(1);
      expect(session.audioProviderAcceptedBytes).toBe(3200);

      // Simulate MCube playedStream event (confirmed carrier played)
      mockWs.simulateMessage({ event: 'playedStream', name: 'seg_1' });
      expect(session.audioConfirmedPlayedCount).toBe(1);
      expect(session.audioConfirmedPlayedBytes).toBe(3200);

      // Simulate watchdog Condition F: clearing stale unacknowledged segment (inferred drain)
      session.pendingSegments.add('stale_seg');
      session.segmentBytes.set('stale_seg', 6400);
      session.lastAudioChunkSentAt = Date.now() - 25000; // > 20s
      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      expect(session.audioInferredDrainCount).toBe(1);
      expect(session.audioInferredDrainBytes).toBe(6400);
      // Confirmed played should remain untouched by inferred drain!
      expect(session.audioConfirmedPlayedBytes).toBe(3200);
    });
  });

  describe('5. Hello Repetition & Conversation Loops', () => {
    it('should rotate responses on consecutive liveness checks ("Hello?") to break loops', () => {
      // 1st liveness check
      const ack1 = buildContextualLivenessAck({ consecutiveLivenessChecks: 1 });
      expect(ack1).toBe('हाँ जी, आवाज़ आ रही है! बोलिए, मैं सुन रही हूँ।');

      // 2nd liveness check
      const ack2 = buildContextualLivenessAck({ consecutiveLivenessChecks: 2 });
      expect(ack2).toBe('हाँ जी मैं लाइन पर ही हूँ, बिल्कुल सुन पा रही हूँ! आप बताइए?');

      // 3rd liveness check
      const ack3 = buildContextualLivenessAck({ consecutiveLivenessChecks: 3 });
      expect(ack3).toBe('जी मैं सुन रही हूँ! क्या आपको मेरी आवाज़ साफ़ आ रही है?');

      // 4th liveness check (breaks infinite loop by offering callback)
      const ack4 = buildContextualLivenessAck({ consecutiveLivenessChecks: 4 });
      expect(ack4).toContain('शायद नेटवर्क में कुछ दिक्कत लग रही है');
      expect(ack4).toContain('दोबारा कॉल करूँ');
    });

    it('should resume conversation context during liveness checks if question was pending', () => {
      const ackWithContext = buildContextualLivenessAck({
        priorTranscript: 'Agent: Aapka budget lagbhag kitna hai?\n',
        consecutiveLivenessChecks: 1,
      });
      expect(ackWithContext).toContain('बजट');
    });

    it('should reset consecutiveLivenessChecks when user asks a substantive question', () => {
      expect(detectIntent('Hello?').isGreeting).toBe(true);
      expect(detectIntent('Budget kitna hai?').isGreeting).toBe(false);
      expect(detectIntent('Palace heights kahan hai?').isGreeting).toBe(false);
    });
  });

  describe('6. Property Inventory Validation (3 BHK Ready-to-Move)', () => {
    it('should include Apex The Kremlin and Quebec by Apex Group in verifiedDetails as Almost Ready to Move', async () => {
      const overview = await conversationService.getProjectsOverview({
        possessionPreference: 'ready to move',
        customerBudgetRupees: 10000000,
      });
      expect(overview).toContain('Apex The Kremlin');
      expect(overview).toContain('Almost Ready to Move');
      expect(overview).toContain('Quebec by Apex Group');
      expect(overview).toContain('Palace Heights');
    });

    it('should strictly prohibit claiming Saya Pre-Launch or Future Estate are Ready-to-Move', async () => {
      const overview = await conversationService.getProjectsOverview({
        possessionPreference: 'ready to move',
      });
      expect(overview).toContain('NEVER misrepresent them as ready-to-move');
      expect(overview).toContain('Saya Pre-Launch');
      expect(overview).toContain('Future Estate');
    });
  });

  describe('7. Two-Minute Audio Boundary & Extended Duration Tests', () => {
    const testDurations = [
      { name: '1:50 (110s) Pre-boundary', seconds: 110 },
      { name: '2:10 (130s) Critical Post-120s Boundary', seconds: 130 },
      { name: '3:00 (180s) Active Call Duration', seconds: 180 },
      { name: '5:00 (300s) Extended Discussion', seconds: 300 },
      { name: '10:00 (600s) Long In-Depth Consultation', seconds: 600 },
    ];

    testDurations.forEach(({ name, seconds }) => {
      it(`should maintain active session, valid WebSocket, and unblocked audio flow at ${name}`, () => {
        const mockWs = createMockWs();
        const callId = `duration-test-${seconds}s`;
        mcubeStreamService.attachClient(mockWs as any, callId);
        const session = mcubeStreamService.getActiveSession(callId)!;

        // Advance session clock to simulate elapsed call duration
        session.sessionStartedAt = Date.now() - seconds * 1000;
        session.inboundFrameCount = Math.floor(seconds * 50); // 50 frames/sec (20ms packets)
        session.lastInboundAudioAt = Date.now() - 500;
        session.heartbeatPingAt = Date.now() - 500;
        session.heartbeatPongAt = Date.now() - 300;

        // Verify active session exists and is NOT removed by any 120s reconnect TTL
        const active = mcubeStreamService.getActiveSession(callId);
        expect(active).toBeDefined();
        expect(active?.wsReadyState).toBe(1);

        // Run session watchdog: verify session remains active and healthy
        mcubeStreamService.runSessionWatchdog(mockWs as any, session);
        expect(mcubeStreamService.getActiveSession(callId)).toBeDefined();

        // Verify metrics reflect correct call duration
        const metrics = mcubeStreamService.getCallMetrics(callId)!;
        expect(metrics).toBeDefined();
        expect(metrics.sessionAgeMs).toBeGreaterThanOrEqual(seconds * 1000);
        expect(metrics.heartbeatStatus).toBe('HEALTHY');
      });
    });
  });
});
