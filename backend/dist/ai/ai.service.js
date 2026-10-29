"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const voice_service_1 = require("../voice/voice.service");
const llm_service_1 = require("../llm/llm.service");
const opener_bank_1 = require("../calls/opener-bank");
const elevenlabs_service_1 = require("../elevenlabs/elevenlabs.service");
const sales_agent_prompt_1 = require("../conversation/sales-agent-prompt");
const playbook_1 = require("./playbook");
const GEMINI_MODELS = new Set([
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
]);
const CHATGPT_MODELS = new Set([
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4.1-mini',
    'gpt-4.1',
    'gpt-4.1-nano',
    'o4-mini',
]);
let AiService = class AiService {
    prisma;
    voice;
    llm;
    settingsCache = null;
    settingsTtlMs = 15_000;
    constructor(prisma, voice, llm) {
        this.prisma = prisma;
        this.voice = voice;
        this.llm = llm;
    }
    async getSettings() {
        if (this.settingsCache &&
            Date.now() - this.settingsCache.at < this.settingsTtlMs) {
            return this.settingsCache.value;
        }
        const value = await this.loadSettings();
        this.settingsCache = { at: Date.now(), value };
        return value;
    }
    invalidateSettingsCache() {
        this.settingsCache = null;
    }
    async loadSettings() {
        let settings = await this.prisma.aiAgentSettings.findFirst();
        if (!settings) {
            settings = await this.prisma.aiAgentSettings.create({
                data: {
                    agentVoice: 'custom',
                    language: 'hi-IN',
                    tone: 'friendly',
                    llmModel: 'gemini-3.5-flash-lite',
                    systemPrompt: (0, sales_agent_prompt_1.buildDefaultSalesAgentPrompt)(),
                },
            });
        }
        let normalizedVoice = this.voice.normalizeSpeaker(settings.agentVoice);
        if (this.voice.getTtsProvider() === 'elevenlabs' &&
            /^[a-zA-Z0-9]{20,}$/.test((settings.agentVoice || '').trim())) {
            normalizedVoice = settings.agentVoice.trim();
        }
        else if (this.voice.getTtsProvider() === 'elevenlabs') {
            const envVoice = (process.env.ELEVENLABS_DEFAULT_VOICE_ID || '').trim();
            if (envVoice && /^[a-zA-Z0-9]{20,}$/.test(envVoice)) {
                normalizedVoice = 'custom';
            }
            else {
                normalizedVoice = this.voice.normalizeSpeaker(settings.agentVoice);
            }
        }
        const normalizedLanguage = this.voice.normalizeAppLanguage(settings.language);
        const normalizedTone = this.normalizeTone(settings.tone);
        const normalizedModel = this.normalizeLlmModel(settings.llmModel);
        const prompt = settings.systemPrompt || '';
        const cleanedPrompt = /वाह|\bwah\b/i.test(prompt)
            ? prompt
                .replace(/["']?वाह["']?\s*,?\s*/g, '')
                .replace(/["']?wah["']?\s*,?\s*/gi, '')
                .replace(/\(\s*,/g, '(')
                .replace(/,\s*\)/g, ')')
                .replace(/\s{2,}/g, ' ')
                .trim()
            : prompt;
        const defaultSalesPrompt = (0, sales_agent_prompt_1.buildDefaultSalesAgentPrompt)();
        const promptNeedsSalesRewrite = !cleanedPrompt.trim() ||
            !(0, sales_agent_prompt_1.isSalesAgentPrompt)(cleanedPrompt) ||
            ((0, sales_agent_prompt_1.isSalesAgentPrompt)(cleanedPrompt) &&
                !/HARD RULE — FRESH WORDING/i.test(cleanedPrompt)) ||
            ((0, sales_agent_prompt_1.isSalesAgentPrompt)(cleanedPrompt) &&
                !/Banned \/ never reuse these sample phrases/i.test(cleanedPrompt)) ||
            /natural Indian real-estate phone agent/i.test(cleanedPrompt) ||
            /You are an AI sales calling agent for real estate/i.test(cleanedPrompt) ||
            /calm, friendly real-estate sales caller/i.test(cleanedPrompt) ||
            /sharp local real-estate sales caller/i.test(cleanedPrompt);
        const nextPrompt = promptNeedsSalesRewrite
            ? defaultSalesPrompt
            : cleanedPrompt;
        const promptNeedsClean = nextPrompt !== prompt;
        if (settings.agentVoice !== normalizedVoice ||
            settings.language !== normalizedLanguage ||
            settings.tone !== normalizedTone ||
            settings.llmModel !== normalizedModel ||
            promptNeedsClean) {
            settings = await this.prisma.aiAgentSettings.update({
                where: { id: settings.id },
                data: {
                    agentVoice: normalizedVoice,
                    language: normalizedLanguage,
                    tone: normalizedTone,
                    llmModel: normalizedModel,
                    ...(promptNeedsClean ? { systemPrompt: nextPrompt } : {}),
                },
            });
        }
        const llm = this.llm.getStatus();
        return {
            ...settings,
            llmConfigured: llm.configured,
            llmProvider: llm.provider,
            ttsProvider: this.voice.getTtsProvider(),
            ttsVoices: this.voice.getTtsProvider() === 'elevenlabs'
                ? Object.entries(elevenlabs_service_1.ELEVENLABS_VOICES).map(([value, meta]) => ({
                    value,
                    label: meta.label,
                    gender: meta.gender,
                }))
                : undefined,
        };
    }
    normalizeTone(tone) {
        const allowed = new Set([
            'professional',
            'friendly',
            'persuasive',
            'warm',
            'formal',
        ]);
        const value = (tone || 'friendly').trim().toLowerCase();
        return allowed.has(value) ? value : 'friendly';
    }
    normalizeLlmModel(model) {
        const value = (model || '').trim();
        const provider = this.llm.getProvider();
        if (provider === 'gemini') {
            if (GEMINI_MODELS.has(value))
                return value;
            return 'gemini-2.5-flash';
        }
        if (CHATGPT_MODELS.has(value))
            return value;
        return 'gpt-4o-mini';
    }
    getOpenerLearning(settings) {
        const playbook = settings?.approvedPlaybook;
        return (0, opener_bank_1.parseOpenerLearning)(playbook);
    }
    async mutateOpenerLearning(mutate) {
        const settings = await this.getSettings();
        const playbook = (0, playbook_1.normalizePlaybook)(settings.approvedPlaybook);
        const learning = (0, opener_bank_1.parseOpenerLearning)(playbook);
        const prevPreferred = learning.preferredStyle;
        mutate(learning);
        learning.preferredStyle = (0, opener_bank_1.bestOpenerStyle)(learning);
        playbook.openerLearning = learning;
        if (learning.preferredStyle &&
            learning.preferredStyle !== prevPreferred) {
            (0, playbook_1.appendImprovement)(playbook, {
                kind: 'opener_preferred',
                summary: `Preferred opener → ${learning.preferredStyle}`,
                detail: `Based on win rate across opener styles`,
            });
        }
        await this.prisma.aiAgentSettings.update({
            where: { id: settings.id },
            data: { approvedPlaybook: playbook },
        });
        this.invalidateSettingsCache();
        return learning;
    }
    async recordOpenerUse(style) {
        return this.mutateOpenerLearning((learning) => {
            const prev = learning.styles[style] || { uses: 0, wins: 0 };
            learning.styles[style] = { uses: prev.uses + 1, wins: prev.wins };
            learning.lastStyle = style;
        });
    }
    async recordOpenerWin(style) {
        return this.mutateOpenerLearning((learning) => {
            const prev = learning.styles[style] || { uses: 0, wins: 0 };
            learning.styles[style] = { uses: Math.max(prev.uses, 1), wins: prev.wins + 1 };
        });
    }
    async learnFromCompletedCall(input) {
        const lesson = (0, playbook_1.deriveAutoLesson)(input);
        if (!lesson)
            return null;
        const settings = await this.getSettings();
        const playbook = (0, playbook_1.normalizePlaybook)(settings.approvedPlaybook);
        const lessons = [...(playbook.autoLessons || [])];
        const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const recent = lessons.slice(-3);
        if (recent.some((l) => norm(l.lesson) === norm(lesson))) {
            (0, playbook_1.appendImprovement)(playbook, {
                kind: 'auto_lesson',
                summary: `Reinforced: ${lesson}`,
                detail: `Outcome: ${input.outcome || 'CONNECTED'} (duplicate principle)`,
                callId: input.callId,
            });
            await this.prisma.aiAgentSettings.update({
                where: { id: settings.id },
                data: { approvedPlaybook: playbook },
            });
            this.invalidateSettingsCache();
            return lesson;
        }
        const at = new Date().toISOString();
        lessons.push({
            lesson,
            outcome: String(input.outcome || 'CONNECTED'),
            at,
            callId: input.callId,
        });
        playbook.autoLessons = lessons.slice(-40);
        (0, playbook_1.appendImprovement)(playbook, {
            kind: 'auto_lesson',
            summary: lesson,
            detail: `Outcome: ${input.outcome || 'CONNECTED'}`,
            callId: input.callId,
            at,
        });
        await this.prisma.aiAgentSettings.update({
            where: { id: settings.id },
            data: { approvedPlaybook: playbook },
        });
        this.invalidateSettingsCache();
        return lesson;
    }
    async getPlaybookSummary() {
        const settings = await this.getSettings();
        const playbook = (0, playbook_1.normalizePlaybook)(settings.approvedPlaybook);
        const opener = playbook.openerLearning || { styles: {} };
        const styleIds = [
            'soft_time',
            'project_hook',
            'warm_checkin',
            'curiosity',
            'availability',
        ];
        const styles = styleIds.map((id) => {
            const stat = opener.styles?.[id] || { uses: 0, wins: 0 };
            return {
                id,
                uses: stat.uses || 0,
                wins: stat.wins || 0,
                winRate: (stat.uses || 0) > 0
                    ? Math.round(((stat.wins || 0) / stat.uses) * 100)
                    : 0,
            };
        });
        const history = [...(playbook.improvementHistory || [])].reverse();
        return {
            preferredOpener: opener.preferredStyle || null,
            lastOpener: opener.lastStyle || null,
            openerStyles: styles,
            tips: [...(playbook.tips || [])].reverse().slice(0, 30),
            autoLessons: [...(playbook.autoLessons || [])].reverse().slice(0, 30),
            history: history.slice(0, 50),
            totals: {
                tips: (playbook.tips || []).length,
                autoLessons: (playbook.autoLessons || []).length,
                history: (playbook.improvementHistory || []).length,
            },
        };
    }
    async updateSettings(dto) {
        const existing = await this.getSettings();
        const { workingHours, llmModel, ...rest } = dto;
        const updated = await this.prisma.aiAgentSettings.update({
            where: { id: existing.id },
            data: {
                ...rest,
                ...(llmModel !== undefined && {
                    llmModel: this.normalizeLlmModel(llmModel),
                }),
                ...(workingHours !== undefined && {
                    workingHours: workingHours,
                }),
            },
        });
        this.invalidateSettingsCache();
        return updated;
    }
    async uploadKnowledgeBase(files) {
        const settings = await this.getSettings();
        const currentKb = Array.isArray(settings.knowledgeBase)
            ? settings.knowledgeBase
            : [];
        return this.prisma.aiAgentSettings.update({
            where: { id: settings.id },
            data: {
                knowledgeBase: [...currentKb, ...files],
            },
        });
    }
    async previewVoice(options) {
        const settings = await this.getSettings();
        const speaker = options?.speaker || settings.agentVoice || 'rachel';
        const language = options?.language || settings.language || 'hi-IN';
        const agentLabel = String(settings.agentName || 'नेहा')
            .split(/[-–—|:/]/)[0]
            .trim()
            .split(/\s+/)[0] || 'नेहा';
        const text = options?.text?.trim() ||
            `नमस्ते, मैं ${agentLabel} बोल रही हूँ। साया राज नगर एक्सटेंशन की आपकी enquiry आई थी — क्या दो मिनट बात हो सकती है?`;
        if (!text)
            throw new common_1.BadRequestException('Preview text is required');
        const result = await this.voice.textToSpeech({
            text,
            speaker,
            language,
            skipSave: true,
            modelId: 'eleven_multilingual_v2',
            pace: 1.0,
        });
        return {
            speaker,
            language: this.voice.normalizeLanguage(language),
            mimeType: result.mimeType || 'audio/mpeg',
            audioBase64: result.audioBase64,
            fileName: result.fileName,
            ttsProvider: this.voice.getTtsProvider(),
        };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        voice_service_1.VoiceService,
        llm_service_1.LlmService])
], AiService);
//# sourceMappingURL=ai.service.js.map