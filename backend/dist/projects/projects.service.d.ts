import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
export declare class ProjectsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
        _count: {
            appointments: number;
            leads: number;
        };
    } & {
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
    })[]>;
    findOne(id: string): Promise<{
        _count: {
            appointments: number;
            leads: number;
        };
        appointments: ({
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
        })[];
        leads: {
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
        }[];
    } & {
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
    }>;
    create(dto: CreateProjectDto): import("@prisma/client").Prisma.Prisma__ProjectClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, dto: UpdateProjectDto): Promise<{
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
    }>;
    remove(id: string): Promise<{
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
    }>;
}
