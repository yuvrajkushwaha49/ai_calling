import { CustomerMemoryService } from './customer-memory.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerProfileCache } from './memory.types';

describe('CustomerMemoryService', () => {
  let service: CustomerMemoryService;
  let mockRedis: Partial<Record<keyof RedisService, jest.Mock>>;
  let mockPrisma: any;

  beforeEach(() => {
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
      },
      call: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      conversationMemory: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'mem-1' }),
      },
    };

    service = new CustomerMemoryService(
      mockPrisma as unknown as PrismaService,
      mockRedis as unknown as RedisService,
    );
  });

  describe('lookupCustomer', () => {
    it('should return cached customer from Redis if cache hit', async () => {
      const cachedProfile: CustomerProfileCache = {
        leadId: 'lead-cached',
        name: 'Amit Sharma',
        phone: '+919876543210',
        purpose: 'end_use',
        bhk: '3 BHK',
        budget: 9000000,
        budgetLabel: '90 Lakh',
        preferredLocation: 'Noida',
        purchaseTimeline: '3 months',
        interestedProjects: ['Saya Gold'],
        leadStatus: 'QUALIFIED',
        lastCallOutcome: 'CONNECTED',
        previousCallCount: 2,
        lastCallAt: '2026-11-01',
        summary: 'Looking for ready to move 3 BHK in Noida',
        updatedAt: Date.now(),
      };

      (mockRedis.get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('customer:')) return Promise.resolve(JSON.stringify(cachedProfile));
        return Promise.resolve(null);
      });

      const result = await service.lookupCustomer('+919876543210');

      expect(result).not.toBeNull();
      expect(result?.leadId).toBe('lead-cached');
      expect(result?.name).toBe('Amit Sharma');
      expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    });

    it('should fall back to Prisma when Redis misses and cache the result', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      mockPrisma.lead.findFirst.mockResolvedValueOnce({
        id: 'lead-db',
        name: 'Pooja Verma',
        phone: '9876543210',
        status: 'QUALIFIED',
        aiSummary: 'Interested in 2 BHK',
        updatedAt: new Date(),
        project: { name: 'Express Astra' },
        calls: [
          {
            outcome: 'CONNECTED',
            summary: 'Discussed pricing and floor plans',
            createdAt: new Date(),
          },
        ],
      });

      const result = await service.lookupCustomer('+919876543210');

      expect(result).not.toBeNull();
      expect(result?.leadId).toBe('lead-db');
      expect(result?.name).toBe('Pooja Verma');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should gracefully return null without throwing when Redis fails and lead not in DB', async () => {
      (mockRedis.get as jest.Mock).mockRejectedValueOnce(new Error('Redis connection lost'));
      mockPrisma.lead.findFirst.mockResolvedValueOnce(null);

      const result = await service.lookupCustomer('+919999999999');
      expect(result).toBeNull();
    });
  });

  describe('initCallMemory', () => {
    it('should initialize empty memory for a new customer call', async () => {
      const state = await service.initCallMemory('call-new-1', '9876543210');

      expect(state.callId).toBe('call-new-1');
      expect(state.isReturningCustomer).toBe(false);
      expect(state.answeredFields).toEqual([]);
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should pre-populate memory with facts when customer is returning', async () => {
      const cachedProfile: CustomerProfileCache = {
        leadId: 'lead-1',
        name: 'Vikram',
        phone: '+919876543210',
        purpose: 'investment',
        bhk: '2 BHK',
        budget: 6000000,
        budgetLabel: '60 Lakh',
        preferredLocation: 'Greater Noida West',
        purchaseTimeline: null,
        interestedProjects: [],
        leadStatus: 'QUALIFIED',
        lastCallOutcome: 'CONNECTED',
        previousCallCount: 1,
        lastCallAt: null,
        summary: 'Wants high rental yield 2 BHK',
        updatedAt: Date.now(),
      };
      (mockRedis.get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('summary')) return Promise.resolve(cachedProfile.summary);
        if (key.includes('customer:')) return Promise.resolve(JSON.stringify(cachedProfile));
        return Promise.resolve(null);
      });

      const state = await service.initCallMemory('call-ret-1', '+919876543210');

      expect(state.isReturningCustomer).toBe(true);
      expect(state.customer.bhk).toBe('2 BHK');
      expect(state.customer.purpose).toBe('investment');
      expect(state.answeredFields).toContain('bhk');
      expect(state.answeredFields).toContain('purpose');
    });
  });

  describe('distributed lock', () => {
    it('should acquire and release lead lock', async () => {
      const token = await service.acquireLeadLock('lead-123');
      expect(token).toBe('token-123');

      const released = await service.releaseLeadLock('lead-123', token!);
      expect(released).toBe(true);
    });
  });
});
