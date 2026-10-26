import { LeadSource, LeadStatus, PropertyType } from '@prisma/client';
export declare class CreateLeadDto {
    name: string;
    phone: string;
    email?: string;
    source?: LeadSource;
    budget?: number;
    propertyType?: PropertyType;
    status?: LeadStatus;
    notes?: string;
    projectId?: string;
}
export declare class UpdateLeadDto {
    name?: string;
    phone?: string;
    email?: string;
    source?: LeadSource;
    budget?: number;
    propertyType?: PropertyType;
    status?: LeadStatus;
    notes?: string;
    projectId?: string;
    aiSummary?: string;
}
export declare class CreateLeadNoteDto {
    content: string;
}
export declare class LeadQueryDto {
    search?: string;
    status?: LeadStatus;
    projectId?: string;
    minBudget?: number;
    maxBudget?: number;
}
