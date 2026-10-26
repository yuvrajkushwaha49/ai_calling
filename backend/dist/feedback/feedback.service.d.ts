import { FeedbackRating, FeedbackStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class FeedbackService {
    private prisma;
    private audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(status?: FeedbackStatus): Prisma.PrismaPromise<({
        project: {
            name: string;
            id: string;
        } | null;
        lead: {
            name: string;
            id: string;
            phone: string;
        } | null;
        call: {
            id: string;
            outcome: import("@prisma/client").$Enums.CallOutcome;
            languageDetected: string | null;
        };
        createdBy: {
            name: string;
            id: string;
        } | null;
        approvedBy: {
            name: string;
            id: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.FeedbackStatus;
        projectId: string | null;
        leadId: string | null;
        callId: string;
        rating: import("@prisma/client").$Enums.FeedbackRating;
        approvedAt: Date | null;
        createdById: string | null;
        category: string | null;
        comment: string | null;
        correctedSummary: string | null;
        correctedReply: string | null;
        correctedFactsJson: Prisma.JsonValue | null;
        aiReplySnapshot: string | null;
        transcriptSnapshot: string | null;
        approvedById: string | null;
    })[]>;
    create(input: {
        callId: string;
        rating: FeedbackRating;
        category?: string;
        comment?: string;
        correctedSummary?: string;
        correctedReply?: string;
        correctedFactsJson?: Record<string, unknown>;
        actorId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.FeedbackStatus;
        projectId: string | null;
        leadId: string | null;
        callId: string;
        rating: import("@prisma/client").$Enums.FeedbackRating;
        approvedAt: Date | null;
        createdById: string | null;
        category: string | null;
        comment: string | null;
        correctedSummary: string | null;
        correctedReply: string | null;
        correctedFactsJson: Prisma.JsonValue | null;
        aiReplySnapshot: string | null;
        transcriptSnapshot: string | null;
        approvedById: string | null;
    }>;
    moderate(id: string, status: FeedbackStatus, actorId: string, actorRole: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.FeedbackStatus;
        projectId: string | null;
        leadId: string | null;
        callId: string;
        rating: import("@prisma/client").$Enums.FeedbackRating;
        approvedAt: Date | null;
        createdById: string | null;
        category: string | null;
        comment: string | null;
        correctedSummary: string | null;
        correctedReply: string | null;
        correctedFactsJson: Prisma.JsonValue | null;
        aiReplySnapshot: string | null;
        transcriptSnapshot: string | null;
        approvedById: string | null;
    }>;
    private mergeIntoPlaybook;
    analytics(): Promise<{
        feedback: (Prisma.PickEnumerable<Prisma.CallFeedbackGroupByOutputType, ("status" | "rating")[]> & {
            _count: number;
        })[];
        preferredLanguages: (Prisma.PickEnumerable<Prisma.CallGroupByOutputType, "languageDetected"[]> & {
            _count: number;
        })[];
        commonQuestions: Record<string, number>;
        commonObjections: Record<string, number>;
        siteVisitByProject: Record<string, number>;
        totals: {
            calls30d: number;
            siteVisits: number;
            qualified: number;
        };
    }>;
}
