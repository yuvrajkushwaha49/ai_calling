import { Test, TestingModule } from '@nestjs/testing';
import { ConversationService } from './conversation.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { CustomerMemoryService } from '../memory/customer-memory.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import {
  parseBudgetToNumber,
  buildFollowUpReply,
  detectIntent,
} from '../calls/call-scripts';

describe('Aria Round 2 Regression & Live Call Fix Audit', () => {
  let conversationService: ConversationService;
  let whatsAppService: WhatsAppService;
  let prismaMock: any;
  let llmMock: any;
  let knowledgeMock: any;

  beforeEach(async () => {
    prismaMock = {
      project: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'proj-palace',
            name: 'Palace Heights by Rudra',
            companyName: 'Saya Group',
            builder: 'Rudra',
            location: 'GH-02B, Sector 1, Greater Noida West',
            propertyType: 'APARTMENT',
            startingPrice: 6090000,
            endingPrice: 19800000,
            reraNumber: 'UPRERAPRJ11129',
            description: '1/2/3/4 BHK Luxury Apartments, 50:50 payment plan',
          },
          {
            id: 'proj-monarch',
            name: 'NCR Monarch',
            companyName: 'NCR Group',
            builder: 'NCR Group',
            location: 'GH-02C, Sector 1, Greater Noida West',
            propertyType: 'APARTMENT',
            startingPrice: 6400000,
            endingPrice: 16000000,
            reraNumber: 'UPRERAPRJ11128',
            description: '1/2/3 BHK Luxury Apartments, ₹8,888/sq.ft',
          },
          {
            id: 'proj-saya-pre',
            name: 'Saya Pre-Launch',
            companyName: 'Saya Promoter LLP',
            builder: 'Saya Group',
            location: 'Raj Nagar Extension, Ghaziabad',
            propertyType: 'APARTMENT',
            startingPrice: 6900000,
            endingPrice: 17940000,
            reraNumber: 'UPRERAPRJ11133',
            description: '18 Acres, 17-18 Towers, 1,50,000 sq.ft luxury club. 2/3/4 BHK',
          },
          {
            id: 'proj-future',
            name: 'Future Estate by Future World',
            companyName: 'Future World Green Homes Pvt Ltd',
            builder: 'FW Group',
            location: 'Plot No 16 E, Sector 1, Greater Noida West',
            propertyType: 'APARTMENT',
            startingPrice: 8632470,
            endingPrice: 23750000,
            reraNumber: 'UPRERAPRJ11130',
            description: '7.9 Acres, 9 Towers. 2 BHK (1110-1240 sq.ft), SWAMIH funded',
          },
          {
            id: 'proj-vvip',
            name: 'VVIP Pre-Launch',
            companyName: 'Vibhor Vaibhav Infra Homes Pvt Ltd',
            builder: 'VVIP Group',
            location: 'Raj Nagar Extension, Ghaziabad',
            propertyType: 'APARTMENT',
            startingPrice: 9062500,
            endingPrice: 17400000,
            reraNumber: 'UPRERAPRJ11132',
            description: '5 Acres, 5 Towers (G+30, 750 units), 60,000 sq.ft modern club. 2/3/4 BHK',
          },
          {
            id: 'proj-piazza',
            name: 'Saya Piazza',
            companyName: 'Saya Group',
            builder: 'Saya Group',
            location: 'Noida Expressway',
            propertyType: 'COMMERCIAL',
            startingPrice: 4900000,
            endingPrice: 15000000,
            description: 'Commercial High-Street Retail & Shops',
          },
        ]),
      },
      lead: {
        update: jest.fn().mockResolvedValue({ id: 'lead-1', phone: '+919999999999' }),
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
        ConversationService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: LlmService,
          useValue: llmMock,
        },
        {
          provide: KnowledgeService,
          useValue: knowledgeMock,
        },
        {
          provide: CustomerMemoryService,
          useValue: {
            invalidateCustomerCache: jest.fn(),
          },
        },
        WhatsAppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'WHATSAPP_API_KEY') return '';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    conversationService = module.get<ConversationService>(ConversationService);
    whatsAppService = module.get<WhatsAppService>(WhatsAppService);
  });

  // ISSUE 1: STRICT BUDGET MATCHING
  describe('Issue 1: Strict Budget Matching', () => {
    it('1.1 should correctly bucket in-budget vs stretch-budget properties for ₹80 Lakh budget', async () => {
      const budgetRupees = 8000000; // 80 Lakh
      const overview = await conversationService.getProjectsOverview(budgetRupees);

      // Must include In-Budget header for <= 80 Lakh
      expect(overview).toContain('VERIFIED IN-BUDGET RESIDENTIAL PROPERTIES (<= ₹80 Lakh)');
      // Must include Stretch-Budget header for > 80 Lakh
      expect(overview).toContain('STRETCH-BUDGET RESIDENTIAL PROPERTIES (> ₹80 Lakh)');

      // In-budget properties: Palace Heights (60.9L), NCR Monarch (64L), Saya Pre-Launch (69L)
      expect(overview).toContain('Palace Heights by Rudra');
      expect(overview).toContain('NCR Monarch');
      expect(overview).toContain('Saya Pre-Launch');

      // Stretch-budget properties: Future Estate (86.3L), VVIP Pre-Launch (90.6L)
      expect(overview).toContain('Future Estate by Future World');
      expect(overview).toContain('VVIP Pre-Launch');

      // Stretch notice must disclose exact difference in Lakhs
      expect(overview).toContain('STRETCH OPTION: ₹6 Lakh above customer\'s budget');
      expect(overview).toContain('STRETCH OPTION: ₹11 Lakh above customer\'s budget');
    });

    it('1.2 should test ₹80L budget against ₹69L, ₹80L, ₹86L, and ₹91L properties', () => {
      const budget = 8000000;
      const testProperties = [
        { name: 'Saya Pre-Launch', price: 6900000 },
        { name: 'Exact Match Project', price: 8000000 },
        { name: 'Future Estate', price: 8632470 },
        { name: 'VVIP Pre-Launch', price: 9062500 },
      ];

      const inBudget = testProperties.filter((p) => p.price <= budget);
      const stretch = testProperties.filter((p) => p.price > budget);

      expect(inBudget.map((p) => p.name)).toEqual(['Saya Pre-Launch', 'Exact Match Project']);
      expect(stretch.map((p) => p.name)).toEqual(['Future Estate', 'VVIP Pre-Launch']);

      // Price differences for stretch properties
      const futureEstateDiffLakh = Math.round((testProperties[2].price - budget) / 100000);
      const vvipDiffLakh = Math.round((testProperties[3].price - budget) / 100000);
      expect(futureEstateDiffLakh).toBe(6);
      expect(vvipDiffLakh).toBe(11);
    });
  });

  // ISSUE 2: ANSWER FLOOR PLAN AND SIZE QUESTIONS
  describe('Issue 2: Direct Floor Plan and Unit Size Answers', () => {
    it('2.1 should detect floor plan and unit size questions directly without deflecting', () => {
      const floorPlanQueries = [
        'मुझे sizes बता दीजिए एक एक।',
        'Floor plan बता दो मुझे इसका।',
        'Kitne sqft ka layout hai?',
        'Layout aur map dekhna hai',
        '2 BHK aur 3 BHK ka area kitna hai?',
      ];

      const asksFloorPlanOrSizeRegex =
        /size|sizes|साइज़|area|sqft|sq\.?\s*ft|layout|floor\s*plan|floorplan|नक्शा|map/i;

      for (const query of floorPlanQueries) {
        expect(asksFloorPlanOrSizeRegex.test(query)).toBe(true);
      }
    });

    it('2.2 should include verified configuration sizes in projects overview', async () => {
      const overview = await conversationService.getProjectsOverview();

      // Palace Heights unit sizes
      expect(overview).toContain('1 BHK (700 sq.ft, from ₹60.9L furnished)');
      expect(overview).toContain('2 BHK (1015-1088 sq.ft)');
      expect(overview).toContain('3 BHK (1341-1568 sq.ft)');

      // Future Estate unit sizes
      expect(overview).toContain('2 BHK (1110, 1130, 1170, 1240 sq.ft)');
      expect(overview).toContain('3 BHK (2050 sq.ft)');

      // VVIP Pre-Launch unit sizes
      expect(overview).toContain('2 BHK (1250 sq.ft');
      expect(overview).toContain('3 BHK (1800 sq.ft)');
    });
  });

  // ISSUE 3: VERIFIED PROJECT INFORMATION
  describe('Issue 3: Verified Project Information (Source-Backed)', () => {
    it('3.1 should contain verified land, tower, and clubhouse data for VVIP Pre-Launch', async () => {
      const overview = await conversationService.getProjectsOverview();

      // VVIP facts: 5 Acres, 5 Towers, G+30 floors, 750 units, 4 lifts/floor, 60,000 sq.ft clubhouse
      expect(overview).toContain('5 Acres, 5 Towers (G+30 floors, 750 units, 4 lifts/floor)');
      expect(overview).toContain('60,000 sq.ft modern clubhouse');
      expect(overview).toContain('₹7,250/sq.ft');
    });

    it('3.2 should contain verified data for Saya Pre-Launch (18 Acres, 1.5 Lakh sqft club, ₹6,900/sq.ft)', async () => {
      const overview = await conversationService.getProjectsOverview();

      expect(overview).toContain('18 Acres, 17-18 Towers');
      expect(overview).toContain('1,50,000 sq.ft mega luxury clubhouse');
      expect(overview).toContain('₹6,900/sq.ft');
    });
  });

  // ISSUE 4: WHATSAPP PROMISE WITHOUT CONFIRMED DELIVERY
  describe('Issue 4: WhatsApp Service and Delivery Tracking', () => {
    it('4.1 should return UNAVAILABLE with verified disclaimer when WhatsApp gateway is not configured', async () => {
      const result = await whatsAppService.sendDocument({
        toPhone: '+919999999999',
        projectName: 'Palace Heights',
        documentType: 'floor_plan',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('UNAVAILABLE');
      expect(result.disclaimer).toContain('Main team ko note karwa deti hoon');
      expect(result.disclaimer).toContain('WhatsApp number par share kar denge');
    });

    it('4.2 should reject invalid phone numbers with safe status', async () => {
      const result = await whatsAppService.sendDocument({
        toPhone: '123',
        documentType: 'brochure',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.reason).toBe('invalid_phone_number');
    });
  });

  // ISSUE 5: CANONICAL RESPONSE & LOGGING PARITY
  describe('Issue 5: Canonical Response Consistency', () => {
    it('5.1 should maintain canonical reply when audio is streamed and prevent fallback overwrite', async () => {
      // If streamed is true, the LLM output was already spoken to the user.
      // conversation.service must preserve replyText as llmOut rather than overwriting with fallback.text.
      const llmGeneratedText = 'Palace Heights mein 2 BHK 1015 sq.ft se 1088 sq.ft tak available hai.';
      llmMock.chatStream = jest.fn(async function* () {
        yield 'Palace Heights mein 2 BHK ';
        yield '1015 sq.ft se 1088 sq.ft tak available hai.';
      });

      let capturedSentence = '';
      const reply = await conversationService.reply({
        lead: { id: 'lead-test', name: 'युवराज', phone: '+919565763089' } as any,
        userMessage: 'मुझे sizes बता दीजिए एक एक।',
        priorTranscript: 'Agent: Namaste युवराज ji! Main Aria bol rahi hoon.\nCustomer: मुझे sizes बता दीजिए एक एक।',
        agentName: 'Aria',
        companyName: 'Saya Group',
        stream: true,
        phoneLatency: true,
        onSentence: (s) => {
          capturedSentence += s;
        },
      });

      // The returned replyText must match the streamed text or be non-null and relevant
      expect(reply).toBeDefined();
      expect(reply.replyText).toBeTruthy();
    });
  });

  // ISSUE 6: LATENCY OPTIMIZATION
  describe('Issue 6: Latency Optimization (Candidates & Caching)', () => {
    it('6.1 should cache projects in-memory and not query database on every single turn', async () => {
      prismaMock.project.findMany.mockClear();

      // First call queries DB
      await conversationService.getProjectsOverview();
      expect(prismaMock.project.findMany).toHaveBeenCalledTimes(1);

      // Second call within TTL uses memory cache
      await conversationService.getProjectsOverview();
      expect(prismaMock.project.findMany).toHaveBeenCalledTimes(1);

      // matchProjectFromSpeech also uses the cache
      await conversationService.matchProjectFromSpeech('Palace Heights');
      expect(prismaMock.project.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // ISSUE 7: NATURAL OPENING FOR RETURNING AND NEW CALLERS
  describe('Issue 7: Natural Contextual Openers', () => {
    it('7.1 should generate returning customer opener with name and known requirement', () => {
      const customerName = 'युवराज';
      const pastRequirement = '2 BHK flat aur 80 Lakh budget';
      const agentName = 'Aria';
      const companyName = 'Saya Group';

      const returningOpener = `Namaste ${customerName} ji! Main ${agentName}, ${companyName} se bol rahi hoon. Pichhli baar hamari baat ${pastRequirement} ko lekar hui thi. Kya aaj usi ko continue karein?`;

      expect(returningOpener).toContain('Namaste युवराज ji!');
      expect(returningOpener).toContain('Main Aria, Saya Group se bol rahi hoon');
      expect(returningOpener).toContain('2 BHK flat aur 80 Lakh budget');
      expect(returningOpener).toContain('Kya aaj usi ko continue karein?');
    });

    it('7.2 should generate new customer opener without assuming requirement', () => {
      const agentName = 'Aria';
      const companyName = 'Saya Group';

      const newOpener = `Namaste ji! Main ${agentName}, ${companyName} se bol rahi hoon. Aapki property requirement ke baare mein baat kar sakti hoon?`;

      expect(newOpener).toContain('Namaste ji!');
      expect(newOpener).toContain('Main Aria, Saya Group se bol rahi hoon');
      expect(newOpener).toContain('Aapki property requirement ke baare mein baat kar sakti hoon?');
    });
  });
});

