import { Injectable, Logger } from '@nestjs/common';
import { CallOutcome, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import {
  buildFollowUpReply,
  compactToneGuide,
  detectIntent,
  extractFactsFromText,
  factsFromLead,
  inferBudgetFromShortReply,
  isSameTalk,
  isShortAffirmation,
  isShortDecline,
  lastAgentLine,
  lastAgentAskedTalkPermission,
  lastAgentOfferedCallback,
  lastAgentOfferedDetails,
  lastAgentWasSoftClose,
  mergeFacts,
  parseBudgetToNumber,
  priorAgentAsked,
  resolveContextualShortReply,
  resolveSpeechGender,
} from '../calls/call-scripts';
import {
  buildVariedOpening,
  parseOpenerLearning,
  type OpenerStyle,
} from '../calls/opener-bank';
import {
  mentionsSayaRajNagarExtension,
  normalizeKnownLocation,
  SAYA_RAJ_NAGAR_EXTENSION,
} from '../elevenlabs/place-names';
import {
  buildDefaultSalesAgentPrompt,
  fillSalesAgentPrompt,
  isSalesAgentPrompt,
} from './sales-agent-prompt';
import {
  formatPlaybookForPrompt,
  latestOpeningStyleTip,
} from '../ai/playbook';
import { parseMeetingSlot } from '../appointments/meeting-time';
import {
  computeInterestScore,
  interestLevelFromScore,
} from './interest-score';

/** Split streaming buffer into speakable chunks for early TTS. */
export function pullSpokenSentences(
  buffer: string,
  options?: { force?: boolean; minChars?: number },
): { sentences: string[]; rest: string } {
  const minChars = options?.minChars ?? 12;
  const text = buffer || '';
  const sentences: string[] = [];
  let rest = text;

  const endRe = /[.!?।\n]+/g;
  let match: RegExpExecArray | null;
  let lastCut = 0;
  while ((match = endRe.exec(text)) != null) {
    const end = match.index + match[0].length;
    const chunk = text.slice(lastCut, end).trim();
    if (chunk.length >= Math.min(6, minChars)) {
      sentences.push(chunk);
      lastCut = end;
    }
  }
  rest = text.slice(lastCut);

  // Soft cut ASAP so first TTS can start before full sentence
  if (!sentences.length && rest.length >= 24) {
    const soft = rest.search(/[,，;:][\s]+/);
    if (soft >= 12) {
      const chunk = rest.slice(0, soft + 1).trim();
      if (chunk) {
        sentences.push(chunk);
        rest = rest.slice(soft + 1);
      }
    }
  }
  if (options?.force && rest.trim()) {
    sentences.push(rest.trim());
    rest = '';
  }

  return { sentences, rest };
}

const UNBACKED_PROMISE_RE =
  /\b(?:cab|taxi|pick\s*-?\s*up|gaadi\s+bhej\w*|car\s+bhej\w*|free\s+gift)\b|कैब|टैक्सी|पिकअप|गाड़ी\s+भेज|फ्री\s+गिफ्ट/i;

/** Drop clauses promising services (cab, pickup, gifts) that the Knowledge never mentions. */
export function dropUnbackedPromises(text: string, knowledge: string): string {
  if (!UNBACKED_PROMISE_RE.test(text) || UNBACKED_PROMISE_RE.test(knowledge)) {
    return text;
  }
  const kept = text
    .split(/(?<=[,;.!?।])\s+/)
    .filter((part) => !UNBACKED_PROMISE_RE.test(part));
  if (!kept.length) return '';
  return kept
    .join(' ')
    .trim()
    .replace(/[,;:]$/, '.');
}

function leadOnlyText(transcript?: string | null): string {
  if (!transcript) return '';
  return transcript
    .split('\n')
    .filter((line) => /^lead:/i.test(line.trim()))
    .map((line) => line.replace(/^lead:\s*/i, ''))
    .join(' ');
}

export type DetectedLanguage =
  | 'en-IN'
  | 'hi-IN'
  | 'hinglish'
  | 'mr-IN'
  | 'gu-IN'
  | 'ta-IN'
  | 'te-IN'
  | 'kn-IN'
  | 'bn-IN'
  | 'pa-IN'
  | 'mixed';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private knowledge: KnowledgeService,
  ) {}

  detectLanguage(text: string, fallback?: string): DetectedLanguage {
    const t = text || '';
    const hasDevanagari = /[\u0900-\u097F]/.test(t);
    const hasGujarati = /[\u0A80-\u0AFF]/.test(t);
    const hasBengali = /[\u0980-\u09FF]/.test(t);
    const hasGurmukhi = /[\u0A00-\u0A7F]/.test(t);
    const hasTamil = /[\u0B80-\u0BFF]/.test(t);
    const hasTelugu = /[\u0C00-\u0C7F]/.test(t);
    const hasKannada = /[\u0C80-\u0CFF]/.test(t);
    const latin = t.replace(/[^\p{L}]/gu, '');
    const latinRatio = latin.length
      ? (latin.match(/[A-Za-z]/g) || []).length / latin.length
      : 0;

    if (hasTamil) return 'ta-IN';
    if (hasTelugu) return 'te-IN';
    if (hasKannada) return 'kn-IN';
    if (hasBengali) return 'bn-IN';
    if (hasGurmukhi) return 'pa-IN';
    if (hasGujarati && !hasDevanagari) return 'gu-IN';
    if (hasDevanagari) {
      if (/आहे|तुमच्या|आम्ही|कृपया|नाही|काय/.test(t)) return 'mr-IN';
      if (latinRatio > 0.25) return 'hinglish';
      return 'hi-IN';
    }

    const lower = t.toLowerCase();
    const hinglishMarkers =
      /(hai|hain|kya|nahi|accha|bahut|aap|mujhe|chahiye|theek|bilkul|matlb|samajh|batao|bolo|karo|rahenge)/i.test(
        lower,
      );
    if (hinglishMarkers && /[a-z]/i.test(t)) return 'hinglish';
    if (latinRatio > 0.7 && /[a-z]{3,}/i.test(t)) return 'en-IN';
    if (
      fallback === 'hinglish' ||
      fallback === 'hi-IN' ||
      fallback === 'mr-IN' ||
      fallback === 'gu-IN' ||
      fallback === 'en-IN' ||
      fallback === 'ta-IN' ||
      fallback === 'te-IN' ||
      fallback === 'kn-IN' ||
      fallback === 'bn-IN' ||
      fallback === 'pa-IN'
    ) {
      return fallback as DetectedLanguage;
    }
    return 'en-IN';
  }

  /** True when message is too short/ambiguous to switch language (ok, haan, yes…). */
  private isAmbiguousLanguageCue(text: string): boolean {
    const t = (text || '').trim();
    if (!t) return true;
    if (t.split(/\s+/).length <= 2 && t.length < 18) {
      return /^(ok+|okay|haan|han|ha|yes|yeah|no|nahi|nhi|नहीं|हाँ|जी|theek|bilkul|hmm+|ach+a+|sure|right|ji)\.?$/i.test(
        t.replace(/[.!?,]/g, ''),
      );
    }
    return false;
  }

  /**
   * Mirror the customer's language. Clear switch → follow them.
   * Ambiguous short replies → keep sticky/prior language.
   */
  resolveReplyLanguage(options: {
    userMessage: string;
    priorTranscript?: string | null;
    stickyLanguage?: string | null;
    fallback?: string;
  }): DetectedLanguage {
    const sticky =
      options.stickyLanguage === 'mixed'
        ? 'hinglish'
        : (options.stickyLanguage as DetectedLanguage | undefined);
    const leadPrior = leadOnlyText(options.priorTranscript);
    const priorDetected = leadPrior
      ? this.detectLanguage(leadPrior, sticky || options.fallback || 'hinglish')
      : sticky || this.detectLanguage('', options.fallback || 'hinglish');

    if (this.isAmbiguousLanguageCue(options.userMessage)) {
      return (sticky || priorDetected || 'hinglish') as DetectedLanguage;
    }

    const fromMessage = this.detectLanguage(
      options.userMessage,
      sticky || priorDetected || options.fallback || 'hinglish',
    );
    return fromMessage === 'mixed' ? 'hinglish' : fromMessage;
  }

  private languageInstruction(lang: DetectedLanguage): string {
    switch (lang) {
      case 'en-IN':
        return 'Reply ONLY in natural Indian English. Do not switch to Hindi.';
      case 'hi-IN':
        return 'Reply ONLY in Hindi using Devanagari script. Keep common nouns like budget/BHK in English if natural. Do not switch to English sentences.';
      case 'mr-IN':
        return 'Reply ONLY in Marathi. Do not switch language.';
      case 'gu-IN':
        return 'Reply ONLY in Gujarati. Do not switch language.';
      case 'ta-IN':
        return 'Reply ONLY in Tamil. Do not switch language.';
      case 'te-IN':
        return 'Reply ONLY in Telugu. Do not switch language.';
      case 'kn-IN':
        return 'Reply ONLY in Kannada. Do not switch language.';
      case 'bn-IN':
        return 'Reply ONLY in Bengali. Do not switch language.';
      case 'pa-IN':
        return 'Reply ONLY in Punjabi. Do not switch language.';
      case 'hinglish':
      case 'mixed':
      default:
        return "Reply in Hinglish: Hindi in Devanagari + simple English nouns (budget, bedroom, location, meeting). Match the customer's mix. Do not suddenly switch to pure English.";
    }
  }

  /** Script banks only cover a few langs — map others to closest safe fallback. */
  private scriptLanguage(lang: DetectedLanguage): string {
    if (
      lang === 'en-IN' ||
      lang === 'hi-IN' ||
      lang === 'hinglish' ||
      lang === 'mr-IN' ||
      lang === 'gu-IN'
    ) {
      return lang;
    }
    return 'en-IN';
  }
  async ensureProjectKnowledge(projectId: string) {
    return this.knowledge.ensureProjectWebsiteKnowledge(projectId);
  }

  async buildOpening(options: {
    lead: {
      id: string;
      name: string;
      budget?: number | null;
      project?: {
        id?: string;
        name?: string | null;
        companyName?: string | null;
        builder?: string | null;
        location?: string | null;
      } | null;
    };
    agentName: string;
    companyName?: string;
    language?: string;
    tone?: string;
    agentVoice?: string;
    /** From AI settings approvedPlaybook.openerLearning */
    openerLearning?: unknown;
  }) {
    const hasLinkedProject = Boolean(options.lead.project?.id || options.lead.project?.name);
    const projectName = options.lead.project?.name || undefined;
    const company =
      options.companyName ||
      options.lead.project?.companyName ||
      options.lead.project?.builder ||
      'Saya Group';

    const learning = parseOpenerLearning(options.openerLearning);
    const openingTip = latestOpeningStyleTip(options.openerLearning);
    const opening = buildVariedOpening({
      leadName: options.lead.name,
      agentName: options.agentName,
      projectName,
      companyName: company,
      builderName: options.lead.project?.builder,
      // Always Hindi-first open (sales agent rule); later turns mirror customer
      language: 'hi-IN',
      tone: options.tone,
      agentVoice: options.agentVoice,
      learning,
      hasLinkedProject,
      openingTip,
    });

    return {
      text: opening.text,
      language: opening.language,
      openerStyle: opening.style as OpenerStyle,
      known: factsFromLead({ ...options.lead, trustProfileBudget: false }),
    };
  }

  async reply(options: {
    lead: {
      id: string;
      name: string;
      budget?: number | null;
      preferredLanguage?: string | null;
      preferredLocation?: string | null;
      bhkPreference?: string | null;
      purchaseTimeline?: string | null;
      projectId?: string | null;
      project?: {
        id: string;
        name: string;
        companyName?: string | null;
        builder?: string | null;
        location?: string | null;
        startingPrice?: number | null;
        endingPrice?: number | null;
        reraNumber?: string | null;
        possessionDate?: Date | null;
        amenities?: unknown;
        description?: string | null;
      } | null;
    };
    userMessage: string;
    priorTranscript?: string | null;
    agentName: string;
    companyName?: string;
    defaultLanguage?: string;
    tone?: string;
    systemPrompt?: string | null;
    llmModel?: string;
    approvedPlaybook?: unknown;
    agentVoice?: string;
    /** Low-latency phone path: shorter replies + harder LLM timeout */
    phoneLatency?: boolean;
    /** Stream LLM tokens; fire onSentence as spoken chunks complete */
    stream?: boolean;
    onTextDelta?: (delta: string) => void;
    onSentence?: (sentence: string) => void | Promise<void>;
  }) {
    const speechGender = resolveSpeechGender({
      agentName: options.agentName,
      agentVoice: options.agentVoice,
    });
    const detected = this.resolveReplyLanguage({
      userMessage: options.userMessage,
      priorTranscript: options.priorTranscript,
      stickyLanguage: options.defaultLanguage,
      fallback: options.lead.preferredLanguage || options.defaultLanguage || 'hi-IN',
    });
    const replyLang = detected === 'mixed' ? 'hinglish' : detected;
    let projectId = options.lead.projectId || options.lead.project?.id || undefined;
    let resolvedProject = options.lead.project || null;
    const previousAgentEarly = lastAgentLine(options.priorTranscript);
    const intentEarly = detectIntent(options.userMessage);
    const contextualEarly = resolveContextualShortReply({
      userMessage: options.userMessage,
      priorTranscript: options.priorTranscript,
    });
    const shortCueEarly =
      isShortAffirmation(options.userMessage) ||
      isShortDecline(options.userMessage);
    const liveTurn = Boolean(options.stream || options.phoneLatency);
    // Fast path: clear intents / short yes-no — skip RAG + Gemini entirely
    const scriptFast =
      liveTurn &&
      (intentEarly.callback ||
        intentEarly.notInterested ||
        intentEarly.askingWhyCall ||
        intentEarly.statingBhk ||
        intentEarly.statingPossession ||
        intentEarly.statingVisitDay ||
        intentEarly.askingPrice ||
        contextualEarly != null ||
        (shortCueEarly &&
          (lastAgentWasSoftClose(previousAgentEarly) ||
            lastAgentAskedTalkPermission(previousAgentEarly) ||
            lastAgentOfferedCallback(previousAgentEarly) ||
            lastAgentOfferedDetails(previousAgentEarly) ||
            intentEarly.positive)));

    if (scriptFast) {
      const knownFast = mergeFacts(
        factsFromLead({
          ...options.lead,
          trustProfileBudget: Boolean(
            options.lead.budget != null && Number(options.lead.budget) > 0,
          ),
        }),
        {
          location: options.lead.preferredLocation || undefined,
          bhk: options.lead.bhkPreference || undefined,
          timeline: options.lead.purchaseTimeline || undefined,
        },
        extractFactsFromText(leadOnlyText(options.priorTranscript)),
        extractFactsFromText(options.userMessage),
      );
      const fallback = buildFollowUpReply({
        transcript: options.userMessage,
        leadName: options.lead.name,
        language: this.scriptLanguage(replyLang),
        tone: options.tone || 'friendly',
        priorTranscript: options.priorTranscript,
        knownFacts: {
          budgetLabel: knownFast.budgetLabel,
          location: knownFast.location,
          interested: knownFast.interested,
          bhk: knownFast.bhk,
          possession: knownFast.possession,
          visitDay: knownFast.visitDay,
        },
        speechGender,
        agentVoice: options.agentVoice,
      });
      let replyText = this.stripBannedPhrases(
        this.fixGenderedSpeech(fallback.text, speechGender),
      );
      if (options.stream && options.onSentence) {
        void Promise.resolve(options.onSentence(replyText));
      }
      this.logger.log(
        `Fast script (${contextualEarly?.kind || 'intent'}) — no RAG/LLM: "${options.userMessage.slice(0, 40)}"`,
      );
      const qualification = await this.extractQualification({
        userMessage: options.userMessage,
        replyText,
        priorTranscript: options.priorTranscript,
        known: knownFast,
        language: replyLang,
        llmModel: options.llmModel,
        skipLlm: true,
      });
      return {
        replyText,
        languageDetected: replyLang,
        sources: [],
        qualification,
        usedLlm: false,
        known: knownFast,
        resolvedProjectId: projectId || null,
        resolvedProjectName: resolvedProject?.name || null,
      };
    }

    // No linked project → try match from customer speech (and transcript) against CRM projects
    // Skip heavy project scan on ultra-low-latency phone turns unless they named something
    if (
      !projectId &&
      (!options.phoneLatency ||
        /saya|साया|project|property|राज\s*नगर|noida|extension/i.test(
          options.userMessage,
        ))
    ) {
      const matched = await this.matchProjectFromSpeech(
        [options.userMessage, options.priorTranscript || ''].join('\n'),
      );
      if (matched) {
        projectId = matched.id;
        resolvedProject = matched;
      }
    }

    const asksDetail =
      /detail|details|बताओ|बताइए|price|rera|emi|amenit|possession|payment|floor|website|location|क्या है|कितना|सुविधा|about|info|information|features|brochure|configuration|config/i.test(
        options.userMessage,
      );

    // Hit RAG only when customer clearly asks for facts (phone: avoid KB delay on chit-chat)
    const newlyMatched = Boolean(projectId && !options.lead.projectId);
    const sources =
      projectId && (asksDetail || (!options.phoneLatency && newlyMatched))
        ? await this.knowledge.retrieve(
            projectId,
            options.userMessage,
            options.phoneLatency ? 1 : newlyMatched ? 3 : 2,
            {
              lexicalOnly: true,
            },
          )
        : [];

    // Prefetch website knowledge once we resolve a project mid-call
    if (newlyMatched && projectId) {
      void this.knowledge
        .ensureProjectWebsiteKnowledge(projectId)
        .catch(() => undefined);
    }

    const known = mergeFacts(
      // Use saved budget only if a previous call already captured it
      factsFromLead({
        ...options.lead,
        trustProfileBudget: Boolean(
          options.lead.budget != null && Number(options.lead.budget) > 0,
        ),
      }),
      {
        location: options.lead.preferredLocation || undefined,
        bhk: options.lead.bhkPreference || undefined,
        timeline: options.lead.purchaseTimeline || undefined,
      },
      extractFactsFromText(leadOnlyText(options.priorTranscript)),
      extractFactsFromText(options.userMessage),
    );
    // Budget is usually unknown on the lead — capture from this call
    if (!known.budgetLabel) {
      const asked = priorAgentAsked(options.priorTranscript);
      const inferred = inferBudgetFromShortReply(options.userMessage, {
        agentAskedBudget: asked.askedBudget,
      });
      if (inferred) known.budgetLabel = inferred;
    }
    if (mentionsSayaRajNagarExtension(options.userMessage)) {
      known.location = SAYA_RAJ_NAGAR_EXTENSION;
    } else if (known.location) {
      known.location =
        normalizeKnownLocation(known.location) || known.location;
    }

    const previousAgent = lastAgentLine(options.priorTranscript);

    const projectContext = resolvedProject
      ? [
          `Project: ${resolvedProject.name}`,
          `Location: ${resolvedProject.location || 'not set'}`,
          `Builder/Company: ${resolvedProject.companyName || resolvedProject.builder || ''}`,
          resolvedProject.startingPrice != null
            ? `Price range: ${resolvedProject.startingPrice} - ${resolvedProject.endingPrice}`
            : null,
          resolvedProject.reraNumber
            ? `RERA: ${resolvedProject.reraNumber}`
            : null,
          resolvedProject.possessionDate
            ? `Possession: ${new Date(resolvedProject.possessionDate).toISOString().slice(0, 10)}`
            : null,
          resolvedProject.description
            ? `Description: ${String(resolvedProject.description).slice(0, 220)}`
            : null,
        ]
          .filter(Boolean)
          .join('\n')
      : `No project linked yet. Available projects in CRM will be matched when the customer names one.
IMPORTANT: First discover which property/project they want and which configuration (2BHK / 3BHK / etc.).
Do NOT invent prices or features. Once they name a project, answer only from Knowledge below (if any).
If they have not named a project yet, ask ONE short question: which project / property are they looking at.`;

    const ragBlock = sources.length
      ? sources
          .map(
            (s, i) =>
              `[${i + 1}:${s.source.title}] ${s.content.replace(/\s+/g, ' ').slice(0, 280)}`,
          )
          .join('\n')
      : '';

    const playbook =
      formatPlaybookForPrompt(options.approvedPlaybook, options.phoneLatency ? 320 : 600);

    const recentTranscript = (options.priorTranscript || '')
      .split('\n')
      .filter((l) => l.trim())
      .slice(options.phoneLatency ? -4 : -8)
      .join('\n');

    const company =
      options.companyName ||
      resolvedProject?.companyName ||
      resolvedProject?.builder ||
      'Saya Group';
    const productName = resolvedProject?.name || 'the property they choose';

    const genderLines =
      speechGender === 'female'
        ? 'Female Hindi: बोल रही हूँ / समझ गई. Never male forms.'
        : 'Male Hindi: बोल रहा हूँ / समझ गया. Never female forms.';

    // Phone: think + answer customer first (LLM); script only if LLM fails
    const system = options.phoneLatency
      ? `You are ${options.agentName}, live RE telecaller for ${company}.
${genderLines}
Speak ${replyLang}. ${this.languageInstruction(replyLang)}
THINK about what the customer just said, then reply.
Rules:
1) If they ask why you called → say property enquiry aayi thi, soft check — do NOT jump to possession/BHK.
2) If they refuse / nahi chahiye / rakho phone / kuch nahi → thank them and stop.
3) Never ignore their question. Never repeat your last line.
4) Fresh wording. No budget-first. No inventing inventory.
5) Never promise cab/pickup, gifts, discounts or any service not in Knowledge.
Flow only after they engage: plan → 2/3 bed → ready vs construction → Knowledge options → visit.
Facts: ${JSON.stringify(known)}
Project: ${resolvedProject?.name || 'unknown'} ${resolvedProject?.location || ''}
${ragBlock ? `Knowledge:\n${ragBlock.slice(0, 500)}` : ''}
${playbook ? playbook : ''}
${previousAgent ? `Do not repeat: ${previousAgent.slice(0, 100)}` : ''}
Answer thoughtfully in one short spoken reply.`
      : `${(() => {
          const salesTemplate = isSalesAgentPrompt(options.systemPrompt)
            ? String(options.systemPrompt)
            : buildDefaultSalesAgentPrompt();
          return fillSalesAgentPrompt(salesTemplate, {
            company_name: company,
            customer_name: options.lead.name || 'ji',
            product_name: productName,
            lead_source: 'enquiry',
            previous_interaction: recentTranscript
              ? recentTranscript.slice(0, 280)
              : 'none',
            location:
              known.location ||
              options.lead.preferredLocation ||
              resolvedProject?.location ||
              'not shared yet',
            agent_name: options.agentName,
            date: 'the agreed date',
            time: 'the agreed time',
            requirement: known.bhk || known.location || 'to be confirmed',
            budget: known.budgetLabel || 'to be confirmed',
            timeline: known.timeline || 'to be confirmed',
            objections: 'none noted yet',
            questions: options.userMessage.slice(0, 120),
            next_action: resolvedProject
              ? 'answer from knowledge / continue qualify'
              : 'ask which project and configuration',
            short_summary: resolvedProject
              ? 'live call — project identified'
              : 'live call — discover project first',
          });
        })()}

## LIVE CALL RUNTIME (CRITICAL)
You are ${options.agentName} calling now for ${company}.
Language: Customer is speaking in ${replyLang}. ${this.languageInstruction(replyLang)}
If they change language mid-call, follow and stay there.
${speechGender === 'female'
  ? 'You are female. Hindi first-person: बोल रही हूँ, समझ गई, सकती हूँ, चाहती हूँ, बताऊँगी, करूँगी. NEVER male forms (बोल रहा, समझ गया, सकता, चाहता, बताऊँगा, करूँगा). Use "Samajh gayi" not "Samajh gaya".'
  : 'You are male. Hindi first-person: बोल रहा हूँ, समझ गया, सकता हूँ, चाहता हूँ, बताऊँगा, करूँगा. NEVER female forms.'}
Tone: ${compactToneGuide(options.tone || 'friendly')}
CRITICAL UNDERSTANDING RULES:
1) FIRST understand the customer's last message. If they asked a question (e.g. "kis liye phone kiye"), ANSWER that question before any sales question.
2) If they refuse / "nahi chahiye" / "rakho phone" / don't want anything → polite thank-you and STOP. Do not restart discovery.
3) Never ignore them and jump to possession/BHK/budget.
4) Never repeat your previous line.
Engagement: React to their exact words. Never open with "Got it" / "Noted" / "Perfect".
Banned openers: Got it, Got it., Okay okay, Perfect, Noted.
Known facts so far: ${JSON.stringify(known)}
Known place: If they mention Saya / साया Raj Nagar Extension, remember exactly "${SAYA_RAJ_NAGAR_EXTENSION}" and say it as साया राज नगर एक्सटेंशन (never "Sayaa").
${previousAgent ? `Last reply (do not repeat): ${previousAgent.slice(0, 160)}` : ''}
${playbook ? `Playbook notes: ${playbook}` : ''}
Project:
${projectContext}
${ragBlock ? `Knowledge (answer from this; do not invent):\n${ragBlock}` : !resolvedProject ? `Knowledge: none yet — ask which project they mean, then answer from KB after it is identified.` : `Knowledge: none loaded — do not invent facts; offer to confirm and follow up.`}
Reply now in 1–2 short spoken sentences. Answer them first; one question max only if still appropriate.`;

    let replyText: string | null = null;
    let usedLlm = false;

    const llmMessages = [
      { role: 'system' as const, content: system },
      {
        role: 'user' as const,
        content: options.phoneLatency
          ? `Customer said: "${options.userMessage}"\nUnderstand their intent, then reply in one short spoken line:`
          : `Recent call:\n${recentTranscript || '(start)'}\n\nCustomer just said: "${options.userMessage}"\n\nFirst understand them. If they asked something, answer it. Then reply in 1–2 short sentences.`,
      },
    ];
    const voiceModel = options.llmModel || 'gemini-2.5-flash';
    const llmOpts = {
      temperature: 0.45,
      model: voiceModel,
      maxOutputTokens: options.phoneLatency || options.stream ? 60 : 120,
      timeoutMs: options.phoneLatency || options.stream ? 5000 : 8000,
      lowLatency: true,
    };

    let llmOut: string | null = null;
    const knowledgeText = sources.map((s) => s.content).join(' ');
    const onSentence = options.onSentence
      ? (sentence: string) => {
          const safe = dropUnbackedPromises(sentence, knowledgeText);
          if (safe) return options.onSentence!(safe);
        }
      : undefined;

    if (options.stream || options.phoneLatency) {
      // Tiny prompt for speed (full sales bible is too heavy for live turns)
      const learned = formatPlaybookForPrompt(
        options.approvedPlaybook,
        200,
      );
      const quickSystem = `You are ${options.agentName}, live RE phone agent for ${company}.
Speak ${replyLang}. ${genderLines}
CRITICAL: Reply to the customer's last message in context of YOUR previous line.
Your previous line: "${(previousAgent || '').slice(0, 120)}"
Rules: busy/baad me → callback stop. Soft-close + bilkul/ok → thank & END (no WhatsApp). Nahi to talk → soft close. WhatsApp only if they asked or you offered details and they said yes.
ONE short spoken sentence (max 18 words). No invent prices. No Got it/Noted.
Never promise cab/pickup, gifts, discounts or any service not in KB. For a visit, just fix day/time; say the team will confirm details.
Facts: ${JSON.stringify(known)}
${resolvedProject ? `Project: ${resolvedProject.name}` : ''}
${ragBlock ? `KB:\n${ragBlock.slice(0, 200)}` : ''}
${learned ? learned : ''}`;
      const quickMessages = [
        { role: 'system' as const, content: quickSystem },
        {
          role: 'user' as const,
          content: `Customer: "${options.userMessage}"\nReply only to that:`,
        },
      ];
      const t0 = Date.now();
      let streamed = false;
      if (options.stream && onSentence) {
        llmOut = await this.consumeLlmStream(quickMessages, llmOpts, {
          onTextDelta: options.onTextDelta,
          onSentence,
        });
        streamed = Boolean(llmOut);
        const remaining = llmOpts.timeoutMs - (Date.now() - t0);
        if (!llmOut && remaining > 800) {
          llmOut = await this.llm.chat(quickMessages, {
            ...llmOpts,
            timeoutMs: remaining,
          });
        }
      } else {
        llmOut = await this.llm.chat(quickMessages, llmOpts);
      }
      this.logger.log(
        `LLM live turn ${llmOut ? (streamed ? 'stream hit' : 'hit') : 'miss'} in ${Date.now() - t0}ms`,
      );
      if (llmOut && options.stream && !streamed) {
        options.onTextDelta?.(llmOut);
        const { sentences, rest } = pullSpokenSentences(`${llmOut}\n`, {
          force: true,
          minChars: 8,
        });
        const chunks = [...sentences, ...(rest.trim() ? [rest.trim()] : [])];
        for (const s of chunks) {
          if (onSentence) void Promise.resolve(onSentence(s));
        }
      }
    } else {
      llmOut = await this.llm.chat(llmMessages, llmOpts);
    }

    if (replyText == null && llmOut) {
      replyText = llmOut;
      usedLlm = true;
      // If LLM still echoed the last line, force a non-repeating scripted next step
      if (previousAgent && isSameTalk(replyText, previousAgent)) {
        const fallback = buildFollowUpReply({
          transcript: options.userMessage,
          leadName: options.lead.name,
          language: this.scriptLanguage(replyLang),
          tone: options.tone || 'friendly',
          priorTranscript: options.priorTranscript,
          knownFacts: {
            budgetLabel: known.budgetLabel,
            location: known.location,
            interested: known.interested,
          },
          speechGender,
          agentVoice: options.agentVoice,
        });
        replyText = fallback.text;
        usedLlm = false;
      }
    } else if (replyText == null) {
      const fallback = buildFollowUpReply({
        transcript: options.userMessage,
        leadName: options.lead.name,
        language: this.scriptLanguage(replyLang),
        tone: options.tone || 'friendly',
        priorTranscript: options.priorTranscript,
        knownFacts: {
          budgetLabel: known.budgetLabel,
          location: known.location,
          interested: known.interested,
        },
        speechGender,
        agentVoice: options.agentVoice,
      });
      replyText = fallback.text;
      // Use retrieved knowledge in scripted fallback when customer asks for details
      if (asksDetail && sources[0]) {
        const snippet = sources[0].content.replace(/\s+/g, ' ').slice(0, 180);
        const suffix =
          replyLang === 'en-IN' || this.scriptLanguage(replyLang) === 'en-IN'
            ? ` Anything else you'd like to know?`
            : replyLang === 'mr-IN'
              ? ` आणखी काही जाणून घ्यायचे असेल तर सांगा.`
              : replyLang === 'gu-IN'
                ? ` વધુ જાણવું હોય તો કહો.`
                : ` और कुछ जानना हो तो बताइए।`;
        const prefix =
          replyLang === 'en-IN' || this.scriptLanguage(replyLang) === 'en-IN'
            ? `Sure ${options.lead.name}. `
            : `अच्छा ${options.lead.name}. `;
        replyText = `${prefix}${snippet}${
          snippet.length >= 160 ? '…' : ''
        }${suffix}`;
      }
      if (options.onSentence && replyText) {
        void Promise.resolve(options.onSentence(replyText));
      }
      this.logger.warn(
        `LLM miss — scripted fallback for: "${options.userMessage.slice(0, 80)}"`,
      );
    }

    replyText = this.stripBannedPhrases(
      this.fixGenderedSpeech(replyText!, speechGender),
    );
    replyText =
      dropUnbackedPromises(replyText, knowledgeText) ||
      (this.scriptLanguage(replyLang) === 'en-IN'
        ? 'Sure, our team will confirm the visit details with you.'
        : 'ठीक है, हमारी टीम आपसे visit की details confirm कर लेगी।');

    // Heuristic qualification only (skip 2nd LLM call — major latency win)
    const qualification = await this.extractQualification({
      userMessage: options.userMessage,
      replyText,
      priorTranscript: options.priorTranscript,
      known,
      language: replyLang,
      llmModel: options.llmModel,
      skipLlm: true,
    });

    return {
      replyText: replyText!,
      languageDetected: replyLang,
      sources: sources.map((s) => ({
        chunkId: s.id,
        score: s.score,
        title: s.source.title,
        sourceType: s.source.sourceType,
        fileName: s.source.fileName,
        sourceUrl: s.source.sourceUrl,
        excerpt: s.content.slice(0, 280),
      })),
      qualification,
      usedLlm,
      known,
      /** Set when speech matched a CRM project (may auto-link the lead). */
      resolvedProjectId: projectId || null,
      resolvedProjectName: resolvedProject?.name || null,
    };
  }

  /** Consume streamed LLM tokens; emit spoken sentences early for TTS. */
  private async consumeLlmStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    opts: {
      temperature?: number;
      model?: string;
      maxOutputTokens?: number;
      timeoutMs?: number;
      lowLatency?: boolean;
    },
    hooks?: {
      onTextDelta?: (delta: string) => void;
      onSentence?: (sentence: string) => void | Promise<void>;
    },
  ): Promise<string | null> {
    let full = '';
    let pending = '';
    let emitted = 0;
    try {
      for await (const delta of this.llm.chatStream(messages, opts)) {
        if (!delta) continue;
        full += delta;
        pending += delta;
        hooks?.onTextDelta?.(delta);
        const { sentences, rest } = pullSpokenSentences(pending, {
          force: false,
        });
        pending = rest;
        for (const s of sentences) {
          emitted += 1;
          // Do not await TTS here — that stalls Gemini token streaming
          if (hooks?.onSentence) {
            void Promise.resolve(hooks.onSentence(s));
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `LLM stream consume failed: ${err instanceof Error ? err.message : err}`,
      );
    }
    const leftover = pending.trim();
    if (leftover) {
      emitted += 1;
      if (hooks?.onSentence) {
        await Promise.resolve(hooks.onSentence(leftover));
      }
    }
    // If stream failed with nothing, return null for scripted fallback
    if (!full.trim()) return null;
    // If echo/fallback replaces text later, early TTS already played — acceptable
    void emitted;
    return full.trim();
  }

  /**
   * Fuzzy-match customer speech against CRM project names / locations / builders.
   */
  async matchProjectFromSpeech(text: string): Promise<{
    id: string;
    name: string;
    companyName?: string | null;
    builder?: string | null;
    location?: string | null;
    startingPrice?: number | null;
    endingPrice?: number | null;
    reraNumber?: string | null;
    possessionDate?: Date | null;
    amenities?: unknown;
    description?: string | null;
  } | null> {
    const raw = (text || '').trim();
    if (raw.length < 3) return null;

    const projects = await this.prisma.project.findMany({
      select: {
        id: true,
        name: true,
        companyName: true,
        builder: true,
        location: true,
        startingPrice: true,
        endingPrice: true,
        reraNumber: true,
        possessionDate: true,
        amenities: true,
        description: true,
      },
      take: 50,
    });
    if (!projects.length) return null;

    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0900-\u097F]/g, (ch) => ch) // keep Devanagari
        .replace(/[^a-z0-9\u0900-\u097F\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const hay = norm(raw);
    // Common spoken aliases
    const hayExpanded = hay
      .replace(/\bsayaa?\b/g, 'saya')
      .replace(/\bsaa\s*ya\b/g, 'saya')
      .replace(/\braaj\b/g, 'raj')
      .replace(/\bext(?:ension)?\b/g, 'extension');

    let best: (typeof projects)[0] | null = null;
    let bestScore = 0;

    for (const p of projects) {
      const tokens = [p.name, p.location, p.builder, p.companyName]
        .filter(Boolean)
        .map((x) => norm(String(x)));
      let score = 0;
      for (const t of tokens) {
        if (!t || t.length < 3) continue;
        if (hayExpanded.includes(t) || hay.includes(t)) {
          score = Math.max(score, t.length);
          continue;
        }
        // Token overlap (e.g. "saya" + "raj nagar")
        const parts = t.split(' ').filter((w) => w.length >= 3);
        const hits = parts.filter((w) => hayExpanded.includes(w)).length;
        if (parts.length && hits / parts.length >= 0.6) {
          score = Math.max(score, Math.floor(t.length * (hits / parts.length)));
        }
      }
      // Saya Raj Nagar Extension special case
      if (
        /saya|साया/.test(hayExpanded) &&
        /raj\s*nagar|राज\s*नगर/.test(hayExpanded) &&
        /saya.*raj|साया.*राज/i.test(p.name)
      ) {
        score = Math.max(score, 40);
      }
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    return bestScore >= 4 ? best : null;
  }

  /** Strip वाह/bhai/Got it and other robotic openers from customer-facing speech. */
  private stripBannedPhrases(text: string): string {
    return text
      .replace(/(^|\s)वाह(?=[\s!?,.।]|$)[!?,.।]?\s*/g, '$1')
      .replace(/\bwah\b[!?,.]?\s*/gi, '')
      .replace(/\bbhai\b/gi, '')
      .replace(/भाई\s*/g, '')
      .replace(/\byaar bhai\b/gi, '')
      // Never keep repeating "Got it"
      .replace(/^(got it[.!,]?\s*)+/i, '')
      .replace(/\bgot it[.!,]?\s*/gi, '')
      .replace(/^(i understand[.!,]?\s*)+/i, '')
      .replace(/^(noted[.!,]?\s*)+/i, '')
      .replace(/^(okay okay[.!,]?\s*)+/i, '')
      .replace(/सही विकल्प के लिए आपका बजट कितना है\??/gi, '')
      .replace(/सही options के लिए आपका budget कितना है[^.?]*/gi, '')
      .replace(/Sahi options ke liye aapka budget kitna hai[^.?]*/gi, '')
      .replace(/To shortlist correctly, what budget are you considering\??/gi, '')
      .replace(/गलत time तो नहीं पकड़ा\?*/gi, '')
      .replace(/\?{2,}/g, '?')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([।.?!,])/g, '$1')
      .trim();
  }

  /** Force first-person Hindi/English forms to match agent voice gender. */
  private fixGenderedSpeech(text: string, gender: 'male' | 'female'): string {
    const pick = (m: string, f: string) => (gender === 'female' ? f : m);
    let out = text
      .replace(/समझ गया\/गई|समझ गया\/ गई/g, pick('समझ गया', 'समझ गई'))
      .replace(/samajh gaya\/gayi/gi, pick('samajh gaya', 'samajh gayi'))
      .replace(/bol raha\/rahi/gi, pick('bol raha', 'bol rahi'))
      .replace(/बोल रहा\/रही/g, pick('बोल रहा', 'बोल रही'))
      .replace(/sakta\/sakti/gi, pick('sakta', 'sakti'))
      .replace(/सकता\/सकती/g, pick('सकता', 'सकती'))
      .replace(/chahta\/chahti/gi, pick('chahta', 'chahti'))
      .replace(/चाहता\/चाहती/g, pick('चाहता', 'चाहती'))
      .replace(/karunga\/karungi/gi, pick('karunga', 'karungi'))
      .replace(/करूँगा\/करूँगी/g, pick('करूँगा', 'करूँगी'))
      .replace(/bataunga\/bataungi/gi, pick('bataunga', 'bataungi'))
      .replace(/बताऊँगा\/बताऊँगी/g, pick('बताऊँगा', 'बताऊँगी'))
      .replace(/सुझाऊँगा\/सुझाऊँगी/g, pick('सुझाऊँगा', 'सुझाऊँगी'));

    if (gender === 'female') {
      out = out
        .replace(/बोल रहा( हूँ| हूं)?/g, 'बोल रही$1')
        .replace(/समझ गया/g, 'समझ गई')
        .replace(/कर रहा( हूँ| हूं)?/g, 'कर रही$1')
        .replace(/रहा हूँ|रहा हूं/g, 'रही हूँ')
        .replace(/सकता हूँ|सकता हूं/g, 'सकती हूँ')
        .replace(/चाहता हूँ|चाहता हूं/g, 'चाहती हूँ')
        .replace(/बताऊँगा|बताऊंगा/g, 'बताऊँगी')
        .replace(/करूँगा|करूंगा/g, 'करूँगी')
        .replace(/लूँगा|लूंगा/g, 'लूँगी')
        .replace(/\bbol raha\b/gi, 'bol rahi')
        .replace(/\bsamajh gaya\b/gi, 'samajh gayi')
        .replace(/\bsakta hun\b/gi, 'sakti hun')
        .replace(/\bchahta hun\b/gi, 'chahti hun');
    } else {
      out = out
        .replace(/बोल रही( हूँ| हूं)?/g, 'बोल रहा$1')
        .replace(/समझ गई/g, 'समझ गया')
        .replace(/कर रही( हूँ| हूं)?/g, 'कर रहा$1')
        .replace(/रही हूँ|रही हूं/g, 'रहा हूँ')
        .replace(/सकती हूँ|सकती हूं/g, 'सकता हूँ')
        .replace(/चाहती हूँ|चाहती हूं/g, 'चाहता हूँ')
        .replace(/बताऊँगी|बताऊंगी/g, 'बताऊँगा')
        .replace(/करूँगी|करूंगी/g, 'करूँगा')
        .replace(/लूँगी|लूंगी/g, 'लूँगा')
        .replace(/\bbol rahi\b/gi, 'bol raha')
        .replace(/\bsamajh gayi\b/gi, 'samajh gaya')
        .replace(/\bsakti hun\b/gi, 'sakta hun')
        .replace(/\bchahti hun\b/gi, 'chahta hun');
    }
    return out;
  }

  private async extractQualification(input: {
    userMessage: string;
    replyText: string;
    priorTranscript?: string | null;
    known: ReturnType<typeof mergeFacts>;
    language: string;
    llmModel?: string;
    skipLlm?: boolean;
  }) {
    const base = {
      language: input.language,
      budgetLabel: input.known.budgetLabel || null,
      preferredLocation: input.known.location || null,
      bhkPreference: input.known.bhk || null,
      purchaseTimeline: null as string | null,
      interestLevel: input.known.interested ? 'high' : 'medium',
      interestScore: 4 as number,
      objections: null as string | null,
      siteVisitInterest: Boolean(input.known.askedVisit),
      callbackAt: null as string | null,
      outcome: 'CONNECTED' as string,
      summary: `${input.userMessage.slice(0, 80)} → ${input.replyText.slice(0, 100)}`,
      suggestedNextAction: 'Follow up with matching inventory',
    };

    const lower = input.userMessage.toLowerCase();
    if (/not interested|nahi chahiye|नहीं चाहिए/.test(lower)) {
      base.interestLevel = 'none';
      base.outcome = 'NOT_INTERESTED';
      base.suggestedNextAction = 'Mark not interested; no further calls unless requested';
    } else if (/callback|later|tomorrow|baad/.test(lower)) {
      base.outcome = 'CALLBACK_REQUESTED';
      base.suggestedNextAction = 'Schedule callback at preferred time';
    } else if (/site visit|visit|dekhna/.test(lower)) {
      base.siteVisitInterest = true;
      base.outcome = 'SITE_VISIT_INTERESTED';
      base.interestLevel = 'high';
      base.suggestedNextAction = 'Book site visit with project advisor';
    } else if (input.known.budgetLabel || input.known.location) {
      base.outcome = 'QUALIFIED';
      base.suggestedNextAction = 'Share matching units and propose site visit';
    }

    if (/month|months|weeks|days|this year|next year|jaldi|turant|3 month|6 month/.test(lower)) {
      const m = input.userMessage.match(
        /(?:within|in|by)?\s*(\d+\s*(?:day|days|week|weeks|month|months|year|years)|this year|next year|jaldi|turant)/i,
      );
      base.purchaseTimeline = m?.[1] || input.userMessage.slice(0, 80);
    }

    // Capture concrete meeting datetime when customer says e.g. "kal 4 baje"
    const slot = parseMeetingSlot(input.userMessage, input.priorTranscript);
    if (slot) {
      (base as { meetingAt?: string }).meetingAt = slot.startIso;
      base.siteVisitInterest = true;
      if (base.outcome === 'CONNECTED' || base.outcome === 'QUALIFIED') {
        base.outcome = 'SITE_VISIT_INTERESTED';
      }
      base.suggestedNextAction = `Meeting ${slot.label}`;
    }

    base.interestScore = computeInterestScore({
      userMessage: input.userMessage,
      priorTranscript: input.priorTranscript,
      known: input.known,
      outcome: base.outcome,
      siteVisitInterest: base.siteVisitInterest,
      meetingBooked: Boolean((base as { meetingAt?: string }).meetingAt),
    });
    base.interestLevel = `${interestLevelFromScore(base.interestScore)} (${base.interestScore}/10)`;

    if (input.skipLlm) {
      return base;
    }

    const llmJson = await this.llm.chat(
      [
        {
          role: 'system',
          content:
            'Extract lead qualification JSON with keys: language, budgetLabel, preferredLocation, bhkPreference, purchaseTimeline, interestLevel, interestScore (integer 0-10 how interested the lead is in buying/visiting), objections, siteVisitInterest, callbackAt, outcome, summary, suggestedNextAction. outcome one of CONNECTED, QUALIFIED, CALLBACK_REQUESTED, SITE_VISIT_INTERESTED, NOT_INTERESTED. summary max 2 sentences.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            prior: input.priorTranscript,
            customer: input.userMessage,
            agent: input.replyText,
            known: input.known,
            seed: base,
          }),
        },
      ],
      {
        temperature: 0,
        json: true,
        model: input.llmModel || 'gemini-3.5-flash-lite',
        maxOutputTokens: 250,
      },
    );

    if (llmJson) {
      try {
        const parsed = JSON.parse(llmJson) as Record<string, unknown>;
        const merged = { ...base, ...parsed };
        const rawScore = Number(parsed.interestScore);
        merged.interestScore = Number.isFinite(rawScore)
          ? Math.max(0, Math.min(10, Math.round(rawScore)))
          : computeInterestScore({
              userMessage: input.userMessage,
              priorTranscript: input.priorTranscript,
              known: input.known,
              outcome: String(merged.outcome || base.outcome),
              siteVisitInterest: Boolean(merged.siteVisitInterest),
              meetingBooked: Boolean(
                (merged as { meetingAt?: string }).meetingAt,
              ),
              previousScore: base.interestScore,
            });
        merged.interestLevel = `${interestLevelFromScore(merged.interestScore)} (${merged.interestScore}/10)`;
        return merged;
      } catch {
        this.logger.warn('Failed to parse qualification JSON');
      }
    }

    return base;
  }

  mapOutcomeToLeadStatus(outcome: string): LeadStatus {
    switch (outcome) {
      case 'NOT_INTERESTED':
        return LeadStatus.NOT_INTERESTED;
      case 'CALLBACK_REQUESTED':
        return LeadStatus.CALLBACK_REQUESTED;
      case 'SITE_VISIT_INTERESTED':
        return LeadStatus.SITE_VISIT_INTERESTED;
      case 'QUALIFIED':
        return LeadStatus.QUALIFIED;
      default:
        return LeadStatus.CONTACTED;
    }
  }

  mapOutcomeEnum(outcome: string): CallOutcome {
    switch (outcome) {
      case 'NOT_INTERESTED':
        return CallOutcome.NOT_INTERESTED;
      case 'CALLBACK_REQUESTED':
        return CallOutcome.CALLBACK_REQUESTED;
      case 'SITE_VISIT_INTERESTED':
        return CallOutcome.SITE_VISIT_INTERESTED;
      case 'QUALIFIED':
        return CallOutcome.QUALIFIED;
      default:
        return CallOutcome.CONNECTED;
    }
  }

  async applyQualificationToLead(
    leadId: string,
    qualification: Record<string, unknown>,
  ) {
    const budgetLabel = String(qualification.budgetLabel || '');
    const budget = parseBudgetToNumber(budgetLabel);

    const outcome = String(qualification.outcome || 'CONNECTED');
    const data: Prisma.LeadUpdateInput = {
      preferredLanguage: String(qualification.language || '') || undefined,
      preferredLocation:
        (qualification.preferredLocation as string) || undefined,
      bhkPreference: (qualification.bhkPreference as string) || undefined,
      purchaseTimeline: (qualification.purchaseTimeline as string) || undefined,
      interestLevel: (qualification.interestLevel as string) || undefined,
      interestScore:
        typeof qualification.interestScore === 'number'
          ? Math.max(0, Math.min(10, Math.round(Number(qualification.interestScore))))
          : undefined,
      objections: (qualification.objections as string) || undefined,
      siteVisitInterest: Boolean(qualification.siteVisitInterest),
      suggestedNextAction:
        (qualification.suggestedNextAction as string) || undefined,
      aiSummary: (qualification.summary as string) || undefined,
      status: this.mapOutcomeToLeadStatus(outcome),
      lastQualifiedAt: new Date(),
      ...(budget ? { budget } : {}),
      ...(qualification.callbackAt
        ? { callbackAt: new Date(String(qualification.callbackAt)) }
        : {}),
      ...(outcome === 'NOT_INTERESTED' ? { doNotCall: false } : {}),
    };

    return this.prisma.lead.update({ where: { id: leadId }, data });
  }
}
