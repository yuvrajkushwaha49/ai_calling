import { AppointmentStatus } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';
export declare class AppointmentsController {
    private appointmentsService;
    constructor(appointmentsService: AppointmentsService);
    findAll(status?: AppointmentStatus): import("@prisma/client").Prisma.PrismaPromise<({
        project: {
            name: string;
            id: string;
            location: string;
        } | null;
        lead: {
            email: string | null;
            name: string;
            id: string;
            phone: string;
        };
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
        lead: {
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
        };
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
    }>;
    create(dto: CreateAppointmentDto): Promise<{
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
        lead: {
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
        };
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
    }>;
    update(id: string, dto: UpdateAppointmentDto): Promise<{
        project: {
            name: string;
            id: string;
        } | null;
        lead: {
            name: string;
            id: string;
            phone: string;
        };
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
    }>;
    remove(id: string): Promise<{
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
    }>;
}
