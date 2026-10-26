import { PrismaService } from '../prisma/prisma.service';
export declare class AnalyticsService {
    private prisma;
    constructor(prisma: PrismaService);
    getDashboardStats(): Promise<{
        totalLeads: number;
        callsToday: number;
        qualifiedLeads: number;
        appointments: number;
        revenue: number;
        recentActivities: ({
            user: {
                name: string;
                id: string;
            } | null;
            lead: {
                name: string;
                id: string;
            };
        } & {
            id: string;
            createdAt: Date;
            description: string;
            leadId: string;
            userId: string | null;
            type: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
        })[];
        leadSources: {
            source: import("@prisma/client").$Enums.LeadSource;
            count: number;
        }[];
        callsAnalytics: {
            date: string;
            count: number;
        }[];
    }>;
    getFullAnalytics(): Promise<{
        dailyCalls: {
            date: string;
            count: number;
        }[];
        monthlyCalls: {
            month: string;
            count: number;
        }[];
        qualifiedLeads: number;
        conversionRate: number;
        projectPerformance: {
            id: string;
            name: string;
            leads: number;
            appointments: number;
        }[];
        agentPerformance: {
            id: string;
            name: string;
            activities: number;
        }[];
    }>;
    private getCallsAnalytics;
    private getMonthlyCalls;
    private getAgentPerformance;
}
