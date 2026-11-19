import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAiSettingsDto } from './dto/ai-settings.dto';
import { VoiceService } from '../voice/voice.service';
import { LlmService } from '../llm/llm.service';
import {
  bestOpenerStyle,
  parseOpenerLearning,
  type OpenerLearning,
  type OpenerStyle,
} from '../calls/opener-bank';
import { ELEVENLABS_VOICES } from '../elevenlabs/elevenlabs.service';
import {
  buildDefaultSalesAgentPrompt,
  isSalesAgentPrompt,
} from '../conversation/sales-agent-prompt';
import {
  appendImprovement,
  deriveAutoLesson,
  normalizePlaybook,
  type AgentPlaybook,
} from './playbook';

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

@Injectable()
export class AiService {
  private settingsCache:
    | { at: number; value: Awaited<ReturnType<AiService['loadSettings']>> }
    | null = null;
  private readonly settingsTtlMs = 15_000;

  constructor(
    private prisma: PrismaService,
    private voice: VoiceService,
    private llm: LlmService,
  ) {}

  async getSettings() {
    if (
      this.settingsCache &&
      Date.now() - this.settingsCache.at < this.settingsTtlMs
    ) {
      return this.settingsCache.value;
    }
    const value = await this.loadSettings();
    this.settingsCache = { at: Date.now(), value };
    return value;
  }

  /** Call after PATCH so next turn picks up new settings. */
  invalidateSettingsCache() {
    this.settingsCache = null;
  }

  private async loadSettings() {
    let settings = await this.prisma.aiAgentSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.aiAgentSettings.create({
        data: {
          agentVoice: 'custom',
          language: 'hi-IN',
          tone: 'friendly',
          llmModel: 'gemini-flash-lite-latest',
          systemPrompt: buildDefaultSalesAgentPrompt(),
        },
      });
    }

    // Migrate legacy voices / unsupported languages
    let normalizedVoice = this.voice.normalizeSpeaker(settings.agentVoice);
    // Prefer free default ElevenLabs voices (darian/elara/…) over legacy aliases
    if (
      this.voice.getTtsProvider() === 'elevenlabs' &&
      /^[a-zA-Z0-9]{20,}$/.test((settings.agentVoice || '').trim())
    ) {
      normalizedVoice = settings.agentVoice.trim();
    } else if (this.voice.getTtsProvider() === 'elevenlabs') {
      const envVoice = (process.env.ELEVENLABS_DEFAULT_VOICE_ID || '').trim();
      if (envVoice && /^[a-zA-Z0-9]{20,}$/.test(envVoice)) {
        // Use configured custom voice id
        normalizedVoice = 'custom';
      } else {
        normalizedVoice = this.voice.normalizeSpeaker(settings.agentVoice);
      }
    }
    const normalizedLanguage = this.voice.normalizeAppLanguage(settings.language);
    const normalizedTone = this.normalizeTone(
      (settings as { tone?: string }).tone,
    );
    const normalizedModel = this.normalizeLlmModel(
      (settings as { llmModel?: string }).llmModel,
    );
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
    const defaultSalesPrompt = buildDefaultSalesAgentPrompt(normalizedLanguage);
    const promptNeedsSalesRewrite =
      !cleanedPrompt.trim() ||
      !isSalesAgentPrompt(cleanedPrompt) ||
      (isSalesAgentPrompt(cleanedPrompt) &&
        !/HARD RULE — FRESH WORDING/i.test(cleanedPrompt)) ||
      (isSalesAgentPrompt(cleanedPrompt) &&
        !/Banned \/ never reuse these sample phrases/i.test(cleanedPrompt)) ||
      ((normalizedLanguage === 'hinglish' || normalizedLanguage === 'hi-IN') &&
        /HINGLISH using ENGLISH ALPHABET/i.test(cleanedPrompt)) ||
      (normalizedLanguage === 'en-IN' &&
        /DEVANAGARI SCRIPT|देवनागरी लिपि/i.test(cleanedPrompt)) ||
      /natural Indian real-estate phone agent/i.test(cleanedPrompt) ||
      /You are an AI sales calling agent for real estate/i.test(cleanedPrompt) ||
      /calm, friendly real-estate sales caller/i.test(cleanedPrompt) ||
      /sharp local real-estate sales caller/i.test(cleanedPrompt);
    const nextPrompt = promptNeedsSalesRewrite
      ? defaultSalesPrompt
      : cleanedPrompt;
    const promptNeedsClean = nextPrompt !== prompt;

    let companyName = (settings as { companyName?: string }).companyName || '';
    if (!companyName || /saya\s*group/i.test(companyName) || /rgbil/i.test(companyName) || /workains\s*realty/i.test(companyName)) {
      companyName = 'Workains Reality';
    }
    let agentName = (settings as { agentName?: string }).agentName || 'Aria';
    if (!agentName || /real\s*estate/i.test(agentName) || /assistant/i.test(agentName)) {
      agentName = 'Aria';
    }

    if (
      settings.agentVoice !== normalizedVoice ||
      settings.language !== normalizedLanguage ||
      (settings as { tone?: string }).tone !== normalizedTone ||
      (settings as { llmModel?: string }).llmModel !== normalizedModel ||
      (settings as { companyName?: string }).companyName !== companyName ||
      (settings as { agentName?: string }).agentName !== agentName ||
      promptNeedsClean
    ) {
      settings = await this.prisma.aiAgentSettings.update({
        where: { id: settings.id },
        data: {
          agentVoice: normalizedVoice,
          language: normalizedLanguage,
          tone: normalizedTone,
          llmModel: normalizedModel,
          companyName,
          agentName,
          ...(promptNeedsClean ? { systemPrompt: nextPrompt } : {}),
        },
      });
    }

    const llm = this.llm.getStatus();
    const playbook = normalizePlaybook(settings.approvedPlaybook);
    const savedVoice = (playbook as any)?.voiceSettings || {};
    const voiceSettings = {
      stability: typeof savedVoice.stability === 'number' ? savedVoice.stability : 0.50,
      similarityBoost: typeof savedVoice.similarityBoost === 'number' ? savedVoice.similarityBoost : 0.80,
      style: typeof savedVoice.style === 'number' ? savedVoice.style : 0.05,
      speed: typeof savedVoice.speed === 'number' ? savedVoice.speed : 1.0,
      useSpeakerBoost: typeof savedVoice.useSpeakerBoost === 'boolean' ? savedVoice.useSpeakerBoost : true,
    };

    // Propagate to VoiceService so all TTS across the application uses these settings
    this.voice.setActiveVoiceSettings(voiceSettings);

    return {
      ...settings,
      companyName,
      agentName,
      voiceSettings,
      voiceStability: voiceSettings.stability,
      voiceSimilarity: voiceSettings.similarityBoost,
      voiceStyle: voiceSettings.style,
      voiceSpeed: voiceSettings.speed,
      voiceSpeakerBoost: voiceSettings.useSpeakerBoost,
      llmConfigured: llm.configured,
      llmProvider: llm.provider,
      ttsProvider: this.voice.getTtsProvider(),
      ttsVoices:
        this.voice.getTtsProvider() === 'elevenlabs'
          ? Object.entries(ELEVENLABS_VOICES).map(([value, meta]) => ({
              value,
              label: meta.label,
              gender: meta.gender,
            }))
          : undefined,
    };
  }

  private normalizeTone(tone?: string): string {
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

  normalizeLlmModel(model?: string): string {
    const value = (model || '').trim();
    const provider = this.llm.getProvider();
    if (provider === 'gemini') {
      if (
        value === 'gemini-flash-lite-latest' ||
        value === 'gemini-3.5-flash' ||
        value === 'gemini-3.6-flash'
      ) {
        return value;
      }
      return 'gemini-flash-lite-latest';
    }
    if (CHATGPT_MODELS.has(value)) return value;
    return 'gpt-4o-mini';
  }

  getOpenerLearning(settings?: { approvedPlaybook?: unknown }): OpenerLearning {
    const playbook = settings?.approvedPlaybook;
    return parseOpenerLearning(playbook);
  }

  private async mutateOpenerLearning(
    mutate: (learning: OpenerLearning) => void,
  ) {
    const settings = await this.getSettings();
    const playbook = normalizePlaybook(settings.approvedPlaybook) as AgentPlaybook &
      Record<string, unknown>;
    const learning = parseOpenerLearning(playbook);
    const prevPreferred = learning.preferredStyle;
    mutate(learning);
    learning.preferredStyle = bestOpenerStyle(learning);
    playbook.openerLearning = learning;
    if (
      learning.preferredStyle &&
      learning.preferredStyle !== prevPreferred
    ) {
      appendImprovement(playbook, {
        kind: 'opener_preferred',
        summary: `Preferred opener → ${learning.preferredStyle}`,
        detail: `Based on win rate across opener styles`,
      });
    }
    await this.prisma.aiAgentSettings.update({
      where: { id: settings.id },
      data: { approvedPlaybook: playbook as unknown as Prisma.InputJsonValue },
    });
    this.invalidateSettingsCache();
    return learning;
  }

  /** Count that this opener style was used on a call. */
  async recordOpenerUse(style: OpenerStyle) {
    return this.mutateOpenerLearning((learning) => {
      const prev = learning.styles[style] || { uses: 0, wins: 0 };
      learning.styles[style] = { uses: prev.uses + 1, wins: prev.wins };
      learning.lastStyle = style;
    });
  }

  /** Mark opener as successful when customer engages / qualifies. */
  async recordOpenerWin(style: OpenerStyle) {
    return this.mutateOpenerLearning((learning) => {
      const prev = learning.styles[style] || { uses: 0, wins: 0 };
      learning.styles[style] = { uses: Math.max(prev.uses, 1), wins: prev.wins + 1 };
    });
  }

  /**
   * After a call ends, store a short principle so the agent improves itself.
   * Lessons are tips — never verbatim scripts.
   */
  async learnFromCompletedCall(input: {
    callId: string;
    outcome?: string | null;
    transcript?: string | null;
    interestScore?: number | null;
  }) {
    const lesson = deriveAutoLesson(input);
    if (!lesson) return null;

    const settings = await this.getSettings();
    const playbook = normalizePlaybook(settings.approvedPlaybook);
    const lessons = [...(playbook.autoLessons || [])];

    // Skip near-duplicate only if same lesson already in the last 3 entries
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const recent = lessons.slice(-3);
    if (recent.some((l) => norm(l.lesson) === norm(lesson))) {
      // Still record that we reinforced the same principle on this call
      appendImprovement(playbook, {
        kind: 'auto_lesson',
        summary: `Reinforced: ${lesson}`,
        detail: `Outcome: ${input.outcome || 'CONNECTED'} (duplicate principle)`,
        callId: input.callId,
      });
      await this.prisma.aiAgentSettings.update({
        where: { id: settings.id },
        data: { approvedPlaybook: playbook as unknown as Prisma.InputJsonValue },
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
    appendImprovement(playbook, {
      kind: 'auto_lesson',
      summary: lesson,
      detail: `Outcome: ${input.outcome || 'CONNECTED'}`,
      callId: input.callId,
      at,
    });
    await this.prisma.aiAgentSettings.update({
      where: { id: settings.id },
      data: { approvedPlaybook: playbook as unknown as Prisma.InputJsonValue },
    });
    this.invalidateSettingsCache();
    return lesson;
  }

  /** Public summary for Learning UI — when/what improved. */
  async getPlaybookSummary() {
    const settings = await this.getSettings();
    const playbook = normalizePlaybook(settings.approvedPlaybook);
    const opener = playbook.openerLearning || { styles: {} };
    const styleIds = [
      'soft_time',
      'project_hook',
      'warm_checkin',
      'curiosity',
      'availability',
    ] as const;
    const styles = styleIds.map((id) => {
      const stat = opener.styles?.[id] || { uses: 0, wins: 0 };
      return {
        id,
        uses: stat.uses || 0,
        wins: stat.wins || 0,
        winRate:
          (stat.uses || 0) > 0
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

  async updateSettings(dto: UpdateAiSettingsDto) {
    const existing = await this.getSettings();
    const {
      workingHours,
      llmModel,
      language,
      systemPrompt,
      voiceSettings: dtoVoiceSettings,
      voiceStability,
      voiceSimilarity,
      voiceStyle,
      voiceSpeed,
      voiceSpeakerBoost,
      ...rest
    } = dto;
    const normalizedLang = language
      ? this.voice.normalizeAppLanguage(language)
      : existing.language;

    const languageChanged = normalizedLang !== existing.language;
    let resolvedPrompt = systemPrompt;
    if (languageChanged) {
      resolvedPrompt = buildDefaultSalesAgentPrompt(normalizedLang);
    } else if ((normalizedLang === 'hinglish' || normalizedLang === 'hi-IN') && systemPrompt && /HINGLISH using ENGLISH ALPHABET/i.test(systemPrompt)) {
      resolvedPrompt = buildDefaultSalesAgentPrompt(normalizedLang);
    } else if (normalizedLang === 'en-IN' && systemPrompt && /DEVANAGARI SCRIPT|देवनागरी लिपि/i.test(systemPrompt)) {
      resolvedPrompt = buildDefaultSalesAgentPrompt('en-IN');
    }

    const playbook = normalizePlaybook(existing.approvedPlaybook) as any;
    const currentVoice = playbook.voiceSettings || (existing as any).voiceSettings || {};

    const updatedVoiceSettings = {
      stability: typeof voiceStability === 'number' ? voiceStability : (dtoVoiceSettings?.stability ?? currentVoice.stability ?? 0.50),
      similarityBoost: typeof voiceSimilarity === 'number' ? voiceSimilarity : (dtoVoiceSettings?.similarityBoost ?? currentVoice.similarityBoost ?? 0.80),
      style: typeof voiceStyle === 'number' ? voiceStyle : (dtoVoiceSettings?.style ?? currentVoice.style ?? 0.05),
      speed: typeof voiceSpeed === 'number' ? voiceSpeed : (dtoVoiceSettings?.speed ?? currentVoice.speed ?? 1.0),
      useSpeakerBoost: typeof voiceSpeakerBoost === 'boolean' ? voiceSpeakerBoost : (dtoVoiceSettings?.useSpeakerBoost ?? currentVoice.useSpeakerBoost ?? true),
    };
    playbook.voiceSettings = updatedVoiceSettings;

    const updated = await this.prisma.aiAgentSettings.update({
      where: { id: existing.id },
      data: {
        ...rest,
        approvedPlaybook: playbook as unknown as Prisma.InputJsonValue,
        language: normalizedLang,
        ...(resolvedPrompt !== undefined && { systemPrompt: resolvedPrompt }),
        ...(llmModel !== undefined && {
          llmModel: this.normalizeLlmModel(llmModel),
        }),
        ...(workingHours !== undefined && {
          workingHours: workingHours as Prisma.InputJsonValue,
        }),
      },
    });
    this.invalidateSettingsCache();
    this.voice.setActiveVoiceSettings(updatedVoiceSettings);
    return {
      ...updated,
      voiceSettings: updatedVoiceSettings,
      voiceStability: updatedVoiceSettings.stability,
      voiceSimilarity: updatedVoiceSettings.similarityBoost,
      voiceStyle: updatedVoiceSettings.style,
      voiceSpeed: updatedVoiceSettings.speed,
      voiceSpeakerBoost: updatedVoiceSettings.useSpeakerBoost,
    };
  }

  async uploadKnowledgeBase(files: string[]) {
    const settings = await this.getSettings();
    const currentKb = Array.isArray(settings.knowledgeBase)
      ? (settings.knowledgeBase as string[])
      : [];
    return this.prisma.aiAgentSettings.update({
      where: { id: settings.id },
      data: {
        knowledgeBase: [...currentKb, ...files],
      },
    });
  }

  async previewVoice(options?: {
    text?: string;
    speaker?: string;
    language?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
    useSpeakerBoost?: boolean;
  }) {
    const settings = await this.getSettings();
    const speaker = options?.speaker || settings.agentVoice || 'custom';
    const language = options?.language || settings.language || 'hi-IN';
    const isMale = this.voice.voiceGender(speaker) === 'male';
    const fallbackName = isMale ? 'अमन' : 'Aria';
    const agentLabel = String(settings.agentName || fallbackName)
      .split(/[-–—|:/]/)[0]
      .trim()
      .split(/\s+/)[0] || fallbackName;
    const defaultText = isMale
      ? `नमस्ते, मैं ${agentLabel} बोल रहा हूँ real estate team से... आज आपकी कैसे help कर सकता हूँ?`
      : `नमस्ते, मैं ${agentLabel} बोल रही हूँ real estate team से... आज आपकी कैसे help कर सकती हूँ?`;
    const text = options?.text?.trim() || defaultText;

    if (!text) throw new BadRequestException('Preview text is required');

    const voiceSettings = (settings as any).voiceSettings || {};
    const stability = typeof options?.stability === 'number' ? options.stability : (voiceSettings.stability ?? 0.50);
    const similarityBoost = typeof options?.similarityBoost === 'number' ? options.similarityBoost : (voiceSettings.similarityBoost ?? 0.80);
    const style = typeof options?.style === 'number' ? options.style : (voiceSettings.style ?? 0.05);
    const pace = typeof options?.speed === 'number' ? options.speed : (voiceSettings.speed ?? 1.0);
    const useSpeakerBoost = typeof options?.useSpeakerBoost === 'boolean' ? options.useSpeakerBoost : (voiceSettings.useSpeakerBoost ?? true);

    const result = await this.voice.textToSpeech({
      text,
      speaker,
      language,
      skipSave: true,
      modelId: 'eleven_multilingual_v2',
      pace,
      stability,
      similarityBoost,
      style,
      useSpeakerBoost,
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
}
