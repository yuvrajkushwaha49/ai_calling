import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export declare class AuditService {
    private prisma;
    constructor(prisma: PrismaService);
    log(input: {
        actorId?: string | null;
        action: string;
        entityType: string;
        entityId?: string | null;
        details?: Record<string, unknown>;
    }): Promise<{
        id: string;
        createdAt: Date;
        action: string;
        entityType: string;
        entityId: string | null;
        details: Prisma.JsonValue | null;
        actorId: string | null;
    }>;
    findRecent(limit?: number): Prisma.PrismaPromise<({
        actor: {
            email: string;
            name: string;
            id: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        action: string;
        entityType: string;
        entityId: string | null;
        details: Prisma.JsonValue | null;
        actorId: string | null;
    })[]>;
}
