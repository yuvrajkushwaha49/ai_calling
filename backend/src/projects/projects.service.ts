import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
      include: { _count: { select: { leads: true, appointments: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        leads: { take: 10, orderBy: { createdAt: 'desc' } },
        appointments: {
          take: 10,
          include: { lead: { select: { id: true, name: true, phone: true } } },
          orderBy: { date: 'desc' },
        },
        _count: { select: { leads: true, appointments: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        ...dto,
        possessionDate: dto.possessionDate ? new Date(dto.possessionDate) : undefined,
        amenities: dto.amenities || [],
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        possessionDate: dto.possessionDate ? new Date(dto.possessionDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
