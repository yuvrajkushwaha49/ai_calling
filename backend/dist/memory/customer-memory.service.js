"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CustomerMemoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerMemoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
const phone_utils_1 = require("./phone-utils");
let CustomerMemoryService = CustomerMemoryService_1 = class CustomerMemoryService {
    prisma;
    redis;
    logger = new common_1.Logger(CustomerMemoryService_1.name);
    localMemoryFallback = new Map();
    localHistoryFallback = new Map();
    CUSTOMER_PROFILE_TTL = 3600;
    CALL_MEMORY_TTL = 7200;
    CALL_HISTORY_TTL = 7200;
    CUSTOMER_SUMMARY_TTL = 86400;
    MAX_HISTORY_TURNS = 20;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    async lookupCustomer(phone, leadIdHint) {
        const normalized = (0, phone_utils_1.normalizePhoneNumber)(phone);
        if (!normalized && !leadIdHint)
            return null;
        if (normalized) {
            try {
                const cached = await this.getCustomerProfileFromRedis(normalized);
                if (cached)
                    return cached;
            }
            catch (err) {
                this.logger.warn(`[Memory] Redis lookup failed, falling back to DB: ${err}`);
            }
        }
        const fromDb = await this.fetchCustomerProfileFromDb(normalized, leadIdHint);
        if (fromDb && normalized) {
            await this.saveCustomerProfileToRedis(fromDb);
        }
        return fromDb;
    }
    async initCallMemory(callId, phone, leadIdHint) {
        return this.initializeCallMemory(callId, phone, leadIdHint);
    }
    async acquireLeadLock(leadId, ttlSeconds = 10) {
        const key = `lead:${leadId}:lock`;
        return this.redis.acquireLock(key, ttlSeconds);
    }
    async releaseLeadLock(leadId, token) {
        const key = `lead:${leadId}:lock`;
        return this.redis.releaseLock(key, token);
    }
    async initializeCallMemory(callId, rawPhone, leadIdHint) {
        const normalizedPhone = (0, phone_utils_1.normalizePhoneNumber)(rawPhone);
        const maskedPhone = (0, phone_utils_1.maskPhoneNumber)(normalizedPhone || rawPhone);
        this.logger.log(`[Memory] Initializing callId=${callId} phone=${maskedPhone}`);
        let customerProfile = null;
        let previousSummary = null;
        if (normalizedPhone) {
            customerProfile = await this.getCustomerProfileFromRedis(normalizedPhone);
            if (customerProfile) {
                this.logger.log(`[Memory] Cache HIT for customer ${maskedPhone}. Previous calls: ${customerProfile.previousCallCount}`);
                previousSummary = await this.getCustomerSummaryFromRedis(normalizedPhone);
            }
        }
        if (!customerProfile) {
            customerProfile = await this.fetchCustomerProfileFromDb(normalizedPhone, leadIdHint);
            if (customerProfile && normalizedPhone) {
                void this.saveCustomerProfileToRedis(customerProfile);
                if (customerProfile.summary) {
                    void this.saveCustomerSummaryToRedis(normalizedPhone, customerProfile.summary);
                    previousSummary = customerProfile.summary;
                }
            }
        }
        const isReturning = Boolean(customerProfile &&
            (customerProfile.previousCallCount > 0 ||
                (customerProfile.leadId && customerProfile.leadStatus !== 'NEW')));
        const initialFacts = {
            name: customerProfile?.name || null,
            purpose: customerProfile?.purpose || null,
            bhk: customerProfile?.bhk || null,
            budget: customerProfile?.budget || null,
            budgetLabel: customerProfile?.budgetLabel || null,
            location: customerProfile?.preferredLocation || null,
            timeline: customerProfile?.purchaseTimeline || null,
            interestedProjects: customerProfile?.interestedProjects || [],
        };
        const answeredFields = [];
        if (initialFacts.bhk)
            answeredFields.push('bhk');
        if (initialFacts.budget || initialFacts.budgetLabel)
            answeredFields.push('budget');
        if (initialFacts.purpose)
            answeredFields.push('purpose');
        if (initialFacts.location)
            answeredFields.push('location');
        if (initialFacts.timeline)
            answeredFields.push('timeline');
        if (initialFacts.name && initialFacts.name !== 'Inbound Caller')
            answeredFields.push('name');
        const confirmedFacts = {};
        for (const field of answeredFields) {
            const val = initialFacts[field];
            if (val !== undefined && val !== null) {
                confirmedFacts[field] = {
                    value: val,
                    source: 'crm',
                    confidence: 'confirmed',
                    updatedAt: Date.now(),
                };
            }
        }
        const state = {
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
        await this.saveCallMemoryToRedis(callId, state);
        this.localMemoryFallback.set(callId, state);
        return state;
    }
    async getCallMemory(callId) {
        const key = `call:${callId}:memory`;
        const cached = await this.redis.get(key);
        if (cached) {
            try {
                const state = JSON.parse(cached);
                this.localMemoryFallback.set(callId, state);
                return state;
            }
            catch {
            }
        }
        return this.localMemoryFallback.get(callId) || null;
    }
    async updateCallMemory(callId, updater) {
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
        const fields = new Set();
        const c = state.customer;
        if (c.bhk)
            fields.add('bhk');
        if (c.budget || c.budgetLabel)
            fields.add('budget');
        if (c.purpose)
            fields.add('purpose');
        if (c.location)
            fields.add('location');
        if (c.timeline || c.possession)
            fields.add('timeline');
        if (c.name && c.name !== 'Inbound Caller')
            fields.add('name');
        if (c.siteVisit?.interested)
            fields.add('siteVisit');
        state.answeredFields = Array.from(fields);
        this.localMemoryFallback.set(callId, state);
        await this.saveCallMemoryToRedis(callId, state);
        return state;
    }
    async applyExtractedFacts(callId, extracted) {
        return this.updateCallMemory(callId, (state) => {
            const now = Date.now();
            for (const [key, value] of Object.entries(extracted.facts)) {
                if (value === undefined || value === null)
                    continue;
                const confidence = extracted.confidenceMap[key] || 'confirmed';
                const snippet = extracted.rawSnippets[key];
                const existingConfirmed = state.confirmedFacts[key];
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
                    state.customer[key] = value;
                    continue;
                }
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
                if (confidence === 'confirmed') {
                    state.confirmedFacts[key] = {
                        value,
                        source: 'customer',
                        confidence: 'confirmed',
                        updatedAt: now,
                        rawSnippet: snippet,
                        previousValue: existingConfirmed?.value,
                    };
                }
                else {
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
                }
                else {
                    state.customer[key] = value;
                }
            }
        });
    }
    async recordTurn(callId, turn) {
        const key = `call:${callId}:history`;
        const serialized = JSON.stringify(turn);
        await this.redis.rpush(key, serialized);
        await this.redis.ltrim(key, -this.MAX_HISTORY_TURNS, -1);
        await this.redis.expire(key, this.CALL_HISTORY_TTL);
        const list = this.localHistoryFallback.get(callId) || [];
        list.push(turn);
        if (list.length > this.MAX_HISTORY_TURNS) {
            list.splice(0, list.length - this.MAX_HISTORY_TURNS);
        }
        this.localHistoryFallback.set(callId, list);
    }
    async getRecentHistory(callId, limit = 10) {
        const key = `call:${callId}:history`;
        const rawList = await this.redis.lrange(key, -limit, -1);
        if (rawList && rawList.length > 0) {
            try {
                return rawList.map((item) => JSON.parse(item));
            }
            catch {
            }
        }
        const fallback = this.localHistoryFallback.get(callId) || [];
        return fallback.slice(-limit);
    }
    async persistMemoryToDb(callId) {
        const state = await this.getCallMemory(callId);
        if (!state)
            return;
        try {
            await this.prisma.conversationMemory.upsert({
                where: { callId },
                create: {
                    callId,
                    leadId: state.leadId,
                    customerFacts: state.customer,
                    askedQuestions: state.askedQuestions,
                    answeredFields: state.answeredFields,
                    pendingQuestion: state.pendingQuestion,
                    lastIntent: state.lastIntent,
                    conversationStage: state.conversationStage,
                    conversationSummary: state.conversationSummary,
                },
                update: {
                    customerFacts: state.customer,
                    askedQuestions: state.askedQuestions,
                    answeredFields: state.answeredFields,
                    pendingQuestion: state.pendingQuestion,
                    lastIntent: state.lastIntent,
                    conversationStage: state.conversationStage,
                    conversationSummary: state.conversationSummary,
                },
            });
            if (state.leadId) {
                const leadUpdate = {};
                const c = state.customer;
                if (c.name && c.name !== 'Inbound Caller')
                    leadUpdate.name = c.name;
                if (c.bhk)
                    leadUpdate.bhkPreference = c.bhk;
                if (c.budget)
                    leadUpdate.budget = c.budget;
                if (c.location)
                    leadUpdate.preferredLocation = c.location;
                if (c.timeline)
                    leadUpdate.purchaseTimeline = c.timeline;
                if (c.siteVisit?.interested)
                    leadUpdate.siteVisitInterest = true;
                if (state.conversationSummary)
                    leadUpdate.aiSummary = state.conversationSummary;
                if (Object.keys(leadUpdate).length > 0) {
                    await this.prisma.lead.update({
                        where: { id: state.leadId },
                        data: leadUpdate,
                    });
                }
            }
            if (state.phone) {
                const profile = {
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
        }
        catch (err) {
            this.logger.error(`[Memory] Failed to persist memory to DB for callId=${callId}: ${err instanceof Error ? err.message : err}`);
        }
    }
    async invalidateCustomerCache(rawPhone) {
        const phone = (0, phone_utils_1.normalizePhoneNumber)(rawPhone);
        if (!phone)
            return;
        await this.redis.del(`customer:${phone}`, `customer:${phone}:summary`);
        this.logger.log(`[Memory] Invalidated Redis cache for customer ${(0, phone_utils_1.maskPhoneNumber)(phone)}`);
    }
    async getCustomerProfileFromRedis(phone) {
        const key = `customer:${phone}`;
        const raw = await this.redis.get(key);
        if (!raw)
            return null;
        try {
            if (typeof this.redis?.expire === 'function') {
                void this.redis.expire(key, this.CUSTOMER_PROFILE_TTL).catch(() => null);
            }
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async saveCustomerProfileToRedis(profile) {
        if (!profile.phone)
            return;
        const key = `customer:${profile.phone}`;
        await this.redis.set(key, JSON.stringify(profile), this.CUSTOMER_PROFILE_TTL);
    }
    async getCustomerSummaryFromRedis(phone) {
        const key = `customer:${phone}:summary`;
        return this.redis.get(key);
    }
    async saveCustomerSummaryToRedis(phone, summary) {
        const key = `customer:${phone}:summary`;
        await this.redis.set(key, summary, this.CUSTOMER_SUMMARY_TTL);
    }
    async saveCallMemoryToRedis(callId, state) {
        const key = `call:${callId}:memory`;
        await this.redis.set(key, JSON.stringify(state), this.CALL_MEMORY_TTL);
    }
    async fetchCustomerProfileFromDb(normalizedPhone, leadIdHint) {
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
            if (!lead)
                return null;
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
        }
        catch (err) {
            this.logger.warn(`[Memory] DB lookup error: ${err instanceof Error ? err.message : err}`);
            return null;
        }
    }
};
exports.CustomerMemoryService = CustomerMemoryService;
exports.CustomerMemoryService = CustomerMemoryService = CustomerMemoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], CustomerMemoryService);
//# sourceMappingURL=customer-memory.service.js.map