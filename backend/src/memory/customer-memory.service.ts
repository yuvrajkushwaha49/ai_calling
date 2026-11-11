import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  ConversationState,
  ConversationTurn,
  CustomerFacts,
  CustomerProfileCache,
  FactEntry,
} from './memory.types';
import { maskPhoneNumber, normalizePhoneNumber } from './phone-utils';
import { ExtractedTurnFacts } from './fact-extractor.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomerMemoryService {
  private readonly logger = new Logger(CustomerMemoryService.name);

  // In-memory fallback map for active calls when Redis is unavailable
  private readonly localMemoryFallback = new Map<string, ConversationState>();
  private readonly localHistoryFallback = new Map<string, ConversationTurn[]>();

  // TTL constants
  private readonly CUSTOMER_PROFILE_TTL = 3600; // 1 hour
  private readonly CALL_MEMORY_TTL = 7200; // 2 hours
  private readonly CALL_HISTORY_TTL = 7200; // 2 hours
  private readonly CUSTOMER_SUMMARY_TTL = 86400; // 24 hours
  private readonly MAX_HISTORY_TURNS = 20;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Fast customer profile lookup from Redis with Prisma DB fallback
   */
  async lookupCustomer(
    phone: string,
    leadIdHint?: string | null,
  ): Promise<CustomerProfileCache | null> {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized && !leadIdHint) return null;

    if (normalized) {
      try {
        const cached = await this.getCustomerProfileFromRedis(normalized);
        if (cached) return cached;
      } catch (err) {
        this.logger.warn(`[Memory] Redis lookup failed, falling back to DB: ${err}`);
      }
    }

    const fromDb = await this.fetchCustomerProfileFromDb(normalized, leadIdHint);
    if (fromDb && normalized) {
      await this.saveCustomerProfileToRedis(fromDb);
    }
    return fromDb;
  }

  async initCallMemory(
    callId: string,
    phone?: string | null,
    leadIdHint?: string | null,
  ): Promise<ConversationState> {
    return this.initializeCallMemory(callId, phone, leadIdHint);
  }

  async acquireLeadLock(leadId: string, ttlSeconds = 10): Promise<string | null> {
    const key = `lead:${leadId}:lock`;
    return this.redis.acquireLock(key, ttlSeconds);
  }

  async releaseLeadLock(leadId: string, token: string): Promise<boolean> {
    const key = `lead:${leadId}:lock`;
    return this.redis.releaseLock(key, token);
  }

  /**
   * Initialize or retrieve conversation state for an incoming / outgoing call.
   */
  async initializeCallMemory(
    callId: string,
    rawPhone?: string | null,
    leadIdHint?: string | null,
  ): Promise<ConversationState> {
    const normalizedPhone = normalizePhoneNumber(rawPhone);
    const maskedPhone = maskPhoneNumber(normalizedPhone || rawPhone);

    this.logger.log(`[Memory] Initializing callId=${callId} phone=${maskedPhone}`);

    let customerProfile: CustomerProfileCache | null = null;
    let previousSummary: string | null = null;

    // 1. Try Redis Customer Profile Cache
    if (normalizedPhone) {
      customerProfile = await this.getCustomerProfileFromRedis(normalizedPhone);
      if (customerProfile) {
        this.logger.log(
          `[Memory] Cache HIT for customer ${maskedPhone}. Previous calls: ${customerProfile.previousCallCount}`,
        );
        previousSummary = await this.getCustomerSummaryFromRedis(normalizedPhone);
      }
    }

    // 2. Cache MISS: Query PostgreSQL / MySQL via Prisma
    if (!customerProfile) {
      customerProfile = await this.fetchCustomerProfileFromDb(normalizedPhone, leadIdHint);
      if (customerProfile && normalizedPhone) {
        // Populate Redis cache asynchronously
        void this.saveCustomerProfileToRedis(customerProfile);
        if (customerProfile.summary) {
          void this.saveCustomerSummaryToRedis(normalizedPhone, customerProfile.summary);
          previousSummary = customerProfile.summary;
        }
      }
    }

    const isReturning = Boolean(
      customerProfile &&
        (customerProfile.previousCallCount > 0 ||
          (customerProfile.leadId && customerProfile.leadStatus !== 'NEW')),
    );

    // Initial customer facts from profile (if returning customer)
    const initialFacts: CustomerFacts = {
      name: customerProfile?.name || null,
      purpose: customerProfile?.purpose || null,
      bhk: customerProfile?.bhk || null,
      budget: customerProfile?.budget || null,
      budgetLabel: customerProfile?.budgetLabel || null,
      location: customerProfile?.preferredLocation || null,
      timeline: customerProfile?.purchaseTimeline || null,
      interestedProjects: customerProfile?.interestedProjects || [],
    };

    const answeredFields: string[] = [];
    if (initialFacts.bhk) answeredFields.push('bhk');
    if (initialFacts.budget || initialFacts.budgetLabel) answeredFields.push('budget');
    if (initialFacts.purpose) answeredFields.push('purpose');
    if (initialFacts.location) answeredFields.push('location');
    if (initialFacts.timeline) answeredFields.push('timeline');
    if (initialFacts.name && initialFacts.name !== 'Inbound Caller') answeredFields.push('name');

    const confirmedFacts: Record<string, FactEntry> = {};
    for (const field of answeredFields) {
      const val = (initialFacts as Record<string, any>)[field];
      if (val !== undefined && val !== null) {
        confirmedFacts[field] = {
          value: val,
          source: 'crm',
          confidence: 'confirmed',
          updatedAt: Date.now(),
        };
      }
    }

    const state: ConversationState = {
      callId,
      leadId: customerProfile?.leadId || leadIdHint || null,
      phone: normalizedPhone,
      isReturningCustomer: isReturning,
      previousCallCount: customerProfile?.previousCallCount || 0,
      lastCallSummary: previousSummary || customerProfile?.summary || null,
      customer: initialFacts,
      confirmedFacts,
      approximateFacts: {},
      answeredFields,
      askedQuestions: [],
      pendingQuestion: null,
      lastIntent: null,
      conversationStage: isReturning ? 'discovery' : 'greeting',
      conversationSummary: '',
      lastAssistantResponse: '',
      updatedAt: Date.now(),
    };

    // Save initial state to Redis & local fallback
    await this.saveCallMemoryToRedis(callId, state);
    this.localMemoryFallback.set(callId, state);

    return state;
  }

  /**
   * Retrieve active call memory.
   */
  async getCallMemory(callId: string): Promise<ConversationState | null> {
    const key = `call:${callId}:memory`;
    const cached = await this.redis.get(key);

    if (cached) {
      try {
        const state = JSON.parse(cached) as ConversationState;
        this.localMemoryFallback.set(callId, state);
        return state;
      } catch {
        // parse error fallback
      }
    }

    return this.localMemoryFallback.get(callId) || null;
  }

  /**
   * Update active call memory with new facts or turn updates.
   */
  async updateCallMemory(
    callId: string,
    updater: (state: ConversationState) => void,
  ): Promise<ConversationState> {
    let state = await this.getCallMemory(callId);
    if (!state) {
      state = {
        callId,
        leadId: null,
        phone: '',
        isReturningCustomer: false,
        previousCallCount: 0,
        customer: { interestedProjects: [] },
        confirmedFacts: {},
        approximateFacts: {},
        answeredFields: [],
        askedQuestions: [],
        pendingQuestion: null,
        lastIntent: null,
        conversationStage: 'discovery',
        conversationSummary: '',
        lastAssistantResponse: '',
        updatedAt: Date.now(),
      };
    }

    updater(state);
    state.updatedAt = Date.now();

    // Recompute answeredFields
    const fields = new Set<string>();
    const c = state.customer;
    if (c.bhk) fields.add('bhk');
    if (c.budget || c.budgetLabel) fields.add('budget');
    if (c.purpose) fields.add('purpose');
    if (c.location) fields.add('location');
    if (c.timeline || c.possession) fields.add('timeline');
    if (c.name && c.name !== 'Inbound Caller') fields.add('name');
    if (c.siteVisit?.interested) fields.add('siteVisit');
    state.answeredFields = Array.from(fields);

    this.localMemoryFallback.set(callId, state);
    await this.saveCallMemoryToRedis(callId, state);

    return state;
  }

  /**
   * Apply facts extracted from customer utterance to conversation state.
   */
  async applyExtractedFacts(
    callId: string,
    extracted: ExtractedTurnFacts,
  ): Promise<ConversationState> {
    return this.updateCallMemory(callId, (state) => {
      const now = Date.now();

      for (const [key, value] of Object.entries(extracted.facts)) {
        if (value === undefined || value === null) continue;

        const confidence = extracted.confidenceMap[key] || 'confirmed';
        const snippet = extracted.rawSnippets[key];
        const existingConfirmed = state.confirmedFacts[key];

        // Customer explicit correction
        if (extracted.isCorrection && extracted.correctionField === key) {
          this.logger.log(`[Memory] Customer correction applied for ${key}: ${value}`);
          state.confirmedFacts[key] = {
            value,
            source: 'customer',
            confidence: 'confirmed',
            updatedAt: now,
            rawSnippet: snippet,
            previousValue: existingConfirmed?.value,
          };
          (state.customer as Record<string, any>)[key] = value;
          continue;
        }

        // If field already confirmed, don't overwrite with lower confidence
        if (existingConfirmed && confidence === 'approximate') {
          state.approximateFacts[key] = {
            value,
            source: 'customer',
            confidence: 'approximate',
            updatedAt: now,
            rawSnippet: snippet,
          };
          continue;
        }

        // Standard update
        if (confidence === 'confirmed') {
          state.confirmedFacts[key] = {
            value,
            source: 'customer',
            confidence: 'confirmed',
            updatedAt: now,
            rawSnippet: snippet,
            previousValue: existingConfirmed?.value,
          };
        } else {
          state.approximateFacts[key] = {
            value,
            source: 'customer',
            confidence: 'approximate',
            updatedAt: now,
            rawSnippet: snippet,
          };
        }

        if (key === 'interestedProjects' && Array.isArray(value)) {
          const merged = new Set([...state.customer.interestedProjects, ...value]);
          state.customer.interestedProjects = Array.from(merged);
        } else {
          (state.customer as Record<string, any>)[key] = value;
        }
      }
    });
  }

  /**
   * Record a conversation turn in Redis list and local fallback.
   */
  async recordTurn(callId: string, turn: ConversationTurn): Promise<void> {
    const key = `call:${callId}:history`;
    const serialized = JSON.stringify(turn);

    // 1. Push to Redis list
    await this.redis.rpush(key, serialized);
    await this.redis.ltrim(key, -this.MAX_HISTORY_TURNS, -1);
    await this.redis.expire(key, this.CALL_HISTORY_TTL);

    // 2. Local fallback
    const list = this.localHistoryFallback.get(callId) || [];
    list.push(turn);
    if (list.length > this.MAX_HISTORY_TURNS) {
      list.splice(0, list.length - this.MAX_HISTORY_TURNS);
    }
    this.localHistoryFallback.set(callId, list);
  }

  /**
   * Retrieve recent conversation history for prompt injection.
   */
  async getRecentHistory(callId: string, limit = 10): Promise<ConversationTurn[]> {
    const key = `call:${callId}:history`;
    const rawList = await this.redis.lrange(key, -limit, -1);

    if (rawList && rawList.length > 0) {
      try {
        return rawList.map((item) => JSON.parse(item) as ConversationTurn);
      } catch {
        // parse error fallback
      }
    }

    const fallback = this.localHistoryFallback.get(callId) || [];
    return fallback.slice(-limit);
  }

  /**
   * Persist conversation memory permanently to PostgreSQL / MySQL via Prisma.
   */
  async persistMemoryToDb(callId: string): Promise<void> {
    const state = await this.getCallMemory(callId);
    if (!state) return;

    try {
      // 1. Upsert ConversationMemory
      await this.prisma.conversationMemory.upsert({
        where: { callId },
        create: {
          callId,
          leadId: state.leadId,
          customerFacts: state.customer as any,
          askedQuestions: state.askedQuestions,
          answeredFields: state.answeredFields,
          pendingQuestion: state.pendingQuestion,
          lastIntent: state.lastIntent,
          conversationStage: state.conversationStage,
          conversationSummary: state.conversationSummary,
        },
        update: {
          customerFacts: state.customer as any,
          askedQuestions: state.askedQuestions,
          answeredFields: state.answeredFields,
          pendingQuestion: state.pendingQuestion,
          lastIntent: state.lastIntent,
          conversationStage: state.conversationStage,
          conversationSummary: state.conversationSummary,
        },
      });

      // 2. Update Lead record if leadId exists
      if (state.leadId) {
        const leadUpdate: Prisma.LeadUpdateInput = {};
        const c = state.customer;

        if (c.name && c.name !== 'Inbound Caller') leadUpdate.name = c.name;
        if (c.bhk) leadUpdate.bhkPreference = c.bhk;
        if (c.budget) leadUpdate.budget = c.budget;
        if (c.location) leadUpdate.preferredLocation = c.location;
        if (c.timeline) leadUpdate.purchaseTimeline = c.timeline;
        if (c.siteVisit?.interested) leadUpdate.siteVisitInterest = true;
        if (state.conversationSummary) leadUpdate.aiSummary = state.conversationSummary;

        if (Object.keys(leadUpdate).length > 0) {
          await this.prisma.lead.update({
            where: { id: state.leadId },
            data: leadUpdate,
          });
        }
      }

      // 3. Update Redis Customer Profile & Summary Cache
      if (state.phone) {
        const profile: CustomerProfileCache = {
          leadId: state.leadId,
          name: state.customer.name || null,
          phone: state.phone,
          purpose: state.customer.purpose || null,
          bhk: state.customer.bhk || null,
          budget: state.customer.budget || null,
          budgetLabel: state.customer.budgetLabel || null,
          preferredLocation: state.customer.location || null,
          purchaseTimeline: state.customer.timeline || null,
          interestedProjects: state.customer.interestedProjects || [],
          leadStatus: 'QUALIFIED',
          lastCallOutcome: 'CONNECTED',
          previousCallCount: state.previousCallCount + 1,
          lastCallAt: new Date().toISOString(),
          summary: state.conversationSummary || state.lastCallSummary || null,
          updatedAt: Date.now(),
        };

        void this.saveCustomerProfileToRedis(profile);
        if (state.conversationSummary) {
          void this.saveCustomerSummaryToRedis(state.phone, state.conversationSummary);
        }
      }

      this.logger.log(`[Memory] Persisted conversation memory to DB for callId=${callId}`);
    } catch (err) {
      this.logger.error(
        `[Memory] Failed to persist memory to DB for callId=${callId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Invalidate customer cache when lead information is modified elsewhere in the CRM.
   */
  async invalidateCustomerCache(rawPhone?: string | null): Promise<void> {
    const phone = normalizePhoneNumber(rawPhone);
    if (!phone) return;

    await this.redis.del(`customer:${phone}`, `customer:${phone}:summary`);
    this.logger.log(`[Memory] Invalidated Redis cache for customer ${maskPhoneNumber(phone)}`);
  }

  // ==========================================
  // Private Redis & Database Helpers
  // ==========================================

  private async getCustomerProfileFromRedis(phone: string): Promise<CustomerProfileCache | null> {
    const key = `customer:${phone}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;

    try {
      // Refresh TTL on access (sliding window)
      if (typeof this.redis?.expire === 'function') {
        void this.redis.expire(key, this.CUSTOMER_PROFILE_TTL).catch(() => null);
      }
      return JSON.parse(raw) as CustomerProfileCache;
    } catch {
      return null;
    }
  }

  private async saveCustomerProfileToRedis(profile: CustomerProfileCache): Promise<void> {
    if (!profile.phone) return;
    const key = `customer:${profile.phone}`;
    await this.redis.set(key, JSON.stringify(profile), this.CUSTOMER_PROFILE_TTL);
  }

  private async getCustomerSummaryFromRedis(phone: string): Promise<string | null> {
    const key = `customer:${phone}:summary`;
    return this.redis.get(key);
  }

  private async saveCustomerSummaryToRedis(phone: string, summary: string): Promise<void> {
    const key = `customer:${phone}:summary`;
    await this.redis.set(key, summary, this.CUSTOMER_SUMMARY_TTL);
  }

  private async saveCallMemoryToRedis(callId: string, state: ConversationState): Promise<void> {
    const key = `call:${callId}:memory`;
    await this.redis.set(key, JSON.stringify(state), this.CALL_MEMORY_TTL);
  }

  private async fetchCustomerProfileFromDb(
    normalizedPhone: string,
    leadIdHint?: string | null,
  ): Promise<CustomerProfileCache | null> {
    try {
      const searchNumber = normalizedPhone ? normalizedPhone.slice(-10) : undefined;

      const lead = await this.prisma.lead.findFirst({
        where: {
          OR: [
            ...(leadIdHint ? [{ id: leadIdHint }] : []),
            ...(searchNumber ? [{ phone: { contains: searchNumber } }] : []),
          ],
        },
        include: {
          project: true,
          calls: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              outcome: true,
              summary: true,
              transcript: true,
              createdAt: true,
            },
          },
        },
      });

      if (!lead) return null;

      const calls = lead.calls || [];
      const lastCall = calls[0];
      const previousSummary = lead.aiSummary || lastCall?.summary || null;

      return {
        leadId: lead.id,
        name: lead.name && !/inbound/i.test(lead.name) ? lead.name : null,
        phone: normalizedPhone || lead.phone,
        purpose: null,
        bhk: lead.bhkPreference || null,
        budget: lead.budget || null,
        budgetLabel: lead.budget ? (lead.budget >= 10000000 ? `${(lead.budget / 10000000).toFixed(1)} Cr` : `${Math.round(lead.budget / 100000)} Lakh`) : null,
        preferredLocation: lead.preferredLocation || lead.project?.location || null,
        purchaseTimeline: lead.purchaseTimeline || null,
        interestedProjects: lead.project?.name ? [lead.project.name] : [],
        leadStatus: String(lead.status),
        lastCallOutcome: lastCall?.outcome ? String(lastCall.outcome) : null,
        previousCallCount: calls.length,
        lastCallAt: lastCall?.createdAt ? lastCall.createdAt.toISOString() : null,
        summary: previousSummary,
        updatedAt: Date.now(),
      };
    } catch (err) {
      this.logger.warn(`[Memory] DB lookup error: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
