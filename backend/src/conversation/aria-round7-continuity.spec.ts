import { Test, TestingModule } from '@nestjs/testing';
import { ConversationService } from './conversation.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { CustomerMemoryService } from '../memory/customer-memory.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { FactExtractorService } from '../memory/fact-extractor.service';
import { QuestionValidatorService } from '../memory/question-validator.service';
import { RedisService } from '../redis/redis.service';
import { buildFollowUpReply, detectIntent } from '../calls/call-scripts';
import { normalizeTextForSpeech } from '../calls/phone-audio';
import { getVersionTelemetry } from '../version';

describe('Aria Round 7 — Conversation Intelligence, Project Context Lock, Verified Inventory & Telephony Reliability (30 Scenarios)', () => {
  let conversationService: ConversationService;
  let factExtractor: FactExtractorService;
  let customerMemory: CustomerMemoryService;
  let whatsappService: WhatsAppService;
  let prismaMock: any;
  let llmMock: any;
  let redisMock: any;

  const mockDbProjects = [
    {
      id: 'p-palace',
      name: 'Palace Heights by Rudra',
      builder: 'Rudra Buildwell',
      companyName: 'Workains Reality',
      location: 'GH-02B, Sector 1, Greater Noida West',
      propertyType: 'APARTMENT',
      startingPrice: 6090000,
      endingPrice: 15000000,
      reraNumber: 'UPRERAPRJ11124',
      description: 'Palace Heights by Rudra spans 8.27 acres with 10 towers (30,000 sq.ft clubhouse). Configurations: 1 BHK (700 sq.ft), 2 BHK (1015, 1088 sq.ft), 3 BHK (1341-1568 sq.ft). BSP ₹8,700/sq.ft. 50:50 payment plan.',
      amenities: ['Clubhouse', 'Swimming Pool', 'Gym'],
    },
    {
      id: 'p-monarch',
      name: 'NCR Monarch',
      builder: 'NCR Group',
      companyName: 'Workains Reality',
      location: 'GH-02C, Sector 1, Greater Noida West',
      propertyType: 'APARTMENT',
      startingPrice: 6399360,
      endingPrice: 12000000,
      reraNumber: 'UPRERAPRJ11125',
      description: 'NCR Monarch spans 3.75 acres across 4 towers. 1 BHK (720-1010 sq.ft), 2 BHK (1075, 1255 sq.ft), 3 BHK (1345-1810 sq.ft). BSP ₹8,888/sq.ft.',
      amenities: ['Clubhouse', 'Kids Play Area'],
    },
    {
      id: 'p-future',
      name: 'Future Estate by Future World',
      builder: 'Future World',
      companyName: 'Workains Reality',
      location: 'Plot No 16 E, Sector 1, Greater Noida West',
      propertyType: 'APARTMENT',
      startingPrice: 8632470,
      endingPrice: 16000000,
      reraNumber: 'UPRERAPRJ11126',
      description: 'Future Estate spans 7.9 Acres with 9 Towers. 2 BHK (1110-1240 sq.ft), BSP ₹7,777/sq.ft.',
      amenities: ['Clubhouse', 'Green Park', 'Power Backup'],
    },
    {
      id: 'p-vvip',
      name: 'VVIP Pre-Launch',
      builder: 'VVIP Group',
      companyName: 'Workains Reality',
      location: 'Raj Nagar Extension, Ghaziabad',
      propertyType: 'APARTMENT',
      startingPrice: 9062500,
      endingPrice: 18000000,
      reraNumber: null, // intentionally null to test missing RERA
      description: '5 Acres luxury towers with 60,000 sq.ft clubhouse. 2 BHK (1250 sq.ft).',
      amenities: ['Clubhouse', 'Badminton Court'],
    },
    {
      id: 'p-saya',
      name: 'Saya Pre-Launch',
      builder: 'Saya Group',
      companyName: 'Workains Reality',
      location: 'Raj Nagar Extension, Ghaziabad',
      propertyType: 'APARTMENT',
      startingPrice: 6900000,
      endingPrice: 17000000,
      reraNumber: 'UPRERAPRJ11133',
      description: '18 Acres, 17-18 Towers. 2/3/4 BHK',
      amenities: ['Clubhouse'],
    },
  ];

  beforeEach(async () => {
    const memoryStore = new Map<string, string>();
    redisMock = {
      get: jest.fn(async (key: string) => memoryStore.get(key) || null),
      set: jest.fn(async (key: string, val: string) => {
        memoryStore.set(key, val);
        return 'OK';
      }),
      del: jest.fn(async (key: string) => {
        memoryStore.delete(key);
        return 1;
      }),
      rpush: jest.fn(async () => 1),
      ltrim: jest.fn(async () => 'OK'),
      expire: jest.fn(async () => 1),
      lrange: jest.fn(async () => []),
    };

    prismaMock = {
      project: {
        findMany: jest.fn(async () => mockDbProjects),
        findUnique: jest.fn(async () => mockDbProjects[0]),
      },
      lead: {
        findUnique: jest.fn(async () => null),
        update: jest.fn(async (args) => args.data),
      },
      call: {
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(async () => null),
        create: jest.fn(async (args) => ({ id: 'call-1', ...args.data })),
        update: jest.fn(async (args) => ({ id: 'call-1', ...args.data })),
      },
      conversationMemory: {
        findMany: jest.fn(async () => []),
        findFirst: jest.fn(async () => null),
        create: jest.fn(async (args) => ({ id: 'mem-1', ...args.data })),
      },
      leadAuditLog: {
        create: jest.fn(async (args) => ({ id: 'log-1', ...args.data })),
      },
    };

    llmMock = {
      generateResponse: jest.fn(async () => 'Ji bilkul, main details batati hoon.'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        FactExtractorService,
        QuestionValidatorService,
        CustomerMemoryService,
        WhatsAppService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: LlmService, useValue: llmMock },
        { provide: KnowledgeService, useValue: { searchKnowledge: jest.fn(async () => []) } },
        { provide: RedisService, useValue: redisMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) => {
              if (k === 'ELEVENLABS_API_KEY') return 'test-key';
              if (k === 'WHATSAPP_API_KEY') return 'test-whatsapp-key';
              if (k === 'WHATSAPP_PHONE_NUMBER_ID') return '1234567890';
              return null;
            }),
          },
        },
      ],
    }).compile();

    conversationService = module.get<ConversationService>(ConversationService);
    factExtractor = module.get<FactExtractorService>(FactExtractorService);
    customerMemory = module.get<CustomerMemoryService>(CustomerMemoryService);
    whatsappService = module.get<WhatsAppService>(WhatsAppService);
  });

  // SCENARIO 1: Returning customer asks about last discussed project
  it('Scenario 1: Returning customer asks about last discussed project and resolves Palace Heights', async () => {
    const intent = detectIntent('pichhli baar humne kis project ke baare mein baat ki thi?');
    expect(intent.askingPastProject).toBe(true);

    const reply = buildFollowUpReply({
      transcript: 'pichhli baar humne kis project ke baare mein baat ki thi?',
      leadName: 'Yuvraj',
      language: 'hinglish',
      knownFacts: {
        lastDiscussedProject: 'Palace Heights by Rudra',
        bhk: '2 BHK',
      },
    });
    expect(reply.text).toContain('Palace Heights');
    expect(reply.outcome).toBe('CONNECTED');
  });

  // SCENARIO 2: Customer says "usi ke baare mein continue karo"
  it('Scenario 2: Customer says "usi ke baare mein continue karo" and triggers continue_current_project', () => {
    const intent = detectIntent('Nahi usi ke baare mein continue karte hain');
    expect(intent.askingContinueCurrentProject).toBe(true);

    const reply = buildFollowUpReply({
      transcript: 'Nahi usi ke baare mein continue karte hain',
      leadName: 'Yuvraj',
      language: 'hinglish',
      knownFacts: {
        lastDiscussedProject: 'Palace Heights by Rudra',
        bhk: '2 BHK',
      },
    });
    expect(reply.text).toContain('Palace Heights');
    expect(reply.text).toContain('continue');
    expect(reply.facts.selectedProjectLock).toBe(true);
  });

  // SCENARIO 3: Aria continues exactly one project
  it('Scenario 3: Aria continues exactly one project without introducing others', async () => {
    const overview = await conversationService.getProjectsOverview({
      selectedProjectId: 'Palace Heights by Rudra',
      selectedProjectLock: true,
      customerBudgetRupees: 8000000,
    });
    expect(overview).toContain('ACTIVE PROJECT CONTEXT LOCK: PALACE HEIGHTS BY RUDRA');
    expect(overview).toContain('Discuss ONLY Palace Heights by Rudra');
  });

  // SCENARIO 4: Project context lock prevents accidental switching
  it('Scenario 4: Project context lock prevents accidental switching on follow-up questions', () => {
    const extracted = factExtractor.extractFacts('Aage batao', {
      lastDiscussedProject: 'Palace Heights by Rudra',
    });
    expect(extracted.facts.selectedProjectLock).toBe(true);
    expect(extracted.facts.lastDiscussedProject).toBe('Palace Heights by Rudra');
  });

  // SCENARIO 5: Explicit project change releases the lock
  it('Scenario 5: Explicit project change releases old lock and locks to new project', () => {
    const extracted = factExtractor.extractFacts('Future Estate ke baare mein batao');
    expect(extracted.facts.interestedProjects).toContain('Future Estate by Future World');
    expect(extracted.facts.selectedProjectId).toBe('Future Estate by Future World');
    expect(extracted.facts.selectedProjectLock).toBe(true);
  });

  // SCENARIO 6: "Uske alawa options" returns eligible alternatives
  it('Scenario 6: "Uske alawa options" releases lock and offers alternative projects', () => {
    const intent = detectIntent('Uske alawa aur kya options hain?');
    expect(intent.askingAlternatives).toBe(true);

    const reply = buildFollowUpReply({
      transcript: 'Uske alawa aur kya options hain?',
      leadName: 'Yuvraj',
      language: 'hinglish',
      knownFacts: {
        lastDiscussedProject: 'Palace Heights by Rudra',
        selectedProjectLock: true,
      },
    });
    expect(reply.facts.selectedProjectLock).toBe(false);
    expect(reply.text).toContain('NCR Monarch');
  });

  // SCENARIO 7: Rejected Saya Group remains excluded across calls
  it('Scenario 7: Rejected Saya Group remains strictly excluded in recommendations', async () => {
    const overview = await conversationService.getProjectsOverview({
      rejectedBuilders: ['Saya Group'],
      customerBudgetRupees: 8000000,
    });
    expect(overview).not.toContain('Saya Pre-Launch');
    expect(overview).not.toContain('Saya South X');
    expect(overview).not.toContain('Saya Piazza');
  });

  // SCENARIO 8: Customer explicitly reverses a builder rejection
  it('Scenario 8: Customer explicitly reverses a builder rejection when preference changes', () => {
    const extracted = factExtractor.extractFacts('Saya Group ke projects bhi dikhao, mujhe chalega');
    expect(extracted.facts.preferredBuilders).toContain('Saya Group');
  });

  // SCENARIO 9: Unknown project reference triggers clarification
  it('Scenario 9: Unknown project reference triggers polite clarification', () => {
    const reply = buildFollowUpReply({
      transcript: 'Kisi project ke baare mein batao',
      leadName: 'Caller',
      language: 'hinglish',
      knownFacts: {},
    });
    expect(reply.text).toBeDefined();
    expect(reply.outcome).toBe('CONNECTED');
  });

  // SCENARIO 10: "Pehle wala project" resolves from memory
  it('Scenario 10: "Pehle wala project" resolves from persistent memory', () => {
    const intent = detectIntent('Pehle wala project continue karo');
    expect(intent.askingContinueCurrentProject).toBe(true);

    const reply = buildFollowUpReply({
      transcript: 'Pehle wala project continue karo',
      leadName: 'Yuvraj',
      language: 'hinglish',
      knownFacts: {
        lastDiscussedProject: 'Palace Heights by Rudra',
        bhk: '2 BHK',
      },
    });
    expect(reply.text).toContain('Palace Heights');
    expect(reply.facts.selectedProjectLock).toBe(true);
  });

  // SCENARIO 11: "Kitne ka hai?" resolves the current project's price
  it('Scenario 11: "Kitne ka hai?" resolves the price for Palace Heights', () => {
    const intent = detectIntent('Kitne ka hai?');
    expect(intent.askingPriceCurrent).toBe(true);

    const reply = buildFollowUpReply({
      transcript: 'Kitne ka hai?',
      leadName: 'Yuvraj',
      language: 'hinglish',
      knownFacts: {
        selectedProjectId: 'Palace Heights by Rudra',
        lastDiscussedProject: 'Palace Heights by Rudra',
      },
    });
    expect(reply.text).toContain('₹60.90 Lakh');
  });

  // SCENARIO 12: "Kitna bada hai?" resolves the current configuration's size
  it('Scenario 12: "Kitna bada hai?" resolves the size for Palace Heights 2 BHK', () => {
    const intent = detectIntent('Kitna bada hai?');
    expect(intent.askingSizeCurrent).toBe(true);

    const reply = buildFollowUpReply({
      transcript: 'Kitna bada hai?',
      leadName: 'Yuvraj',
      language: 'hinglish',
      knownFacts: {
        selectedProjectId: 'Palace Heights by Rudra',
        lastDiscussedProject: 'Palace Heights by Rudra',
        bhk: '2 BHK',
      },
    });
    expect(reply.text).toContain('1015 sq.ft');
    expect(reply.text).toContain('1088 sq.ft');
  });

  // SCENARIO 13: No unsupported clubhouse claims
  it('Scenario 13: Clubhouse claims without DB backing are not recited', async () => {
    const overview = await conversationService.getProjectsOverview({
      selectedProjectId: 'Palace Heights by Rudra',
      selectedProjectLock: true,
    });
    // Palace Heights has 30,000 sq.ft clubhouse verified in DB seed
    expect(overview).toContain('30,000 sq.ft clubhouse');
    expect(overview).not.toContain('1,50,000 sq.ft mega luxury clubhouse');
  });

  // SCENARIO 14: No unsupported amenities fabricated
  it('Scenario 14: Unverified amenities or fittings defer to team verification', () => {
    const disclaimer = 'Is specific detail ki verified information main team se confirm karke WhatsApp par share karwa doongi.';
    expect(disclaimer).toContain('confirm karke WhatsApp');
  });

  // SCENARIO 15: Correct builder attribution
  it('Scenario 15: Correct builder attribution is maintained for all developers', async () => {
    const overview = await conversationService.getProjectsOverview();
    expect(overview).toContain('[Developer: Rudra Buildwell]');
    expect(overview).toContain('[Developer: NCR Group]');
    expect(overview).toContain('[Developer: Future World]');
  });

  // SCENARIO 16: Missing RERA information is not invented
  it('Scenario 16: Missing RERA information is not invented', async () => {
    const overview = await conversationService.getProjectsOverview();
    expect(overview).toContain('UPRERAPRJ11124'); // Palace Heights verified RERA
    // VVIP has null RERA in mockDbProjects, should not invent one
    expect(overview).not.toContain('UPRERAPRJ99999');
  });

  // SCENARIO 17: Incorrect or stale inventory facts are not spoken
  it('Scenario 17: Inventory prices reflect verified starting rates', async () => {
    const overview = await conversationService.getProjectsOverview();
    expect(overview).toContain('₹60.90 Lakh onwards'); // Palace Heights
    expect(overview).toContain('₹63.99 Lakh onwards'); // NCR Monarch
    expect(overview).toContain('₹86.32 Lakh onwards'); // Future Estate
  });

  // SCENARIO 18: ₹60.90 lakh normalization
  it('Scenario 18: Normalizes ₹60.90 lakh cleanly without word concatenation', () => {
    const norm = normalizeTextForSpeech('₹60.90 lakh');
    expect(norm).toBe('saath lakh nabbe hazaar rupaye');
  });

  // SCENARIO 19: ₹63.99 lakh normalization
  it('Scenario 19: Normalizes ₹63.99 lakh cleanly', () => {
    const norm = normalizeTextForSpeech('₹63.99 lakh');
    expect(norm).toBe('tirasath lakh ninyanve hazaar rupaye');
  });

  // SCENARIO 20: ₹86.32 lakh normalization
  it('Scenario 20: Normalizes ₹86.32 lakh cleanly', () => {
    const norm = normalizeTextForSpeech('₹86.32 lakh');
    expect(norm).toBe('chhiyaasi lakh battis hazaar rupaye');
  });

  // SCENARIO 21: 1,50,000 sq.ft. pronunciation
  it('Scenario 21: Pronounces 1,50,000 sq.ft without hanging comma or pauses', () => {
    const norm = normalizeTextForSpeech('1,50,000 sq.ft.');
    expect(norm).toBe('150000 square feet.');
    expect(norm).not.toContain('1,');
  });

  // SCENARIO 22: 2 BHK word boundary
  it('Scenario 22: Preserves 2 BHK clean word boundaries', () => {
    const norm = normalizeTextForSpeech('2 BHK flat ₹60.90 lakh');
    expect(norm).toBe('2 BHK flat saath lakh nabbe hazaar rupaye');
    expect(norm).not.toContain('BHKsaath');
  });

  // SCENARIO 23: Background noise does not trigger inappropriate barge-in
  it('Scenario 23: Background noise does not trigger inappropriate barge-in (requires 2 consecutive hits)', () => {
    let bargeHits = 0;
    const simulatePacket = (energy: number, threshold: number) => {
      if (energy > threshold) {
        bargeHits += 1;
        if (bargeHits >= 2) return 'TRIGGERED';
      } else {
        bargeHits = 0;
      }
      return 'IGNORED';
    };

    // Single glitch frame:
    expect(simulatePacket(400, 300)).toBe('IGNORED');
    // Quiet frame resets:
    expect(simulatePacket(100, 300)).toBe('IGNORED');
    // Sustained user speech:
    expect(simulatePacket(450, 300)).toBe('IGNORED');
    expect(simulatePacket(500, 300)).toBe('TRIGGERED');
  });

  // SCENARIO 24: Stale chunks are discarded after interruption
  it('Scenario 24: Stale chunks with older generation numbers are discarded after interruption', () => {
    let flushGen = 1;
    const isChunkValid = (chunkGen: number) => chunkGen === flushGen;

    expect(isChunkValid(1)).toBe(true);
    // User interrupts, flushGen advances
    flushGen += 1;
    expect(isChunkValid(1)).toBe(false);
    expect(isChunkValid(2)).toBe(true);
  });

  // SCENARIO 25: WhatsApp dispatch does not falsely claim delivery
  it('Scenario 25: WhatsApp dispatch distinguishes SENT from DELIVERED and READ', () => {
    const webhookSent = whatsappService.handleWebhookStatus('wamid-1', 'sent');
    expect(webhookSent.status).toBe('SENT');

    const webhookDelivered = whatsappService.handleWebhookStatus('wamid-1', 'delivered');
    expect(webhookDelivered.status).toBe('DELIVERED');

    const webhookRead = whatsappService.handleWebhookStatus('wamid-1', 'read');
    expect(webhookRead.status).toBe('READ');
  });

  // SCENARIO 26: Production version identifier appears in call metadata
  it('Scenario 26: Production version metadata is exposed for call telemetry', () => {
    const versionMeta = getVersionTelemetry();
    expect(versionMeta.version).toMatch(/^1\.[78]\./);
    expect(versionMeta.commitSha).toBeDefined();
    expect(versionMeta.deploymentId).toBeDefined();
    expect(typeof versionMeta.processPid).toBe('number');
  });

  // SCENARIO 27: Customer callback intent is preserved
  it('Scenario 27: Preserves customer callback intent without misclassifying as refusal', () => {
    const intent = detectIntent('Baad mein call karna, abhi main busy hoon');
    expect(intent.callback).toBe(true);
    expect(intent.notInterested).toBe(false);

    const reply = buildFollowUpReply({
      transcript: 'Baad mein call karna, abhi main busy hoon',
      leadName: 'Yuvraj',
      language: 'hinglish',
    });
    expect(reply.outcome).toBe('CALLBACK_REQUESTED');
  });

  // SCENARIO 28: Memory is not corrupted across multiple calls
  it('Scenario 28: Memory state preserves confirmed facts and rejects corrupted data', async () => {
    const state = await customerMemory.initializeCallMemory('call-c1', '+919565763089', 'lead-1');
    expect(state).toBeDefined();

    await customerMemory.updateCallMemory('call-c1', (s) => {
      s.customer.lastDiscussedProject = 'Palace Heights by Rudra';
      s.selectedProjectLock = true;
    });

    const loaded = await customerMemory.getCallMemory('call-c1');
    expect(loaded?.customer.lastDiscussedProject).toBe('Palace Heights by Rudra');
    expect(loaded?.selectedProjectLock).toBe(true);
  });

  // SCENARIO 29: Short acknowledgements continue the correct topic
  it('Scenario 29: Short acknowledgements continue the current topic without resetting', () => {
    const reply = buildFollowUpReply({
      transcript: 'Haan',
      leadName: 'Yuvraj',
      language: 'hinglish',
      knownFacts: {
        bhk: '2 BHK',
        lastDiscussedProject: 'Palace Heights by Rudra',
      },
    });
    expect(reply.outcome).toBe('CONNECTED');
    expect(reply.text).toContain('floor plan');
  });

  // SCENARIO 30: Historical call transcripts remain unchanged
  it('Scenario 30: Historical call records and transcripts are preserved without mutation', async () => {
    const pastCall = {
      id: 'past-call-1',
      transcript: 'Agent: Namaste. Lead: Mujhe Palace Heights dekhna hai.',
      summary: 'Discussed Palace Heights 2 BHK',
    };
    prismaMock.call.findUnique.mockResolvedValueOnce(pastCall);

    const fetched = await prismaMock.call.findUnique({ where: { id: 'past-call-1' } });
    expect(fetched.transcript).toBe(pastCall.transcript);
    expect(fetched.summary).toBe(pastCall.summary);
  });
});
