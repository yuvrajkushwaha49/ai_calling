import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  KnowledgeSourceType,
  KnowledgeStatus,
  Prisma,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

type CachedChunk = {
  id: string;
  content: string;
  embedding: number[] | null;
  source: {
    id: string;
    title: string;
    sourceType: KnowledgeSourceType;
    sourceUrl: string | null;
    fileName: string | null;
  };
};

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'knowledge');
  /** In-memory chunk cache — avoids SQLite scan every voice turn */
  private readonly chunkCache = new Map<
    string,
    { at: number; chunks: CachedChunk[] }
  >();
  private readonly chunkCacheTtlMs = 60_000;

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private audit: AuditService,
  ) {
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  invalidateProjectCache(projectId: string) {
    this.chunkCache.delete(projectId);
  }

  private async loadChunks(projectId: string): Promise<CachedChunk[]> {
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
    const chunks: CachedChunk[] = rows.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      embedding: Array.isArray(chunk.embedding)
        ? (chunk.embedding as number[])
        : null,
      source: chunk.source,
    }));
    this.chunkCache.set(projectId, { at: Date.now(), chunks });
    return chunks;
  }

  listByProject(projectId: string) {
    return this.prisma.projectKnowledgeSource.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
    });
  }

  async getSource(id: string) {
    const source = await this.prisma.projectKnowledgeSource.findUnique({
      where: { id },
      include: {
        chunks: { orderBy: { chunkIndex: 'asc' }, take: 50 },
        project: { select: { id: true, name: true } },
      },
    });
    if (!source) throw new NotFoundException('Knowledge source not found');
    return source;
  }

  async addWebsite(input: {
    projectId: string;
    url: string;
    title?: string;
    actorId?: string;
  }) {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const source = await this.prisma.projectKnowledgeSource.create({
      data: {
        projectId: input.projectId,
        title: input.title || input.url,
        sourceType: KnowledgeSourceType.WEBSITE,
        sourceUrl: input.url,
        status: KnowledgeStatus.PROCESSING,
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
    } catch (error) {
      await this.prisma.projectKnowledgeSource.update({
        where: { id: source.id },
        data: {
          status: KnowledgeStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Failed',
        },
      });
      throw error;
    }

    return this.getSource(source.id);
  }

  async addTextDocument(input: {
    projectId: string;
    title: string;
    text: string;
    sourceType?: KnowledgeSourceType;
    actorId?: string;
  }) {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!input.text?.trim()) throw new BadRequestException('Text is required');

    const source = await this.prisma.projectKnowledgeSource.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        sourceType: input.sourceType || KnowledgeSourceType.TEXT,
        status: KnowledgeStatus.PROCESSING,
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

  async uploadFile(input: {
    projectId: string;
    file: Express.Multer.File;
    title?: string;
    sourceType?: KnowledgeSourceType;
    actorId?: string;
  }) {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const safeName = `${Date.now()}-${randomUUID()}-${input.file.originalname}`.replace(
      /[^\w.\-]+/g,
      '_',
    );
    const filePath = path.join(this.uploadsDir, safeName);
    fs.writeFileSync(filePath, input.file.buffer);

    const sourceType =
      input.sourceType ||
      (input.file.mimetype === 'application/pdf'
        ? KnowledgeSourceType.PDF
        : KnowledgeSourceType.OTHER);

    const source = await this.prisma.projectKnowledgeSource.create({
      data: {
        projectId: input.projectId,
        title: input.title || input.file.originalname,
        sourceType,
        status: KnowledgeStatus.PROCESSING,
        fileName: input.file.originalname,
        filePath,
        mimeType: input.file.mimetype,
      },
    });

    try {
      let text = '';
      if (
        input.file.mimetype === 'application/pdf' ||
        input.file.originalname.toLowerCase().endsWith('.pdf')
      ) {
        const parsed = await pdfParse(input.file.buffer);
        text = parsed.text || '';
      } else {
        text = input.file.buffer.toString('utf8');
      }
      if (!text.trim()) {
        throw new BadRequestException('Could not extract text from file');
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
    } catch (error) {
      await this.prisma.projectKnowledgeSource.update({
        where: { id: source.id },
        data: {
          status: KnowledgeStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Failed',
        },
      });
      throw error;
    }

    return this.getSource(source.id);
  }

  async reprocess(sourceId: string, actorId?: string) {
    const source = await this.prisma.projectKnowledgeSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Knowledge source not found');

    await this.prisma.projectKnowledgeChunk.deleteMany({ where: { sourceId } });
    await this.prisma.projectKnowledgeSource.update({
      where: { id: sourceId },
      data: { status: KnowledgeStatus.PROCESSING, errorMessage: null },
    });

    let text = source.rawText || '';
    if (!text && source.filePath && fs.existsSync(source.filePath)) {
      const buf = fs.readFileSync(source.filePath);
      if (
        source.mimeType === 'application/pdf' ||
        source.fileName?.toLowerCase().endsWith('.pdf')
      ) {
        text = (await pdfParse(buf)).text || '';
      } else {
        text = buf.toString('utf8');
      }
    }
    if (!text && source.sourceUrl) {
      text = await this.fetchWebsiteText(source.sourceUrl);
    }
    if (!text.trim()) {
      throw new BadRequestException('No text available to reprocess');
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

  async remove(sourceId: string, actorId?: string) {
    const source = await this.prisma.projectKnowledgeSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Knowledge source not found');
    await this.prisma.projectKnowledgeSource.delete({ where: { id: sourceId } });
    if (source.filePath && fs.existsSync(source.filePath)) {
      try {
        fs.unlinkSync(source.filePath);
      } catch {
        // ignore
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

  /**
   * Strict project-scoped retrieval.
   * Voice turns: lexicalOnly=true (no remote embed — major latency win).
   */
  async retrieve(
    projectId: string,
    query: string,
    topK = 5,
    options?: { lexicalOnly?: boolean },
  ) {
    const chunks = await this.loadChunks(projectId);
    if (!chunks.length) return [];

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
    // Fast path / voice path: skip slow remote embedding
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

  /**
   * If the project has a websiteUrl but no READY website knowledge yet,
   * scrape + ingest it so calls can answer from that content.
   */
  async ensureProjectWebsiteKnowledge(projectId: string, actorId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project?.websiteUrl?.trim()) return null;

    const url = project.websiteUrl.trim();
    const existing = await this.prisma.projectKnowledgeSource.findFirst({
      where: {
        projectId,
        sourceType: KnowledgeSourceType.WEBSITE,
        OR: [{ sourceUrl: url }, { sourceUrl: url.replace(/\/$/, '') }],
        status: { in: [KnowledgeStatus.READY, KnowledgeStatus.PROCESSING] },
      },
      include: { _count: { select: { chunks: true } } },
    });
    if (existing?.status === KnowledgeStatus.READY && existing._count.chunks > 0) {
      return existing;
    }
    if (existing?.status === KnowledgeStatus.PROCESSING) {
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
    } catch (error) {
      this.logger.warn(
        `Auto website ingest failed: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  private lexicalScore(query: string, content: string) {
    const q = new Set(
      query
        .toLowerCase()
        .split(/[\s,./|]+/)
        .filter((t) => t.length > 1),
    );
    if (!q.size) return 0;
    const c = content.toLowerCase();
    let hit = 0;
    for (const token of q) {
      if (c.includes(token)) hit += 1;
    }
    return hit / q.size;
  }

  private chunkText(text: string, size = 900, overlap = 150) {
    const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    const chunks: string[] = [];
    let i = 0;
    while (i < clean.length) {
      const end = Math.min(clean.length, i + size);
      chunks.push(clean.slice(i, end).trim());
      if (end >= clean.length) break;
      i = Math.max(0, end - overlap);
    }
    return chunks.filter(Boolean);
  }

  private async ingestText(sourceId: string, text: string) {
    const source = await this.prisma.projectKnowledgeSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Knowledge source not found');

    const pieces = this.chunkText(text);
    const remote = await this.llm.embed(pieces);
    const rows = pieces.map((content, chunkIndex) => ({
      projectId: source.projectId,
      sourceId,
      chunkIndex,
      content,
      tokenCount: Math.ceil(content.length / 4),
      embedding: (remote?.[chunkIndex] ||
        this.llm.localEmbed(content)) as unknown as Prisma.InputJsonValue,
    }));

    await this.prisma.projectKnowledgeChunk.createMany({ data: rows });
    await this.prisma.projectKnowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: KnowledgeStatus.READY,
        rawText: text.slice(0, 200_000),
        errorMessage: null,
      },
    });
    this.invalidateProjectCache(source.projectId);
  }

  private async fetchWebsiteText(url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid website URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Only http/https URLs are allowed');
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; RealEstateAI-CRM/1.0; +https://localhost)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new BadRequestException(`Failed to fetch URL (${res.status})`);
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
      throw new BadRequestException('Website page had little readable text');
    }
    return text.slice(0, 200_000);
  }
}
