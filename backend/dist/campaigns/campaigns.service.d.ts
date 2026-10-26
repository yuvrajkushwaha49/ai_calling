import { CampaignStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CallsService } from '../calls/calls.service';
import { AuditService } from '../audit/audit.service';
import { AiService } from '../ai/ai.service';
export declare class CampaignsService {
    private prisma;
    private calls;
    private audit;
    private ai;
    constructor(prisma: PrismaService, calls: CallsService, audit: AuditService, ai: AiService);
    list(): Prisma.PrismaPromise<({
        project: {
            name: string;
            id: string;
        } | null;
        _count: {
            calls: number;
            queueItems: number;
        };
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CampaignStatus;
        projectId: string | null;
        workingHours: Prisma.JsonValue | null;
        timezone: string;
        scheduledAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        maxRetries: number;
        retryDelayMins: number;
        filterJson: Prisma.JsonValue | null;
        createdById: string | null;
    })[]>;
    get(id: string): Promise<{
        project: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            propertyType: import("@prisma/client").$Enums.PropertyType;
            companyName: string;
            location: string;
            builder: string;
            startingPrice: number;
            endingPrice: number;
            possessionDate: Date | null;
            reraNumber: string | null;
            amenities: Prisma.JsonValue | null;
            description: string | null;
            websiteUrl: string | null;
        } | null;
        queueItems: ({
            lead: {
                name: string;
                id: string;
                phone: string;
                status: import("@prisma/client").$Enums.LeadStatus;
                doNotCall: boolean;
            };
            call: {
                id: string;
                status: import("@prisma/client").$Enums.CallStatus;
                outcome: import("@prisma/client").$Enums.CallOutcome;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.QueueItemStatus;
            leadId: string;
            campaignId: string;
            callId: string | null;
            attempts: number;
            nextAttempt: Date | null;
            lastError: string | null;
        })[];
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CampaignStatus;
        projectId: string | null;
        workingHours: Prisma.JsonValue | null;
        timezone: string;
        scheduledAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        maxRetries: number;
        retryDelayMins: number;
        filterJson: Prisma.JsonValue | null;
        createdById: string | null;
    }>;
    create(input: {
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
    }): Promise<{
        project: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            propertyType: import("@prisma/client").$Enums.PropertyType;
            companyName: string;
            location: string;
            builder: string;
            startingPrice: number;
            endingPrice: number;
            possessionDate: Date | null;
            reraNumber: string | null;
            amenities: Prisma.JsonValue | null;
            description: string | null;
            websiteUrl: string | null;
        } | null;
        queueItems: ({
            lead: {
                name: string;
                id: string;
                phone: string;
                status: import("@prisma/client").$Enums.LeadStatus;
                doNotCall: boolean;
            };
            call: {
                id: string;
                status: import("@prisma/client").$Enums.CallStatus;
                outcome: import("@prisma/client").$Enums.CallOutcome;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.QueueItemStatus;
            leadId: string;
            campaignId: string;
            callId: string | null;
            attempts: number;
            nextAttempt: Date | null;
            lastError: string | null;
        })[];
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CampaignStatus;
        projectId: string | null;
        workingHours: Prisma.JsonValue | null;
        timezone: string;
        scheduledAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        maxRetries: number;
        retryDelayMins: number;
        filterJson: Prisma.JsonValue | null;
        createdById: string | null;
    }>;
    setStatus(id: string, status: CampaignStatus, actorId?: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CampaignStatus;
        projectId: string | null;
        workingHours: Prisma.JsonValue | null;
        timezone: string;
        scheduledAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        maxRetries: number;
        retryDelayMins: number;
        filterJson: Prisma.JsonValue | null;
        createdById: string | null;
    }>;
    processDue(limit?: number): Promise<{
        processed: number;
        skipped: string;
    } | {
        processed: number;
        skipped?: undefined;
    }>;
    private withinWorkingHours;
}
