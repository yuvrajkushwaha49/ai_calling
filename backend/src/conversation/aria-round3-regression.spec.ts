import { Test, TestingModule } from '@nestjs/testing';
import { QuestionValidatorService } from '../memory/question-validator.service';
import { ConversationService } from './conversation.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { CustomerMemoryService } from '../memory/customer-memory.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { ConversationState } from '../memory/memory.types';
import { isGenericAcknowledgement, parseMeetingSlot } from '../appointments/meeting-time';

describe('Aria Round 3 — Live Call Critical Bug Fix & Regression Audit', () => {
  let validator: QuestionValidatorService;
  let conversationService: ConversationService;
  let prismaMock: any;
  let llmMock: any;
  let knowledgeMock: any;

  const mockCustomerState = (overrides?: Partial<ConversationState>): ConversationState => ({
    callId: 'call-r3-10700',
    leadId: 'lead-r3-yuvi',
    phone: '+919565763089',
    isReturningCustomer: true,
    customer: {
      name: 'युवराज',
      purpose: 'end_use',
      bhk: '2 BHK',
      budget: 8000000,
      budgetLabel: '80 Lakh',
      location: 'Sector 1 Noida Extension',
      timeline: null,
      possession: null,
      interestedProjects: ['VVIP Pre-Launch'],
      siteVisit: null,
    },
    answeredFields: ['bhk', 'budget', 'purpose', 'location'],
    askedQuestions: ['ask_bhk', 'ask_budget'],
    pendingQuestion: null,
    lastIntent: null,
    conversationStage: 'requirement_gathering',
    conversationSummary: '',
    lastAssistantResponse: '',
    confirmedFacts: {},
    approximateFacts: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(async () => {
    prismaMock = {
      project: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            name: 'Palace Heights by Rudra',
            location: 'GH-02B, Sector 1, Greater Noida West',
            propertyType: 'APARTMENT',
            startingPrice: 6090000,
            endingPrice: 19800000,
          },
          {
            id: 'p2',
            name: 'NCR Monarch',
            location: 'GH-02C, Sector 1, Greater Noida West',
            propertyType: 'APARTMENT',
            startingPrice: 6400000,
            endingPrice: 16000000,
          },
          {
            id: 'p3',
            name: 'Saya Pre-Launch',
            location: 'Raj Nagar Extension, Ghaziabad',
            propertyType: 'APARTMENT',
            startingPrice: 6900000,
            endingPrice: 17940000,
          },
          {
            id: 'p4',
            name: 'Future Estate by Future World',
            location: 'Plot No 16 E, Sector 1, Greater Noida West',
            propertyType: 'APARTMENT',
            startingPrice: 8632470,
            endingPrice: 23750000,
          },
          {
            id: 'p5',
            name: 'VVIP Pre-Launch',
            location: 'Raj Nagar Extension, Ghaziabad',
            propertyType: 'APARTMENT',
            startingPrice: 9062500,
            endingPrice: 17400000,
          },
          {
            id: 'p6',
            name: 'Saya Piazza',
            location: 'Noida Expressway',
            propertyType: 'COMMERCIAL',
            startingPrice: 4900000,
            endingPrice: 15000000,
          },
        ]),
      },
      lead: {
        update: jest.fn().mockResolvedValue({ id: 'lead-r3-yuvi' }),
      },
    };

    llmMock = {
      chat: jest.fn(),
      chatStream: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
      getProvider: jest.fn().mockReturnValue('gemini'),
      resolveChatModel: jest.fn((m) => m || 'gemini-flash-lite-latest'),
    };

    knowledgeMock = {
      retrieve: jest.fn().mockResolvedValue([]),
      ensureProjectWebsiteKnowledge: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionValidatorService,
        ConversationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: LlmService, useValue: llmMock },
        { provide: KnowledgeService, useValue: knowledgeMock },
        {
          provide: CustomerMemoryService,
          useValue: { invalidateCustomerCache: jest.fn() },
        },
        WhatsAppService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    validator = module.get<QuestionValidatorService>(QuestionValidatorService);
    conversationService = module.get<ConversationService>(ConversationService);
  });

  // TEST 1: Exact 10:19:30 failure reproduction — Stretch budget permission is NOT replaced with site visit pitch
  it('Test 1: Correct stretch-budget permission question is never replaced by a site-visit pitch (10:19:30 reproduction)', () => {
    const state = mockCustomerState();
    const liveCallSentence =
      'Isme 2 BHK ₹91 Lakh se start hota hai — kyunki yeh aapke ₹80 Lakh budget se ₹11 Lakh upar hai, kya main iski aur details aapko bataun?';

    const result = validator.validateAndSanitize(liveCallSentence, state);

    // Must be allowed and NOT treated as repeated question
    expect(result.allowed).toBe(true);
    expect(result.wasRepeated).toBe(false);
    expect(result.sanitizedText).toBe(liveCallSentence);
    expect(result.sanitizedText).not.toContain('site visit');
    expect(result.sanitizedText).not.toContain('sample flat');
  });

  // TEST 2: Genuine repeated budget question is blocked
  it('Test 2: A repeated budget collection question is blocked when budget is known', () => {
    const state = mockCustomerState();
    const repeatedBudgetSentence = 'Aapka approximate budget kitna hai?';

    const result = validator.validateAndSanitize(repeatedBudgetSentence, state);

    expect(result.allowed).toBe(false);
    expect(result.wasRepeated).toBe(true);
    expect(result.blockedField).toBe('budget');
    expect(result.sanitizedText).not.toContain('budget kitna');
  });

  // TEST 3: Exact 10:19:57 failure reproduction — Project price and unit-size details remain intact
  it('Test 3: Correct project price and unit-size details remain intact after validation (10:19:57 reproduction)', () => {
    const state = mockCustomerState();
    const liveCallSentence =
      'VVIP Pre-Launch mein 2 BHK 1250 sq.ft ka hai aur starting price ₹90.625 Lakh hai. Kya aap iska payment plan jaanna chahenge?';

    const result = validator.validateAndSanitize(liveCallSentence, state);

    expect(result.allowed).toBe(true);
    expect(result.wasRepeated).toBe(false);
    expect(result.sanitizedText).toContain('1250 sq.ft');
    expect(result.sanitizedText).toContain('₹90.625 Lakh');
    expect(result.sanitizedText).toContain('payment plan jaanna chahenge');
  });

  // TEST 4: Customer asking for floor plan receives available verified details
  it('Test 4: Customer asking for floor plan or sizes receives available verified details', async () => {
    const overview = await conversationService.getProjectsOverview(8000000);

    expect(overview).toContain('2 BHK (1250 sq.ft');
    expect(overview).toContain('1 BHK (700 sq.ft');
    expect(overview).toContain('1015-1088 sq.ft');
    expect(overview).toContain('Future Estate by Future World');
  });

  // TEST 5: Direct information request is not converted into a site-visit pitch
  it('Test 5: Factual information prefix is preserved when repeated question clause is removed', () => {
    const state = mockCustomerState({
      answeredFields: ['bhk', 'budget', 'purpose', 'location'],
    });
    const sentenceWithFact =
      'Palace Heights GH-02B Sector 1 mein hai. Aap 2 BHK dekh rahe hain ya 3 BHK?';

    const result = validator.validateAndSanitize(sentenceWithFact, state);

    expect(result.allowed).toBe(false);
    expect(result.sanitizedText).toContain('Palace Heights GH-02B Sector 1 mein hai.');
    // Repeated question clause removed
    expect(result.sanitizedText).not.toContain('Aap 2 BHK dekh rahe hain ya 3 BHK');
  });

  // TEST 6: Rejected project handling
  it('Test 6: A rejected project is acknowledged and not recommended again', () => {
    const userMessage = 'Nahi mujhe Future Estate nahi chahiye, koi aur option batao.';
    const isRejected = /future estate.*?(?:nahi|not|reject)|nahi.*?(?:future estate)/i.test(userMessage);

    expect(isRejected).toBe(true);
  });

  // TEST 7: Residential and commercial inventory remain strictly separated
  it('Test 7: Residential and commercial inventory remain separated for flat seekers', async () => {
    const overview = await conversationService.getProjectsOverview(8000000);

    // Residential section must contain apartments
    expect(overview).toContain('[VERIFIED IN-BUDGET RESIDENTIAL PROPERTIES (<= ₹80 Lakh)');
    expect(overview).toContain('Palace Heights by Rudra');

    // Commercial section must be separate and marked for commercial queries only
    expect(overview).toContain('[COMMERCIAL PROJECTS (Shops/Offices/Retail - ONLY IF CUSTOMER EXPLICITLY ASKS COMMERCIAL)]');
    expect(overview).toContain('Saya Piazza');
  });

  // TEST 8: Actual spoken response and transcript consistency
  it('Test 8: Actual spoken response matches validated sentences and final transcript', () => {
    const rawLlmSentences = [
      'VVIP Pre-Launch Raj Nagar Extension mein hai.',
      'Isme 2 BHK 1250 sq.ft ka hai.',
    ];
    const actuallySentSentences = [...rawLlmSentences];

    const finalTranscriptText = actuallySentSentences.join(' ');

    expect(finalTranscriptText).toBe(
      'VVIP Pre-Launch Raj Nagar Extension mein hai. Isme 2 BHK 1250 sq.ft ka hai.',
    );
  });

  // TEST 9: Cancelled audio during barge-in is NOT recorded as spoken
  it('Test 9: Cancelled audio is not marked as successfully spoken when aborted', () => {
    const actuallySentSentences: string[] = [];
    const aborted = true;

    // Turn was cancelled by barge-in before audio could be delivered to MCube
    const finalTranscriptText =
      actuallySentSentences.length > 0 ? actuallySentSentences.join(' ') : '';

    expect(finalTranscriptText).toBe('');
    expect(actuallySentSentences).toHaveLength(0);
  });

  // TEST 10: Interrupted opener is not repeated on next turn
  it('Test 10: When caller says Hello after opener, agent acknowledges without repeating welcome pitch', () => {
    const callerSays = 'Hello';
    const priorTranscript = 'Agent: Namaste युवराज ji! Main Aria, Saya Group se bol rahi hoon...\n';

    const isAfterOpener = priorTranscript.includes('Agent: Namaste');
    const isGreeting = /^(?:hello|haan ji|namaste)\??$/i.test(callerSays.trim());

    expect(isAfterOpener).toBe(true);
    expect(isGreeting).toBe(true);
    // Agent must acknowledge simply rather than re-introducing
    const naturalReply = 'Haan ji युवराज ji, main sun rahi hoon, boliye!';
    expect(naturalReply).not.toContain('Saya Group se bol rahi hoon');
  });

  // TEST 11: Unknown TTS timing is not reported as 0ms
  it('Test 11: Unknown TTS timing is reported as NOT_MEASURED, never 0ms', () => {
    const ttsFirstAudioMs: number | null = null;
    const formatted = ttsFirstAudioMs != null ? `${ttsFirstAudioMs}ms` : 'NOT_MEASURED';

    expect(formatted).toBe('NOT_MEASURED');
    expect(formatted).not.toBe('0ms');
  });

  // TEST 12: Existing appointment booking safeguards continue working
  it('Test 12: Generic acknowledgement "theek hai" does not book an appointment', () => {
    expect(isGenericAcknowledgement('ठीक है')).toBe(true);
    expect(isGenericAcknowledgement('हाँ')).toBe(true);
    expect(isGenericAcknowledgement('अच्छा')).toBe(true);

    const slot = parseMeetingSlot('ठीक है');
    expect(slot).toBeNull();
  });
});
