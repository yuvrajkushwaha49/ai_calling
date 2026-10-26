import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto, CreateLeadNoteDto, LeadQueryDto } from './dto/lead.dto';
export declare class LeadsController {
    private leadsService;
    constructor(leadsService: LeadsService);
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
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        budget: number | null;
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
        leadNotes: ({
            user: {
                name: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            content: string;
            leadId: string;
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
            description: string;
            leadId: string;
            userId: string | null;
            type: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
        })[];
        calls: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.CallStatus;
            projectId: string | null;
            interestScore: number | null;
            suggestedNextAction: string | null;
            leadId: string;
            campaignId: string | null;
            duration: number;
            transcript: string | null;
            summary: string | null;
            recordingUrl: string | null;
            outcome: import("@prisma/client").$Enums.CallOutcome;
            provider: string;
            providerCallId: string | null;
            greetingText: string | null;
            languageDetected: string | null;
            qualificationJson: import("@prisma/client/runtime/library").JsonValue | null;
            sourcesJson: import("@prisma/client/runtime/library").JsonValue | null;
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
            status: import("@prisma/client").$Enums.AppointmentStatus;
            notes: string | null;
            projectId: string | null;
            date: Date;
            leadId: string;
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
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        budget: number | null;
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
    create(dto: CreateLeadDto): import("@prisma/client").Prisma.Prisma__LeadClient<{
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
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        budget: number | null;
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    createBulk(body: {
        leads: CreateLeadDto[];
    }): Promise<({
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
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        budget: number | null;
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
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        budget: number | null;
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
        phone: string;
        source: import("@prisma/client").$Enums.LeadSource;
        budget: number | null;
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
    addNote(id: string, userId: string, dto: CreateLeadNoteDto): Promise<{
        user: {
            name: string;
            id: string;
        };
    } & {
        id: string;
        createdAt: Date;
        content: string;
        leadId: string;
        userId: string;
    }>;
}
