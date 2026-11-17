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
  eventId?: string | null;
  htmlLink?: string | null;
  hangoutLink?: string | null;
  success: boolean;
  errorCode?: 'invalid_grant' | 'auth_error' | 'transient_error' | 'config_missing' | string;
  errorMessage?: string;
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

  /** Create a calendar event for a site visit / meeting with robust failure handling. */
  async createEvent(
    input: CalendarEventInput,
  ): Promise<CalendarEventResult> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Google Calendar not configured — set GOOGLE_CALENDAR_CLIENT_ID/SECRET/REFRESH_TOKEN',
      );
      return {
        success: false,
        errorCode: 'config_missing',
        errorMessage: 'Google Calendar credentials not configured in backend/.env',
      };
    }
    const calendar = this.getCalendar();
    if (!calendar) {
      return {
        success: false,
        errorCode: 'auth_error',
        errorMessage: 'Failed to initialize Google OAuth2 client',
      };
    }

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
          return {
            success: false,
            errorCode: 'transient_error',
            errorMessage: 'Google Calendar returned no event id',
          };
        }
        this.logger.log(`Google Calendar event created: ${eventId}`);
        return {
          success: true,
          eventId,
          htmlLink: res.data.htmlLink,
          hangoutLink: res.data.hangoutLink,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const isInvalidGrant = /invalid_grant/i.test(errMsg);

        if (isInvalidGrant) {
          this.logger.error(
            `[GoogleCalendar] 🚨 AUTHENTICATION FAILED: invalid_grant detected. Refresh token expired, revoked, or invalid. Re-authenticate in backend/.env!`,
          );
          return {
            success: false,
            errorCode: 'invalid_grant',
            errorMessage: 'OAuth token invalid/expired (invalid_grant)',
          };
        }

        const isTransient = /timeout|econnreset|econnrefused|500|502|503/i.test(errMsg);
        if (isTransient && attempt < maxRetries) {
          this.logger.warn(
            `[GoogleCalendar] Transient error (attempt ${attempt + 1}/${maxRetries}): ${errMsg}. Retrying in 500ms...`,
          );
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        this.logger.warn(`Google Calendar create failed: ${errMsg}`);
        return {
          success: false,
          errorCode: isTransient ? 'transient_error' : 'calendar_error',
          errorMessage: errMsg,
        };
      }
    }

    return {
      success: false,
      errorCode: 'transient_error',
      errorMessage: 'Max Google Calendar retries exceeded',
    };
  }
}
