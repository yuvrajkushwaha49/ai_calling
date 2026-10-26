import { FeedbackRating, FeedbackStatus } from '@prisma/client';
import { FeedbackService } from './feedback.service';
declare class CreateFeedbackDto {
    callId: string;
    rating: FeedbackRating;
    category?: string;
    comment?: string;
    correctedSummary?: string;
    correctedReply?: string;
    correctedFactsJson?: Record<string, unknown>;
}
export declare class FeedbackController {
    private feedback;
    constructor(feedback: FeedbackService);
    list(status?: FeedbackStatus): import("@prisma/client").Prisma.PrismaPromise<({
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
        correctedFactsJson: import("@prisma/client/runtime/library").JsonValue | null;
        aiReplySnapshot: string | null;
        transcriptSnapshot: string | null;
        approvedById: string | null;
    })[]>;
    analytics(): Promise<{
        feedback: (import("@prisma/client").Prisma.PickEnumerable<import("@prisma/client").Prisma.CallFeedbackGroupByOutputType, ("status" | "rating")[]> & {
            _count: number;
        })[];
        preferredLanguages: (import("@prisma/client").Prisma.PickEnumerable<import("@prisma/client").Prisma.CallGroupByOutputType, "languageDetected"[]> & {
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
    create(dto: CreateFeedbackDto, userId: string): Promise<{
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
        correctedFactsJson: import("@prisma/client/runtime/library").JsonValue | null;
        aiReplySnapshot: string | null;
        transcriptSnapshot: string | null;
        approvedById: string | null;
    }>;
    moderate(id: string, status: FeedbackStatus, user: {
        sub: string;
        role: string;
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
        correctedFactsJson: import("@prisma/client/runtime/library").JsonValue | null;
        aiReplySnapshot: string | null;
        transcriptSnapshot: string | null;
        approvedById: string | null;
    }>;
}
export {};
