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
var AppointmentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const google_calendar_service_1 = require("../google-calendar/google-calendar.service");
const meeting_time_1 = require("./meeting-time");
let AppointmentsService = AppointmentsService_1 = class AppointmentsService {
    prisma;
    googleCalendar;
    logger = new common_1.Logger(AppointmentsService_1.name);
    constructor(prisma, googleCalendar) {
        this.prisma = prisma;
        this.googleCalendar = googleCalendar;
    }
    findAll(status) {
        return this.prisma.appointment.findMany({
            where: status ? { status } : undefined,
            include: {
                lead: { select: { id: true, name: true, phone: true, email: true } },
                project: { select: { id: true, name: true, location: true } },
            },
            orderBy: { date: 'asc' },
        });
    }
    async findOne(id) {
        const appointment = await this.prisma.appointment.findUnique({
            where: { id },
            include: {
                lead: true,
                project: true,
            },
        });
        if (!appointment)
            throw new common_1.NotFoundException('Appointment not found');
        return appointment;
    }
    async create(dto) {
        const appointment = await this.prisma.appointment.create({
            data: {
                leadId: dto.leadId,
                projectId: dto.projectId,
                date: new Date(dto.date),
                time: dto.time,
                status: dto.status,
                notes: dto.notes,
            },
            include: {
                lead: { select: { id: true, name: true, phone: true, email: true } },
                project: { select: { id: true, name: true, location: true } },
            },
        });
        const cal = await this.syncToGoogleCalendar({
            appointmentId: appointment.id,
            leadName: appointment.lead.name,
            leadEmail: appointment.lead.email,
            projectName: appointment.project?.name,
            projectLocation: appointment.project?.location,
            date: dto.date.slice(0, 10),
            time: dto.time,
            notes: dto.notes,
            startIso: this.guessStartIso(dto.date, dto.time),
            endIso: this.guessEndIso(dto.date, dto.time),
        });
        await this.prisma.activity.create({
            data: {
                leadId: dto.leadId,
                type: 'APPOINTMENT_SCHEDULED',
                description: `Site visit scheduled for ${dto.date} at ${dto.time}${cal?.htmlLink ? ' (Google Calendar synced)' : ''}`,
            },
        });
        return this.findOne(appointment.id);
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.appointment.update({
            where: { id },
            data: {
                ...dto,
                date: dto.date ? new Date(dto.date) : undefined,
            },
            include: {
                lead: { select: { id: true, name: true, phone: true } },
                project: { select: { id: true, name: true } },
            },
        });
    }
    async remove(id) {
        await this.findOne(id);
        return this.prisma.appointment.delete({ where: { id } });
    }
    async maybeBookFromCall(options) {
        const msg = options.userMessage || '';
        const qual = options.qualification || {};
        const interested = Boolean(qual.siteVisitInterest) ||
            /SITE_VISIT|CALLBACK|meeting|visit|appointment|book|fix|meeting|मिल|विजिट|visit|callback/i.test(String(qual.outcome || '')) ||
            (0, meeting_time_1.looksLikeMeetingRequest)(msg);
        if (!interested && !(0, meeting_time_1.looksLikeMeetingRequest)(msg)) {
            return { booked: false, reason: 'no_meeting_intent' };
        }
        const slot = (0, meeting_time_1.parseMeetingSlot)(msg, options.priorTranscript) ||
            (typeof qual.meetingAt === 'string'
                ? this.slotFromIso(String(qual.meetingAt))
                : null);
        if (!slot) {
            return { booked: false, reason: 'no_datetime' };
        }
        const dayStart = new Date(`${slot.date}T00:00:00+05:30`);
        const dayEnd = new Date(`${slot.date}T23:59:59+05:30`);
        const existing = await this.prisma.appointment.findFirst({
            where: {
                leadId: options.leadId,
                status: client_1.AppointmentStatus.SCHEDULED,
                date: { gte: dayStart, lte: dayEnd },
                time: slot.time,
            },
        });
        if (existing) {
            return {
                booked: true,
                appointmentId: existing.id,
                date: slot.date,
                time: slot.time,
                googleLink: existing.googleLink,
                calendarSynced: Boolean(existing.googleEventId),
                label: slot.label,
                reason: 'already_exists',
            };
        }
        const lead = await this.prisma.lead.findUnique({
            where: { id: options.leadId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                projectId: true,
                project: { select: { id: true, name: true, location: true } },
            },
        });
        if (!lead)
            return { booked: false, reason: 'lead_missing' };
        const projectId = options.projectId || lead.projectId || undefined;
        const appointment = await this.prisma.appointment.create({
            data: {
                leadId: lead.id,
                projectId,
                date: new Date(`${slot.date}T12:00:00+05:30`),
                time: slot.time,
                status: client_1.AppointmentStatus.SCHEDULED,
                notes: `Auto-booked from AI call. Customer said: "${msg.slice(0, 160)}"`,
            },
        });
        const cal = await this.syncToGoogleCalendar({
            appointmentId: appointment.id,
            leadName: lead.name,
            leadEmail: lead.email,
            projectName: lead.project?.name,
            projectLocation: lead.project?.location,
            date: slot.date,
            time: slot.time,
            notes: appointment.notes || undefined,
            startIso: slot.startIso,
            endIso: slot.endIso,
        });
        await this.prisma.activity.create({
            data: {
                leadId: lead.id,
                type: 'APPOINTMENT_SCHEDULED',
                description: `AI call booked meeting ${slot.label}${cal?.htmlLink ? ' · Google Calendar' : ''}`,
                metadata: {
                    appointmentId: appointment.id,
                    googleEventId: cal?.eventId || null,
                    source: 'ai_call',
                },
            },
        });
        await this.prisma.lead.update({
            where: { id: lead.id },
            data: {
                siteVisitInterest: true,
                callbackAt: new Date(slot.startIso),
                status: 'SITE_VISIT_INTERESTED',
                suggestedNextAction: `Site visit ${slot.label}`,
            },
        });
        this.logger.log(`Booked appointment ${appointment.id} for lead ${lead.id} at ${slot.label}`);
        return {
            booked: true,
            appointmentId: appointment.id,
            date: slot.date,
            time: slot.time,
            googleLink: cal?.htmlLink || null,
            calendarSynced: Boolean(cal?.eventId),
            label: slot.label,
        };
    }
    slotFromIso(iso) {
        const ms = Date.parse(iso);
        if (Number.isNaN(ms))
            return null;
        const d = new Date(ms);
        const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const time = d.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
        const startIso = iso.includes('+') || iso.endsWith('Z') ? iso : `${iso}+05:30`;
        const end = new Date(ms + 60 * 60 * 1000);
        const endIso = end.toISOString().replace(/\.\d{3}Z$/, '+05:30');
        return { date, time, startIso, endIso, label: `${date} ${time}` };
    }
    guessStartIso(date, time) {
        const parsed = (0, meeting_time_1.parseMeetingSlot)(`${date} ${time}`);
        if (parsed)
            return parsed.startIso;
        const day = date.slice(0, 10);
        return `${day}T11:00:00+05:30`;
    }
    guessEndIso(date, time) {
        const parsed = (0, meeting_time_1.parseMeetingSlot)(`${date} ${time}`);
        if (parsed)
            return parsed.endIso;
        const day = date.slice(0, 10);
        return `${day}T12:00:00+05:30`;
    }
    async syncToGoogleCalendar(input) {
        const cal = await this.googleCalendar.createEvent({
            summary: `Site visit — ${input.leadName}${input.projectName ? ` · ${input.projectName}` : ''}`,
            description: [
                `Lead: ${input.leadName}`,
                input.projectName ? `Project: ${input.projectName}` : null,
                `When: ${input.date} ${input.time} (IST)`,
                input.notes || null,
                'Booked automatically by AI Calling CRM',
            ]
                .filter(Boolean)
                .join('\n'),
            startIso: input.startIso,
            endIso: input.endIso,
            attendeeEmail: input.leadEmail,
            location: input.projectLocation,
        });
        if (cal?.eventId) {
            await this.prisma.appointment.update({
                where: { id: input.appointmentId },
                data: {
                    googleEventId: cal.eventId,
                    googleLink: cal.htmlLink || cal.hangoutLink || null,
                },
            });
        }
        return cal;
    }
    confirmationLine(booking, language) {
        if (!booking.booked || !booking.date || !booking.time)
            return null;
        const lang = (language || 'hi-IN').toLowerCase();
        if (lang.startsWith('en')) {
            return booking.calendarSynced
                ? `I've booked your meeting for ${booking.date} at ${booking.time} and added it to the calendar.`
                : `I've noted your meeting for ${booking.date} at ${booking.time}.`;
        }
        return booking.calendarSynced
            ? `मैंने आपकी मीटिंग ${booking.date} को ${booking.time} पर calendar में सेट कर दी है।`
            : `मैंने आपकी मीटिंग ${booking.date} को ${booking.time} पर नोट कर ली है।`;
    }
};
exports.AppointmentsService = AppointmentsService;
exports.AppointmentsService = AppointmentsService = AppointmentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        google_calendar_service_1.GoogleCalendarService])
], AppointmentsService);
//# sourceMappingURL=appointments.service.js.map