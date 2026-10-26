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
exports.FeedbackService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const playbook_1 = require("../ai/playbook");
let FeedbackService = class FeedbackService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    list(status) {
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
    async create(input) {
        const call = await this.prisma.call.findUnique({
            where: { id: input.callId },
            include: { lead: true },
        });
        if (!call)
            throw new common_1.NotFoundException('Call not found');
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
                    undefined),
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
    async moderate(id, status, actorId, actorRole) {
        if (actorRole !== client_1.UserRole.ADMIN && actorRole !== 'ADMIN') {
            throw new common_1.BadRequestException('Only admins can approve feedback');
        }
        const existing = await this.prisma.callFeedback.findUnique({
            where: { id },
        });
        if (!existing)
            throw new common_1.NotFoundException('Feedback not found');
        const updated = await this.prisma.callFeedback.update({
            where: { id },
            data: {
                status,
                approvedById: actorId,
                approvedAt: status === client_1.FeedbackStatus.APPROVED ? new Date() : null,
            },
        });
        if (status === client_1.FeedbackStatus.APPROVED) {
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
    async mergeIntoPlaybook(feedback) {
        const settings = await this.prisma.aiAgentSettings.findFirst();
        if (!settings)
            return;
        const playbook = (0, playbook_1.normalizePlaybook)(settings.approvedPlaybook);
        const note = String(feedback.correctedReply || feedback.comment || '').trim();
        if (!note)
            return;
        const at = new Date().toISOString();
        const tipNote = note.slice(0, 280);
        playbook.tips = [
            ...(playbook.tips || []),
            {
                note: tipNote,
                rating: String(feedback.rating),
                source: 'feedback',
                at,
            },
        ].slice(-100);
        (0, playbook_1.appendImprovement)(playbook, {
            kind: 'feedback_tip',
            summary: tipNote,
            detail: `Approved tip · rating ${feedback.rating}`,
            at,
        });
        await this.prisma.aiAgentSettings.update({
            where: { id: settings.id },
            data: {
                approvedPlaybook: playbook,
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
        const questions = {};
        const objections = {};
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
        const siteVisitByProject = {};
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
};
exports.FeedbackService = FeedbackService;
exports.FeedbackService = FeedbackService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], FeedbackService);
//# sourceMappingURL=feedback.service.js.map