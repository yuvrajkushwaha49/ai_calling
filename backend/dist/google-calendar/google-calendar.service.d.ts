import { ConfigService } from '@nestjs/config';
export type CalendarEventInput = {
    summary: string;
    description?: string;
    startIso: string;
    endIso: string;
    attendeeEmail?: string | null;
    location?: string | null;
};
export type CalendarEventResult = {
    eventId?: string | null;
    htmlLink?: string | null;
    hangoutLink?: string | null;
    success: boolean;
    errorCode?: 'invalid_grant' | 'auth_error' | 'transient_error' | 'config_missing' | string;
    errorMessage?: string;
};
export declare class GoogleCalendarService {
    private config;
    private readonly logger;
    constructor(config: ConfigService);
    isConfigured(): boolean;
    private getCalendarId;
    private getAuthClient;
    private getCalendar;
    createEvent(input: CalendarEventInput): Promise<CalendarEventResult>;
}
