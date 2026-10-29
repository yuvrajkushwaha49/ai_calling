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
var ConversationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
exports.pullSpokenSentences = pullSpokenSentences;
exports.dropUnbackedPromises = dropUnbackedPromises;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const llm_service_1 = require("../llm/llm.service");
const knowledge_service_1 = require("../knowledge/knowledge.service");
const call_scripts_1 = require("../calls/call-scripts");
const opener_bank_1 = require("../calls/opener-bank");
const place_names_1 = require("../elevenlabs/place-names");
const sales_agent_prompt_1 = require("./sales-agent-prompt");
const playbook_1 = require("../ai/playbook");
const meeting_time_1 = require("../appointments/meeting-time");
const interest_score_1 = require("./interest-score");
function pullSpokenSentences(buffer, options) {
    const minChars = options?.minChars ?? 12;
    const text = buffer || '';
    const sentences = [];
    let rest = text;
    const endRe = /[.!?।\n]+/g;
    let match;
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
const UNBACKED_PROMISE_RE = /\b(?:cab|taxi|pick\s*-?\s*up|gaadi\s+bhej\w*|car\s+bhej\w*|free\s+gift)\b|कैब|टैक्सी|पिकअप|गाड़ी\s+भेज|फ्री\s+गिफ्ट/i;
function dropUnbackedPromises(text, knowledge) {
    if (!UNBACKED_PROMISE_RE.test(text) || UNBACKED_PROMISE_RE.test(knowledge)) {
        return text;
    }
    const kept = text
        .split(/(?<=[,;.!?।])\s+/)
        .filter((part) => !UNBACKED_PROMISE_RE.test(part));
    if (!kept.length)
        return '';
    return kept
        .join(' ')
        .trim()
        .replace(/[,;:]$/, '.');
}
function leadOnlyText(transcript) {
    if (!transcript)
        return '';
    return transcript
        .split('\n')
        .filter((line) => /^lead:/i.test(line.trim()))
        .map((line) => line.replace(/^lead:\s*/i, ''))
        .join(' ');
}
let ConversationService = ConversationService_1 = class ConversationService {
    prisma;
    llm;
    knowledge;
    logger = new common_1.Logger(ConversationService_1.name);
    constructor(prisma, llm, knowledge) {
        this.prisma = prisma;
        this.llm = llm;
        this.knowledge = knowledge;
    }
    detectLanguage(text, fallback) {
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
        if (hasTamil)
            return 'ta-IN';
        if (hasTelugu)
            return 'te-IN';
        if (hasKannada)
            return 'kn-IN';
        if (hasBengali)
            return 'bn-IN';
        if (hasGurmukhi)
            return 'pa-IN';
        if (hasGujarati && !hasDevanagari)
            return 'gu-IN';
        if (hasDevanagari) {
            if (/आहे|तुमच्या|आम्ही|कृपया|नाही|काय/.test(t))
                return 'mr-IN';
            if (latinRatio > 0.25)
                return 'hinglish';
            return 'hi-IN';
        }
        const lower = t.toLowerCase();
        const hinglishMarkers = /(hai|hain|kya|nahi|accha|bahut|aap|mujhe|chahiye|theek|bilkul|matlb|samajh|batao|bolo|karo|rahenge)/i.test(lower);
        if (hinglishMarkers && /[a-z]/i.test(t))
            return 'hinglish';
        if (latinRatio > 0.7 && /[a-z]{3,}/i.test(t))
            return 'en-IN';
        if (fallback === 'hinglish' ||
            fallback === 'hi-IN' ||
            fallback === 'mr-IN' ||
            fallback === 'gu-IN' ||
            fallback === 'en-IN' ||
            fallback === 'ta-IN' ||
            fallback === 'te-IN' ||
            fallback === 'kn-IN' ||
            fallback === 'bn-IN' ||
            fallback === 'pa-IN') {
            return fallback;
        }
        return 'en-IN';
    }
    isAmbiguousLanguageCue(text) {
        const t = (text || '').trim();
        if (!t)
            return true;
        if (t.split(/\s+/).length <= 2 && t.length < 18) {
            return /^(ok+|okay|haan|han|ha|yes|yeah|no|nahi|nhi|नहीं|हाँ|जी|theek|bilkul|hmm+|ach+a+|sure|right|ji)\.?$/i.test(t.replace(/[.!?,]/g, ''));
        }
        return false;
    }
    resolveReplyLanguage(options) {
        const sticky = options.stickyLanguage === 'mixed'
            ? 'hinglish'
            : options.stickyLanguage;
        const leadPrior = leadOnlyText(options.priorTranscript);
        const priorDetected = leadPrior
            ? this.detectLanguage(leadPrior, sticky || options.fallback || 'hinglish')
            : sticky || this.detectLanguage('', options.fallback || 'hinglish');
        if (this.isAmbiguousLanguageCue(options.userMessage)) {
            return (sticky || priorDetected || 'hinglish');
        }
        const fromMessage = this.detectLanguage(options.userMessage, sticky || priorDetected || options.fallback || 'hinglish');
        return fromMessage === 'mixed' ? 'hinglish' : fromMessage;
    }
    languageInstruction(lang) {
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
    scriptLanguage(lang) {
        if (lang === 'en-IN' ||
            lang === 'hi-IN' ||
            lang === 'hinglish' ||
            lang === 'mr-IN' ||
            lang === 'gu-IN') {
            return lang;
        }
        return 'en-IN';
    }
    async ensureProjectKnowledge(projectId) {
        return this.knowledge.ensureProjectWebsiteKnowledge(projectId);
    }
    async buildOpening(options) {
        const hasLinkedProject = Boolean(options.lead.project?.id || options.lead.project?.name);
        const projectName = options.lead.project?.name || undefined;
        const company = options.companyName ||
            options.lead.project?.companyName ||
            options.lead.project?.builder ||
            'Saya Group';
        const learning = (0, opener_bank_1.parseOpenerLearning)(options.openerLearning);
        const openingTip = (0, playbook_1.latestOpeningStyleTip)(options.openerLearning);
        const opening = (0, opener_bank_1.buildVariedOpening)({
            leadName: options.lead.name,
            agentName: options.agentName,
            projectName,
            companyName: company,
            builderName: options.lead.project?.builder,
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
            openerStyle: opening.style,
            known: (0, call_scripts_1.factsFromLead)({ ...options.lead, trustProfileBudget: false }),
        };
    }
    async reply(options) {
        const speechGender = (0, call_scripts_1.resolveSpeechGender)({
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
        const previousAgentEarly = (0, call_scripts_1.lastAgentLine)(options.priorTranscript);
        const intentEarly = (0, call_scripts_1.detectIntent)(options.userMessage);
        const contextualEarly = (0, call_scripts_1.resolveContextualShortReply)({
            userMessage: options.userMessage,
            priorTranscript: options.priorTranscript,
        });
        const shortCueEarly = (0, call_scripts_1.isShortAffirmation)(options.userMessage) ||
            (0, call_scripts_1.isShortDecline)(options.userMessage);
        const liveTurn = Boolean(options.stream || options.phoneLatency);
        const scriptFast = liveTurn &&
            (intentEarly.callback ||
                intentEarly.notInterested ||
                intentEarly.askingWhyCall ||
                intentEarly.askingIdentity ||
                intentEarly.isGreeting ||
                intentEarly.statingBhk ||
                intentEarly.statingPossession ||
                intentEarly.statingVisitDay ||
                intentEarly.askingPrice ||
                contextualEarly != null ||
                (shortCueEarly &&
                    ((0, call_scripts_1.lastAgentWasSoftClose)(previousAgentEarly) ||
                        (0, call_scripts_1.lastAgentAskedTalkPermission)(previousAgentEarly) ||
                        (0, call_scripts_1.lastAgentOfferedCallback)(previousAgentEarly) ||
                        (0, call_scripts_1.lastAgentOfferedDetails)(previousAgentEarly) ||
                        intentEarly.positive)));
        if (scriptFast) {
            const knownFast = (0, call_scripts_1.mergeFacts)((0, call_scripts_1.factsFromLead)({
                ...options.lead,
                trustProfileBudget: Boolean(options.lead.budget != null && Number(options.lead.budget) > 0),
            }), {
                location: options.lead.preferredLocation || undefined,
                bhk: options.lead.bhkPreference || undefined,
                timeline: options.lead.purchaseTimeline || undefined,
            }, (0, call_scripts_1.extractFactsFromText)(leadOnlyText(options.priorTranscript)), (0, call_scripts_1.extractFactsFromText)(options.userMessage));
            const fallback = (0, call_scripts_1.buildFollowUpReply)({
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
                agentName: options.agentName,
                companyName: options.companyName,
                isInbound: options.isInbound,
            });
            let replyText = this.stripBannedPhrases(this.fixGenderedSpeech(fallback.text, speechGender));
            if (options.stream && options.onSentence) {
                void Promise.resolve(options.onSentence(replyText));
            }
            this.logger.log(`Fast script (${contextualEarly?.kind || 'intent'}) — no RAG/LLM: "${options.userMessage.slice(0, 40)}"`);
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
        if (!projectId &&
            (!options.phoneLatency ||
                /saya|साया|project|property|राज\s*नगर|noida|extension/i.test(options.userMessage))) {
            const matched = await this.matchProjectFromSpeech([options.userMessage, options.priorTranscript || ''].join('\n'));
            if (matched) {
                projectId = matched.id;
                resolvedProject = matched;
            }
        }
        const asksDetail = /detail|details|बताओ|बताइए|price|rera|emi|amenit|possession|payment|floor|website|location|क्या है|कितना|सुविधा|about|info|information|features|brochure|configuration|config/i.test(options.userMessage);
        const newlyMatched = Boolean(projectId && !options.lead.projectId);
        const sources = projectId && (asksDetail || (!options.phoneLatency && newlyMatched))
            ? await this.knowledge.retrieve(projectId, options.userMessage, options.phoneLatency ? 1 : newlyMatched ? 3 : 2, {
                lexicalOnly: true,
            })
            : [];
        if (newlyMatched && projectId) {
            void this.knowledge
                .ensureProjectWebsiteKnowledge(projectId)
                .catch(() => undefined);
        }
        const known = (0, call_scripts_1.mergeFacts)((0, call_scripts_1.factsFromLead)({
            ...options.lead,
            trustProfileBudget: Boolean(options.lead.budget != null && Number(options.lead.budget) > 0),
        }), {
            location: options.lead.preferredLocation || undefined,
            bhk: options.lead.bhkPreference || undefined,
            timeline: options.lead.purchaseTimeline || undefined,
        }, (0, call_scripts_1.extractFactsFromText)(leadOnlyText(options.priorTranscript)), (0, call_scripts_1.extractFactsFromText)(options.userMessage));
        if (!known.budgetLabel) {
            const asked = (0, call_scripts_1.priorAgentAsked)(options.priorTranscript);
            const inferred = (0, call_scripts_1.inferBudgetFromShortReply)(options.userMessage, {
                agentAskedBudget: asked.askedBudget,
            });
            if (inferred)
                known.budgetLabel = inferred;
        }
        if ((0, place_names_1.mentionsSayaRajNagarExtension)(options.userMessage)) {
            known.location = place_names_1.SAYA_RAJ_NAGAR_EXTENSION;
        }
        else if (known.location) {
            known.location =
                (0, place_names_1.normalizeKnownLocation)(known.location) || known.location;
        }
        const previousAgent = (0, call_scripts_1.lastAgentLine)(options.priorTranscript);
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
                .map((s, i) => `[${i + 1}:${s.source.title}] ${s.content.replace(/\s+/g, ' ').slice(0, 280)}`)
                .join('\n')
            : '';
        const playbook = (0, playbook_1.formatPlaybookForPrompt)(options.approvedPlaybook, options.phoneLatency ? 320 : 600);
        const recentTranscript = (options.priorTranscript || '')
            .split('\n')
            .filter((l) => l.trim())
            .slice(options.phoneLatency ? -4 : -8)
            .join('\n');
        const company = options.companyName ||
            resolvedProject?.companyName ||
            resolvedProject?.builder ||
            'Saya Group';
        const productName = resolvedProject?.name || 'the property they choose';
        const genderLines = speechGender === 'female'
            ? 'Female Hindi: बोल रही हूँ / समझ गई. Never male forms.'
            : 'Male Hindi: बोल रहा हूँ / समझ गया. Never female forms.';
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
                const salesTemplate = (0, sales_agent_prompt_1.isSalesAgentPrompt)(options.systemPrompt)
                    ? String(options.systemPrompt)
                    : (0, sales_agent_prompt_1.buildDefaultSalesAgentPrompt)();
                return (0, sales_agent_prompt_1.fillSalesAgentPrompt)(salesTemplate, {
                    company_name: company,
                    customer_name: options.lead.name || 'ji',
                    product_name: productName,
                    lead_source: 'enquiry',
                    previous_interaction: recentTranscript
                        ? recentTranscript.slice(0, 280)
                        : 'none',
                    location: known.location ||
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
Tone: ${(0, call_scripts_1.compactToneGuide)(options.tone || 'friendly')}
CRITICAL HUMAN TELECALLER RULES:
1) GREETING / IDENTITY / LIVENESS HANDLING:
   - If customer says "Hello" / "Haan ji" at start: Greet warmly: "Haan ji Namaste! ${company} real estate helpline mein aapka swagat hai. Main ${options.agentName} baat kar rahi hoon, bataiye main aapki kya sahayata kar sakti hoon?"
   - If customer says "Hello" / "Awaz aa rahi hai" / "Sun rahe ho" mid-call: Reassure immediately: "Haan ji, bilkul aawaz aa rahi hai! Main sun rahi hoon, boliye!"
   - If customer asks "Kaun?" / "Kaun bol raha hai?" / "Kahan phone lag gaya?": Clarify directly: "Ji Namaste! Main ${company} real estate helpline se ${options.agentName} baat kar rahi hoon. Batayein main aapki kya sahayata kar sakti hoon?"
   - If asked for project/property details: Give facts simply; if looking up: "Ji main dekh rahi hoon, ek second..."
2) FIRST understand the customer's last message. If they asked a question (e.g. price, location, 2BHK/3BHK), ANSWER that directly before any sales question.
3) If they refuse / "nahi chahiye" / "rakho phone" / don't want anything → polite thank-you and STOP. Do not restart discovery.
4) Never ignore them and jump to possession/BHK/budget.
5) Never repeat your previous line.
Engagement: React to their exact words. Never open with "Got it" / "Noted" / "Perfect".
Banned openers: Got it, Got it., Okay okay, Perfect, Noted.
Known facts so far: ${JSON.stringify(known)}
Known place: If they mention Saya / साया Raj Nagar Extension, remember exactly "${place_names_1.SAYA_RAJ_NAGAR_EXTENSION}" and say it as साया राज नगर एक्सटेंशन (never "Sayaa").
${previousAgent ? `Last reply (do not repeat): ${previousAgent.slice(0, 160)}` : ''}
${playbook ? `Playbook notes: ${playbook}` : ''}
Project:
${projectContext}
${ragBlock ? `Knowledge (answer from this; do not invent):\n${ragBlock}` : !resolvedProject ? `Knowledge: none yet — ask which project they mean, then answer from KB after it is identified.` : `Knowledge: none loaded — do not invent facts; offer to confirm and follow up.`}
Reply now in 1–2 short spoken sentences. Answer them first; one question max only if still appropriate.`;
        let replyText = null;
        let usedLlm = false;
        const llmMessages = [
            { role: 'system', content: system },
            {
                role: 'user',
                content: options.phoneLatency
                    ? `Customer said: "${options.userMessage}"\nUnderstand their intent, then reply in one short spoken line:`
                    : `Recent call:\n${recentTranscript || '(start)'}\n\nCustomer just said: "${options.userMessage}"\n\nFirst understand them. If they asked something, answer it. Then reply in 1–2 short sentences.`,
            },
        ];
        const voiceModel = options.llmModel || 'gemini-flash-lite-latest';
        const llmOpts = {
            temperature: 0.45,
            model: voiceModel,
            maxOutputTokens: options.phoneLatency || options.stream ? 60 : 120,
            timeoutMs: options.phoneLatency || options.stream ? 9000 : 10000,
            lowLatency: true,
        };
        let llmOut = null;
        const knowledgeText = sources.map((s) => s.content).join(' ');
        const onSentence = options.onSentence
            ? (sentence) => {
                const safe = dropUnbackedPromises(sentence, knowledgeText);
                if (safe)
                    return options.onSentence(safe);
            }
            : undefined;
        if (options.stream || options.phoneLatency) {
            const learned = (0, playbook_1.formatPlaybookForPrompt)(options.approvedPlaybook, 200);
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
                { role: 'system', content: quickSystem },
                {
                    role: 'user',
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
            }
            else {
                llmOut = await this.llm.chat(quickMessages, llmOpts);
            }
            this.logger.log(`LLM live turn ${llmOut ? (streamed ? 'stream hit' : 'hit') : 'miss'} in ${Date.now() - t0}ms`);
            if (llmOut && options.stream && !streamed) {
                options.onTextDelta?.(llmOut);
                const { sentences, rest } = pullSpokenSentences(`${llmOut}\n`, {
                    force: true,
                    minChars: 8,
                });
                const chunks = [...sentences, ...(rest.trim() ? [rest.trim()] : [])];
                for (const s of chunks) {
                    if (onSentence)
                        void Promise.resolve(onSentence(s));
                }
            }
        }
        else {
            llmOut = await this.llm.chat(llmMessages, llmOpts);
        }
        if (replyText == null && llmOut) {
            replyText = llmOut;
            usedLlm = true;
            if (previousAgent && (0, call_scripts_1.isSameTalk)(replyText, previousAgent)) {
                const fallback = (0, call_scripts_1.buildFollowUpReply)({
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
                    agentName: options.agentName,
                    companyName: options.companyName,
                    isInbound: options.isInbound,
                });
                replyText = fallback.text;
                usedLlm = false;
            }
        }
        else if (replyText == null) {
            const fallback = (0, call_scripts_1.buildFollowUpReply)({
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
                agentName: options.agentName,
                companyName: options.companyName,
                isInbound: options.isInbound,
            });
            replyText = fallback.text;
            if (asksDetail && sources[0]) {
                const snippet = sources[0].content.replace(/\s+/g, ' ').slice(0, 180);
                const suffix = replyLang === 'en-IN' || this.scriptLanguage(replyLang) === 'en-IN'
                    ? ` Anything else you'd like to know?`
                    : replyLang === 'mr-IN'
                        ? ` आणखी काही जाणून घ्यायचे असेल तर सांगा.`
                        : replyLang === 'gu-IN'
                            ? ` વધુ જાણવું હોય તો કહો.`
                            : ` और कुछ जानना हो तो बताइए।`;
                const prefix = replyLang === 'en-IN' || this.scriptLanguage(replyLang) === 'en-IN'
                    ? `Sure ${options.lead.name}. `
                    : `अच्छा ${options.lead.name}. `;
                replyText = `${prefix}${snippet}${snippet.length >= 160 ? '…' : ''}${suffix}`;
            }
            if (options.onSentence && replyText) {
                void Promise.resolve(options.onSentence(replyText));
            }
            this.logger.warn(`LLM miss — scripted fallback for: "${options.userMessage.slice(0, 80)}"`);
        }
        replyText = this.stripBannedPhrases(this.fixGenderedSpeech(replyText, speechGender));
        replyText =
            dropUnbackedPromises(replyText, knowledgeText) ||
                (this.scriptLanguage(replyLang) === 'en-IN'
                    ? 'Sure, our team will confirm the visit details with you.'
                    : 'ठीक है, हमारी टीम आपसे visit की details confirm कर लेगी।');
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
            replyText: replyText,
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
            resolvedProjectId: projectId || null,
            resolvedProjectName: resolvedProject?.name || null,
        };
    }
    async consumeLlmStream(messages, opts, hooks) {
        let full = '';
        let pending = '';
        let emitted = 0;
        try {
            for await (const delta of this.llm.chatStream(messages, opts)) {
                if (!delta)
                    continue;
                full += delta;
                pending += delta;
                hooks?.onTextDelta?.(delta);
                const { sentences, rest } = pullSpokenSentences(pending, {
                    force: false,
                });
                pending = rest;
                for (const s of sentences) {
                    emitted += 1;
                    if (hooks?.onSentence) {
                        void Promise.resolve(hooks.onSentence(s));
                    }
                }
            }
        }
        catch (err) {
            this.logger.warn(`LLM stream consume failed: ${err instanceof Error ? err.message : err}`);
        }
        const leftover = pending.trim();
        if (leftover) {
            emitted += 1;
            if (hooks?.onSentence) {
                await Promise.resolve(hooks.onSentence(leftover));
            }
        }
        if (!full.trim())
            return null;
        void emitted;
        return full.trim();
    }
    async matchProjectFromSpeech(text) {
        const raw = (text || '').trim();
        if (raw.length < 3)
            return null;
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
        if (!projects.length)
            return null;
        const norm = (s) => s
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0900-\u097F]/g, (ch) => ch)
            .replace(/[^a-z0-9\u0900-\u097F\s]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const hay = norm(raw);
        const hayExpanded = hay
            .replace(/\bsayaa?\b/g, 'saya')
            .replace(/\bsaa\s*ya\b/g, 'saya')
            .replace(/\braaj\b/g, 'raj')
            .replace(/\bext(?:ension)?\b/g, 'extension');
        let best = null;
        let bestScore = 0;
        for (const p of projects) {
            const tokens = [p.name, p.location, p.builder, p.companyName]
                .filter(Boolean)
                .map((x) => norm(String(x)));
            let score = 0;
            for (const t of tokens) {
                if (!t || t.length < 3)
                    continue;
                if (hayExpanded.includes(t) || hay.includes(t)) {
                    score = Math.max(score, t.length);
                    continue;
                }
                const parts = t.split(' ').filter((w) => w.length >= 3);
                const hits = parts.filter((w) => hayExpanded.includes(w)).length;
                if (parts.length && hits / parts.length >= 0.6) {
                    score = Math.max(score, Math.floor(t.length * (hits / parts.length)));
                }
            }
            if (/saya|साया/.test(hayExpanded) &&
                /raj\s*nagar|राज\s*नगर/.test(hayExpanded) &&
                /saya.*raj|साया.*राज/i.test(p.name)) {
                score = Math.max(score, 40);
            }
            if (score > bestScore) {
                bestScore = score;
                best = p;
            }
        }
        return bestScore >= 4 ? best : null;
    }
    stripBannedPhrases(text) {
        return text
            .replace(/(^|\s)वाह(?=[\s!?,.।]|$)[!?,.।]?\s*/g, '$1')
            .replace(/\bwah\b[!?,.]?\s*/gi, '')
            .replace(/\bbhai\b/gi, '')
            .replace(/भाई\s*/g, '')
            .replace(/\byaar bhai\b/gi, '')
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
    fixGenderedSpeech(text, gender) {
        const pick = (m, f) => (gender === 'female' ? f : m);
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
        }
        else {
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
    async extractQualification(input) {
        const base = {
            language: input.language,
            budgetLabel: input.known.budgetLabel || null,
            preferredLocation: input.known.location || null,
            bhkPreference: input.known.bhk || null,
            purchaseTimeline: null,
            interestLevel: input.known.interested ? 'high' : 'medium',
            interestScore: 4,
            objections: null,
            siteVisitInterest: Boolean(input.known.askedVisit),
            callbackAt: null,
            outcome: 'CONNECTED',
            summary: `${input.userMessage.slice(0, 80)} → ${input.replyText.slice(0, 100)}`,
            suggestedNextAction: 'Follow up with matching inventory',
        };
        const lower = input.userMessage.toLowerCase();
        if (/not interested|nahi chahiye|नहीं चाहिए/.test(lower)) {
            base.interestLevel = 'none';
            base.outcome = 'NOT_INTERESTED';
            base.suggestedNextAction = 'Mark not interested; no further calls unless requested';
        }
        else if (/callback|later|tomorrow|baad/.test(lower)) {
            base.outcome = 'CALLBACK_REQUESTED';
            base.suggestedNextAction = 'Schedule callback at preferred time';
        }
        else if (/site visit|visit|dekhna/.test(lower)) {
            base.siteVisitInterest = true;
            base.outcome = 'SITE_VISIT_INTERESTED';
            base.interestLevel = 'high';
            base.suggestedNextAction = 'Book site visit with project advisor';
        }
        else if (input.known.budgetLabel || input.known.location) {
            base.outcome = 'QUALIFIED';
            base.suggestedNextAction = 'Share matching units and propose site visit';
        }
        if (/month|months|weeks|days|this year|next year|jaldi|turant|3 month|6 month/.test(lower)) {
            const m = input.userMessage.match(/(?:within|in|by)?\s*(\d+\s*(?:day|days|week|weeks|month|months|year|years)|this year|next year|jaldi|turant)/i);
            base.purchaseTimeline = m?.[1] || input.userMessage.slice(0, 80);
        }
        const slot = (0, meeting_time_1.parseMeetingSlot)(input.userMessage, input.priorTranscript);
        if (slot) {
            base.meetingAt = slot.startIso;
            base.siteVisitInterest = true;
            if (base.outcome === 'CONNECTED' || base.outcome === 'QUALIFIED') {
                base.outcome = 'SITE_VISIT_INTERESTED';
            }
            base.suggestedNextAction = `Meeting ${slot.label}`;
        }
        base.interestScore = (0, interest_score_1.computeInterestScore)({
            userMessage: input.userMessage,
            priorTranscript: input.priorTranscript,
            known: input.known,
            outcome: base.outcome,
            siteVisitInterest: base.siteVisitInterest,
            meetingBooked: Boolean(base.meetingAt),
        });
        base.interestLevel = `${(0, interest_score_1.interestLevelFromScore)(base.interestScore)} (${base.interestScore}/10)`;
        if (input.skipLlm) {
            return base;
        }
        const llmJson = await this.llm.chat([
            {
                role: 'system',
                content: 'Extract lead qualification JSON with keys: language, budgetLabel, preferredLocation, bhkPreference, purchaseTimeline, interestLevel, interestScore (integer 0-10 how interested the lead is in buying/visiting), objections, siteVisitInterest, callbackAt, outcome, summary, suggestedNextAction. outcome one of CONNECTED, QUALIFIED, CALLBACK_REQUESTED, SITE_VISIT_INTERESTED, NOT_INTERESTED. summary max 2 sentences.',
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
        ], {
            temperature: 0,
            json: true,
            model: input.llmModel || 'gemini-3.5-flash-lite',
            maxOutputTokens: 250,
        });
        if (llmJson) {
            try {
                const parsed = JSON.parse(llmJson);
                const merged = { ...base, ...parsed };
                const rawScore = Number(parsed.interestScore);
                merged.interestScore = Number.isFinite(rawScore)
                    ? Math.max(0, Math.min(10, Math.round(rawScore)))
                    : (0, interest_score_1.computeInterestScore)({
                        userMessage: input.userMessage,
                        priorTranscript: input.priorTranscript,
                        known: input.known,
                        outcome: String(merged.outcome || base.outcome),
                        siteVisitInterest: Boolean(merged.siteVisitInterest),
                        meetingBooked: Boolean(merged.meetingAt),
                        previousScore: base.interestScore,
                    });
                merged.interestLevel = `${(0, interest_score_1.interestLevelFromScore)(merged.interestScore)} (${merged.interestScore}/10)`;
                return merged;
            }
            catch {
                this.logger.warn('Failed to parse qualification JSON');
            }
        }
        return base;
    }
    mapOutcomeToLeadStatus(outcome) {
        switch (outcome) {
            case 'NOT_INTERESTED':
                return client_1.LeadStatus.NOT_INTERESTED;
            case 'CALLBACK_REQUESTED':
                return client_1.LeadStatus.CALLBACK_REQUESTED;
            case 'SITE_VISIT_INTERESTED':
                return client_1.LeadStatus.SITE_VISIT_INTERESTED;
            case 'QUALIFIED':
                return client_1.LeadStatus.QUALIFIED;
            default:
                return client_1.LeadStatus.CONTACTED;
        }
    }
    mapOutcomeEnum(outcome) {
        switch (outcome) {
            case 'NOT_INTERESTED':
                return client_1.CallOutcome.NOT_INTERESTED;
            case 'CALLBACK_REQUESTED':
                return client_1.CallOutcome.CALLBACK_REQUESTED;
            case 'SITE_VISIT_INTERESTED':
                return client_1.CallOutcome.SITE_VISIT_INTERESTED;
            case 'QUALIFIED':
                return client_1.CallOutcome.QUALIFIED;
            default:
                return client_1.CallOutcome.CONNECTED;
        }
    }
    async applyQualificationToLead(leadId, qualification) {
        const budgetLabel = String(qualification.budgetLabel || '');
        const budget = (0, call_scripts_1.parseBudgetToNumber)(budgetLabel);
        const outcome = String(qualification.outcome || 'CONNECTED');
        const data = {
            preferredLanguage: String(qualification.language || '') || undefined,
            preferredLocation: qualification.preferredLocation || undefined,
            bhkPreference: qualification.bhkPreference || undefined,
            purchaseTimeline: qualification.purchaseTimeline || undefined,
            interestLevel: qualification.interestLevel || undefined,
            interestScore: typeof qualification.interestScore === 'number'
                ? Math.max(0, Math.min(10, Math.round(Number(qualification.interestScore))))
                : undefined,
            objections: qualification.objections || undefined,
            siteVisitInterest: Boolean(qualification.siteVisitInterest),
            suggestedNextAction: qualification.suggestedNextAction || undefined,
            aiSummary: qualification.summary || undefined,
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
};
exports.ConversationService = ConversationService;
exports.ConversationService = ConversationService = ConversationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        llm_service_1.LlmService,
        knowledge_service_1.KnowledgeService])
], ConversationService);
//# sourceMappingURL=conversation.service.js.map