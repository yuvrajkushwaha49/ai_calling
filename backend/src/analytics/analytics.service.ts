import { Injectable } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalLeads,
      callsToday,
      qualifiedLeads,
      appointments,
      convertedLeads,
      recentActivities,
      leadSources,
      callsByDay,
    ] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.call.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      this.prisma.lead.count({ where: { status: LeadStatus.QUALIFIED } }),
      this.prisma.appointment.count({
        where: { status: 'SCHEDULED', date: { gte: today } },
      }),
      this.prisma.lead.count({ where: { status: LeadStatus.CONVERTED } }),
      this.prisma.activity.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          lead: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.lead.groupBy({
        by: ['source'],
        _count: { source: true },
      }),
      this.getCallsAnalytics(7),
    ]);

    const revenue = convertedLeads * 50000;

    return {
      totalLeads,
      callsToday,
      qualifiedLeads,
      appointments,
      revenue,
      recentActivities,
      leadSources: leadSources.map((s) => ({
        source: s.source,
        count: s._count.source,
      })),
      callsAnalytics: callsByDay,
    };
  }

  async getFullAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      dailyCalls,
      monthlyCalls,
      qualifiedLeads,
      totalLeads,
      convertedLeads,
      projectPerformance,
    ] = await Promise.all([
      this.getCallsAnalytics(30),
      this.getMonthlyCalls(),
      this.prisma.lead.count({ where: { status: LeadStatus.QUALIFIED } }),
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { status: LeadStatus.CONVERTED } }),
      this.prisma.project.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { leads: true, appointments: true } },
        },
        orderBy: { leads: { _count: 'desc' } },
        take: 10,
      }),
    ]);

    const conversionRate =
      totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    return {
      dailyCalls,
      monthlyCalls,
      qualifiedLeads,
      conversionRate,
      projectPerformance: projectPerformance.map((p) => ({
        id: p.id,
        name: p.name,
        leads: p._count.leads,
        appointments: p._count.appointments,
      })),
      agentPerformance: await this.getAgentPerformance(),
    };
  }

  private async getCallsAnalytics(days: number) {
    const result: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await this.prisma.call.count({
        where: { createdAt: { gte: date, lt: nextDate } },
      });
      result.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }
    return result;
  }

  private async getMonthlyCalls() {
    const result: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      const nextMonth = new Date(date);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const count = await this.prisma.call.count({
        where: { createdAt: { gte: date, lt: nextMonth } },
      });
      result.push({
        month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
        count,
      });
    }
    return result;
  }

  private async getAgentPerformance() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { activities: true } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      activities: u._count.activities,
    }));
  }
}
