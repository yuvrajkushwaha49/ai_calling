import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  LeadStatus,
  Prisma,
  QueueItemStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CallsService } from '../calls/calls.service';
import { AuditService } from '../audit/audit.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private calls: CallsService,
    private audit: AuditService,
    private ai: AiService,
  ) {}

  list() {
    return this.prisma.callCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { queueItems: true, calls: true } },
      },
    });
  }

  async get(id: string) {
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
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async create(input: {
    name: string;
    projectId?: string;
    leadIds?: string[];
    scheduledAt?: string;
    timezone?: string;
    workingHours?: Record<string, unknown>;
    maxRetries?: number;
    retryDelayMins?: number;
    filterJson?: Record<string, unknown>;
    actorId?: string;
  }) {
    if (!input.projectId && (!input.leadIds || !input.leadIds.length)) {
      throw new BadRequestException('Provide projectId and/or leadIds');
    }

    const leadWhere: Prisma.LeadWhereInput = {
      doNotCall: false,
      consentToCall: true,
      status: { notIn: [LeadStatus.LOST, LeadStatus.NOT_INTERESTED] },
    };
    if (input.projectId) leadWhere.projectId = input.projectId;
    if (input.leadIds?.length) leadWhere.id = { in: input.leadIds };

    const leads = await this.prisma.lead.findMany({
      where: leadWhere,
      select: { id: true, projectId: true },
    });
    if (!leads.length) {
      throw new BadRequestException('No eligible leads found for campaign');
    }

    const missingProject = leads.filter((l) => !l.projectId);
    if (missingProject.length) {
      throw new BadRequestException(
        `${missingProject.length} lead(s) are not linked to a project. Link project before calling.`,
      );
    }

    const campaign = await this.prisma.callCampaign.create({
      data: {
        name: input.name,
        projectId: input.projectId,
        status: input.scheduledAt
          ? CampaignStatus.SCHEDULED
          : CampaignStatus.DRAFT,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        timezone: input.timezone || 'Asia/Kolkata',
        workingHours: (input.workingHours || undefined) as
          | Prisma.InputJsonValue
          | undefined,
        maxRetries: input.maxRetries ?? 2,
        retryDelayMins: input.retryDelayMins ?? 60,
        filterJson: (input.filterJson || undefined) as
          | Prisma.InputJsonValue
          | undefined,
        createdById: input.actorId,
        queueItems: {
          create: leads.map((l) => ({
            leadId: l.id,
            status: QueueItemStatus.QUEUED,
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

  async setStatus(
    id: string,
    status: CampaignStatus,
    actorId?: string,
  ) {
    await this.get(id);
    const data: Prisma.CallCampaignUpdateInput = { status };
    if (status === CampaignStatus.RUNNING) data.startedAt = new Date();
    if (
      status === CampaignStatus.COMPLETED ||
      status === CampaignStatus.CANCELLED
    ) {
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
    const hours = (settings.workingHours || {}) as {
      start?: string;
      end?: string;
      days?: string[];
    };
    if (!this.withinWorkingHours(hours, settings.timezone || 'Asia/Kolkata')) {
      return { processed: 0, skipped: 'outside_working_hours' };
    }

    const due = await this.prisma.campaignQueueItem.findMany({
      where: {
        status: QueueItemStatus.QUEUED,
        campaign: { status: CampaignStatus.RUNNING },
        OR: [{ nextAttempt: null }, { nextAttempt: { lte: new Date() } }],
        lead: {
          doNotCall: false,
          consentToCall: true,
          status: { notIn: [LeadStatus.LOST, LeadStatus.NOT_INTERESTED] },
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
          status: QueueItemStatus.CALLING,
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
            status: QueueItemStatus.COMPLETED,
            callId: call.id,
          },
        });
        processed += 1;
      } catch (error) {
        const attempts = item.attempts + 1;
        const canRetry = attempts <= (item.campaign.maxRetries || 2);
        await this.prisma.campaignQueueItem.update({
          where: { id: item.id },
          data: {
            status: canRetry
              ? QueueItemStatus.QUEUED
              : QueueItemStatus.FAILED,
            lastError:
              error instanceof Error ? error.message : 'Call failed',
            nextAttempt: canRetry
              ? new Date(
                  Date.now() +
                    (item.campaign.retryDelayMins || 60) * 60_000,
                )
              : null,
          },
        });
      }
    }

    // auto-complete campaigns with no remaining queued/calling
    const running = await this.prisma.callCampaign.findMany({
      where: { status: CampaignStatus.RUNNING },
      include: {
        queueItems: {
          where: {
            status: { in: [QueueItemStatus.QUEUED, QueueItemStatus.CALLING] },
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
            status: CampaignStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      }
    }

    return { processed };
  }

  private withinWorkingHours(
    hours: { start?: string; end?: string; days?: string[] },
    _timezone: string,
  ) {
    const now = new Date();
    const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const day = dayMap[now.getDay()];
    const days = hours.days?.length
      ? hours.days.map((d) => d.toLowerCase())
      : ['mon', 'tue', 'wed', 'thu', 'fri'];
    if (!days.includes(day)) return false;

    const start = hours.start || '09:00';
    const end = hours.end || '18:00';
    const mins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return mins >= sh * 60 + sm && mins <= eh * 60 + em;
  }
}
