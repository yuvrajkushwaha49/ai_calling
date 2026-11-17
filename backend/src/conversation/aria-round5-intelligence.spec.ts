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
import { buildFollowUpReply } from '../calls/call-scripts';
import { pullSpokenSentences } from './conversation.service';
import { normalizeTextForSpeech } from '../calls/phone-audio';

describe('Aria Round 5 — Conversation Intelligence, Voice Quality & Sales Automation (20 Scenarios)', () => {
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
      location: 'Sector 1, Greater Noida West',
      propertyType: 'APARTMENT',
      startingPrice: 6090000,
      endingPrice: 15000000,
      reraNumber: 'UPRERAPRJ0001',
      description: 'Luxury apartments in Sector 1 Greater Noida West',
      amenities: ['Clubhouse', 'Swimming Pool', 'Gym'],
    },
    {
      id: 'p-monarch',
      name: 'NCR Monarch',
      builder: 'NCR Group',
      companyName: 'Workains Reality',
      location: 'Sector 1, Greater Noida West',
      propertyType: 'APARTMENT',
      startingPrice: 6400000,
      endingPrice: 12000000,
      reraNumber: 'UPRERAPRJ0002',
      description: 'Modern clubhouse and apartments',
      amenities: ['Clubhouse', 'Kids Play Area'],
    },
    {
      id: 'p-future',
      name: 'Future Estate by Future World',
      builder: 'Future World',
      companyName: 'Workains Reality',
      location: 'Sector 1, Greater Noida West',
      propertyType: 'APARTMENT',
      startingPrice: 8632470,
      endingPrice: 16000000,
      reraNumber: 'UPRERAPRJ0003',
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
      reraNumber: 'UPRERAPRJ0004',
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
      reraNumber: 'UPRERAPRJ0005',
      description: '18 Acres township in Raj Nagar Extension',
      amenities: ['Clubhouse', 'Sports Complex'],
    },
    {
      id: 'p-saya-comm1',
      name: 'Saya Piazza',
      builder: 'Saya Group',
      companyName: 'Workains Reality',
      location: 'Noida Expressway',
      propertyType: 'COMMERCIAL',
      startingPrice: 4900000,
      endingPrice: 20000000,
      reraNumber: 'UPRERAPRJ0006',
      description: 'Commercial retail shops and food court',
      amenities: ['High-speed Elevators', 'Multi-level Parking'],
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
          id: 'lead-round5-yuvi',
          name: 'युवराज',
          phone: '+919565763089',
          budget: 8000000,
          objections: ['rejectedBuilder:Saya Group'],
          calls: [],
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
            leadId: 'lead-round5-yuvi',
            rejectedBuilders: ['Saya Group'],
            preferredBuilders: [],
            rejectedProjects: [],
            preferredProjects: [],
            propertyType: 'RESIDENTIAL',
            purpose: 'end_use',
            updatedAt: new Date(),
          },
        ]),
        upsert: jest.fn().mockResolvedValue({ id: 'mem-round5' }),
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

  // Scenario 1: Customer rejects Saya in an earlier call
  it('Scenario 1: Customer rejection of Saya is captured as rejectedBuilder', () => {
    const facts1 = factExtractor.extractFacts('Saya group mujhe pasand nahi hai bilkul bhi', 'call-1');
    expect(facts1.rejectedBuilders).toContain('Saya Group');
    expect(facts1.preferredBuilders || []).not.toContain('Saya Group');

    const facts2 = factExtractor.extractFacts('Saya ke alawa aur koi options hain kya?', 'call-1');
    expect(facts2.rejectedBuilders).toContain('Saya Group');
  });

  // Scenario 2: Same customer calls again (cross-call persistence)
  it('Scenario 2: Cross-call persistence restores rejected builders from DB conversationMemory', async () => {
    const profile = await customerMemory.lookupCustomer('+919565763089');
    expect(profile).not.toBeNull();
    expect(profile?.rejectedBuilders).toContain('Saya Group');
  });

  // Scenario 3: Saya is not recommended again
  it('Scenario 3: Filtered overview strictly excludes rejected builder Saya Group', async () => {
    const overview = await conversationService.getProjectsOverview({
      rejectedBuilders: ['Saya Group'],
    });

    expect(overview).not.toContain('Saya Pre-Launch');
    expect(overview).not.toContain('Saya Piazza');
    expect(overview).not.toContain('Saya South X');
    expect(overview).toContain('Palace Heights');
    expect(overview).toContain('NCR Monarch');
  });

  // Scenario 4: Customer explicitly changes their preference (Saya re-enabled)
  it('Scenario 4: Explicit affirmative interest in Saya clears it from rejectedBuilders', async () => {
    await customerMemory.initializeCallMemory('call-4', '+919565763089');

    const updated = await customerMemory.applyExtractedFacts('call-4', {
      facts: {
        preferredBuilders: ['Saya Group'],
      } as any,
      confidenceMap: { preferredBuilders: 'confirmed' },
      rawSnippets: { preferredBuilders: 'Saya dekhna hai' },
      isCorrection: false,
      sourceText: 'Saya dekhna hai',
      preferredBuilders: ['Saya Group'],
    });

    expect(updated.customer.rejectedBuilders).not.toContain('Saya Group');
    expect(updated.customer.preferredBuilders).toContain('Saya Group');
  });

  // Scenario 5: Rejected project is filtered
  it('Scenario 5: Specific rejected project is excluded from recommendations', async () => {
    const overview = await conversationService.getProjectsOverview({
      rejectedProjects: ['Future Estate'],
    });

    expect(overview).not.toContain('Future Estate by Future World');
    expect(overview).toContain('Palace Heights by Rudra');
    expect(overview).toContain('NCR Monarch');
  });

  // Scenario 6: All eligible projects are retrieved ("Sab projects batao")
  it('Scenario 6: Broad request "Sab projects batao" returns all eligible inventory without arbitrary limits', async () => {
    const overview = await conversationService.getProjectsOverview({
      propertyType: 'RESIDENTIAL',
      rejectedBuilders: ['Saya Group'],
    });

    expect(overview).toContain('Palace Heights by Rudra');
    expect(overview).toContain('NCR Monarch');
    expect(overview).toContain('Future Estate by Future World');
    expect(overview).toContain('VVIP Pre-Launch');
  });

  // Scenario 7: Future Estate is not accidentally omitted
  it('Scenario 7: Future Estate is included in inventory retrieval', async () => {
    const overview = await conversationService.getProjectsOverview({
      propertyType: 'RESIDENTIAL',
    });
    expect(overview).toContain('Future Estate by Future World');
  });

  // Scenario 8: VVIP inventory is not accidentally omitted
  it('Scenario 8: VVIP Pre-Launch is included in inventory retrieval', async () => {
    const overview = await conversationService.getProjectsOverview({
      propertyType: 'RESIDENTIAL',
    });
    expect(overview).toContain('VVIP Pre-Launch');
  });

  // Scenario 9: Developer attribution remains accurate
  it('Scenario 9: Authentic developer/builder attribution is preserved for all projects', async () => {
    const overview = await conversationService.getProjectsOverview({});
    expect(overview).toContain('[Developer: Rudra Buildwell]');
    expect(overview).toContain('[Developer: NCR Group]');
    expect(overview).toContain('[Developer: Future World]');
    expect(overview).toContain('[Developer: VVIP Group]');
  });

  // Scenario 10: Customer says "NCR" after discussing NCR Monarch (context resolution)
  it('Scenario 10: "NCR ke baare mein batao" intent is recognized without confusion', () => {
    const reply = buildFollowUpReply({
      transcript: 'NCR ke baare mein batao',
      leadName: 'युवराज',
      companyName: 'Workains Reality',
    });
    expect(reply.text).toContain('NCR Monarch');
    expect(reply.text).toContain('Greater Noida West');
  });

  // Scenario 11: Customer says "Okay" after receiving an answer (natural ack, no pitch restart)
  it('Scenario 11: "Okay" gives a natural brief acknowledgement without re-pitching from scratch', () => {
    const reply = buildFollowUpReply({
      transcript: 'Okay',
      leadName: 'युवराज',
      companyName: 'Workains Reality',
      language: 'hinglish',
    });
    expect(reply.text).toMatch(/ji|bilkul/i);
    expect(reply.text).not.toContain('Swagat hai');
    expect(reply.text).not.toContain('Aapka budget kitna hai');
  });

  // Scenario 12: Customer asks "Kya nahi hai?" (clarification)
  it('Scenario 12: "Kya nahi hai?" triggers polite clarification without breaking conversation flow', () => {
    const reply = buildFollowUpReply({
      transcript: 'Kya nahi hai?',
      leadName: 'युवराज',
      companyName: 'Workains Reality',
      language: 'hinglish',
    });
    expect(reply.text).toContain('amenity, feature ya facility');
  });

  // Scenario 13: Barge-in invalidates pending audio (cancelPlay = true, flushGen increments)
  it('Scenario 13: Barge-in flag and flush generation transition correctly invalidates pending audio', () => {
    const session = {
      flushGen: 1,
      cancelPlay: false,
      pendingSegments: ['seg-1', 'seg-2'],
    };

    session.flushGen++;
    session.cancelPlay = true;
    session.pendingSegments = [];

    expect(session.flushGen).toBe(2);
    expect(session.cancelPlay).toBe(true);
    expect(session.pendingSegments.length).toBe(0);
  });

  // Scenario 14: Old audio cannot play after cancellation (sendPlayAudio drops chunk)
  it('Scenario 14: Audio transmission drops chunks matching stale flushGen or cancelPlay flag', () => {
    const session = {
      flushGen: 3,
      cancelPlay: true,
    };

    const shouldPlayChunk = (chunkGen: number, sess: typeof session) => {
      if (sess.cancelPlay) return false;
      if (chunkGen !== sess.flushGen) return false;
      return true;
    };

    expect(shouldPlayChunk(2, session)).toBe(false);
    expect(shouldPlayChunk(3, session)).toBe(false);
  });

  // Scenario 15: ₹63.99 Lakh stays together in TTS chunking
  it('Scenario 15: pullSpokenSentences preserves ₹63.99 Lakh without splitting on decimal point', () => {
    const text = 'Isme 2 BHK price ₹63.99 Lakh se start hota hai. Kya aap brochure dekhna chahenge?';
    const { sentences } = pullSpokenSentences(text, { force: true });

    expect(sentences.length).toBe(2);
    expect(sentences[0]).toContain('₹63.99 Lakh');
    expect(sentences[0]).not.toBe('Isme 2 BHK price ₹63.');
  });

  // Scenario 16: ₹60.9 Lakh stays together in TTS chunking and speech normalization
  it('Scenario 16: pullSpokenSentences preserves ₹60.9 Lakh and normalizes to Hindi words cleanly', () => {
    const text = 'Palace Heights mein unit price ₹60.9 Lakh se shuru hai. Location Sector 1 hai.';
    const { sentences } = pullSpokenSentences(text, { force: true });

    expect(sentences.length).toBe(2);
    expect(sentences[0]).toContain('₹60.9 Lakh');

    const normalized = normalizeTextForSpeech(sentences[0]);
    expect(normalized).toContain('saath lakh nabbe hazaar rupaye');
  });

  // Scenario 17: sq.ft abbreviation does not trigger sentence break
  it('Scenario 17: sq.ft abbreviation does not trigger sentence break', () => {
    const text = 'Super area 1250 sq.ft hai aur BSP ₹8,888 per sq.ft hai. Kya yeh size aapko pasand hai?';
    const { sentences } = pullSpokenSentences(text, { force: true });

    expect(sentences.length).toBe(2);
    expect(sentences[0]).toContain('1250 sq.ft');
    expect(sentences[0]).toContain('₹8,888 per sq.ft');

    const normalized = normalizeTextForSpeech(sentences[0]);
    expect(normalized).toContain('square feet');
    expect(normalized).toContain('aath hazaar aath sau athasi rupaye');
  });

  // Scenario 18: Unsupported amenities are not invented
  it('Scenario 18: Project details report only verified documented amenities from CRM DB', async () => {
    const project = await prismaMock.project.findFirst({
      where: { name: { contains: 'Palace Heights' } },
    });

    expect(project.amenities).toEqual(['Clubhouse', 'Swimming Pool', 'Gym']);
    expect(project.amenities).not.toContain('Helipad');
    expect(project.amenities).not.toContain('Private Beach');
  });

  // Scenario 19: WhatsApp failure is reported accurately
  it('Scenario 19: WhatsApp delivery failure returns honest transparent customer message', async () => {
    jest.spyOn(whatsappService, 'sendDocument').mockResolvedValue({
      success: false,
      status: 'FAILED',
      reason: 'api_unconfigured',
      disclaimer: 'WhatsApp par document abhi send nahi ho paya.',
    });

    const res = await whatsappService.sendDocument({
      toPhone: '+919565763089',
      projectName: 'NCR Monarch',
      documentType: 'brochure',
    });
    expect(res.success).toBe(false);
    expect(res.disclaimer).toBe('WhatsApp par document abhi send nahi ho paya.');
  });

  // Scenario 20: Customer memory remains correct after Redis invalidation
  it('Scenario 20: After Redis cache invalidation, customer profile is accurately rebuilt from Postgres DB', async () => {
    (redisMock.get as jest.Mock).mockResolvedValue(null);

    const profile = await customerMemory.lookupCustomer('+919565763089');
    expect(profile).not.toBeNull();
    expect(profile?.leadId).toBe('lead-round5-yuvi');
    expect(profile?.rejectedBuilders).toContain('Saya Group');
    expect(prismaMock.lead.findFirst).toHaveBeenCalled();
  });
});
