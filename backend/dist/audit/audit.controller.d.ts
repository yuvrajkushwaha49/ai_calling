import { AuditService } from './audit.service';
export declare class AuditController {
    private audit;
    constructor(audit: AuditService);
    list(limit?: string): import("@prisma/client").Prisma.PrismaPromise<({
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
        details: import("@prisma/client/runtime/library").JsonValue | null;
        actorId: string | null;
    })[]>;
}
