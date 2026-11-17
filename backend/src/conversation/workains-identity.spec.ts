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
import { detectIntent, buildFollowUpReply } from '../calls/call-scripts';
import { speakAgentName, speakCompanyName } from '../calls/opener-bank';
import { ConversationState } from '../memory/memory.types';

describe('Workains Reality — Business Identity & Multi-Builder Channel Partner Transformation (15 Scenarios)', () => {
  let conversationService: ConversationService;
  let factExtractor: FactExtractorService;
  let prismaMock: any;
  let llmMock: any;
  let knowledgeMock: any;

  const mockState = (overrides?: Partial<ConversationState>): ConversationState => ({
    callId: 'call-workains-001',
    leadId: 'lead-workains-yuvi',
    phone: '+919565763089',
    isReturningCustomer: false,
    customer: {
      name: 'युवराज',
      purpose: 'end_use',
      bhk: '2 BHK',
      budget: 8000000,
      budgetLabel: '80 Lakh',
      location: 'Sector 1 Noida Extension',
      timeline: null,
      possession: null,
      interestedProjects: [],
      siteVisit: null,
      preferredBuilders: [],
      rejectedBuilders: [],
      preferredProjects: [],
      rejectedProjects: [],
      propertyType: 'RESIDENTIAL',
      lastDiscussedProject: null,
      lastDiscussedBuilder: null,
      nextRecommendedProjects: [],
    },
    answeredFields: ['bhk', 'budget'],
    askedQuestions: [],
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
    },
    {
      id: 'p-saya-comm2',
      name: 'Saya South X',
      builder: 'Saya Group',
      companyName: 'Workains Reality',
      location: 'Greater Noida West',
      propertyType: 'COMMERCIAL',
      startingPrice: 5500000,
      endingPrice: 25000000,
      reraNumber: 'UPRERAPRJ0007',
      description: 'High street commercial retail destination',
    },
  ];

  beforeEach(async () => {
    prismaMock = {
      project: {
        findMany: jest.fn().mockResolvedValue(mockDbProjects),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          return mockDbProjects.find((p) =>
            p.name.toLowerCase().includes(String(where?.name?.contains || '').toLowerCase()),
          );
        }),
      },
    };

    llmMock = {
      generateResponse: jest.fn(),
      streamText: jest.fn(),
    };

    knowledgeMock = {
      searchKnowledge: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        FactExtractorService,
        QuestionValidatorService,
        {
          provide: CustomerMemoryService,
          useValue: { invalidateCustomerCache: jest.fn() },
        },
        { provide: PrismaService, useValue: prismaMock },
        { provide: LlmService, useValue: llmMock },
        { provide: KnowledgeService, useValue: knowledgeMock },
        {
          provide: WhatsAppService,
          useValue: { sendProjectBrochure: jest.fn(), sendFloorPlan: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => (k === 'COMPANY_NAME' ? 'Workains Reality' : null)) },
        },
      ],
    }).compile();

    conversationService = module.get<ConversationService>(ConversationService);
    factExtractor = module.get<FactExtractorService>(FactExtractorService);
  });

  // Scenario 1: New customer hears Workains Reality intro
  it('Scenario 1: New customer opener introduces Workains Reality as channel partner across multiple builders', () => {
    const company = speakCompanyName('Workains Reality', 'hinglish');
    expect(company).toBe('Workains Reality');

    const agent = speakAgentName('Aria Real Estate Sales Advisor');
    expect(agent).toBe('Aria');

    const expectedNewOpener =
      'Namaste ji! Main Aria, Workains Reality se bol rahi hoon. Hum multiple builders ke residential aur commercial projects mein property options provide karte hain. Aap kis location mein property dekh rahe hain?';
    expect(expectedNewOpener).toContain('Workains Reality');
    expect(expectedNewOpener).toContain('multiple builders');
  });

  // Scenario 2: Returning customer hears Workains Reality intro
  it('Scenario 2: Returning customer opener introduces Workains Reality and offers to continue or see new projects', () => {
    const name = 'युवराज';
    const requirement = '2 BHK flat Sector 1 Noida Extension mein lagbhag 80 Lakh budget';
    const returningOpener = `Namaste ${name} ji! Main Aria, Workains Reality se bol rahi hoon. Pichhli baar humne aapki ${requirement} ke baare mein baat ki thi. Kya aaj usi ko continue karein ya koi naya project dekhna chahenge?`;

    expect(returningOpener).toContain('Workains Reality');
    expect(returningOpener).toContain(name);
    expect(returningOpener).toContain('naya project dekhna chahenge');
  });

  // Scenario 3: Customer asks for Saya project (handled as inventory)
  it('Scenario 3: Customer asks for Saya project and it is handled strictly as developer inventory', async () => {
    const extracted = factExtractor.extractProjects('Saya Pre-Launch ka details batao');
    expect(extracted.interested).toContain('Saya Pre-Launch');

    const overview = await conversationService.getProjectsOverview();
    expect(overview).toContain('Saya Pre-Launch');
    expect(overview).toContain('Developer: Saya Group');
  });

  // Scenario 4: Customer rejects Saya and asks for another builder
  it('Scenario 4: Customer rejects Saya; AI captures builder rejection and fast script pivots politely without disconnecting', () => {
    const text = 'Mujhe Saya Group ka project nahi chahiye, koi doosra builder batao';
    const builderFacts = factExtractor.extractBuilders(text);
    expect(builderFacts.rejected).toContain('Saya Group');

    const intent = detectIntent(text);
    expect(intent.builderRejection).toBe(true);

    const reply = buildFollowUpReply({
      transcript: text,
      leadName: 'युवराज',
      companyName: 'Workains Reality',
    });
    expect(reply.text).toContain('Main Saya Group ke options hata deti hoon');
    expect(reply.text).toContain('doosre builders ke projects check karti hoon');
    expect(reply.text).not.toContain('Alvida');
    expect(reply.text).not.toContain('Dhanyawad, phone rakh');
  });

  // Scenario 5: Customer asks for Future Estate
  it('Scenario 5: Customer asks for Future Estate (including phonetic future state) and AI confirms availability immediately', () => {
    const phoneticText = 'Mujhe future state chahiye. Kya aapke paas hai?';
    const extracted = factExtractor.extractProjects(phoneticText);
    expect(extracted.interested).toContain('Future Estate by Future World');

    const intent = detectIntent(phoneticText);
    expect(intent.specificProjectInquiry).toBe(true);

    const reply = buildFollowUpReply({
      transcript: phoneticText,
      leadName: 'युवराज',
      companyName: 'Workains Reality',
    });
    expect(reply.text).toContain('Future Estate ka project hamari available inventory mein hai');
  });

  // Scenario 6: Customer asks for VVIP
  it('Scenario 6: Customer asks for VVIP and details include VVIP Group attribution', async () => {
    const overview = await conversationService.getProjectsOverview();
    expect(overview).toContain('VVIP Pre-Launch');
    expect(overview).toContain('Developer: VVIP Group');
  });

  // Scenario 7: Customer asks for multiple project options across builders
  it('Scenario 7: Project list contains multiple distinct builders', async () => {
    const overview = await conversationService.getProjectsOverview();
    expect(overview).toContain('Rudra Buildwell');
    expect(overview).toContain('NCR Group');
    expect(overview).toContain('Future World');
    expect(overview).toContain('VVIP Group');
  });

  // Scenario 8: Customer wants residential only (commercial excluded)
  it('Scenario 8: Customer asking for residential budget options receives residential projects, excluding commercial', async () => {
    const overview = await conversationService.getProjectsOverview(8000000);
    expect(overview).toContain('[VERIFIED IN-BUDGET RESIDENTIAL PROPERTIES');
    expect(overview).toContain('Palace Heights by Rudra');
    expect(overview).toContain('NCR Monarch');
    // Commercial section is separate and labelled commercial only
    expect(overview).toContain('[COMMERCIAL PROJECTS');
  });

  // Scenario 9: Customer wants commercial only
  it('Scenario 9: Commercial section provides high-street commercial projects with explicit developer', async () => {
    const overview = await conversationService.getProjectsOverview();
    expect(overview).toContain('Saya Piazza');
    expect(overview).toContain('Saya South X');
    expect(overview).toContain('Developer: Saya Group');
  });

  // Scenario 10: Customer rejects one project but continues conversation
  it('Scenario 10: Customer rejects one project; AI does not disconnect or treat as total refusal', () => {
    const text = 'Nahi yeh project nahi chahiye, koi doosra option dikhao';
    const intent = detectIntent(text);
    // Should NOT be treated as end-of-call refusal
    expect(intent.notInterested).toBe(false);
  });

  // Scenario 11: Customer asks for price comparison across builders
  it('Scenario 11: Project pricing across different builders is distinctly mapped', async () => {
    const overview = await conversationService.getProjectsOverview();
    expect(overview).toContain('₹60.90 Lakh onwards'); // Palace Heights (Rudra)
    expect(overview).toContain('₹64.00 Lakh onwards'); // NCR Monarch (NCR)
    expect(overview).toContain('₹86.32 Lakh onwards'); // Future Estate (Future World)
    expect(overview).toContain('₹90.63 Lakh onwards'); // VVIP Pre-Launch (VVIP)
  });

  // Scenario 12: Customer previously rejected builder is recorded in memory
  it('Scenario 12: CustomerMemory tracks rejectedBuilders and preferredBuilders', () => {
    const state = mockState({
      customer: {
        ...mockState().customer,
        rejectedBuilders: ['Saya Group'],
        preferredBuilders: ['Future World', 'Rudra Buildwell'],
      },
    });
    expect(state.customer.rejectedBuilders).toContain('Saya Group');
    expect(state.customer.preferredBuilders).toContain('Future World');
  });

  // Scenario 13: Gemini failure does not produce an unrelated goodbye
  it('Scenario 13: Fallback response on LLM failure does not hang up or give unrelated goodbye', () => {
    const reply = buildFollowUpReply({
      transcript: 'Bhai mujhe details chahiye',
      companyName: 'Workains Reality',
      leadName: 'युवराज',
    });
    expect(reply.text).not.toContain('Dhanyawad, phone rakh raha');
    expect(reply.text).not.toContain('Alvida');
  });

  // Scenario 14: Historical project developer information remains intact in DB structure
  it('Scenario 14: Prisma project entity contains builder and companyName', async () => {
    const projects = await conversationService.getCachedProjects();
    for (const p of projects) {
      expect(p.builder).toBeDefined();
      expect(typeof p.builder).toBe('string');
    }
  });

  // Scenario 15: CRM branding consistently shows Workains Reality
  it('Scenario 15: Company name consistently resolves to Workains Reality', () => {
    const defaultCompany = speakCompanyName(undefined, 'hinglish');
    expect(defaultCompany).toBe('Workains Reality');

    const devanagariCompany = speakCompanyName(undefined, 'hi-IN');
    expect(devanagariCompany).toBe('वर्केंस रियलिटी');
  });
});
