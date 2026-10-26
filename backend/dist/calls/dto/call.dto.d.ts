import { CallOutcome } from '@prisma/client';
export declare class CreateCallDto {
    leadId: string;
    duration?: number;
    transcript?: string;
    summary?: string;
    recordingUrl?: string;
    outcome?: CallOutcome;
}
export declare class UpdateCallDto {
    duration?: number;
    transcript?: string;
    summary?: string;
    recordingUrl?: string;
    outcome?: CallOutcome;
}
