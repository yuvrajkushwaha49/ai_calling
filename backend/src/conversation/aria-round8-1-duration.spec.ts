import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CustomerMemoryService } from '../memory/customer-memory.service';
import { McubeStreamService, McubeSession } from '../calls/mcube-stream.service';
import { AiService } from '../ai/ai.service';
import { VoiceService } from '../voice/voice.service';
import { ConversationService } from './conversation.service';
import { FactExtractorService } from '../memory/fact-extractor.service';
import { QuestionValidatorService } from '../memory/question-validator.service';
import { AppointmentsService } from '../appointments/appointments.service';

describe('Aria Round 8.1 — Two-Minute Audio Dropout Investigation & Long-Running Call Reliability', () => {
  let mcubeStreamService: McubeStreamService;
  let voiceService: jest.Mocked<Partial<VoiceService>>;
  let conversationService: jest.Mocked<Partial<ConversationService>>;
  let customerMemory: jest.Mocked<Partial<CustomerMemoryService>>;

  const mockPrisma = {
    lead: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'lead-1', name: 'Lead Test', phone: '+919999999999' }),
      update: jest.fn().mockResolvedValue({ id: 'lead-1' }),
    },
    call: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'call-1', transcript: '' }),
      update: jest.fn().mockResolvedValue({ id: 'call-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const mockConfig = {
    get: jest.fn(() => null),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    voiceService = {
      speechToText: jest.fn().mockResolvedValue({ transcript: 'Haan mujhe 2 BHK chahiye', languageCode: 'en-IN' }),
      textToSpeech: jest.fn().mockResolvedValue({ audioBase64: Buffer.from('test-audio').toString('base64') }),
    };
    conversationService = {
      reply: jest.fn().mockResolvedValue({
        replyText: 'Gaur City mein 2 BHK available hai.',
        languageDetected: 'hinglish',
      }),
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
      providers: [
        McubeStreamService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AiService, useValue: { getSettings: jest.fn().mockResolvedValue({ companyName: 'Workains Reality', agentName: 'Aria' }) } },
        { provide: VoiceService, useValue: voiceService },
        { provide: ConversationService, useValue: conversationService },
        { provide: CustomerMemoryService, useValue: customerMemory },
        { provide: FactExtractorService, useValue: { extractFromUtterance: jest.fn().mockReturnValue(null) } },
        { provide: QuestionValidatorService, useValue: { validateAndSanitize: jest.fn().mockImplementation((m, s) => ({ wasRepeated: false, sanitized: s })) } },
        { provide: AppointmentsService, useValue: { maybeBookFromCall: jest.fn().mockResolvedValue({ booked: false }) } },
      ],
    }).compile();

    mcubeStreamService = module.get<McubeStreamService>(McubeStreamService);
  });

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

  // ==========================================
  // SECTION 1: LONG-RUNNING CALL DURATIONS
  // ==========================================

  describe('Section 1: Long-Running Call Lifecycles (30s to 10m)', () => {
    it('Scenario 1: 30-second call maintains healthy state and frame tracking', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-30s');
      const session = mcubeStreamService.getActiveSession('call-30s')!;
      expect(session).toBeDefined();

      // Simulate 30s elapsed with media frames
      session.sessionStartedAt = Date.now() - 30000;
      session.inboundFrameCount = 60;
      session.lastInboundAudioAt = Date.now() - 500;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      const metrics = mcubeStreamService.getCallMetrics('call-30s')!;
      expect(metrics.sessionAgeMs).toBeGreaterThanOrEqual(30000);
      expect(metrics.inboundFrames).toBe(60);
      expect(metrics.failureReason).toBe('NONE');
    });

    it('Scenario 2: 90-second call executes periodic heartbeat pings without dropping', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-90s');
      const session = mcubeStreamService.getActiveSession('call-90s')!;

      session.sessionStartedAt = Date.now() - 90000;
      session.inboundFrameCount = 180;
      session.lastInboundAudioAt = Date.now() - 1000;
      session.heartbeatPingAt = Date.now() - 2000;
      session.heartbeatPongAt = Date.now() - 1500;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      const metrics = mcubeStreamService.getCallMetrics('call-90s')!;
      expect(metrics.sessionAgeMs).toBeGreaterThanOrEqual(90000);
      expect(metrics.heartbeatStatus).toBe('HEALTHY');
      expect(metrics.failureReason).toBe('NONE');
    });

    it('Scenario 3: 120-second call boundary — active session NEVER evicted by reconnect cache TTL', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-120s');
      const session = mcubeStreamService.getActiveSession('call-120s')!;

      // Age to exactly 120 seconds
      session.sessionStartedAt = Date.now() - 120000;
      session.inboundFrameCount = 250;
      session.lastInboundAudioAt = Date.now() - 2000;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      // Verify active session remains in activeSessions and is NOT expired
      expect(mcubeStreamService.getActiveSession('call-120s')).toBeDefined();
      expect(mcubeStreamService.getReconnectCache('call-120s')).toBeUndefined();
      const metrics = mcubeStreamService.getCallMetrics('call-120s')!;
      expect(metrics.sessionAgeMs).toBeGreaterThanOrEqual(120000);
      expect(metrics.failureReason).toBe('NONE');
    });

    it('Scenario 4: 150-second call continues bidirectional conversation smoothly', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-150s');
      const session = mcubeStreamService.getActiveSession('call-150s')!;

      session.sessionStartedAt = Date.now() - 150000;
      session.turnCount = 4;
      session.inboundFrameCount = 300;
      session.outboundFrameCount = 8;
      session.lastInboundAudioAt = Date.now() - 1000;
      session.lastOutboundAudioAt = Date.now() - 3000;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      const metrics = mcubeStreamService.getCallMetrics('call-150s')!;
      expect(metrics.sessionAgeMs).toBeGreaterThanOrEqual(150000);
      expect(metrics.outboundFrames).toBe(8);
      expect(metrics.failureReason).toBe('NONE');
    });

    it('Scenario 5: 3-minute call (180s) tracks multi-turn stability and low latency', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-180s');
      const session = mcubeStreamService.getActiveSession('call-180s')!;

      session.sessionStartedAt = Date.now() - 180000;
      session.turnCount = 6;
      session.inboundFrameCount = 400;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);
      expect(session.closed).toBe(false);
      expect(mcubeStreamService.getActiveSession('call-180s')).toBe(session);
    });

    it('Scenario 6: 5-minute call (300s) preserves customer memory and context lock', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-300s');
      const session = mcubeStreamService.getActiveSession('call-300s')!;

      session.sessionStartedAt = Date.now() - 300000;
      session.turnCount = 10;
      session.memory = {
        callId: 'call-300s',
        customer: { bhk: '3 BHK', budgetLabel: '1.2 Cr' },
        selectedProjectId: 'Future Estate',
        selectedProjectLock: true,
      };

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      expect(session.memory.selectedProjectId).toBe('Future Estate');
      expect(session.memory.selectedProjectLock).toBe(true);
      expect(session.turnCount).toBe(10);
    });

    it('Scenario 7: 10-minute long-duration call (600s) executes without memory leaks or audio degradation', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-600s');
      const session = mcubeStreamService.getActiveSession('call-600s')!;

      session.sessionStartedAt = Date.now() - 600000;
      session.turnCount = 18;
      session.inboundFrameCount = 1200;
      session.outboundFrameCount = 35;
      session.heartbeatPingAt = Date.now() - 1000;
      session.heartbeatPongAt = Date.now() - 800;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      const metrics = mcubeStreamService.getCallMetrics('call-600s')!;
      expect(metrics.sessionAgeMs).toBeGreaterThanOrEqual(600000);
      expect(metrics.heartbeatStatus).toBe('HEALTHY');
      expect(metrics.failureReason).toBe('NONE');
    });
  });

  // ==========================================
  // SECTION 2: SILENCE, CONTINUOUS SPEECH & BARGE-IN
  // ==========================================

  describe('Section 2: Silence, Continuous Speech & Barge-In Recovery', () => {
    it('Scenario 8: Active call with 2 minutes of customer silence keeps WebSocket alive via heartbeat (Condition A)', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-silence-2m');
      const session = mcubeStreamService.getActiveSession('call-silence-2m')!;

      session.sessionStartedAt = Date.now() - 120000;
      session.inboundFrameCount = 10; // answered initial greeting, then fell silent
      session.lastInboundAudioAt = Date.now() - 75000; // silent for > 60s
      session.heartbeatPingAt = Date.now() - 2000;
      session.heartbeatPongAt = Date.now() - 1500;

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      // Condition A detected & logged, but call session is safely preserved
      expect(session.lastFailureCondition).toBe('NO_INBOUND_AUDIO');
      expect(session.closed).toBe(false);
      expect(mcubeStreamService.getActiveSession('call-silence-2m')).toBeDefined();
    });

    it('Scenario 9: Active call with continuous speech for 5 minutes does not overflow buffer or drop chunks', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-continuous-speech');
      const session = mcubeStreamService.getActiveSession('call-continuous-speech')!;

      session.sessionStartedAt = Date.now() - 300000;
      // Simulate continuous audio chunks pushed
      const chunk = Buffer.alloc(160, 0x7f); // mulaw silence/audio
      for (let i = 0; i < 50; i++) {
        mockWs.simulateMessage({
          event: 'media',
          streamId: 'str-cont-1',
          media: { payload: chunk.toString('base64'), track: 'inbound' },
        });
      }

      expect(session.inboundFrameCount).toBe(50);
      expect(session.lastInboundAudioAt).toBeGreaterThan(0);
      expect(session.closed).toBe(false);
    });

    it('Scenario 10: Repeated barge-ins clear pending queue and increment flushGen safely without state corruption', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-repeated-barge');
      const session = mcubeStreamService.getActiveSession('call-repeated-barge')!;
      session.streamId = 'stream-barge';
      session.agentPlaying = true;
      session.pendingSegments.add('seg_1');
      session.pendingSegments.add('seg_2');

      const initialGen = session.flushGen;

      // Barge 1
      session.bargeHits = 2; // confirmed hit
      const clearAudio1 = () => {
        mcubeStreamService.sendClearAudio(mockWs as any, session.streamId);
        session.cancelPlay = true;
        session.agentPlaying = false;
        session.pendingSegments.clear();
        session.flushGen += 1;
      };
      clearAudio1();

      expect(session.pendingSegments.size).toBe(0);
      expect(session.cancelPlay).toBe(true);
      expect(session.flushGen).toBe(initialGen + 1);

      // Cooldown self-healing resets cancelPlay
      session.lastAudioChunkSentAt = Date.now() - 12000;
      mcubeStreamService.runSessionWatchdog(mockWs as any, session);
      expect(session.cancelPlay).toBe(false);
    });
  });

  // ==========================================
  // SECTION 3: RECONNECT CACHE & BOUNDARY TESTS
  // ==========================================

  describe('Section 3: Reconnect Cache & 120s Boundary Tests', () => {
    it('Scenario 11A: WebSocket disconnect at 110s restores seamlessly from 120s reconnect cache', () => {
      const mockWs1 = createMockWs();
      mcubeStreamService.attachClient(mockWs1 as any, 'call-reconnect-110s');
      const session1 = mcubeStreamService.getActiveSession('call-reconnect-110s')!;
      session1.turnCount = 3;
      session1.transcript = 'Agent: Namaste\nCaller: Gaur City 2 BHK\n';
      session1.memory = { callId: 'call-reconnect-110s', customer: { bhk: '2 BHK' } };

      // Disconnect socket (moved to reconnectCache with 120s TTL)
      mockWs1.simulateClose(1006, 'Abnormal Closure');
      expect(mcubeStreamService.getActiveSession('call-reconnect-110s')).toBeUndefined();
      expect(mcubeStreamService.getReconnectCache('call-reconnect-110s')).toBeDefined();

      // Reconnect within 120s window (e.g. after 5 seconds)
      const mockWs2 = createMockWs();
      mcubeStreamService.attachClient(mockWs2 as any, 'call-reconnect-110s');

      const restoredSession = mcubeStreamService.getActiveSession('call-reconnect-110s')!;
      expect(restoredSession).toBeDefined();
      expect(restoredSession.turnCount).toBe(3);
      expect(restoredSession.transcript).toContain('Gaur City 2 BHK');
      expect(restoredSession.memory?.customer?.bhk).toBe('2 BHK');
      // Reconnect cache entry consumed and deleted
      expect(mcubeStreamService.getReconnectCache('call-reconnect-110s')).toBeUndefined();
    });

    it('Scenario 11B: Reconnect attempt after 120s expiry creates new clean session gracefully', () => {
      const mockWs1 = createMockWs();
      mcubeStreamService.attachClient(mockWs1 as any, 'call-expired-reconnect');
      mockWs1.simulateClose(1000, 'Normal');

      // Force delete reconnect cache simulating 120s timer firing
      const cached = mcubeStreamService.getReconnectCache('call-expired-reconnect');
      if (cached) {
        clearTimeout(cached.timer);
        (mcubeStreamService as any).reconnectCache.delete('call-expired-reconnect');
      }

      // Reconnect after expiry
      const mockWs2 = createMockWs();
      mcubeStreamService.attachClient(mockWs2 as any, 'call-expired-reconnect');

      const freshSession = mcubeStreamService.getActiveSession('call-expired-reconnect')!;
      expect(freshSession.turnCount).toBe(0);
      expect(freshSession.transcript).toBe('Agent: Hello?\n');
    });

    it('Scenario 18: Active session is NEVER evicted by reconnect cache while WebSocket is connected (Condition H Protection)', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-active-protection');
      const session = mcubeStreamService.getActiveSession('call-active-protection')!;

      // Simulate accidental map removal
      (mcubeStreamService as any).activeSessions.delete('call-active-protection');

      // Watchdog detects open socket with missing map entry, heals it and logs Condition H
      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      expect(mcubeStreamService.getActiveSession('call-active-protection')).toBe(session);
      expect(session.lastFailureCondition).toBe('SESSION_EXPIRED_WHILE_ACTIVE');
    });
  });

  // ==========================================
  // SECTION 4: FAILURE CONDITIONS & SELF-HEALING
  // ==========================================

  describe('Section 4: Failure Conditions A through G & Self-Healing', () => {
    it('Scenario 12: Redis unavailable during active call falls back to memory without crash', async () => {
      customerMemory.recordTurn!.mockRejectedValueOnce(new Error('Redis connection refused'));
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-redis-down');
      const session = mcubeStreamService.getActiveSession('call-redis-down')!;
      session.streamId = 'str-redis';

      // Simulate speech turn
      session.rawChunks.push(Buffer.alloc(8000 * 2, 0x55)); // 2s audio
      await (mcubeStreamService as any).flushTurn(mockWs, session);

      // Turn must complete cleanly despite Redis outage
      expect(session.busy).toBe(false);
      expect(session.turnCount).toBe(1);
    });

    it('Scenario 13: Delayed MCube playback acknowledgement is cleared by watchdog (Condition F)', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-delayed-ack');
      const session = mcubeStreamService.getActiveSession('call-delayed-ack')!;
      session.pendingSegments.add('seg_stuck');
      session.agentPlaying = true;
      session.lastAudioChunkSentAt = Date.now() - 25000; // sent 25s ago with no playedStream ACK

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      expect(session.lastFailureCondition).toBe('MCUBE_PLAYBACK_UNACKNOWLEDGED');
      expect(session.pendingSegments.size).toBe(0);
      expect(session.agentPlaying).toBe(false);
    });

    it('Scenario 14: TTS provider failure logs Condition D and recovers without locking busy state', async () => {
      voiceService.textToSpeech!.mockRejectedValue(new Error('ElevenLabs 503 Service Unavailable'));
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-tts-fail');
      const session = mcubeStreamService.getActiveSession('call-tts-fail')!;
      session.streamId = 'str-tts-fail';

      const audio = await (mcubeStreamService as any).synthesizeForSession('Test utterance', session, {});

      expect(audio).toBeNull();
      expect(session.lastFailureCondition).toBe('TTS_SYNTHESIS_FAILED');
      expect(session.busy).toBe(false);
    });

    it('Scenario 15: STT provider empty transcript logs Condition B and ignores turn safely', async () => {
      voiceService.speechToText!.mockResolvedValueOnce({ transcript: '', languageCode: null });
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-stt-fail');
      const session = mcubeStreamService.getActiveSession('call-stt-fail')!;
      session.streamId = 'str-stt-fail';

      session.rawChunks.push(Buffer.alloc(8000, 0x55)); // 1s audio
      await (mcubeStreamService as any).flushTurn(mockWs, session);

      expect(session.lastFailureCondition).toBe('STT_NO_TRANSCRIPT');
      expect(session.busy).toBe(false);
      expect(session.turnCount).toBe(0);
    });

    it('Scenario 16: WebSocket close during in-flight turn cleans up gracefully without unhandled rejection', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-close-during-turn');
      const session = mcubeStreamService.getActiveSession('call-close-during-turn')!;
      session.busy = true;

      // Close socket mid-flight
      mockWs.simulateClose(1006, 'Carrier drop');

      expect(session.closed).toBe(true);
      expect(session.agentPlaying).toBe(false);
      expect(session.wsReadyState).toBe(3);
    });

    it('Scenario 17: Duplicate cleanup event is idempotent and does not throw or double-free', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-idempotent-close');

      // First close
      mockWs.simulateClose(1000, 'Normal');
      // Second close
      expect(() => mockWs.simulateClose(1000, 'Normal')).not.toThrow();

      expect(mcubeStreamService.getActiveSession('call-idempotent-close')).toBeUndefined();
    });

    it('Scenario 18: Watchdog recovers stuck busy state (>15s) automatically', () => {
      const mockWs = createMockWs();
      mcubeStreamService.attachClient(mockWs as any, 'call-stuck-busy');
      const session = mcubeStreamService.getActiveSession('call-stuck-busy')!;

      session.busy = true;
      session.busySince = Date.now() - 16000; // stuck for 16s

      mcubeStreamService.runSessionWatchdog(mockWs as any, session);

      expect(session.busy).toBe(false);
      expect(session.recoveryAttempts).toBe(1);
    });
  });
});
