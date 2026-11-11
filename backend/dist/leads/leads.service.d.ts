import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerMemoryService } from '../memory/customer-memory.service';
import { CreateLeadDto, UpdateLeadDto, CreateLeadNoteDto, LeadQueryDto } from './dto/lead.dto';
export declare class LeadsService {
    private prisma;
    private customerMemory;
    constructor(prisma: PrismaService, customerMemory: CustomerMemoryService);
    findAll(query: LeadQueryDto): Promise<({
        project: {
            name: string;
            id: string;
            location: string;
        } | null;
        _count: {
            calls: number;
            appointments: number;
        };
    } & {
        email: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        budget: number | null;
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        propertyType: import("@prisma/client").$Enums.PropertyType | null;
        status: import("@prisma/client").$Enums.LeadStatus;
        notes: string | null;
        projectId: string | null;
        aiSummary: string | null;
        preferredLanguage: string | null;
        preferredLocation: string | null;
        bhkPreference: string | null;
        purchaseTimeline: string | null;
        interestLevel: string | null;
        interestScore: number | null;
        objections: string | null;
        siteVisitInterest: boolean;
        callbackAt: Date | null;
        doNotCall: boolean;
        consentToCall: boolean;
        suggestedNextAction: string | null;
        lastQualifiedAt: Date | null;
    })[]>;
    findOne(id: string): Promise<{
        project: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            location: string;
            propertyType: import("@prisma/client").$Enums.PropertyType;
            companyName: string;
            builder: string;
            startingPrice: number;
            endingPrice: number;
            possessionDate: Date | null;
            reraNumber: string | null;
            amenities: Prisma.JsonValue | null;
            description: string | null;
            websiteUrl: string | null;
        } | null;
        leadNotes: ({
            user: {
                name: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            leadId: string;
            content: string;
            userId: string;
        })[];
        activities: ({
            user: {
                name: string;
                id: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            type: string;
            leadId: string;
            description: string;
            userId: string | null;
            metadata: Prisma.JsonValue | null;
        })[];
        calls: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            summary: string | null;
            leadId: string;
            status: import("@prisma/client").$Enums.CallStatus;
            projectId: string | null;
            interestScore: number | null;
            suggestedNextAction: string | null;
            campaignId: string | null;
            duration: number;
            transcript: string | null;
            recordingUrl: string | null;
            outcome: import("@prisma/client").$Enums.CallOutcome;
            provider: string;
            providerCallId: string | null;
            greetingText: string | null;
            languageDetected: string | null;
            qualificationJson: Prisma.JsonValue | null;
            sourcesJson: Prisma.JsonValue | null;
        }[];
        appointments: ({
            project: {
                name: string;
                id: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string;
            status: import("@prisma/client").$Enums.AppointmentStatus;
            notes: string | null;
            projectId: string | null;
            date: Date;
            time: string;
            googleEventId: string | null;
            googleLink: string | null;
        })[];
    } & {
        email: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        budget: number | null;
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        propertyType: import("@prisma/client").$Enums.PropertyType | null;
        status: import("@prisma/client").$Enums.LeadStatus;
        notes: string | null;
        projectId: string | null;
        aiSummary: string | null;
        preferredLanguage: string | null;
        preferredLocation: string | null;
        bhkPreference: string | null;
        purchaseTimeline: string | null;
        interestLevel: string | null;
        interestScore: number | null;
        objections: string | null;
        siteVisitInterest: boolean;
        callbackAt: Date | null;
        doNotCall: boolean;
        consentToCall: boolean;
        suggestedNextAction: string | null;
        lastQualifiedAt: Date | null;
    }>;
    create(dto: CreateLeadDto): Prisma.Prisma__LeadClient<{
        project: {
            name: string;
            id: string;
        } | null;
    } & {
        email: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        budget: number | null;
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        propertyType: import("@prisma/client").$Enums.PropertyType | null;
        status: import("@prisma/client").$Enums.LeadStatus;
        notes: string | null;
        projectId: string | null;
        aiSummary: string | null;
        preferredLanguage: string | null;
        preferredLocation: string | null;
        bhkPreference: string | null;
        purchaseTimeline: string | null;
        interestLevel: string | null;
        interestScore: number | null;
        objections: string | null;
        siteVisitInterest: boolean;
        callbackAt: Date | null;
        doNotCall: boolean;
        consentToCall: boolean;
        suggestedNextAction: string | null;
        lastQualifiedAt: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    createBulk(dtos: CreateLeadDto[]): Promise<({
        project: {
            name: string;
            id: string;
        } | null;
    } & {
        email: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        budget: number | null;
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        propertyType: import("@prisma/client").$Enums.PropertyType | null;
        status: import("@prisma/client").$Enums.LeadStatus;
        notes: string | null;
        projectId: string | null;
        aiSummary: string | null;
        preferredLanguage: string | null;
        preferredLocation: string | null;
        bhkPreference: string | null;
        purchaseTimeline: string | null;
        interestLevel: string | null;
        interestScore: number | null;
        objections: string | null;
        siteVisitInterest: boolean;
        callbackAt: Date | null;
        doNotCall: boolean;
        consentToCall: boolean;
        suggestedNextAction: string | null;
        lastQualifiedAt: Date | null;
    })[]>;
    update(id: string, dto: UpdateLeadDto): Promise<{
        project: {
            name: string;
            id: string;
        } | null;
    } & {
        email: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        budget: number | null;
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        propertyType: import("@prisma/client").$Enums.PropertyType | null;
        status: import("@prisma/client").$Enums.LeadStatus;
        notes: string | null;
        projectId: string | null;
        aiSummary: string | null;
        preferredLanguage: string | null;
        preferredLocation: string | null;
        bhkPreference: string | null;
        purchaseTimeline: string | null;
        interestLevel: string | null;
        interestScore: number | null;
        objections: string | null;
        siteVisitInterest: boolean;
        callbackAt: Date | null;
        doNotCall: boolean;
        consentToCall: boolean;
        suggestedNextAction: string | null;
        lastQualifiedAt: Date | null;
    }>;
    remove(id: string): Promise<{
        email: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        budget: number | null;
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        propertyType: import("@prisma/client").$Enums.PropertyType | null;
        status: import("@prisma/client").$Enums.LeadStatus;
        notes: string | null;
        projectId: string | null;
        aiSummary: string | null;
        preferredLanguage: string | null;
        preferredLocation: string | null;
        bhkPreference: string | null;
        purchaseTimeline: string | null;
        interestLevel: string | null;
        interestScore: number | null;
        objections: string | null;
        siteVisitInterest: boolean;
        callbackAt: Date | null;
        doNotCall: boolean;
        consentToCall: boolean;
        suggestedNextAction: string | null;
        lastQualifiedAt: Date | null;
    }>;
    addNote(leadId: string, userId: string, dto: CreateLeadNoteDto): Promise<{
        user: {
            name: string;
            id: string;
        };
    } & {
        id: string;
        createdAt: Date;
        leadId: string;
        content: string;
        userId: string;
    }>;
}
