import { CampaignStatus } from '@prisma/client';
import { CampaignsService } from './campaigns.service';
declare class CreateCampaignDto {
    name: string;
    projectId?: string;
    leadIds?: string[];
    scheduledAt?: string;
    timezone?: string;
    workingHours?: Record<string, unknown>;
    maxRetries?: number;
    retryDelayMins?: number;
    filterJson?: Record<string, unknown>;
}
export declare class CampaignsController {
    private campaigns;
    constructor(campaigns: CampaignsService);
    list(): import("@prisma/client").Prisma.PrismaPromise<({
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
        workingHours: import("@prisma/client/runtime/library").JsonValue | null;
        timezone: string;
        scheduledAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        maxRetries: number;
        retryDelayMins: number;
        filterJson: import("@prisma/client/runtime/library").JsonValue | null;
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
            amenities: import("@prisma/client/runtime/library").JsonValue | null;
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
        workingHours: import("@prisma/client/runtime/library").JsonValue | null;
        timezone: string;
        scheduledAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        maxRetries: number;
        retryDelayMins: number;
        filterJson: import("@prisma/client/runtime/library").JsonValue | null;
        createdById: string | null;
    }>;
    create(dto: CreateCampaignDto, userId: string): Promise<{
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
            amenities: import("@prisma/client/runtime/library").JsonValue | null;
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
        workingHours: import("@prisma/client/runtime/library").JsonValue | null;
        timezone: string;
        scheduledAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        maxRetries: number;
        retryDelayMins: number;
        filterJson: import("@prisma/client/runtime/library").JsonValue | null;
        createdById: string | null;
    }>;
    setStatus(id: string, status: CampaignStatus, userId: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.CampaignStatus;
        projectId: string | null;
        workingHours: import("@prisma/client/runtime/library").JsonValue | null;
        timezone: string;
        scheduledAt: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        maxRetries: number;
        retryDelayMins: number;
        filterJson: import("@prisma/client/runtime/library").JsonValue | null;
        createdById: string | null;
    }>;
    processDue(): Promise<{
        processed: number;
        skipped: string;
    } | {
        processed: number;
        skipped?: undefined;
    }>;
}
export {};
