import { KnowledgeSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';
export declare class KnowledgeService {
    private prisma;
    private llm;
    private audit;
    private readonly logger;
    private readonly uploadsDir;
    private readonly chunkCache;
    private readonly chunkCacheTtlMs;
    constructor(prisma: PrismaService, llm: LlmService, audit: AuditService);
    invalidateProjectCache(projectId: string): void;
    private loadChunks;
    listByProject(projectId: string): Prisma.PrismaPromise<({
        _count: {
            chunks: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: Prisma.JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    })[]>;
    getSource(id: string): Promise<{
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: Prisma.JsonValue | null;
            embedding: Prisma.JsonValue | null;
            sourceId: string;
            chunkIndex: number;
            tokenCount: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: Prisma.JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }>;
    addWebsite(input: {
        projectId: string;
        url: string;
        title?: string;
        actorId?: string;
    }): Promise<{
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: Prisma.JsonValue | null;
            embedding: Prisma.JsonValue | null;
            sourceId: string;
            chunkIndex: number;
            tokenCount: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: Prisma.JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }>;
    addTextDocument(input: {
        projectId: string;
        title: string;
        text: string;
        sourceType?: KnowledgeSourceType;
        actorId?: string;
    }): Promise<{
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: Prisma.JsonValue | null;
            embedding: Prisma.JsonValue | null;
            sourceId: string;
            chunkIndex: number;
            tokenCount: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: Prisma.JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }>;
    uploadFile(input: {
        projectId: string;
        file: Express.Multer.File;
        title?: string;
        sourceType?: KnowledgeSourceType;
        actorId?: string;
    }): Promise<{
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: Prisma.JsonValue | null;
            embedding: Prisma.JsonValue | null;
            sourceId: string;
            chunkIndex: number;
            tokenCount: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: Prisma.JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }>;
    reprocess(sourceId: string, actorId?: string): Promise<{
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: Prisma.JsonValue | null;
            embedding: Prisma.JsonValue | null;
            sourceId: string;
            chunkIndex: number;
            tokenCount: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: Prisma.JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }>;
    remove(sourceId: string, actorId?: string): Promise<{
        ok: boolean;
    }>;
    retrieve(projectId: string, query: string, topK?: number, options?: {
        lexicalOnly?: boolean;
    }): Promise<{
        id: string;
        content: string;
        score: number;
        source: {
            id: string;
            title: string;
            sourceType: KnowledgeSourceType;
            sourceUrl: string | null;
            fileName: string | null;
        };
    }[]>;
    ensureProjectWebsiteKnowledge(projectId: string, actorId?: string): Promise<({
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: Prisma.JsonValue | null;
            embedding: Prisma.JsonValue | null;
            sourceId: string;
            chunkIndex: number;
            tokenCount: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: Prisma.JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }) | ({
        _count: {
            chunks: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: Prisma.JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }) | null>;
    private lexicalScore;
    private chunkText;
    private ingestText;
    private fetchWebsiteText;
}
