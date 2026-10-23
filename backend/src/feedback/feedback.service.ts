import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedbackRating, FeedbackStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { appendImprovement, normalizePlaybook } from '../ai/playbook';

@Injectable()
export class FeedbackService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  list(status?: FeedbackStatus) {
    return this.prisma.callFeedback.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        call: { select: { id: true, outcome: true, languageDetected: true } },
        lead: { select: { id: true, name: true, phone: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
  }

  async create(input: {
    callId: string;
    rating: FeedbackRating;
    category?: string;
    comment?: string;
    correctedSummary?: string;
    correctedReply?: string;
    correctedFactsJson?: Record<string, unknown>;
    actorId?: string;
  }) {
    const call = await this.prisma.call.findUnique({
      where: { id: input.callId },
      include: { lead: true },
    });
    if (!call) throw new NotFoundException('Call not found');

    const feedback = await this.prisma.callFeedback.create({
      data: {
        callId: call.id,
        leadId: call.leadId,
        projectId: call.projectId,
        rating: input.rating,
        category: input.category,
        comment: input.comment,
        correctedSummary: input.correctedSummary,
        correctedReply: input.correctedReply,
        correctedFactsJson: (input.correctedFactsJson ||
          undefined) as Prisma.InputJsonValue | undefined,
        aiReplySnapshot: call.summary,
        transcriptSnapshot: call.transcript,
        createdById: input.actorId,
      },
    });

    await this.audit.log({
      actorId: input.actorId,
      action: 'FEEDBACK_SUBMITTED',
      entityType: 'CallFeedback',
      entityId: feedback.id,
      details: { rating: input.rating, callId: call.id },
    });

    return feedback;
  }

  async moderate(
    id: string,
    status: FeedbackStatus,
    actorId: string,
    actorRole: string,
  ) {
    if (actorRole !== UserRole.ADMIN && actorRole !== 'ADMIN') {
      throw new BadRequestException('Only admins can approve feedback');
    }
    const existing = await this.prisma.callFeedback.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Feedback not found');

    const updated = await this.prisma.callFeedback.update({
      where: { id },
      data: {
        status,
        approvedById: actorId,
        approvedAt: status === FeedbackStatus.APPROVED ? new Date() : null,
      },
    });

    if (status === FeedbackStatus.APPROVED) {
      await this.mergeIntoPlaybook(updated);
    }

    await this.audit.log({
      actorId,
      action: `FEEDBACK_${status}`,
      entityType: 'CallFeedback',
      entityId: id,
    });

    return updated;
  }

  private async mergeIntoPlaybook(feedback: {
    category?: string | null;
    correctedReply?: string | null;
    comment?: string | null;
    rating: FeedbackRating;
  }) {
    const settings = await this.prisma.aiAgentSettings.findFirst();
    if (!settings) return;

    const playbook = normalizePlaybook(settings.approvedPlaybook);
    const note = String(
      feedback.correctedReply || feedback.comment || '',
    ).trim();
    if (!note) return;

    const at = new Date().toISOString();
    const tipNote = note.slice(0, 280);
    playbook.tips = [
      ...(playbook.tips || []),
      {
        note: tipNote,
        rating: String(feedback.rating),
        source: 'feedback' as const,
        at,
      },
    ].slice(-100);

    appendImprovement(playbook, {
      kind: 'feedback_tip',
      summary: tipNote,
      detail: `Approved tip · rating ${feedback.rating}`,
      at,
    });

    await this.prisma.aiAgentSettings.update({
      where: { id: settings.id },
      data: {
        approvedPlaybook: playbook as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async analytics() {
    const [feedback, calls, byLang, byProject] = await Promise.all([
      this.prisma.callFeedback.groupBy({
        by: ['rating', 'status'],
        _count: true,
      }),
      this.prisma.call.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        select: {
          outcome: true,
          languageDetected: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
      this.prisma.call.groupBy({
        by: ['languageDetected'],
        _count: true,
      }),
      this.prisma.call.groupBy({
        by: ['projectId', 'outcome'],
        _count: true,
      }),
    ]);

    const questions: Record<string, number> = {};
    const objections: Record<string, number> = {};
    for (const c of calls) {
      if (c.outcome === 'NOT_INTERESTED') {
        objections.not_interested = (objections.not_interested || 0) + 1;
      }
      if (c.outcome === 'CALLBACK_REQUESTED') {
        objections.callback = (objections.callback || 0) + 1;
      }
      if (c.outcome === 'SITE_VISIT_INTERESTED') {
        questions.site_visit = (questions.site_visit || 0) + 1;
      }
      if (c.outcome === 'QUALIFIED') {
        questions.qualified = (questions.qualified || 0) + 1;
      }
    }

    const siteVisitByProject: Record<string, number> = {};
    for (const row of byProject) {
      if (row.outcome === 'SITE_VISIT_INTERESTED' && row.projectId) {
        siteVisitByProject[row.projectId] =
          (siteVisitByProject[row.projectId] || 0) + row._count;
      }
    }

    return {
      feedback,
      preferredLanguages: byLang,
      commonQuestions: questions,
      commonObjections: objections,
      siteVisitByProject,
      totals: {
        calls30d: calls.length,
        siteVisits: calls.filter((c) => c.outcome === 'SITE_VISIT_INTERESTED')
          .length,
        qualified: calls.filter((c) => c.outcome === 'QUALIFIED').length,
      },
    };
  }
}
