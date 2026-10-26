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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const calls_service_1 = require("../calls/calls.service");
const audit_service_1 = require("../audit/audit.service");
const ai_service_1 = require("../ai/ai.service");
let CampaignsService = class CampaignsService {
    prisma;
    calls;
    audit;
    ai;
    constructor(prisma, calls, audit, ai) {
        this.prisma = prisma;
        this.calls = calls;
        this.audit = audit;
        this.ai = ai;
    }
    list() {
        return this.prisma.callCampaign.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                project: { select: { id: true, name: true } },
                _count: { select: { queueItems: true, calls: true } },
            },
        });
    }
    async get(id) {
        const campaign = await this.prisma.callCampaign.findUnique({
            where: { id },
            include: {
                project: true,
                queueItems: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        lead: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                status: true,
                                doNotCall: true,
                            },
                        },
                        call: {
                            select: { id: true, status: true, outcome: true },
                        },
                    },
                },
            },
        });
        if (!campaign)
            throw new common_1.NotFoundException('Campaign not found');
        return campaign;
    }
    async create(input) {
        if (!input.projectId && (!input.leadIds || !input.leadIds.length)) {
            throw new common_1.BadRequestException('Provide projectId and/or leadIds');
        }
        const leadWhere = {
            doNotCall: false,
            consentToCall: true,
            status: { notIn: [client_1.LeadStatus.LOST, client_1.LeadStatus.NOT_INTERESTED] },
        };
        if (input.projectId)
            leadWhere.projectId = input.projectId;
        if (input.leadIds?.length)
            leadWhere.id = { in: input.leadIds };
        const leads = await this.prisma.lead.findMany({
            where: leadWhere,
            select: { id: true, projectId: true },
        });
        if (!leads.length) {
            throw new common_1.BadRequestException('No eligible leads found for campaign');
        }
        const missingProject = leads.filter((l) => !l.projectId);
        if (missingProject.length) {
            throw new common_1.BadRequestException(`${missingProject.length} lead(s) are not linked to a project. Link project before calling.`);
        }
        const campaign = await this.prisma.callCampaign.create({
            data: {
                name: input.name,
                projectId: input.projectId,
                status: input.scheduledAt
                    ? client_1.CampaignStatus.SCHEDULED
                    : client_1.CampaignStatus.DRAFT,
                scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
                timezone: input.timezone || 'Asia/Kolkata',
                workingHours: (input.workingHours || undefined),
                maxRetries: input.maxRetries ?? 2,
                retryDelayMins: input.retryDelayMins ?? 60,
                filterJson: (input.filterJson || undefined),
                createdById: input.actorId,
                queueItems: {
                    create: leads.map((l) => ({
                        leadId: l.id,
                        status: client_1.QueueItemStatus.QUEUED,
                        nextAttempt: input.scheduledAt
                            ? new Date(input.scheduledAt)
                            : new Date(),
                    })),
                },
            },
        });
        await this.audit.log({
            actorId: input.actorId,
            action: 'CAMPAIGN_CREATED',
            entityType: 'CallCampaign',
            entityId: campaign.id,
            details: { leadCount: leads.length },
        });
        return this.get(campaign.id);
    }
    async setStatus(id, status, actorId) {
        await this.get(id);
        const data = { status };
        if (status === client_1.CampaignStatus.RUNNING)
            data.startedAt = new Date();
        if (status === client_1.CampaignStatus.COMPLETED ||
            status === client_1.CampaignStatus.CANCELLED) {
            data.completedAt = new Date();
        }
        const updated = await this.prisma.callCampaign.update({
            where: { id },
            data,
        });
        await this.audit.log({
            actorId,
            action: `CAMPAIGN_${status}`,
            entityType: 'CallCampaign',
            entityId: id,
        });
        return updated;
    }
    async processDue(limit = 5) {
        const settings = await this.ai.getSettings();
        const hours = (settings.workingHours || {});
        if (!this.withinWorkingHours(hours, settings.timezone || 'Asia/Kolkata')) {
            return { processed: 0, skipped: 'outside_working_hours' };
        }
        const due = await this.prisma.campaignQueueItem.findMany({
            where: {
                status: client_1.QueueItemStatus.QUEUED,
                campaign: { status: client_1.CampaignStatus.RUNNING },
                OR: [{ nextAttempt: null }, { nextAttempt: { lte: new Date() } }],
                lead: {
                    doNotCall: false,
                    consentToCall: true,
                    status: { notIn: [client_1.LeadStatus.LOST, client_1.LeadStatus.NOT_INTERESTED] },
                },
            },
            take: limit,
            orderBy: { createdAt: 'asc' },
            include: { lead: true, campaign: true },
        });
        let processed = 0;
        for (const item of due) {
            await this.prisma.campaignQueueItem.update({
                where: { id: item.id },
                data: {
                    status: client_1.QueueItemStatus.CALLING,
                    attempts: { increment: 1 },
                },
            });
            try {
                const call = await this.calls.startOutboundCall(item.leadId, {
                    browserDemo: false,
                    campaignId: item.campaignId,
                });
                await this.prisma.campaignQueueItem.update({
                    where: { id: item.id },
                    data: {
                        status: client_1.QueueItemStatus.COMPLETED,
                        callId: call.id,
                    },
                });
                processed += 1;
            }
            catch (error) {
                const attempts = item.attempts + 1;
                const canRetry = attempts <= (item.campaign.maxRetries || 2);
                await this.prisma.campaignQueueItem.update({
                    where: { id: item.id },
                    data: {
                        status: canRetry
                            ? client_1.QueueItemStatus.QUEUED
                            : client_1.QueueItemStatus.FAILED,
                        lastError: error instanceof Error ? error.message : 'Call failed',
                        nextAttempt: canRetry
                            ? new Date(Date.now() +
                                (item.campaign.retryDelayMins || 60) * 60_000)
                            : null,
                    },
                });
            }
        }
        const running = await this.prisma.callCampaign.findMany({
            where: { status: client_1.CampaignStatus.RUNNING },
            include: {
                queueItems: {
                    where: {
                        status: { in: [client_1.QueueItemStatus.QUEUED, client_1.QueueItemStatus.CALLING] },
                    },
                    take: 1,
                },
            },
        });
        for (const c of running) {
            if (!c.queueItems.length) {
                await this.prisma.callCampaign.update({
                    where: { id: c.id },
                    data: {
                        status: client_1.CampaignStatus.COMPLETED,
                        completedAt: new Date(),
                    },
                });
            }
        }
        return { processed };
    }
    withinWorkingHours(hours, _timezone) {
        const now = new Date();
        const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const day = dayMap[now.getDay()];
        const days = hours.days?.length
            ? hours.days.map((d) => d.toLowerCase())
            : ['mon', 'tue', 'wed', 'thu', 'fri'];
        if (!days.includes(day))
            return false;
        const start = hours.start || '09:00';
        const end = hours.end || '18:00';
        const mins = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        return mins >= sh * 60 + sm && mins <= eh * 60 + em;
    }
};
exports.CampaignsService = CampaignsService;
exports.CampaignsService = CampaignsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        calls_service_1.CallsService,
        audit_service_1.AuditService,
        ai_service_1.AiService])
], CampaignsService);
//# sourceMappingURL=campaigns.service.js.map