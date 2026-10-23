import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  CreateLeadNoteDto,
  LeadQueryDto,
} from './dto/lead.dto';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { email: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.minBudget || query.maxBudget) {
      where.budget = {};
      if (query.minBudget) where.budget.gte = query.minBudget;
      if (query.maxBudget) where.budget.lte = query.maxBudget;
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

  async findOne(id: string) {
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
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  create(dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: {
        ...dto,
        budget: dto.budget,
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async createBulk(dtos: CreateLeadDto[]) {
    return this.prisma.$transaction(
      dtos.map((dto) =>
        this.prisma.lead.create({
          data: dto,
          include: { project: { select: { id: true, name: true } } },
        }),
      ),
    );
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.findOne(id);
    return this.prisma.lead.update({
      where: { id },
      data: dto,
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.lead.delete({ where: { id } });
  }

  async addNote(leadId: string, userId: string, dto: CreateLeadNoteDto) {
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
}
