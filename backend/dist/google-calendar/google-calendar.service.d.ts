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
    eventId: string;
    htmlLink?: string | null;
    hangoutLink?: string | null;
};
export declare class GoogleCalendarService {
    private config;
    private readonly logger;
    constructor(config: ConfigService);
    isConfigured(): boolean;
    private getCalendarId;
    private getAuthClient;
    private getCalendar;
    createEvent(input: CalendarEventInput): Promise<CalendarEventResult | null>;
}
