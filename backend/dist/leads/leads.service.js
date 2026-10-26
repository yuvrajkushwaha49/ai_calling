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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let LeadsService = class LeadsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(query) {
        const where = {};
        if (query.search) {
            where.OR = [
                { name: { contains: query.search } },
                { email: { contains: query.search } },
                { phone: { contains: query.search } },
            ];
        }
        if (query.status)
            where.status = query.status;
        if (query.projectId)
            where.projectId = query.projectId;
        if (query.minBudget || query.maxBudget) {
            where.budget = {};
            if (query.minBudget)
                where.budget.gte = query.minBudget;
            if (query.maxBudget)
                where.budget.lte = query.maxBudget;
        }
        return this.prisma.lead.findMany({
            where,
            include: {
                project: { select: { id: true, name: true, location: true } },
                _count: { select: { calls: true, appointments: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id) {
        const lead = await this.prisma.lead.findUnique({
            where: { id },
            include: {
                project: true,
                calls: { orderBy: { createdAt: 'desc' } },
                appointments: {
                    include: { project: { select: { id: true, name: true } } },
                    orderBy: { date: 'desc' },
                },
                leadNotes: {
                    include: { user: { select: { id: true, name: true } } },
                    orderBy: { createdAt: 'desc' },
                },
                activities: {
                    include: { user: { select: { id: true, name: true } } },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        return lead;
    }
    create(dto) {
        return this.prisma.lead.create({
            data: {
                ...dto,
                budget: dto.budget,
            },
            include: { project: { select: { id: true, name: true } } },
        });
    }
    async createBulk(dtos) {
        return this.prisma.$transaction(dtos.map((dto) => this.prisma.lead.create({
            data: dto,
            include: { project: { select: { id: true, name: true } } },
        })));
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.lead.update({
            where: { id },
            data: dto,
            include: { project: { select: { id: true, name: true } } },
        });
    }
    async remove(id) {
        await this.findOne(id);
        return this.prisma.lead.delete({ where: { id } });
    }
    async addNote(leadId, userId, dto) {
        await this.findOne(leadId);
        const note = await this.prisma.leadNote.create({
            data: { leadId, userId, content: dto.content },
            include: { user: { select: { id: true, name: true } } },
        });
        await this.prisma.activity.create({
            data: {
                leadId,
                userId,
                type: 'NOTE_ADDED',
                description: 'Note added to lead',
            },
        });
        return note;
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeadsService);
//# sourceMappingURL=leads.service.js.map