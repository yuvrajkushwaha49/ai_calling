"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var KnowledgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const llm_service_1 = require("../llm/llm.service");
const audit_service_1 = require("../audit/audit.service");
const pdfParse = require('pdf-parse');
let KnowledgeService = KnowledgeService_1 = class KnowledgeService {
    prisma;
    llm;
    audit;
    logger = new common_1.Logger(KnowledgeService_1.name);
    uploadsDir = path.join(process.cwd(), 'uploads', 'knowledge');
    chunkCache = new Map();
    chunkCacheTtlMs = 60_000;
    constructor(prisma, llm, audit) {
        this.prisma = prisma;
        this.llm = llm;
        this.audit = audit;
        fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    invalidateProjectCache(projectId) {
        this.chunkCache.delete(projectId);
    }
    async loadChunks(projectId) {
        const hit = this.chunkCache.get(projectId);
        if (hit && Date.now() - hit.at < this.chunkCacheTtlMs) {
            return hit.chunks;
        }
        const rows = await this.prisma.projectKnowledgeChunk.findMany({
            where: { projectId },
            include: {
                source: {
                    select: {
                        id: true,
                        title: true,
                        sourceType: true,
                        sourceUrl: true,
                        fileName: true,
                    },
                },
            },
            take: 120,
        });
        const chunks = rows.map((chunk) => ({
            id: chunk.id,
            content: chunk.content,
            embedding: Array.isArray(chunk.embedding)
                ? chunk.embedding
                : null,
            source: chunk.source,
        }));
        this.chunkCache.set(projectId, { at: Date.now(), chunks });
        return chunks;
    }
    listByProject(projectId) {
        return this.prisma.projectKnowledgeSource.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { chunks: true } } },
        });
    }
    async getSource(id) {
        const source = await this.prisma.projectKnowledgeSource.findUnique({
            where: { id },
            include: {
                chunks: { orderBy: { chunkIndex: 'asc' }, take: 50 },
                project: { select: { id: true, name: true } },
            },
        });
        if (!source)
            throw new common_1.NotFoundException('Knowledge source not found');
        return source;
    }
    async addWebsite(input) {
        const project = await this.prisma.project.findUnique({
            where: { id: input.projectId },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const source = await this.prisma.projectKnowledgeSource.create({
            data: {
                projectId: input.projectId,
                title: input.title || input.url,
                sourceType: client_1.KnowledgeSourceType.WEBSITE,
                sourceUrl: input.url,
                status: client_1.KnowledgeStatus.PROCESSING,
            },
        });
        try {
            const text = await this.fetchWebsiteText(input.url);
            await this.ingestText(source.id, text);
            await this.audit.log({
                actorId: input.actorId,
                action: 'KNOWLEDGE_WEBSITE_ADDED',
                entityType: 'ProjectKnowledgeSource',
                entityId: source.id,
                details: { projectId: input.projectId, url: input.url },
            });
        }
        catch (error) {
            await this.prisma.projectKnowledgeSource.update({
                where: { id: source.id },
                data: {
                    status: client_1.KnowledgeStatus.FAILED,
                    errorMessage: error instanceof Error ? error.message : 'Failed',
                },
            });
            throw error;
        }
        return this.getSource(source.id);
    }
    async addTextDocument(input) {
        const project = await this.prisma.project.findUnique({
            where: { id: input.projectId },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        if (!input.text?.trim())
            throw new common_1.BadRequestException('Text is required');
        const source = await this.prisma.projectKnowledgeSource.create({
            data: {
                projectId: input.projectId,
                title: input.title,
                sourceType: input.sourceType || client_1.KnowledgeSourceType.TEXT,
                status: client_1.KnowledgeStatus.PROCESSING,
                rawText: input.text,
            },
        });
        await this.ingestText(source.id, input.text);
        await this.audit.log({
            actorId: input.actorId,
            action: 'KNOWLEDGE_TEXT_ADDED',
            entityType: 'ProjectKnowledgeSource',
            entityId: source.id,
            details: { projectId: input.projectId, title: input.title },
        });
        return this.getSource(source.id);
    }
    async uploadFile(input) {
        const project = await this.prisma.project.findUnique({
            where: { id: input.projectId },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const safeName = `${Date.now()}-${(0, crypto_1.randomUUID)()}-${input.file.originalname}`.replace(/[^\w.\-]+/g, '_');
        const filePath = path.join(this.uploadsDir, safeName);
        fs.writeFileSync(filePath, input.file.buffer);
        const sourceType = input.sourceType ||
            (input.file.mimetype === 'application/pdf'
                ? client_1.KnowledgeSourceType.PDF
                : client_1.KnowledgeSourceType.OTHER);
        const source = await this.prisma.projectKnowledgeSource.create({
            data: {
                projectId: input.projectId,
                title: input.title || input.file.originalname,
                sourceType,
                status: client_1.KnowledgeStatus.PROCESSING,
                fileName: input.file.originalname,
                filePath,
                mimeType: input.file.mimetype,
            },
        });
        try {
            let text = '';
            if (input.file.mimetype === 'application/pdf' ||
                input.file.originalname.toLowerCase().endsWith('.pdf')) {
                const parsed = await pdfParse(input.file.buffer);
                text = parsed.text || '';
            }
            else {
                text = input.file.buffer.toString('utf8');
            }
            if (!text.trim()) {
                throw new common_1.BadRequestException('Could not extract text from file');
            }
            await this.ingestText(source.id, text);
            await this.audit.log({
                actorId: input.actorId,
                action: 'KNOWLEDGE_FILE_UPLOADED',
                entityType: 'ProjectKnowledgeSource',
                entityId: source.id,
                details: {
                    projectId: input.projectId,
                    fileName: input.file.originalname,
                },
            });
        }
        catch (error) {
            await this.prisma.projectKnowledgeSource.update({
                where: { id: source.id },
                data: {
                    status: client_1.KnowledgeStatus.FAILED,
                    errorMessage: error instanceof Error ? error.message : 'Failed',
                },
            });
            throw error;
        }
        return this.getSource(source.id);
    }
    async reprocess(sourceId, actorId) {
        const source = await this.prisma.projectKnowledgeSource.findUnique({
            where: { id: sourceId },
        });
        if (!source)
            throw new common_1.NotFoundException('Knowledge source not found');
        await this.prisma.projectKnowledgeChunk.deleteMany({ where: { sourceId } });
        await this.prisma.projectKnowledgeSource.update({
            where: { id: sourceId },
            data: { status: client_1.KnowledgeStatus.PROCESSING, errorMessage: null },
        });
        let text = source.rawText || '';
        if (!text && source.filePath && fs.existsSync(source.filePath)) {
            const buf = fs.readFileSync(source.filePath);
            if (source.mimeType === 'application/pdf' ||
                source.fileName?.toLowerCase().endsWith('.pdf')) {
                text = (await pdfParse(buf)).text || '';
            }
            else {
                text = buf.toString('utf8');
            }
        }
        if (!text && source.sourceUrl) {
            text = await this.fetchWebsiteText(source.sourceUrl);
        }
        if (!text.trim()) {
            throw new common_1.BadRequestException('No text available to reprocess');
        }
        await this.ingestText(sourceId, text);
        await this.audit.log({
            actorId,
            action: 'KNOWLEDGE_REPROCESSED',
            entityType: 'ProjectKnowledgeSource',
            entityId: sourceId,
        });
        return this.getSource(sourceId);
    }
    async remove(sourceId, actorId) {
        const source = await this.prisma.projectKnowledgeSource.findUnique({
            where: { id: sourceId },
        });
        if (!source)
            throw new common_1.NotFoundException('Knowledge source not found');
        await this.prisma.projectKnowledgeSource.delete({ where: { id: sourceId } });
        if (source.filePath && fs.existsSync(source.filePath)) {
            try {
                fs.unlinkSync(source.filePath);
            }
            catch {
            }
        }
        await this.audit.log({
            actorId,
            action: 'KNOWLEDGE_DELETED',
            entityType: 'ProjectKnowledgeSource',
            entityId: sourceId,
            details: { projectId: source.projectId },
        });
        return { ok: true };
    }
    async retrieve(projectId, query, topK = 5, options) {
        const chunks = await this.loadChunks(projectId);
        if (!chunks.length)
            return [];
        const lexicalRanked = chunks
            .map((chunk) => {
            const lexical = this.lexicalScore(query, chunk.content);
            return {
                id: chunk.id,
                content: chunk.content,
                score: lexical,
                source: chunk.source,
                embedding: chunk.embedding,
            };
        })
            .sort((a, b) => b.score - a.score);
        const lexicalOnly = options?.lexicalOnly !== false;
        if (lexicalOnly || lexicalRanked[0]?.score >= 0.12) {
            return lexicalRanked
                .slice(0, topK)
                .filter((s) => s.score > 0.04)
                .map(({ embedding: _e, ...rest }) => rest);
        }
        const queryEmbedRemote = await this.llm.embed([query]);
        const queryVec = queryEmbedRemote?.[0] || this.llm.localEmbed(query);
        const scored = chunks.map((chunk) => {
            const stored = chunk.embedding;
            const vec = stored?.length ? stored : this.llm.localEmbed(chunk.content);
            const semantic = this.llm.cosine(queryVec, vec);
            const lexical = this.lexicalScore(query, chunk.content);
            return {
                id: chunk.id,
                content: chunk.content,
                score: semantic * 0.7 + lexical * 0.3,
                source: chunk.source,
            };
        });
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .filter((s) => s.score > 0.02);
    }
    async ensureProjectWebsiteKnowledge(projectId, actorId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
        });
        if (!project?.websiteUrl?.trim())
            return null;
        const url = project.websiteUrl.trim();
        const existing = await this.prisma.projectKnowledgeSource.findFirst({
            where: {
                projectId,
                sourceType: client_1.KnowledgeSourceType.WEBSITE,
                OR: [{ sourceUrl: url }, { sourceUrl: url.replace(/\/$/, '') }],
                status: { in: [client_1.KnowledgeStatus.READY, client_1.KnowledgeStatus.PROCESSING] },
            },
            include: { _count: { select: { chunks: true } } },
        });
        if (existing?.status === client_1.KnowledgeStatus.READY && existing._count.chunks > 0) {
            return existing;
        }
        if (existing?.status === client_1.KnowledgeStatus.PROCESSING) {
            return existing;
        }
        this.logger.log(`Auto-ingesting project website for ${project.name}: ${url}`);
        try {
            return await this.addWebsite({
                projectId,
                url,
                title: `${project.name} website`,
                actorId,
            });
        }
        catch (error) {
            this.logger.warn(`Auto website ingest failed: ${error instanceof Error ? error.message : error}`);
            return null;
        }
    }
    lexicalScore(query, content) {
        const q = new Set(query
            .toLowerCase()
            .split(/[\s,./|]+/)
            .filter((t) => t.length > 1));
        if (!q.size)
            return 0;
        const c = content.toLowerCase();
        let hit = 0;
        for (const token of q) {
            if (c.includes(token))
                hit += 1;
        }
        return hit / q.size;
    }
    chunkText(text, size = 900, overlap = 150) {
        const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
        const chunks = [];
        let i = 0;
        while (i < clean.length) {
            const end = Math.min(clean.length, i + size);
            chunks.push(clean.slice(i, end).trim());
            if (end >= clean.length)
                break;
            i = Math.max(0, end - overlap);
        }
        return chunks.filter(Boolean);
    }
    async ingestText(sourceId, text) {
        const source = await this.prisma.projectKnowledgeSource.findUnique({
            where: { id: sourceId },
        });
        if (!source)
            throw new common_1.NotFoundException('Knowledge source not found');
        const pieces = this.chunkText(text);
        const remote = await this.llm.embed(pieces);
        const rows = pieces.map((content, chunkIndex) => ({
            projectId: source.projectId,
            sourceId,
            chunkIndex,
            content,
            tokenCount: Math.ceil(content.length / 4),
            embedding: (remote?.[chunkIndex] ||
                this.llm.localEmbed(content)),
        }));
        await this.prisma.projectKnowledgeChunk.createMany({ data: rows });
        await this.prisma.projectKnowledgeSource.update({
            where: { id: sourceId },
            data: {
                status: client_1.KnowledgeStatus.READY,
                rawText: text.slice(0, 200_000),
                errorMessage: null,
            },
        });
        this.invalidateProjectCache(source.projectId);
    }
    async fetchWebsiteText(url) {
        let parsed;
        try {
            parsed = new URL(url);
        }
        catch {
            throw new common_1.BadRequestException('Invalid website URL');
        }
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new common_1.BadRequestException('Only http/https URLs are allowed');
        }
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RealEstateAI-CRM/1.0; +https://localhost)',
                Accept: 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
        });
        if (!res.ok) {
            throw new common_1.BadRequestException(`Failed to fetch URL (${res.status})`);
        }
        const html = await res.text();
        const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
        if (text.length < 40) {
            throw new common_1.BadRequestException('Website page had little readable text');
        }
        return text.slice(0, 200_000);
    }
};
exports.KnowledgeService = KnowledgeService;
exports.KnowledgeService = KnowledgeService = KnowledgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        llm_service_1.LlmService,
        audit_service_1.AuditService])
], KnowledgeService);
//# sourceMappingURL=knowledge.service.js.map