import { KnowledgeSourceType } from '@prisma/client';
import { KnowledgeService } from './knowledge.service';
declare class AddWebsiteDto {
    projectId: string;
    url: string;
    title?: string;
}
declare class AddTextDto {
    projectId: string;
    title: string;
    text: string;
    sourceType?: KnowledgeSourceType;
}
export declare class KnowledgeController {
    private knowledge;
    constructor(knowledge: KnowledgeService);
    list(projectId: string): import("@prisma/client").Prisma.PrismaPromise<({
        _count: {
            chunks: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.KnowledgeStatus;
        projectId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    })[]>;
    get(id: string): Promise<{
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            embedding: import("@prisma/client/runtime/library").JsonValue | null;
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
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }>;
    addWebsite(dto: AddWebsiteDto, userId: string): Promise<{
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            embedding: import("@prisma/client/runtime/library").JsonValue | null;
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
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }>;
    addText(dto: AddTextDto, userId: string): Promise<{
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            embedding: import("@prisma/client/runtime/library").JsonValue | null;
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
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }>;
    upload(file: Express.Multer.File, projectId: string, title: string | undefined, sourceType: KnowledgeSourceType | undefined, userId: string): Promise<{
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            embedding: import("@prisma/client/runtime/library").JsonValue | null;
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
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }>;
    reprocess(id: string, userId: string): Promise<{
        project: {
            name: string;
            id: string;
        };
        chunks: {
            id: string;
            createdAt: Date;
            projectId: string;
            content: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            embedding: import("@prisma/client/runtime/library").JsonValue | null;
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
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        fileName: string | null;
        filePath: string | null;
        mimeType: string | null;
        title: string;
        sourceType: import("@prisma/client").$Enums.KnowledgeSourceType;
        sourceUrl: string | null;
        rawText: string | null;
        errorMessage: string | null;
    }>;
    remove(id: string, userId: string): Promise<{
        ok: boolean;
    }>;
}
export {};
