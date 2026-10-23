import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';

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

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private config: ConfigService) {}

  isConfigured(): boolean {
    const clientId = this.config.get<string>('GOOGLE_CALENDAR_CLIENT_ID')?.trim();
    const clientSecret = this.config
      .get<string>('GOOGLE_CALENDAR_CLIENT_SECRET')
      ?.trim();
    const refreshToken = this.config
      .get<string>('GOOGLE_CALENDAR_REFRESH_TOKEN')
      ?.trim();
    return Boolean(clientId && clientSecret && refreshToken);
  }

  private getCalendarId() {
    return (
      this.config.get<string>('GOOGLE_CALENDAR_ID')?.trim() || 'primary'
    );
  }

  private getAuthClient() {
    const clientId = this.config.get<string>('GOOGLE_CALENDAR_CLIENT_ID')?.trim();
    const clientSecret = this.config
      .get<string>('GOOGLE_CALENDAR_CLIENT_SECRET')
      ?.trim();
    const refreshToken = this.config
      .get<string>('GOOGLE_CALENDAR_REFRESH_TOKEN')
      ?.trim();
    if (!clientId || !clientSecret || !refreshToken) {
      return null;
    }
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  private getCalendar(): calendar_v3.Calendar | null {
    const auth = this.getAuthClient();
    if (!auth) return null;
    return google.calendar({ version: 'v3', auth });
  }

  /** Create a calendar event for a site visit / meeting. */
  async createEvent(
    input: CalendarEventInput,
  ): Promise<CalendarEventResult | null> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Google Calendar not configured — set GOOGLE_CALENDAR_CLIENT_ID/SECRET/REFRESH_TOKEN',
      );
      return null;
    }
    const calendar = this.getCalendar();
    if (!calendar) return null;

    try {
      const res = await calendar.events.insert({
        calendarId: this.getCalendarId(),
        requestBody: {
          summary: input.summary,
          description: input.description || '',
          location: input.location || undefined,
          start: { dateTime: input.startIso, timeZone: 'Asia/Kolkata' },
          end: { dateTime: input.endIso, timeZone: 'Asia/Kolkata' },
          attendees: input.attendeeEmail
            ? [{ email: input.attendeeEmail }]
            : undefined,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 30 },
              { method: 'email', minutes: 60 },
            ],
          },
        },
        sendUpdates: input.attendeeEmail ? 'all' : 'none',
      });

      const eventId = res.data.id;
      if (!eventId) {
        this.logger.warn('Google Calendar insert returned no event id');
        return null;
      }
      this.logger.log(`Google Calendar event created: ${eventId}`);
      return {
        eventId,
        htmlLink: res.data.htmlLink,
        hangoutLink: res.data.hangoutLink,
      };
    } catch (error) {
      this.logger.warn(
        `Google Calendar create failed: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }
  }
}
