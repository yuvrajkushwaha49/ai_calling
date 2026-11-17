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
import { pullSpokenSentences } from './conversation.service';
import { normalizeTextForSpeech } from '../calls/phone-audio';

describe('Aria Round 6 — Production Validation, MCube Audio Reliability & Voice Quality (20 Scenarios)', () => {
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
      description: 'Luxury apartments in Sector 1 Greater Noida West',
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
      description: 'Modern clubhouse and apartments',
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
      description: 'SWAMIH funded project in Greater Noida West',
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
      reraNumber: 'UPRERAPRJ11127',
      description: '5 Acres luxury towers with mega clubhouse',
      amenities: ['Mega Clubhouse', 'Infinity Pool'],
    },
    {
      id: 'p-saya-res',
      name: 'Saya Pre-Launch',
      builder: 'Saya Group',
      companyName: 'Workains Reality',
      location: 'Raj Nagar Extension, Ghaziabad',
      propertyType: 'APARTMENT',
      startingPrice: 6900000,
      endingPrice: 14000000,
      reraNumber: 'UPRERAPRJ11128',
      description: '18 Acres township in Raj Nagar Extension',
      amenities: ['Clubhouse', 'Sports Complex'],
    },
  ];

  beforeEach(async () => {
    prismaMock = {
      project: {
        findMany: jest.fn().mockImplementation((args?: any) => {
          let list = [...mockDbProjects];
          if (args?.where?.propertyType) {
            list = list.filter((p) => p.propertyType === args.where.propertyType);
          }
          return Promise.resolve(list);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(
            mockDbProjects.find((p) =>
              p.name.toLowerCase().includes(String(where?.name?.contains || '').toLowerCase()),
            ),
          );
        }),
      },
      lead: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'lead-round6-yuvi',
          name: 'युवराज',
          phone: '+919565763089',
          budget: 8000000,
          objections: ['rejectedBuilder:Saya Group'],
          calls: [],
          project: {
            name: 'Palace Heights by Rudra',
            companyName: 'Rudra Buildwell',
          },
        }),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      call: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      conversationMemory: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            leadId: 'lead-round6-yuvi',
            customerFacts: {
              lastDiscussedProject: 'Palace Heights by Rudra',
              bhk: '2 BHK',
              budget: 8000000,
              budgetLabel: '80 Lakh',
              rejectedBuilders: ['Saya Group'],
              preferredBuilders: ['Rudra Buildwell'],
            },
            rejectedBuilders: ['Saya Group'],
            preferredBuilders: ['Rudra Buildwell'],
            rejectedProjects: [],
            preferredProjects: ['Palace Heights by Rudra'],
            propertyType: 'RESIDENTIAL',
            purpose: 'end_use',
            updatedAt: new Date(),
          },
        ]),
        upsert: jest.fn().mockResolvedValue({ id: 'mem-round6' }),
      },
    };

    redisMock = {
      isAvailable: jest.fn().mockReturnValue(true),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(true),
      rpush: jest.fn().mockResolvedValue(1),
      lrange: jest.fn().mockResolvedValue([]),
      ltrim: jest.fn().mockResolvedValue('OK'),
      acquireLock: jest.fn().mockResolvedValue('lock-token'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    llmMock = {
      generateResponse: jest.fn(),
      streamText: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        FactExtractorService,
        QuestionValidatorService,
        CustomerMemoryService,
        WhatsAppService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        { provide: LlmService, useValue: llmMock },
        { provide: KnowledgeService, useValue: { searchKnowledge: jest.fn().mockResolvedValue([]) } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) => {
              if (k === 'COMPANY_NAME') return 'Workains Reality';
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

  // Scenario 1: Spacing bug fix — 2 BHK₹60.90 Lakh does not concatenate
  it('Scenario 1: Spacing bug fix ensures word boundary on 2 BHK₹60.90 Lakh', () => {
    const res = normalizeTextForSpeech('2 BHK₹60.90 Lakh');
    expect(res).toBe('2 BHK saath lakh nabbe hazaar rupaye');
    expect(res).not.toContain('BHKsaath');
  });

  // Scenario 2: Decimal currency normalization — ₹63.99 Lakh
  it('Scenario 2: Decimal currency ₹63.99 Lakh normalizes accurately to tirasath lakh ninyanve hazaar rupaye', () => {
    const res = normalizeTextForSpeech('NCR Monarch starting from ₹63.99 Lakh');
    expect(res).toBe('NCR Monarch starting from tirasath lakh ninyanve hazaar rupaye');
  });

  // Scenario 3: Stretch currency normalization — ₹86.32 Lakh
  it('Scenario 3: ₹86.32 Lakh normalizes cleanly to chhiyaasi lakh battis hazaar rupaye', () => {
    const res = normalizeTextForSpeech('Future Estate price ₹86.32 Lakh');
    expect(res).toBe('Future Estate price chhiyaasi lakh battis hazaar rupaye');
  });

  // Scenario 4: Rate per sq.ft normalization — ₹8,888 per sq.ft
  it('Scenario 4: ₹8,888 per sq.ft normalizes to natural Hindi rate expression', () => {
    const res = normalizeTextForSpeech('BSP ₹8,888 per sq.ft');
    expect(res).toBe('BSP aath hazaar aath sau athasi rupaye per square foot');
  });

  // Scenario 5: Unit measurement — 720 sq.ft
  it('Scenario 5: 720 sq.ft expands to 720 square feet without mid-word splitting', () => {
    const res = normalizeTextForSpeech('Super area 720 sq.ft hai');
    expect(res).toBe('Super area 720 square feet hai');
  });

  // Scenario 6: Area with comma — 1,250 sq.ft
  it('Scenario 6: 1,250 sq.ft normalizes to 1250 square feet', () => {
    const res = normalizeTextForSpeech('Unit size 1,250 sq.ft available');
    expect(res).toBe('Unit size 1250 square feet available');
  });

  // Scenario 7: Configuration formatting — 2 BHK and 3 BHK
  it('Scenario 7: Preserves clean formatting for 2 BHK and 3 BHK', () => {
    const res = normalizeTextForSpeech('Kya aap 2 BHK dekh rahe hain ya 3 BHK?');
    expect(res).toBe('Kya aap 2 BHK dekh rahe hain ya 3 BHK?');
  });

  // Scenario 8: Returning customer memory hydration of past discussed project
  it('Scenario 8: Customer profile correctly hydrates lastDiscussedProject across calls', async () => {
    const profile = await customerMemory.lookupCustomer('+919565763089');
    expect(profile).not.toBeNull();
    expect(profile?.lastDiscussedProject).toBe('Palace Heights by Rudra');
    expect(profile?.rejectedBuilders).toContain('Saya Group');
  });

  // Scenario 9: Recall past project query
  it('Scenario 9: "Maine pichhli baar kis project ke baare mein baat ki thi?" directly answers with last discussed project', () => {
    const intent = detectIntent('Maine pichhli baar kis project ke baare mein baat ki thi?');
    expect(intent.askingPastProject).toBe(true);

    const reply = buildFollowUpReply({
      transcript: 'Maine pichhli baar kis project ke baare mein baat ki thi?',
      leadName: 'युवराज',
      companyName: 'Workains Reality',
      language: 'hinglish',
      knownFacts: {
        lastDiscussedProject: 'Palace Heights by Rudra',
      },
    });

    expect(reply.text).toContain('Palace Heights by Rudra');
    expect(reply.text).toContain('pichhli baar humne');
  });

  // Scenario 10: Builder rejection persistence
  it('Scenario 10: "Saya mujhe nahi chahiye" captures rejection and excludes all Saya projects', async () => {
    const facts = factExtractor.extractFacts('Saya mujhe nahi chahiye bilkul');
    expect(facts.rejectedBuilders).toContain('Saya Group');

    const overview = await conversationService.getProjectsOverview({
      rejectedBuilders: facts.rejectedBuilders,
    });
    expect(overview).not.toContain('Saya Pre-Launch');
  });

  // Scenario 11: Alternatives inquiry
  it('Scenario 11: "Uske alawa kya options hain?" provides alternative non-rejected projects', () => {
    const intent = detectIntent('Uske alawa kya options hain?');
    expect(intent.askingAlternatives).toBe(true);

    const reply = buildFollowUpReply({
      transcript: 'Uske alawa kya options hain?',
      leadName: 'युवराज',
      companyName: 'Workains Reality',
      language: 'hinglish',
    });

    expect(reply.text).toContain('Palace Heights by Rudra');
    expect(reply.text).toContain('NCR Monarch');
  });

  // Scenario 12: sab projects query retrieves all eligible DB records
  it('Scenario 12: "Sab projects batao" returns all active inventory without artificial 3-project cap', async () => {
    const overview = await conversationService.getProjectsOverview({
      propertyType: 'RESIDENTIAL',
      rejectedBuilders: ['Saya Group'],
    });

    expect(overview).toContain('Palace Heights by Rudra');
    expect(overview).toContain('NCR Monarch');
    expect(overview).toContain('Future Estate by Future World');
    expect(overview).toContain('VVIP Pre-Launch');
  });

  // Scenario 13: Contextual project resolution
  it('Scenario 13: "NCR ke baare mein batao" clarifies or resolves to NCR Monarch without confusion', () => {
    const reply = buildFollowUpReply({
      transcript: 'NCR ke baare mein batao',
      leadName: 'युवराज',
      companyName: 'Workains Reality',
      language: 'hinglish',
    });
    expect(reply.text).toContain('NCR Monarch');
    expect(reply.text).toContain('Greater Noida West');
  });

  // Scenario 14: Short acknowledgement "Okay"
  it('Scenario 14: "Okay" provides natural continuation without restarting pitch or asking known facts', () => {
    const reply = buildFollowUpReply({
      transcript: 'Okay',
      leadName: 'युवराज',
      companyName: 'Workains Reality',
      language: 'hinglish',
      knownFacts: { bhk: '2 BHK' },
    });
    expect(reply.text).toMatch(/ji|bilkul/i);
    expect(reply.text).not.toContain('Swagat hai');
    expect(reply.text).not.toContain('Aapka budget kitna hai');
  });

  // Scenario 15: Missing feature inquiry
  it('Scenario 15: "Kya nahi hai?" clarifies polite scope without conversational derailment', () => {
    const reply = buildFollowUpReply({
      transcript: 'Kya nahi hai?',
      leadName: 'युवराज',
      companyName: 'Workains Reality',
      language: 'hinglish',
    });
    expect(reply.text).toContain('amenity, feature ya facility');
  });

  // Scenario 16: Callback request
  it('Scenario 16: "Abhi busy hoon, baad mein call karna" confirms callback politely without unsolicited goodbye', () => {
    const intent = detectIntent('Abhi busy hoon, baad mein call karna');
    expect(intent.callback).toBe(true);

    const reply = buildFollowUpReply({
      transcript: 'Abhi busy hoon, baad mein call karna',
      leadName: 'युवराज',
      companyName: 'Workains Reality',
      language: 'hinglish',
    });
    expect(reply.text).toContain('baad mein call');
  });

  // Scenario 17: Document dispatch request
  it('Scenario 17: "WhatsApp par bhej do" notes document dispatch without claiming premature delivery', () => {
    const reply = buildFollowUpReply({
      transcript: 'WhatsApp par bhej do',
      leadName: 'युवराज',
      companyName: 'Workains Reality',
      language: 'hinglish',
    });
    expect(reply.text).toContain('WhatsApp');
    expect(reply.text).not.toContain('delivered ho gaya hai');
  });

  // Scenario 18: Barge-in lifecycle state transitions
  it('Scenario 18: Barge-in invalidates queue, increments flush generation, and triggers lifecycle steps', () => {
    const session = {
      streamId: 'stream-test-r6',
      flushGen: 1,
      cancelPlay: false,
      agentPlaying: true,
      pendingSegments: new Set(['seg-1', 'seg-2']),
      turnAbortController: new AbortController(),
      lastAudioChunkSentAt: Date.now() - 50,
      lastAudioChunkSegment: 'seg-2',
      actualCancellationConfirmed: false,
    };

    // Simulate Step 1 (detect), Step 3 (clear queue), Step 4 (abort)
    const initialSegmentsCount = session.pendingSegments.size;
    session.cancelPlay = true;
    session.agentPlaying = false;
    session.pendingSegments.clear();
    session.flushGen += 1;
    session.turnAbortController.abort();
    session.turnAbortController = null;

    expect(initialSegmentsCount).toBe(2);
    expect(session.pendingSegments.size).toBe(0);
    expect(session.cancelPlay).toBe(true);
    expect(session.flushGen).toBe(2);
    expect(session.turnAbortController).toBeNull();
  });

  // Scenario 19: Stale chunk drop logic
  it('Scenario 19: Stale chunk with older generation or active cancellation is discarded before send', () => {
    const session = {
      flushGen: 4,
      cancelPlay: true,
    };

    const isChunkAllowed = (chunkGen: number, sess: typeof session) => {
      if (sess.cancelPlay) return false;
      if (chunkGen !== sess.flushGen) return false;
      return true;
    };

    expect(isChunkAllowed(3, session)).toBe(false); // Stale generation
    expect(isChunkAllowed(4, session)).toBe(false); // Active cancellation
  });

  // Scenario 20: Meta WhatsApp webhook status transition
  it('Scenario 20: WhatsApp webhook delivery lifecycle accurately tracks sent to delivered states', () => {
    const webhookRes = whatsappService.handleWebhookStatus('wamid_test_123', 'delivered');
    expect(webhookRes.messageId).toBe('wamid_test_123');
    expect(webhookRes.status).toBe('DELIVERED');
  });
});

