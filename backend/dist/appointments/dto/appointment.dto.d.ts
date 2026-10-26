import { AppointmentStatus } from '@prisma/client';
export declare class CreateAppointmentDto {
    leadId: string;
    projectId?: string;
    date: string;
    time: string;
    status?: AppointmentStatus;
    notes?: string;
}
export declare class UpdateAppointmentDto {
    projectId?: string;
    date?: string;
    time?: string;
    status?: AppointmentStatus;
    notes?: string;
}
