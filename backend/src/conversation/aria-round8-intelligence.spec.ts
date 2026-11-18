import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService, BookFromCallResult } from '../appointments/appointments.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  isGenericAcknowledgement,
  isExplicitMeetingConfirmation,
  parseMeetingSlot,
  parseCallbackSlot,
} from '../appointments/meeting-time';
import {
  detectIntent,
  buildFollowUpReply,
  extractFactsFromText,
} from '../calls/call-scripts';
import {
  evaluateLeadQualification,
  computeInterestScore,
  interestLevelFromScore,
} from './interest-score';
import { QuestionValidatorService } from '../memory/question-validator.service';
import { normalizeTextForSpeech } from '../calls/phone-audio';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { ConversationState } from '../memory/memory.types';
import { CustomerMemoryService } from '../memory/customer-memory.service';
import { McubeStreamService } from '../calls/mcube-stream.service';
import { AiService } from '../ai/ai.service';
import { VoiceService } from '../voice/voice.service';
import { ConversationService } from './conversation.service';
import { FactExtractorService } from '../memory/fact-extractor.service';

describe('Aria Round 8 — Human-Like Conversation Intelligence, Lead Conversion & Telephony Reliability', () => {
  let appointmentsService: AppointmentsService;
  let questionValidator: QuestionValidatorService;
  let whatsAppService: WhatsAppService;
  let mcubeStreamService: McubeStreamService;

  const mockPrisma = {
    lead: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
    call: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockCalendar = {
    createEvent: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'WHATSAPP_API_KEY') return 'test-wa-key';
      if (key === 'WHATSAPP_PHONE_NUMBER_ID') return '100200300';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        QuestionValidatorService,
        WhatsAppService,
        McubeStreamService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GoogleCalendarService, useValue: mockCalendar },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AiService, useValue: { getSettings: jest.fn() } },
        { provide: VoiceService, useValue: { speechToText: jest.fn() } },
        { provide: ConversationService, useValue: {} },
        { provide: CustomerMemoryService, useValue: { recordTurn: jest.fn(), applyExtractedFacts: jest.fn() } },
        { provide: FactExtractorService, useValue: { extractFromUtterance: jest.fn() } },
      ],
    }).compile();

    appointmentsService = module.get<AppointmentsService>(AppointmentsService);
    questionValidator = module.get<QuestionValidatorService>(QuestionValidatorService);
    whatsAppService = module.get<WhatsAppService>(WhatsAppService);
    mcubeStreamService = module.get<McubeStreamService>(McubeStreamService);
  });

  // ==========================================
  // SECTION 1: LEAD QUALIFICATION SCORING ENGINE (0-100 & 0-10)
  // ==========================================

  describe('Section 1: Transparent Lead Qualification Scoring', () => {
    it('Scenario 1: Fresh call answered with no property facts has a baseline score of 0 (Never auto-qualifies)', () => {
      const res = evaluateLeadQualification({
        userMessage: 'Hello?',
        priorTranscript: '',
      });
      expect(res.score100).toBe(0);
      expect(res.score10).toBe(0);
      expect(res.isQualified).toBe(false);
      expect(computeInterestScore({})).toBe(0);
    });

    it('Scenario 2: Capturing BHK preference awards exactly 20 points', () => {
      const res = evaluateLeadQualification({
        userMessage: 'Main 2 BHK dekh raha hoon',
      });
      expect(res.breakdown.bhk.verified).toBe(true);
      expect(res.breakdown.bhk.points).toBe(20);
      expect(res.score100).toBe(20);
      expect(res.isQualified).toBe(false); // 20 < 60
    });

    it('Scenario 3: Capturing Budget preference awards exactly 20 points', () => {
      const res = evaluateLeadQualification({
        userMessage: 'Mera budget lagbhag 80 Lakh hai',
      });
      expect(res.breakdown.budget.verified).toBe(true);
      expect(res.breakdown.budget.points).toBe(20);
      expect(res.score100).toBe(20);
    });

    it('Scenario 4: Capturing Location preference awards exactly 15 points', () => {
      const res = evaluateLeadQualification({
        userMessage: 'Mujhe Greater Noida West mein flat chahiye',
      });
      expect(res.breakdown.location.verified).toBe(true);
      expect(res.breakdown.location.points).toBe(15);
    });

    it('Scenario 5: Capturing Timeline / Possession preference awards exactly 15 points', () => {
      const res = evaluateLeadQualification({
        userMessage: 'Mujhe ready to move property chahiye',
      });
      expect(res.breakdown.timeline.verified).toBe(true);
      expect(res.breakdown.timeline.points).toBe(15);
    });

    it('Scenario 6: Capturing Purpose (end-use / investment) awards exactly 10 points', () => {
      const res = evaluateLeadQualification({
        userMessage: 'Hum khud rehne ke liye self use dekh rahe hain',
      });
      expect(res.breakdown.purpose.verified).toBe(true);
      expect(res.breakdown.purpose.points).toBe(10);
    });

    it('Scenario 7: Agreeing to a site visit awards exactly 20 points', () => {
      const res = evaluateLeadQualification({
        userMessage: 'Haan, main site visit dekhna chahta hoon',
        siteVisitInterest: true,
      });
      expect(res.breakdown.siteVisit.verified).toBe(true);
      expect(res.breakdown.siteVisit.points).toBe(20);
    });

    it('Scenario 8: Lead meeting threshold >= 60 points qualifies transparently', () => {
      // BHK (20) + Budget (20) + Location (15) + Timeline (15) = 70 points
      const res = evaluateLeadQualification({
        userMessage: 'Main 3 BHK dekh raha hoon 90 Lakh mein Greater Noida West, ready to move',
      });
      expect(res.score100).toBe(70);
      expect(res.score10).toBe(7);
      expect(res.isQualified).toBe(true);
    });

    it('Scenario 9: Customer stating "not interested" triggers explicit disqualification (score capped <= 10, unqualified)', () => {
      const res = evaluateLeadQualification({
        userMessage: 'Nahi chahiye mujhe, not interested rakh do phone',
        known: { bhk: '2 BHK', budgetLabel: '80 Lakh' },
      });
      expect(res.breakdown.disqualified).toBe(true);
      expect(res.score100).toBe(10);
      expect(res.score10).toBe(1);
      expect(res.isQualified).toBe(false);
    });

    it('Scenario 10: Preference sources and timestamps are tracked for every attribute', () => {
      const res = evaluateLeadQualification({
        userMessage: 'Mujhe 2 BHK chahiye Sector 1 Greater Noida West mein',
      });
      expect(res.preferenceSources.bhk).toBeDefined();
      expect(res.preferenceSources.bhk.source).toBe('customer_explicit');
      expect(res.preferenceSources.bhk.timestamp).toBeDefined();
      expect(res.preferenceSources.location.source).toBe('customer_explicit');
    });
  });

  // ==========================================
  // SECTION 2: HUMAN-LIKE CONVERSATIONAL ENGINE & CONTEXT TRANSITIONS
  // ==========================================

  describe('Section 2: Human-Like Conversation Engine', () => {
    it('Scenario 11: "Achha" receives natural acknowledgement without resetting discovery or re-asking answered BHK', () => {
      const reply = buildFollowUpReply({
        transcript: 'Achha',
        leadName: 'Vikram',
        knownFacts: { bhk: '2 BHK', selectedProjectId: 'Palace Heights by Rudra', selectedProjectLock: true },
        language: 'hinglish',
      });
      expect(reply.text).not.toContain('Aap 2 BHK flat dekh rahe hain ya 3 BHK?');
      expect(reply.text.length).toBeGreaterThan(15);
    });

    it('Scenario 12: "Haan batao" / "Uske baare mein aur batao" deepens locked project facts', () => {
      const intent = detectIntent('Haan uske baare mein aur batao');
      expect(intent.askingTellMore).toBe(true);

      const reply = buildFollowUpReply({
        transcript: 'Uske baare mein aur batao',
        leadName: 'Rahul',
        knownFacts: { selectedProjectId: 'Palace Heights by Rudra', selectedProjectLock: true },
        language: 'hinglish',
      });
      expect(reply.text).toContain('Palace Heights by Rudra');
      expect(reply.text).toMatch(/1015|1088|clubhouse|payment plan/i);
    });

    it('Scenario 13: "Price kya hai?" provides immediate factual pricing for locked project', () => {
      const reply = buildFollowUpReply({
        transcript: 'Price kya hai?',
        leadName: 'Amit',
        knownFacts: { selectedProjectId: 'Palace Heights by Rudra', selectedProjectLock: true },
        language: 'hinglish',
      });
      expect(reply.text).toContain('Palace Heights');
      expect(reply.text).toMatch(/₹80|₹88/i);
    });

    it('Scenario 14: "Location kahan hai?" delivers exact location and connectivity for discussed project', () => {
      const intent = detectIntent('Project ki location kahan hai?');
      expect(intent.askingLocationCurrent).toBe(true);

      const reply = buildFollowUpReply({
        transcript: 'Location kahan hai?',
        leadName: 'Amit',
        knownFacts: { selectedProjectId: 'Palace Heights by Rudra', selectedProjectLock: true },
        language: 'hinglish',
      });
      expect(reply.text).toContain('Sector 1 Greater Noida West');
      expect(reply.text).toContain('Gaur Chowk');
    });

    it('Scenario 15: "Nahi, doosra option batao" releases context lock and introduces alternatives', () => {
      const reply = buildFollowUpReply({
        transcript: 'Nahi, mujhe koi doosra option batao',
        leadName: 'Rohit',
        knownFacts: { selectedProjectId: 'Palace Heights by Rudra', selectedProjectLock: true },
        language: 'hinglish',
      });
      expect(reply.facts.selectedProjectLock).toBe(false);
      expect(reply.text).toMatch(/Sector 1 Greater Noida West|NCR Monarch/i);
    });

    it('Scenario 16: "Abhi budget clear nahi hai" provides gentle guidance without pressing', () => {
      const intent = detectIntent('Abhi budget clear nahi hai');
      expect(intent.budgetUncertain).toBe(true);

      const reply = buildFollowUpReply({
        transcript: 'Abhi budget clear nahi hai',
        leadName: 'Pooja',
        language: 'hinglish',
      });
      expect(reply.text).toContain('₹60 Lakh se ₹90 Lakh');
      expect(reply.text).toContain('2 BHK');
    });

    it('Scenario 17: "WhatsApp kar do" confirms sending verified details to customer phone', () => {
      const intent = detectIntent('Details WhatsApp kar do');
      expect(intent.askingWhatsApp).toBe(true);

      const reply = buildFollowUpReply({
        transcript: 'Mujhe WhatsApp kar do',
        leadName: 'Vikas',
        language: 'hinglish',
      });
      expect(reply.text).toContain('WhatsApp');
      expect(reply.outcome).toBe('CONNECTED');
    });

    it('Scenario 18: One-question-at-a-time enforcement: QuestionValidatorService trims secondary questions', () => {
      const multiQuestion = 'Aapka budget lagbhag kitna hai? Aur aap kab tak shift hona chahte hain?';
      const single = questionValidator.enforceSingleQuestion(multiQuestion);
      expect(single).toBe('Aapka budget lagbhag kitna hai?');
    });

    it('Scenario 19: No repeated discovery: QuestionValidatorService blocks re-asking BHK when already answered', () => {
      const state: ConversationState = {
        callId: 'call-r8-1',
        customer: { bhk: '2 BHK' },
        answeredFields: ['bhk'],
        askedQuestions: ['ask_bhk'],
      };
      const validation = questionValidator.validateAndSanitize(
        state,
        'Aap 2 BHK flat dekh rahe hain ya 3 BHK?',
      );
      expect(validation.allowed).toBe(false);
      expect(validation.wasRepeated).toBe(true);
      expect(validation.sanitized).not.toContain('Aap 2 BHK flat dekh rahe hain ya 3 BHK?');
    });

    it('Scenario 20: No repeated discovery: QuestionValidatorService blocks re-asking budget when already captured', () => {
      const state: ConversationState = {
        callId: 'call-r8-2',
        customer: { budgetLabel: '80 Lakh' },
        answeredFields: ['budget'],
        askedQuestions: ['ask_budget'],
      };
      const validation = questionValidator.validateAndSanitize(
        state,
        'Aapka approximate budget kitna hoga?',
      );
      expect(validation.allowed).toBe(false);
      expect(validation.wasRepeated).toBe(true);
      expect(validation.sanitized).not.toContain('approximate budget');
    });
  });

  // ==========================================
  // SECTION 3: SITE VISIT & CALLBACK CONVERSION ENGINE
  // ==========================================

  describe('Section 3: Site Visit & Callback Conversion Workflows', () => {
    it('Scenario 21: Generic acknowledgement ("theek hai") never books a site visit (visitState: REQUESTED)', async () => {
      const result = await appointmentsService.maybeBookFromCall({
        leadId: 'lead-r8-1',
        userMessage: 'Theek hai',
      });
      expect(result.booked).toBe(false);
      expect(result.reason).toBe('generic_acknowledgement');
      expect(result.visitState).toBe('REQUESTED');
    });

    it('Scenario 22: Generic acknowledgement ("haan ji") never auto-books', async () => {
      const result = await appointmentsService.maybeBookFromCall({
        leadId: 'lead-r8-2',
        userMessage: 'Haan ji',
      });
      expect(result.booked).toBe(false);
      expect(result.reason).toBe('generic_acknowledgement');
    });

    it('Scenario 23: Incomplete date or time marks visit state as PENDING_CONFIRMATION', async () => {
      const result = await appointmentsService.maybeBookFromCall({
        leadId: 'lead-r8-3',
        userMessage: 'Main visit karna chahta hoon par time abhi fix nahi',
      });
      expect(result.booked).toBe(false);
      expect(result.visitState).toBe('PENDING_CONFIRMATION');
    });

    it('Scenario 24: Valid date, time, and project confirmation books appointment (visitState: CONFIRMED)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValueOnce({
        id: 'lead-r8-4',
        name: 'Suresh Kumar',
        phone: '+919876543210',
        projectId: 'proj-palace',
        project: { id: 'proj-palace', name: 'Palace Heights', location: 'Greater Noida West' },
      });
      mockPrisma.appointment.findFirst.mockResolvedValueOnce(null);
      mockPrisma.appointment.create.mockResolvedValueOnce({
        id: 'appt-r8-1',
        date: new Date('2026-11-21T12:00:00+05:30'),
        time: '11:00 AM',
        notes: 'Booked',
      });
      mockCalendar.createEvent.mockResolvedValueOnce({
        success: true,
        eventId: 'gcal-101',
        htmlLink: 'https://calendar.google.com/event-101',
      });

      const result = await appointmentsService.maybeBookFromCall({
        leadId: 'lead-r8-4',
        userMessage: 'Saturday ko subah 11 baje book kar do',
      });
      expect(result.booked).toBe(true);
      expect(result.visitState).toBe('CONFIRMED');
      expect(result.time).toBe('11:00 AM');
    });

    it('Scenario 25: Rescheduling existing visit updates appointment without duplication (visitState: RESCHEDULED)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValueOnce({
        id: 'lead-r8-5',
        name: 'Suresh Kumar',
        phone: '+919876543210',
      });
      mockPrisma.appointment.findFirst.mockResolvedValueOnce({
        id: 'appt-existing-1',
        date: new Date('2026-11-21T12:00:00+05:30'),
        time: '11:00 AM',
      });
      mockPrisma.appointment.update.mockResolvedValueOnce({
        id: 'appt-existing-1',
        date: new Date('2026-11-22T12:00:00+05:30'),
        time: '04:00 PM',
        notes: 'Rescheduled',
      });

      const result = await appointmentsService.maybeBookFromCall({
        leadId: 'lead-r8-5',
        userMessage: 'Saturday nahi, Sunday 4 baje kar dijiye',
      });
      expect(result.booked).toBe(true);
      expect(result.visitState).toBe('RESCHEDULED');
      expect(result.time).toBe('4:00 PM');
    });

    it('Scenario 26: Explicit visit cancellation marks state as CANCELLED', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValueOnce({
        id: 'appt-cancel-1',
        status: 'SCHEDULED',
      });
      mockPrisma.appointment.update.mockResolvedValueOnce({
        id: 'appt-cancel-1',
        status: 'CANCELLED',
      });

      const result = await appointmentsService.maybeBookFromCall({
        leadId: 'lead-r8-6',
        userMessage: 'Main nahi aa paunga, visit cancel kar dijiye',
      });
      expect(result.booked).toBe(false);
      expect(result.visitState).toBe('CANCELLED');
    });

    it('Scenario 27: Relative callback parsing: "kal call karna" resolves to tomorrow with IST offset', () => {
      const slot = parseCallbackSlot('Abhi busy hoon, kal call karna');
      expect(slot).not.toBeNull();
      expect(slot?.relativeDescription).toBe('Kal');
      expect(slot?.targetTime).toBe('11:00 AM');
      expect(slot?.targetIso).toContain('+05:30');
    });

    it('Scenario 28: Relative callback parsing: "kal shaam 5 baje" resolves tomorrow 05:00 PM in IST', () => {
      const slot = parseCallbackSlot('Kal shaam 5 baje call karna');
      expect(slot).not.toBeNull();
      expect(slot?.targetTime).toBe('5:00 PM');
      expect(slot?.label).toContain('Kal shaam 5:00 PM');
    });

    it('Scenario 29: Relative callback parsing: "parso call karna" resolves day after tomorrow', () => {
      const slot = parseCallbackSlot('Parso call karna mujhe');
      expect(slot).not.toBeNull();
      expect(slot?.relativeDescription).toBe('Parso');
    });

    it('Scenario 30: DNC / opt-out detection respects user request and sets doNotCall flag', () => {
      const intent = detectIntent('Mujhe mat call karo, do not call');
      expect(intent.notInterested).toBe(true);
      expect(intent.callback).toBe(false);
    });
  });

  // ==========================================
  // SECTION 4: WHATSAPP RELIABILITY & BUILDER ATTRIBUTION
  // ==========================================

  describe('Section 4: WhatsApp Reliability & Attribution', () => {
    it('Scenario 31: Outbound WhatsApp brochure includes full builder attribution', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wa-msg-801' }] }),
      } as any);

      const res = await whatsAppService.sendDocument({
        toPhone: '+919565763089',
        leadName: 'Yuvi',
        projectName: 'Palace Heights',
        builderName: 'Rudra',
        documentType: 'brochure',
        documentUrl: 'https://cdn.workains.com/brochures/palace-heights.pdf',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('SENT');
      expect(res.builderAttribution).toBe('Palace Heights by Rudra');
      expect(res.messageId).toBe('wa-msg-801');
    });

    it('Scenario 32: WhatsApp dispatch is blocked if customer opted out or lacks consent', async () => {
      const res = await whatsAppService.sendDocument({
        toPhone: '+919565763089',
        projectName: 'Palace Heights',
        documentType: 'brochure',
        isOptedOut: true,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('FAILED');
      expect(res.reason).toBe('consent_missing_or_opted_out');
    });

    it('Scenario 33: Webhook status update tracks READ lifecycle state', () => {
      const statusRes = whatsAppService.handleWebhookStatus('wa-msg-801', 'read');
      expect(statusRes.status).toBe('READ');
      expect(statusRes.messageId).toBe('wa-msg-801');
      expect(statusRes.idempotent).toBe(false);
    });

    it('Scenario 34: Duplicate webhook delivery is handled idempotently without duplicate side effects', () => {
      const first = whatsAppService.handleWebhookStatus('wa-msg-802', 'delivered');
      expect(first.idempotent).toBe(false);

      const second = whatsAppService.handleWebhookStatus('wa-msg-802', 'delivered');
      expect(second.idempotent).toBe(true);
    });
  });

  // ==========================================
  // SECTION 5: TTS NORMALIZATION & HINGLISH ACOUSTIC QUALITY
  // ==========================================

  describe('Section 5: TTS Normalization & Acoustic Quality', () => {
    it('Scenario 35: Indian 2-comma numbering "1,50,000 sq.ft." normalizes without hanging comma', () => {
      const norm = normalizeTextForSpeech('Total area 1,50,000 sq.ft. hai.');
      expect(norm).toBe('Total area 150000 square feet hai.');
    });

    it('Scenario 36: Square yard / Gaj measurements normalize to spoken words', () => {
      const norm = normalizeTextForSpeech('Plot size 200 sq.yd hai aur 150 gaj available hai.');
      expect(norm).toContain('200 square yard');
      expect(norm).toContain('150 square yard');
    });

    it('Scenario 37: RERA registration number normalizes to spoken spaces for clean TTS', () => {
      const norm = normalizeTextForSpeech('RERA number UPRERAPRJ11124 hai.');
      expect(norm).toContain('UP RERA PRJ 11124');
    });

    it('Scenario 38: Currency with decimals "₹60.90 Lakh" normalizes with natural Hindi thousand grouping', () => {
      const norm = normalizeTextForSpeech('Price ₹60.90 Lakh se start hota hai.');
      expect(norm).toContain('saath lakh nabbe hazaar rupaye');
    });

    it('Scenario 39: Integer Lakhs "₹80 Lakh" normalizes cleanly without concatenation', () => {
      const norm = normalizeTextForSpeech('Budget ₹80 Lakh hai.');
      expect(norm).toContain('assi lakh rupaye');
    });
  });

  // ==========================================
  // SECTION 6: TELEPHONY 14-STEP LIFECYCLE & RECONNECT RESILIENCE
  // ==========================================

  describe('Section 6: Telephony Lifecycle & Reconnect Resilience', () => {
    it('Scenario 40: WebSocket reconnect with matching callId preserves prior conversation state and facts', () => {
      const mockWs1 = { on: jest.fn(), send: jest.fn() } as any;
      mcubeStreamService.attachClient(mockWs1, 'call-persisted-801');

      // Mutate state in active session
      const active = (mcubeStreamService as any).activeSessions.get('call-persisted-801');
      expect(active).toBeDefined();
      active.turnCount = 3;
      active.transcript = 'Agent: Namaste\nUser: 2 BHK Palace Heights\n';
      active.memory = {
        callId: 'call-persisted-801',
        customer: { bhk: '2 BHK' },
        selectedProjectId: 'Palace Heights by Rudra',
        selectedProjectLock: true,
      };

      // Reconnect with new WebSocket instance
      const mockWs2 = { on: jest.fn(), send: jest.fn() } as any;
      mcubeStreamService.attachClient(mockWs2, 'call-persisted-801');

      const reconnected = (mcubeStreamService as any).activeSessions.get('call-persisted-801');
      expect(reconnected.turnCount).toBe(3);
      expect(reconnected.transcript).toContain('2 BHK Palace Heights');
      expect(reconnected.memory?.selectedProjectId).toBe('Palace Heights by Rudra');
      expect(reconnected.memory?.selectedProjectLock).toBe(true);
    });

    it('Scenario 41: False barge-in rejection: single ambient spike (bargeHits < 2) does not abort playback', () => {
      const mockWs = { on: jest.fn(), send: jest.fn() } as any;
      mcubeStreamService.attachClient(mockWs, 'call-barge-test');
      const session = (mcubeStreamService as any).activeSessions.get('call-barge-test');
      session.agentPlaying = true;
      session.busy = true;

      // Hit 1: single noise spike
      session.bargeHits += 1;
      expect(session.bargeHits).toBe(1);
      // Playback must not be cancelled
      expect(session.cancelPlay).toBe(false);

      // Hit 2: confirmed interruption
      session.bargeHits += 1;
      expect(session.bargeHits).toBe(2);
    });

    it('Scenario 42: Workains Reality Channel Partner Identity: AI never claims to be developer or builder', () => {
      const reply = buildFollowUpReply({
        transcript: 'Aap kaun bol rahe ho aur kis company se ho?',
        leadName: 'Amit',
        isInbound: true,
        companyName: 'Workains Realty',
        agentName: 'Aria',
        language: 'hinglish',
      });
      expect(reply.text).toContain('Workains Realty');
      expect(reply.text).not.toContain('Saya Group developer');
    });
  });
});
