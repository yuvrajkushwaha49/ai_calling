"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GoogleCalendarService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCalendarService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const googleapis_1 = require("googleapis");
let GoogleCalendarService = GoogleCalendarService_1 = class GoogleCalendarService {
    config;
    logger = new common_1.Logger(GoogleCalendarService_1.name);
    constructor(config) {
        this.config = config;
    }
    isConfigured() {
        const clientId = this.config.get('GOOGLE_CALENDAR_CLIENT_ID')?.trim();
        const clientSecret = this.config
            .get('GOOGLE_CALENDAR_CLIENT_SECRET')
            ?.trim();
        const refreshToken = this.config
            .get('GOOGLE_CALENDAR_REFRESH_TOKEN')
            ?.trim();
        return Boolean(clientId && clientSecret && refreshToken);
    }
    getCalendarId() {
        return (this.config.get('GOOGLE_CALENDAR_ID')?.trim() || 'primary');
    }
    getAuthClient() {
        const clientId = this.config.get('GOOGLE_CALENDAR_CLIENT_ID')?.trim();
        const clientSecret = this.config
            .get('GOOGLE_CALENDAR_CLIENT_SECRET')
            ?.trim();
        const refreshToken = this.config
            .get('GOOGLE_CALENDAR_REFRESH_TOKEN')
            ?.trim();
        if (!clientId || !clientSecret || !refreshToken) {
            return null;
        }
        const oauth2 = new googleapis_1.google.auth.OAuth2(clientId, clientSecret);
        oauth2.setCredentials({ refresh_token: refreshToken });
        return oauth2;
    }
    getCalendar() {
        const auth = this.getAuthClient();
        if (!auth)
            return null;
        return googleapis_1.google.calendar({ version: 'v3', auth });
    }
    async createEvent(input) {
        if (!this.isConfigured()) {
            this.logger.warn('Google Calendar not configured — set GOOGLE_CALENDAR_CLIENT_ID/SECRET/REFRESH_TOKEN');
            return null;
        }
        const calendar = this.getCalendar();
        if (!calendar)
            return null;
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
        }
        catch (error) {
            this.logger.warn(`Google Calendar create failed: ${error instanceof Error ? error.message : error}`);
            return null;
        }
    }
};
exports.GoogleCalendarService = GoogleCalendarService;
exports.GoogleCalendarService = GoogleCalendarService = GoogleCalendarService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GoogleCalendarService);
//# sourceMappingURL=google-calendar.service.js.map