import { CustomerMemoryService } from '../memory/customer-memory.service';
import { FactExtractorService } from '../memory/fact-extractor.service';
import { QuestionValidatorService } from '../memory/question-validator.service';
import { detectIntent } from '../calls/call-scripts';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConversationState } from '../memory/memory.types';

describe('Aria Conversational Intelligence Engine (15 Core Scenarios)', () => {
  let memoryService: CustomerMemoryService;
  let factExtractor: FactExtractorService;
  let questionValidator: QuestionValidatorService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    factExtractor = new FactExtractorService();
    questionValidator = new QuestionValidatorService();

    mockRedis = {
      isAvailable: jest.fn().mockReturnValue(true),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(true),
      rpush: jest.fn().mockResolvedValue(1),
      lrange: jest.fn().mockResolvedValue([]),
      ltrim: jest.fn().mockResolvedValue('OK'),
      acquireLock: jest.fn().mockResolvedValue('token-123'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    mockPrisma = {
      lead: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'lead-new', phone: '9876543210' }),
        update: jest.fn().mockResolvedValue({ id: 'lead-new' }),
      },
      call: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'call-1' }),
        update: jest.fn().mockResolvedValue({ id: 'call-1' }),
      },
      conversationMemory: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'mem-1' }),
      },
    };

    memoryService = new CustomerMemoryService(
      mockPrisma as unknown as PrismaService,
      mockRedis as unknown as RedisService,
    );
  });

  // Scenario 1: Returning Customer Recognition & No Repetition of BHK/Budget
  describe('Scenario 1: Returning Customer Recognition', () => {
    it('recognizes returning customer, populates known facts with source=previous_call, and marks BHK/budget as known', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'lead-returning-1',
        name: 'Yuvraj',
        phone: '+919565763089',
        bhkPreference: '2 BHK',
        budget: 8000000,
        preferredLocation: 'Ghaziabad',
        status: 'CONTACTED',
        calls: [{ outcome: 'interested', summary: 'Looking for 2 BHK in Saya' }],
      });

      const state = await memoryService.initializeCallMemory('call-s1', '+919565763089');

      expect(state.isReturningCustomer).toBe(true);
      expect(state.customer.name).toBe('Yuvraj');
      expect(state.customer.bhk).toBe('2 BHK');
      expect(state.factContext.knownFacts).toContain('bhk');
      expect(state.factContext.knownFacts).toContain('budget');
      expect(state.factContext.missingFacts).not.toContain('bhk');
      expect(state.factContext.missingFacts).not.toContain('budget');
      expect(state.factContext.factDetails['bhk'].source).toBe('previous_call');
    });
  });

  // Scenario 2: Updated Budget
  describe('Scenario 2: Updated Budget Handling', () => {
    it('updates customer budget when they increase or change it, tracking source and previousValue', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'lead-budget-up',
        phone: '+919565763089',
        budget: 8000000,
        status: 'CONTACTED',
        calls: [],
      });

      await memoryService.initializeCallMemory('call-s2', '+919565763089');

      const extracted = factExtractor.extractFacts('Actually my budget is 90 Lakhs now');
      const updated = await memoryService.applyExtractedFacts('call-s2', extracted);

      expect(updated.customer.budgetLabel).toBe('90 Lakh');
      expect(updated.factContext.factDetails['budget'].value).toBe('90 Lakh');
      expect(updated.factContext.factDetails['budget'].source).toBe('current_call');
      expect(updated.factContext.factDetails['budget'].previousValue).toBe('80 Lakh');
    });
  });

  // Scenario 3: Ready-to-move Requirement Preserved
  describe('Scenario 3: Ready-to-Move Requirement', () => {
    it('correctly extracts and preserves possession timeline preference', () => {
      const { facts } = factExtractor.extractFacts('I only want ready to move property in Noida');
      expect(facts.timeline).toBe('Ready to Move');
      expect(facts.possession).toBe('ready_to_move');
      expect(facts.location).toBe('Noida');
    });
  });

  // Scenario 4: Direct Question Answering
  describe('Scenario 4: Direct Question Answering', () => {
    it('detects clarifying question regarding identity without misclassifying as refusal', () => {
      const text1 = 'tumko kaise pata chala mera budget 80 lakh hai?';
      const intent1 = detectIntent(text1);
      expect(intent1.notInterested).toBe(false);
      expect(intent1.askingPrice).toBe(false);

      const text2 = 'aap kaun bol rahe ho aur kahan se number mila?';
      const intent2 = detectIntent(text2);
      expect(intent2.askingIdentity).toBe(true);
      expect(intent2.notInterested).toBe(false);
    });
  });

  // Scenario 5: Customer Changes Topic (Residential to Commercial)
  describe('Scenario 5: Customer Switches Topic to Commercial', () => {
    it('extracts commercial property type when customer asks for shops / retail space', () => {
      const { facts: f1 } = factExtractor.extractFacts('Mujhe commercial shop chahiye Saya Piazza mein');
      expect(f1.propertyType).toBe('commercial');
      expect(f1.interestedProjects).toContain('Saya South X / Piazza');

      const { facts: f2 } = factExtractor.extractFacts('Residential 3 BHK flat dekh raha hoon');
      expect(f2.propertyType).toBe('residential');
      expect(f2.bhk).toBe('3 BHK');
    });
  });

  // Scenario 6: Unclear Transcription / Noise
  describe('Scenario 6: Noise & Short Utterance Filtering', () => {
    it('does not extract false facts or BHK from noise or greeting utterances', () => {
      const noisyText = 'haan... hello? umm';
      const { facts } = factExtractor.extractFacts(noisyText);
      expect(facts.bhk).toBeUndefined();
      expect(facts.budget).toBeUndefined();
      expect(facts.propertyType).toBeUndefined();

      const noisyIntent = detectIntent('hello?');
      expect(noisyIntent.isGreeting).toBe(true);
      expect(noisyIntent.askingPrice).toBe(false);
    });
  });

  // Scenario 7: Repeated Question Prevention
  describe('Scenario 7: Anti-Repetition Question Interception', () => {
    it('intercepts repeated question and replaces with next unasked question', () => {
      const mockState: ConversationState = {
        callId: 'call-s7',
        leadId: 'lead-s7',
        phone: '+919999999999',
        isReturningCustomer: false,
        customer: {
          name: 'Rahul',
          purpose: 'end_use',
          bhk: '2 BHK',
          budget: 8000000,
          budgetLabel: '80 Lakh',
          location: null,
          timeline: null,
          possession: null,
          interestedProjects: [],
          siteVisit: null,
        },
        answeredFields: ['bhk', 'budget', 'purpose'],
        askedQuestions: ['कितने बीएचके देख रहे हैं?'],
        pendingQuestion: null,
        lastIntent: null,
        conversationStage: 'requirement_gathering',
        conversationSummary: '',
        lastAssistantResponse: '',
        confirmedFacts: {},
        approximateFacts: {},
        factContext: {
          knownFacts: ['bhk', 'budget', 'purpose'],
          missingFacts: ['location', 'timeline'],
          nextAction: 'ask_location',
          factDetails: {},
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const aiAttempt = 'Yeh project bahut accha hai. Aap 2 BHK dekh rahe hain ya 3 BHK?';
      const result = questionValidator.validateAndSanitize(aiAttempt, mockState);

      expect(result.allowed).toBe(false);
      expect(result.targetField).toBe('bhk');
      expect(result.sanitizedText).not.toContain('2 BHK देख रहे हैं');
      expect(result.sanitizedText).toMatch(/location|लोकेशन/i);
    });
  });

  // Scenario 8: Location Missing
  describe('Scenario 8: Location Missing Validation', () => {
    it('identifies location as missing and asks for location before assuming it', () => {
      const mockState: ConversationState = {
        callId: 'call-s8',
        leadId: 'lead-s8',
        phone: '+919999999998',
        isReturningCustomer: false,
        customer: {
          name: 'Amit',
          purpose: 'end_use',
          bhk: '3 BHK',
          budget: 15000000,
          budgetLabel: '1.5 Cr',
          location: null,
          timeline: null,
          possession: null,
          interestedProjects: [],
          siteVisit: null,
        },
        answeredFields: ['bhk', 'budget', 'purpose'],
        askedQuestions: [],
        pendingQuestion: null,
        lastIntent: null,
        conversationStage: 'requirement_gathering',
        conversationSummary: '',
        lastAssistantResponse: '',
        confirmedFacts: {},
        approximateFacts: {},
        factContext: {
          knownFacts: ['bhk', 'budget', 'purpose'],
          missingFacts: ['location'],
          nextAction: 'ask_location',
          factDetails: {},
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nextQuestion = (questionValidator as any).getNextUnaskedQuestion(mockState);
      expect(nextQuestion).toMatch(/location|लोकेशन/i);
    });
  });

  // Scenario 9: Residential vs Commercial Segregation
  describe('Scenario 9: Residential vs Commercial Segregation', () => {
    it('distinguishes between commercial and residential queries and projects', () => {
      const commQuery = 'Saya Piazza mein retail shop ka rate kya hai?';
      const { facts: commFacts } = factExtractor.extractFacts(commQuery);
      expect(commFacts.propertyType).toBe('commercial');
      expect(commFacts.interestedProjects).toContain('Saya South X / Piazza');

      const resQuery = 'Saya Gold Avenue mein 3 BHK flat ka price kya hai?';
      const { facts: resFacts } = factExtractor.extractFacts(resQuery);
      expect(resFacts.propertyType).toBe('residential');
    });
  });

  // Scenario 10: Interruption / Barge-in
  describe('Scenario 10: Interruption & Priority Handling', () => {
    it('detects interruption cues and user objections immediately', () => {
      const objection = 'Arre ruko, meri baat suno, mujhe yeh project nahi chahiye';
      const intent = detectIntent(objection);
      expect(intent.notInterested).toBe(true);
    });
  });

  // Scenario 11: Fact Correction Overrides Older Facts
  describe('Scenario 11: Fact Correction Overrides Older Facts', () => {
    it('corrects budget from 80 Lakh to 1.2 Crore cleanly', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue({
        id: 'lead-s11',
        phone: '+919876543210',
        budget: 8000000,
        status: 'CONTACTED',
        calls: [],
      });

      await memoryService.initializeCallMemory('call-s11', '+919876543210');

      const extracted = factExtractor.extractFacts('Mera budget 80 nahi, 1.2 crore hai');
      const updated = await memoryService.applyExtractedFacts('call-s11', extracted);

      expect(updated.customer.budgetLabel).toBe('1.2 Cr');
      expect(updated.factContext.factDetails['budget'].value).toBe('1.2 Cr');
      expect(updated.factContext.factDetails['budget'].source).toBe('current_call');
      expect(updated.factContext.factDetails['budget'].previousValue).toBe('80 Lakh');
    });
  });

  // Scenario 12: Call State Persistence on Disconnect
  describe('Scenario 12: Call State & Memory Persistence', () => {
    it('persists call facts, customer profile, and updates DB on call end', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);
      await memoryService.initializeCallMemory('call-s12', '+919876543219');

      const extracted = factExtractor.extractFacts('Mera naam Vikram hai, 3 BHK chahiye Noida mein');
      await memoryService.applyExtractedFacts('call-s12', extracted);

      await memoryService.persistMemoryToDb('call-s12');

      expect(mockPrisma.conversationMemory.upsert).toHaveBeenCalled();
      const upsertArgs = mockPrisma.conversationMemory.upsert.mock.calls[0][0];
      expect(upsertArgs.create.callId).toBe('call-s12');
      expect(upsertArgs.create.customerFacts.bhk).toBe('3 BHK');
    });
  });

  // Scenario 13: Concurrent Calls Isolation
  describe('Scenario 13: Concurrent Calls Isolation', () => {
    it('keeps state for two simultaneous calls completely separate', async () => {
      mockPrisma.lead.findFirst
        .mockResolvedValueOnce({
          id: 'lead-conc-1',
          phone: '+919000000001',
          name: 'Alice',
          bhkPreference: '2 BHK',
          status: 'CONTACTED',
          calls: [],
        })
        .mockResolvedValueOnce({
          id: 'lead-conc-2',
          phone: '+919000000002',
          name: 'Bob',
          bhkPreference: '3 BHK',
          status: 'CONTACTED',
          calls: [],
        });

      const state1 = await memoryService.initializeCallMemory('call-conc-1', '+919000000001');
      const state2 = await memoryService.initializeCallMemory('call-conc-2', '+919000000002');

      expect(state1.customer.name).toBe('Alice');
      expect(state1.customer.bhk).toBe('2 BHK');

      expect(state2.customer.name).toBe('Bob');
      expect(state2.customer.bhk).toBe('3 BHK');

      // Update Call 1
      const ext1 = factExtractor.extractFacts('Actually I need 4 BHK');
      await memoryService.applyExtractedFacts('call-conc-1', ext1);

      // Call 2 must remain completely unaffected
      const finalState2 = await memoryService.getCallMemory('call-conc-2');
      expect(finalState2?.customer.bhk).toBe('3 BHK');

      const finalState1 = await memoryService.getCallMemory('call-conc-1');
      expect(finalState1?.customer.bhk).toBe('4 BHK');
    });
  });

  // Scenario 14: Site Visit Refusal Graceful Handling
  describe('Scenario 14: Site Visit Refusal Handling', () => {
    it('detects callback request or polite deferral instead of treating as aggressive refusal', () => {
      const deferral = 'Abhi time nahi hai baad mein call karna';
      const intent1 = detectIntent(deferral);
      expect(intent1.callback).toBe(true);

      const strictRefusal = 'Nahi chahiye, phone rakho';
      const intent2 = detectIntent(strictRefusal);
      expect(intent2.notInterested).toBe(true);
    });
  });

  // Scenario 15: No Hallucination on Verified Inventory
  describe('Scenario 15: Fact Extraction Consistency with Inventory', () => {
    it('extracts recognized Saya projects accurately without conflation', () => {
      const { facts: p1 } = factExtractor.extractFacts('Kya Saya South X mein shops hain?');
      expect(p1.interestedProjects).toContain('Saya South X / Piazza');
      expect(p1.propertyType).toBe('commercial');

      const { facts: p2 } = factExtractor.extractFacts('Saya Piazza mein showroom dekhna hai');
      expect(p2.interestedProjects).toContain('Saya South X / Piazza');
      expect(p2.propertyType).toBe('commercial');
    });
  });
});
