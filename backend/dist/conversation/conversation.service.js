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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
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
const customer_memory_service_1 = require("../memory/customer-memory.service");
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
        const punct = match[0];
        const idx = match.index;
        if (punct.includes('.')) {
            const prevChar = idx > 0 ? text[idx - 1] : '';
            const nextChar = idx + punct.length < text.length ? text[idx + punct.length] : '';
            if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
                continue;
            }
            const beforeText = text.slice(Math.max(0, idx - 10), idx);
            if (/\b(?:sq|ft|no|dr|mr|mrs|prof|approx|bsp|vs|etc)$/i.test(beforeText)) {
                if (/sq$/i.test(beforeText) || !/[\s\n]/.test(nextChar)) {
                    continue;
                }
            }
            if (!options?.force && nextChar && !/[\s\n]/.test(nextChar)) {
                continue;
            }
        }
        const end = idx + match[0].length;
        const chunk = text.slice(lastCut, end).trim();
        if (chunk.length >= Math.min(6, minChars)) {
            sentences.push(chunk);
            lastCut = end;
        }
    }
    rest = text.slice(lastCut);
    if (!sentences.length && rest.length >= 24) {
        const commaMatch = /(?<!\d)[,，;:](?!\d)[\s]+/.exec(rest);
        if (commaMatch && commaMatch.index >= 12) {
            const chunk = rest.slice(0, commaMatch.index + 1).trim();
            if (chunk) {
                sentences.push(chunk);
                rest = rest.slice(commaMatch.index + commaMatch[0].length);
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
    customerMemory;
    logger = new common_1.Logger(ConversationService_1.name);
    constructor(prisma, llm, knowledge, customerMemory) {
        this.prisma = prisma;
        this.llm = llm;
        this.knowledge = knowledge;
        this.customerMemory = customerMemory;
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
        const words = t.split(/\s+/).filter(Boolean);
        if (words.length <= 3 && t.length < 25) {
            return true;
        }
        return /^(ok+|okay|haan|han|ha|yes|yeah|no|nahi|nhi|नहीं|हाँ|जी|तो|theek|bilkul|hmm+|ach+a+|sure|right|ji|kya|batao|bolo|kahiye|sunao|hello|namaste)\.?$/i.test(t.replace(/[.!?,?]/g, ''));
    }
    resolveReplyLanguage(options) {
        const sticky = options.stickyLanguage === 'mixed'
            ? 'hinglish'
            : options.stickyLanguage;
        const configured = sticky || options.fallback || 'en-IN';
        const msg = (options.userMessage || '').trim();
        if (/(hindi|हिंदी|हिन्दी)/i.test(msg) && /(speak|talk|bolo|baat|batao|kaho)/i.test(msg)) {
            return 'hi-IN';
        }
        if (/(english|अंग्रेजी)/i.test(msg) && /(speak|talk|bolo|baat|batao|kaho)/i.test(msg)) {
            return 'en-IN';
        }
        if (/hinglish/i.test(msg)) {
            return 'hinglish';
        }
        if (this.isAmbiguousLanguageCue(msg)) {
            return configured;
        }
        const words = msg.split(/\s+/).filter(Boolean);
        if (words.length < 4 && msg.length < 25) {
            return configured;
        }
        const leadPrior = leadOnlyText(options.priorTranscript);
        const priorDetected = leadPrior
            ? this.detectLanguage(leadPrior, configured)
            : configured;
        const fromMessage = this.detectLanguage(msg, priorDetected || configured);
        if (configured === 'hinglish') {
            if (fromMessage === 'hi-IN' || fromMessage === 'mixed' || fromMessage === 'en-IN') {
                return 'hinglish';
            }
            return fromMessage;
        }
        if (configured === 'en-IN') {
            const explicitHindi = /(hindi|हिंदी|हिन्दी)/i.test(msg) && /(speak|talk|bolo|baat|batao|kaho|me)/i.test(msg);
            if (explicitHindi) {
                return 'hi-IN';
            }
            return 'en-IN';
        }
        if (configured === 'hi-IN') {
            const explicitEnglish = /(english|अंग्रेजी)/i.test(msg) && /(speak|talk|bolo|baat|batao|kaho|me)/i.test(msg);
            if (explicitEnglish) {
                return 'en-IN';
            }
            return 'hi-IN';
        }
        return fromMessage === 'mixed' ? 'hinglish' : fromMessage;
    }
    languageInstruction(lang) {
        switch (lang) {
            case 'en-IN':
                return 'Reply ONLY in natural Indian English using Latin alphabet. Do not switch to Hindi.';
            case 'hi-IN':
                return 'Reply ONLY in Hindi using Devanagari script (देवनागरी लिपि). Keep common terms like 2 BHK/3 BHK/budget in phonetics ("2 बीएचके", "बजट"). Do not use English alphabet.';
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
                return 'Reply ONLY in conversational Hinglish using English alphabet (Roman script, e.g. "Haan ji, main samajh gayi", "aap 2 BHK dekh rahe hain"). NEVER use Devanagari script. Keep words naturally spelled in English letters.';
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
        const rawCompany = options.companyName ||
            options.lead.project?.companyName ||
            options.lead.project?.builder ||
            'Workains Realty';
        const company = /saya\s*group/i.test(rawCompany) || /rgbil/i.test(rawCompany)
            ? 'Workains Realty'
            : rawCompany;
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
        const rawCompany = options.companyName ||
            options.lead.project?.companyName ||
            options.lead.project?.builder ||
            resolvedProject?.companyName ||
            resolvedProject?.builder ||
            'Workains Realty';
        const company = /saya\s*group/i.test(rawCompany) || /rgbil/i.test(rawCompany)
            ? 'Workains Realty'
            : rawCompany;
        const rawLeadName = (options.lead.name || '').trim();
        const isGenericLead = (0, call_scripts_1.isPlaceholderLeadName)(rawLeadName);
        const rawMemName = (options.memory?.customer?.name || '').trim();
        const isGenericMem = (0, call_scripts_1.isPlaceholderLeadName)(rawMemName);
        const realCustomerName = (!isGenericMem && rawMemName) ||
            (!isGenericLead && rawLeadName) ||
            null;
        const knownBhk = options.memory?.customer?.bhk ||
            options.lead.bhkPreference ||
            null;
        const knownProject = options.memory?.customer?.interestedProjects?.[0] ||
            resolvedProject?.name ||
            null;
        const isEn = replyLang === 'en-IN';
        const isHing = String(replyLang) === 'hinglish';
        const pastRequirement = knownBhk
            ? isEn
                ? `${knownBhk} apartment`
                : isHing
                    ? `${knownBhk} flat`
                    : `${knownBhk} फ्लैट`
            : knownProject
                ? isEn || isHing
                    ? `${knownProject} project`
                    : `${knownProject} प्रोजेक्ट`
                : '';
        const isReturning = Boolean(options.memory?.isReturningCustomer ||
            Boolean(realCustomerName) ||
            Boolean(knownBhk) ||
            (options.lead.calls && options.lead.calls.length > 0));
        const liveTurn = Boolean(options.stream || options.phoneLatency);
        const userMessage = options.userMessage || '';
        const isProjectRejection = /(?:kisi\s*aur|dusra|doosra|dusre|doosre|koi\s*aur|aur\s*koi|kisi\s*aur\s*ka)\s*(?:ka\s*)?(?:chahiye|dikhao|batao|options?)/i.test(userMessage) ||
            /(?:ka\s*nahi\s*chahiye|ka\s*nhi\s*chahiye|wala\s*nahi|nahi\s*chahiye.*(?:balki|lekin|but|chahiye|dikhao|batao|options?|hai\s*kya|tumhare\s*paas))/i.test(userMessage) ||
            /(?:nahi\s*chahiye.*(?:future|state|estate|vvip|rudra|palace|monarch|aarya|dholera))/i.test(userMessage) ||
            /(?:future\s*(?:state|estate)|vvip|palace\s*heights?|ncr\s*monarch).*(?:chahiye|hai\s*kya|hai)/i.test(userMessage) ||
            /(?:continue.*but|continue.*lekin)/i.test(userMessage);
        const scriptFast = liveTurn &&
            !isProjectRejection &&
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
            const memCustomer = options.memory?.customer;
            const knownFast = (0, call_scripts_1.mergeFacts)((0, call_scripts_1.factsFromLead)({
                ...options.lead,
                trustProfileBudget: Boolean((options.lead.budget != null && Number(options.lead.budget) > 0) ||
                    memCustomer?.budget),
            }), {
                location: memCustomer?.location || options.lead.preferredLocation || undefined,
                bhk: memCustomer?.bhk || options.lead.bhkPreference || undefined,
                timeline: memCustomer?.timeline || options.lead.purchaseTimeline || undefined,
                budgetLabel: memCustomer?.budgetLabel || undefined,
            }, (0, call_scripts_1.extractFactsFromText)(leadOnlyText(options.priorTranscript)), (0, call_scripts_1.extractFactsFromText)(options.userMessage));
            let replyText = '';
            const priorLeadText = leadOnlyText(options.priorTranscript);
            const isStartOfCall = !priorLeadText || priorLeadText.trim().length < 3;
            if (options.isInbound && intentEarly.isGreeting) {
                if (isStartOfCall) {
                    if (realCustomerName) {
                        replyText = isEn
                            ? pastRequirement
                                ? `Hello ${realCustomerName} ji! Welcome back to ${company}. Last time we spoke about ${pastRequirement} — would you like to discuss that further or explore something new today?`
                                : `Hello ${realCustomerName} ji! Thank you for calling ${company} again. I am ${options.agentName}, how may I help you today?`
                            : isHing
                                ? pastRequirement
                                    ? `Namaste ${realCustomerName} ji! ${company} mein aapka phir se swaagat hai. Pichhli baar hamari baat ${pastRequirement} ko lekar hui thi — kya aaj usi ke regarding baat karna chahenge ya kuch naya dekhna hai?`
                                    : `Namaste ${realCustomerName} ji! Dobara call karne ke liye dhanyavaad. Main ${options.agentName} baat kar rahi hoon, bataiye aaj aapki kya sahayata kar sakti hoon?`
                                : pastRequirement
                                    ? `नमस्ते ${realCustomerName} जी! ${company} में आपका फिर से स्वागत है। पिछली बार हमारी बात ${pastRequirement} को लेकर हुई थी — क्या आज उसी के रिगार्डिंग बात करना चाहेंगे या कुछ नया देखना है?`
                                    : `नमस्ते ${realCustomerName} जी! दोबारा कॉल करने के लिए धन्यवाद। मैं ${options.agentName} बात कर रही हूँ, बताइए आज आपकी क्या सहायता कर सकती हूँ?`;
                    }
                    else {
                        replyText = isEn
                            ? `Hello! Welcome to ${company} helpline. I am ${options.agentName}, how may I assist you today?`
                            : isHing
                                ? `Haan ji namaste! ${company} helpline mein aapka swaagat hai. Main ${options.agentName} baat kar rahi hoon, bataiye main aapki kya madad kar sakti hoon?`
                                : `हाँ जी नमस्ते! ${company} हेल्पलाइन में आपका स्वागत है। मैं ${options.agentName} बात कर रही हूँ, बताइए मैं आपकी क्या सहायता कर सकती हूँ?`;
                    }
                }
                else {
                    const livenessPoolHinglish = speechGender === 'male'
                        ? [
                            'Haan ji, main line par hoon, boliye!',
                            'Haan ji, aawaz aa rahi hai! Boliye, main sun raha hoon.',
                            'Haan ji bilkul, sun raha hoon, aap boliye!',
                            'Haan ji, main yahin hoon, boliye!',
                        ]
                        : [
                            'Haan ji, main line par hoon, boliye!',
                            'Haan ji, aawaz aa rahi hai! Boliye, main sun rahi hoon.',
                            'Haan ji bilkul, sun rahi hoon, aap boliye!',
                            'Haan ji, main yahin hoon, boliye!',
                        ];
                    const livenessPoolHindi = speechGender === 'male'
                        ? [
                            'हाँ जी, मैं लाइन पर हूँ, बोलिए!',
                            'हाँ जी, आवाज़ आ रही है! बोलिए, मैं सुन रहा हूँ।',
                            'हाँ जी बिल्कुल, सुन रहा हूँ, बोलिए!',
                            'हाँ जी, मैं यहीं हूँ, बोलिए!',
                        ]
                        : [
                            'हाँ जी, मैं लाइन पर हूँ, बोलिए!',
                            'हाँ जी, आवाज़ आ रही है! बोलिए, मैं सुन रही हूँ।',
                            'हाँ जी बिल्कुल, सुन रही हूँ, बोलिए!',
                            'हाँ जी, मैं यहीं हूँ, बोलिए!',
                        ];
                    const livenessPoolEn = [
                        'Yes, I can hear you clearly! Please go ahead.',
                        'Yes, I am on the line, please go ahead!',
                        'Yes, please go ahead, I am listening.',
                    ];
                    const pool = isEn
                        ? livenessPoolEn
                        : isHing
                            ? livenessPoolHinglish
                            : livenessPoolHindi;
                    const idx = Math.abs((options.priorTranscript || '').length) % pool.length;
                    replyText = pool[idx] || pool[0];
                }
            }
            else {
                const fallback = (0, call_scripts_1.buildFollowUpReply)({
                    transcript: options.userMessage,
                    leadName: realCustomerName || 'जी',
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
                    companyName: company,
                    isInbound: options.isInbound,
                });
                replyText = this.stripBannedPhrases(this.fixGenderedSpeech(fallback.text, speechGender));
            }
            if (options.stream && options.onSentence) {
                void Promise.resolve(options.onSentence(replyText));
            }
            this.logger.log(`⚡ [Fast Script] Caller: "${options.userMessage}" ➔ AI: "${replyText}"`);
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
                options.isInbound ||
                /palace|पैलेस|rudra|रुद्रा|monarch|मोनार्क|ncr|gh-?02|project|property|noida|extension|greater\s*noida|sec-?1|sector\s*1|flat|फ्लैट|bhk|बीएचके/i.test(options.userMessage))) {
            const matched = await this.matchProjectFromSpeech([options.userMessage, options.priorTranscript || ''].join('\n'));
            if (matched) {
                projectId = matched.id;
                resolvedProject = matched;
            }
        }
        const asksDetail = /detail|details|बताओ|बताइए|price|rera|emi|amenit|possession|payment|floor|size|sizes|साइज़|area|sqft|sq\.?\s*ft|layout|map|नक्शा|website|location|क्या है|कितना|सुविधा|about|info|information|features|brochure|configuration|config/i.test(options.userMessage);
        const asksFloorPlanOrSize = /size|sizes|साइज़|area|sqft|sq\.?\s*ft|layout|floor\s*plan|floorplan|नक्शा|map/i.test(options.userMessage);
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
        if (options.memory?.customer) {
            const c = options.memory.customer;
            if (c.bhk && !known.bhk)
                known.bhk = c.bhk;
            if (c.budgetLabel && !known.budgetLabel)
                known.budgetLabel = c.budgetLabel;
            else if (c.budget && !known.budgetLabel)
                known.budgetLabel = `${c.budget >= 10000000 ? `${(c.budget / 10000000).toFixed(1)} Cr` : `${Math.round(c.budget / 100000)} Lakh`}`;
            if (c.purpose && !known.purpose)
                known.purpose = c.purpose;
            if (c.location && !known.location)
                known.location = c.location;
            if (c.timeline && !known.timeline)
                known.timeline = c.timeline;
        }
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
        const productName = resolvedProject?.name || 'the property they choose';
        const genderLines = speechGender === 'female'
            ? 'Female Hindi: बोल रही हूँ / समझ गई. Never male forms.'
            : 'Male Hindi: बोल रहा हूँ / समझ गया. Never female forms.';
        const customerBudgetRupees = options.memory?.customer?.budget ||
            (options.lead.budget != null && Number(options.lead.budget) > 0 ? Number(options.lead.budget) : 0) ||
            (0, call_scripts_1.parseBudgetToNumber)(known.budgetLabel || '') ||
            undefined;
        const rejectedBuilders = options.memory?.customer?.rejectedBuilders || [];
        const rejectedProjects = options.memory?.customer?.rejectedProjects || [];
        const preferredBuilders = options.memory?.customer?.preferredBuilders || [];
        const preferredProjects = options.memory?.customer?.preferredProjects || [];
        const propertyTypePref = options.memory?.customer?.propertyType || null;
        const selectedProjectId = options.memory?.customer?.selectedProjectId ||
            options.memory?.selectedProjectId ||
            options.memory?.customer?.lastDiscussedProject ||
            options.memory?.lastDiscussedProjectName ||
            null;
        const selectedProjectLock = Boolean(options.memory?.customer?.selectedProjectLock ||
            options.memory?.selectedProjectLock);
        const projectsOverview = options.isInbound
            ? await this.getProjectsOverview({
                customerBudgetRupees,
                rejectedBuilders,
                rejectedProjects,
                preferredBuilders,
                preferredProjects,
                preferredLocations: options.memory?.customer?.preferredLocations || [],
                propertyType: propertyTypePref || null,
                selectedProjectId,
                selectedProjectLock,
                possessionPreference: options.memory?.customer?.possessionPreference ||
                    options.memory?.confirmedFacts?.possession?.value ||
                    null,
            })
            : '';
        const isHinglish = String(replyLang) === 'hinglish' ||
            (!replyLang.startsWith('hi') &&
                !replyLang.startsWith('en') &&
                !replyLang.startsWith('mr') &&
                !replyLang.startsWith('gu'));
        const isDevanagari = replyLang.startsWith('hi') && replyLang !== 'hinglish';
        const isEnglish = replyLang.startsWith('en');
        const system = options.phoneLatency
            ? options.isInbound
                ? `You are ${options.agentName}, live customer helpline & real estate property advisor for ${company} (Independent Multi-Builder Real Estate Channel Partner).
${genderLines}
Speak ${replyLang}. ${this.languageInstruction(replyLang)}
The caller dialed your helpline to ask questions about properties, projects, locations, prices, or general information.

IMPORTANT CHANNEL PARTNER IDENTITY:
- ${company} is an independent real estate channel partner working with multiple reputed builders across Delhi NCR (such as Rudra Buildwell, Future World, VVIP Group, Saya Group, Divyansh, Apex, Godrej, etc.).
- NEVER claim to be an employee of any single developer/builder (e.g. Saya Group or RGBIL) and NEVER claim to own the projects.
- If a customer inquires about a specific project (e.g., Future Estate), confirm immediately: "Ji, Future Estate ka project hamari available inventory mein hai. Main aapko uski verified details batati hoon."
- If a customer rejects a specific builder (e.g., "Mujhe Saya Group ka project nahi chahiye"): DO NOT disconnect or end the call! Acknowledge politely and pivot to other developers: "Ji bilkul, koi baat nahi. Main Saya Group ke options hata deti hoon. Aapke liye doosre builders ke projects check karti hoon."

AVAILABLE PROJECTS & INVENTORY:
${selectedProjectLock && selectedProjectId
                    ? `PROJECT CONTEXT LOCK (ACTIVE):
- CURRENT LOCKED PROJECT: ${selectedProjectId}
- The customer has explicitly locked discussion onto ${selectedProjectId}.
- STRICT RULE: Continue discussing ${selectedProjectId} ONLY. DO NOT introduce, switch to, or compare other projects unless the customer explicitly asks for alternatives or other options!
- Answer all questions regarding sizes, prices, layouts, and amenities specifically for ${selectedProjectId}.\n\n`
                    : ''}${projectsOverview}

CUSTOMER STATUS:
${isReturning
                    ? `RETURNING CUSTOMER${realCustomerName ? ` (${realCustomerName} ji)` : ''}.
- Customer has called or enquired before. Known Requirement: ${pastRequirement || 'Interested in property'}.
- CRITICAL: NEVER re-ask for customer's name, BHK, or details already known!
- Use the personalized opening pitch below.`
                    : `NEW CALLER (First time enquiry, no previous records).`}

RULES (HUMAN HELPLINE ADVISOR):
1) GREETING / OPENER RULES:
   - THE OPENER GREETING WAS ALREADY SPOKEN WHEN CALL CONNECTED ("Namaste...").
   - When caller responds with "Hello" / "Haan ji" / "Namaste" / "Aawaz aa rahi hai" / "Sun rahe ho":
     DO NOT repeat the long greeting or company pitch!
     Acknowledge warmly and invite them to speak:
     ${realCustomerName ? `"Haan ji ${realCustomerName} ji, main sun rahi hoon, boliye!"` : `"Haan ji, main sun rahi hoon, boliye!"`}
   - If caller asks "Kaun?" / "Kaun bol raha hai?": ${isHinglish
                    ? `"Ji namaste! Main ${company} real estate helpline se ${options.agentName} baat kar rahi hoon. Bataiye main aapki kya sahayata kar sakti hoon?"`
                    : isEnglish
                        ? `"Hello! I am ${options.agentName} calling from ${company} real estate helpline. How can I assist you today?"`
                        : `"जी नमस्ते! मैं ${company} रियल एस्टेट हेल्पलाइन से ${options.agentName} बात कर रही हूँ। बताइए मैं आपकी क्या सहायता कर सकती हूँ?"`}
2) DIRECT ANSWER MUST TAKE PRIORITY OVER SALES CONVERSION:
   - The customer called you. If they ask about projects, available flats, 2BHK/3BHK sizes, price, location, or RERA, ALWAYS ANSWER DIRECTLY FIRST.
   - NEVER convert an information request into an unsolicited site-visit pitch!
   - Answer directly, mention missing details honestly, and only ask ONE relevant follow-up question if needed.
3) EXPLAIN PROJECTS & PRODUCT LIST WHEN ASKED:
   - If caller asks "kitne products hain, list batao", "sab projects batao", or "jo bhi projects hain, sabki details batao":
     * Present all eligible projects dynamically from AVAILABLE PROJECTS & INVENTORY below (matching in-budget first, stretch-budget with disclosure).
     * DO NOT arbitrarily limit recommendations to three projects. Include Future Estate, VVIP projects, Palace Heights, NCR Monarch, and all eligible inventory.
     * NEVER recommend any project from REJECTED BUILDERS or REJECTED PROJECTS!
     * Clearly state the actual developer alongside each project name (e.g. "Future Estate by Future World", "Palace Heights by Rudra Buildwell").
     * NEVER mix commercial projects into residential recommendations unless customer explicitly asks for commercial.
     * Ask which project or location they want to explore.
4) PROGRESSIVELY COLLECT DETAILS (HUMAN CONVERSATION - 1 DETAIL PER TURN):
   - A real property advisor answers with warmth, then politely asks ONE missing detail to guide them:
     * If caller's name is unknown (${!realCustomerName ? 'Name not known yet' : 'Name is ALREADY KNOWN (' + realCustomerName + ') - NEVER ASK NAME'}): ${isHinglish ? '"Vaise main aapka shubh naam jaan sakti hoon?"' : isEnglish ? '"May I know your name, please?"' : '"वैसे मैं आपका शुभ नाम जान सकती हूँ?"'}
     * If BHK unknown (${!known.bhk ? 'BHK not known' : 'BHK is ALREADY KNOWN (' + known.bhk + ') - NEVER ASK BHK'}): ${isHinglish ? '"Aap 2 BHK flat dekh rahe hain ya 3 BHK?"' : isEnglish ? '"Are you looking for a 2 BHK or 3 BHK apartment?"' : '"आप 2 बीएचके फ्लैट देख रहे हैं या 3 बीएचके?"'}
     * If purpose unknown (${!known.purpose ? 'Purpose not known' : 'Purpose is ALREADY KNOWN (' + known.purpose + ') - NEVER ASK PURPOSE'}): ${isHinglish ? '"Aap apne rehne ke liye dekh rahe hain ya investment ke liye?"' : isEnglish ? '"Are you looking for self-use or investment?"' : '"आप अपने रहने के लिए देख रहे हैं या इन्वेस्टमेंट के लिए?"'}
     * If location or timeline unknown: ${isHinglish ? '"Aap Sector 1 Noida Extension mein dekh rahe hain? Aur kab tak shift karne ka plan hai?"' : isEnglish ? '"Are you looking in Sector 1 Noida Extension? And when are you planning to shift?"' : '"आप सेक्टर 1 नोएडा एक्सटेंशन में देख रहे हैं? और कब तक shift karne ka plan hai?"'}
     * If budget unknown (${!known.budgetLabel ? 'Budget not known' : 'Budget is ALREADY KNOWN (' + known.budgetLabel + ') - NEVER ASK BUDGET'}): ${isHinglish ? '"Aapka lagbhag budget kitna hai?"' : isEnglish ? '"What is your approximate budget?"' : '"आपका लगभग बजट कितना है?"'}
     * Site visit offer ONLY after customer shows clear interest in visiting a specific project.
5) Never ask multiple questions in one turn. Answer first + ask ONE single question.
6) If checking details: "Ji main dekh rahi hoon, ek second..."
7) If wrong number or not interested: polite thank-you and end.
Facts: ${JSON.stringify(known)}
Project: ${resolvedProject?.name || 'helpline discovery'} ${resolvedProject?.location || ''}
${ragBlock ? `Knowledge:\n${ragBlock.slice(0, 500)}` : ''}
${playbook ? playbook : ''}
${previousAgent ? `Do not repeat: ${previousAgent.slice(0, 100)}` : ''}
Answer helpfully and warmly in 1–2 short spoken sentences.`
                : `You are ${options.agentName}, live RE telecaller for ${company}.
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
                const template = options.isInbound
                    ? (0, sales_agent_prompt_1.buildDefaultInboundAgentPrompt)()
                    : (0, sales_agent_prompt_1.isSalesAgentPrompt)(options.systemPrompt)
                        ? String(options.systemPrompt)
                        : (0, sales_agent_prompt_1.buildDefaultSalesAgentPrompt)();
                return (0, sales_agent_prompt_1.fillSalesAgentPrompt)(template, {
                    company_name: company,
                    customer_name: realCustomerName ? `${realCustomerName} ji` : '',
                    product_name: productName,
                    lead_source: options.isInbound ? 'helpline call' : 'enquiry',
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
                    customer_status: isReturning
                        ? `Returning customer${realCustomerName ? ` (${realCustomerName} ji)` : ''}. Called before. PREVIOUS CONTEXT: ${pastRequirement || options.memory?.conversationSummary || 'Interested in property'}. GREET AS RETURNING CALLER USING THE PERSONALIZED PITCH.`
                        : 'New caller without previous records.',
                    answered_fields: (options.memory?.answeredFields || []).join(', ') || 'none yet',
                    known_memory: options.memory ? JSON.stringify(options.memory.customer) : 'none',
                    known_requirement: pastRequirement || (isEn || isHing ? 'property' : 'प्रॉपर्टी'),
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
1) GREETING / IDENTITY / FIRST TURN OPENER (${isHinglish ? 'IN HINGLISH - ROMAN SCRIPT' : isEnglish ? 'IN ENGLISH' : 'IN DEVANAGARI HINDI'}):
   - When customer says "Hello" / "Haan ji" / "Namaste" / "Kaun" at start of call:
${realCustomerName
                ? `     * RECOGNIZED RETURNING CLIENT: Name is "${realCustomerName}".
       Greet warmly by name!
       ${pastRequirement
                    ? isHinglish
                        ? `PITCH THIS EXACT LINE: "Namaste ${realCustomerName} ji! ${company} mein aapka phir se swaagat hai. Pichhli baar hamari baat ${pastRequirement} ko lekar hui thi — kya aaj usi ke regarding baat karna chahenge ya kuch naya dekhna hai?"`
                        : isEnglish
                            ? `PITCH THIS EXACT LINE: "Hello ${realCustomerName} ji! Welcome back to ${company}. Last time we spoke about ${pastRequirement} — would you like to discuss that further or explore something new today?"`
                            : `PITCH THIS EXACT LINE: "नमस्ते ${realCustomerName} जी! ${company} में आपका फिर से स्वागत है। पिछली बार हमारी बात ${pastRequirement} को लेकर हुई थी — क्या आज उसी के रिगार्डिंग बात करना चाहेंगे या कुछ नया देखना है?"`
                    : isHinglish
                        ? `PITCH THIS EXACT LINE: "Namaste ${realCustomerName} ji! Dobara call karne ke liye dhanyavaad. Main ${options.agentName} बात kar rahi hoon, bataiye aaj aapki kya sahayata kar sakti hoon?"`
                        : isEnglish
                            ? `PITCH THIS EXACT LINE: "Hello ${realCustomerName} ji! Thank you for calling again. I am ${options.agentName}, how can I help you today?"`
                            : `PITCH THIS EXACT LINE: "नमस्ते ${realCustomerName} जी! दोबारा कॉल करने के लिए धन्यवाद। मैं ${options.agentName} बात कर रही हूँ, बताइए आज आपकी क्या सहायता कर सकती हूँ?"`}`
                : `     * NEW CALLER (NO DATABASE RECORD / UNKNOWN NAME):
       ${isHinglish
                    ? `PITCH THIS EXACT LINE: "Haan ji namaste! ${company} helpline mein aapka swaagat hai. Main ${options.agentName} baat kar rahi hoon, bataiye main aapki kya sahayata kar sakti hoon?"`
                    : isEnglish
                        ? `PITCH THIS EXACT LINE: "Hello! Welcome to ${company} helpline. I am ${options.agentName}, how may I help you today?"`
                        : `PITCH THIS EXACT LINE: "हाँ जी नमस्ते! ${company} हेल्पलाइन में आपका स्वागत है। मैं ${options.agentName} बात कर रही हूँ, बताइए मैं आपकी क्या सहायता कर सकती हूँ?"`}`}
   - If customer says "Hello" / "Awaz aa rahi hai" / "Sun rahe ho" MID-CALL: Reassure immediately: ${isHinglish ? '"Haan ji, main line par hoon, boliye!" or "Haan ji, aawaz aa rahi hai, boliye!"' : isEnglish ? '"Yes, I can hear you clearly! Please go ahead."' : '"हाँ जी, मैं लाइन पर हूँ, बोलिए!" या "हाँ जी, आवाज़ आ रही है, बोलिए!"'}
   - If customer asks "Kaun?" / "Kaun bol raha hai?" / "Kahan phone lag gaya?": Clarify directly: ${isHinglish ? `"Ji namaste! Main ${company} real estate helpline se ${options.agentName} baat kar rahi hoon. Bataiye main aapki kya madad kar sakti hoon?"` : isEnglish ? `"Hello! I am ${options.agentName} calling from ${company} real estate helpline. How may I assist you?"` : `"जी नमस्ते! मैं ${company} रियल एस्टेट हेल्पलाइन से ${options.agentName} बात कर रही हूँ। बताइए मैं आपकी क्या मदद कर सकती हूँ?"`}
   - If asked for project/property details: Give facts simply; if looking up: "Ji main dekh rahi hoon, ek second..."
2) FIRST understand the customer's last message. If they asked a question (e.g. price, location, 2BHK/3BHK), ANSWER that directly before any sales question.
    - If customer asks "Tumko kaise pata chala mera budget / mera naam / pichhli baat?", explain warmly: "Ji pichhli call par humari baat hui thi, tabhi se system mein record hai." Then address what they want to do next.
    - INCOMPLETE / AMBIGUOUS QUERIES: If customer says "क्या अभी?" / "अभी?" / "Kya abhi?", clarify directly: "Ji kya aap abhi site visit ke baare mein pooch rahe hain, ya abhi call par details discuss karna chahte hain?" Never treat ambiguous phrases or "theek hai" as appointment confirmations.
    - TOPIC CHANGE: If customer changes topic, abandon prior sales flow and answer their new query immediately.
    - BUDGET TRANSPARENCY: Check project prices. Never pitch a property starting above their budget without transparent disclosure. If pitching an option that exceeds their stated budget (e.g. ₹86 Lakh for an ₹80 Lakh budget), disclose: "Yeh option aapke budget se thoda sa upar hai, ₹86 lakh se shuru hota hai. Kya aap dekhna chahenge?" Always ask permission before suggesting stretch options.
    - SEGREGATION: If customer wants residential (flats/apartments/BHK), NEVER pitch commercial projects (shops/retail/malls like Saya South X / Saya Piazza) and vice versa. If ambiguous, clarify: "Aap residential flat dekh rahe hain ya commercial shop?"
    - ANTI-REPETITION: Never re-ask any fact present in "Known facts so far" below!
    - APPOINTMENT BOOKING: Never book an appointment from generic acks ("theek hai", "haan"). Explicitly confirm date, time, and project name.
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
                    ? options.isInbound
                        ? `Customer called helpline and said: "${options.userMessage}"\nUnderstand their query, then reply helpfully in one short spoken line:`
                        : `Customer said: "${options.userMessage}"\nUnderstand their intent, then reply in one short spoken line:`
                    : options.isInbound
                        ? `Recent call:\n${recentTranscript || '(start)'}\n\nCaller just said: "${options.userMessage}"\n\nAnswer their query helpfully and guide them naturally in 1–2 short sentences.`
                        : `Recent call:\n${recentTranscript || '(start)'}\n\nCustomer just said: "${options.userMessage}"\n\nFirst understand them. If they asked something, answer it. Then reply in 1–2 short sentences.`,
            },
        ];
        const voiceModel = options.llmModel || 'gemini-flash-lite-latest';
        const llmOpts = {
            temperature: 0.45,
            model: voiceModel,
            maxOutputTokens: options.phoneLatency || options.stream ? 150 : 200,
            timeoutMs: options.phoneLatency || options.stream ? 12000 : 15000,
            lowLatency: true,
        };
        let llmOut = null;
        let streamed = false;
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
            const callerKnownName = known.callerName && !(0, call_scripts_1.isPlaceholderLeadName)(known.callerName)
                ? known.callerName
                : realCustomerName;
            const quickSystem = options.isInbound
                ? `You are ${options.agentName}, live customer helpline & real estate property advisor for ${company} (Independent Multi-Builder Real Estate Channel Partner).
${genderLines}
Speak ${replyLang}. ${this.languageInstruction(replyLang)}
The caller dialed your helpline to ask questions about properties, projects, locations, prices, or general information.

IMPORTANT CHANNEL PARTNER IDENTITY:
- ${company} is an independent real estate channel partner marketing projects for multiple builders (such as Rudra Buildwell, Future World, VVIP Group, Saya Group, Divyansh, Apex, Godrej, etc.).
- You are NOT an employee of Saya Group or RGBIL. You are NOT the developer/builder. You represent ${company}.
- SPECIFIC PROJECT INQUIRY: If customer asks for a project like Future Estate ("Mujhe Future Estate chahiye. Kya aapke paas hai?"): confirm directly and affirmatively: "Ji, Future Estate ka project hamari available inventory mein hai. Main aapko uski verified details batati hoon."
- BUILDER REJECTION HANDLING: If customer rejects a builder like Saya Group ("Mujhe Saya Group ka project nahi chahiye" / "साया का नहीं चाहिए"): NEVER disconnect or end the call! Politely acknowledge and pivot to other developers: "Ji bilkul, koi baat nahi. Main Saya Group ke options hata deti hoon. Aapke liye doosre builders ke projects check karti hoon."

AVAILABLE PROJECTS & INVENTORY:
${selectedProjectLock && selectedProjectId
                    ? `PROJECT CONTEXT LOCK (ACTIVE):
- CURRENT LOCKED PROJECT: ${selectedProjectId}
- The customer has explicitly locked discussion onto ${selectedProjectId}.
- STRICT RULE: Continue discussing ${selectedProjectId} ONLY. DO NOT introduce, switch to, or compare other projects unless the customer explicitly asks for alternatives or other options!
- Answer all questions regarding sizes, prices, layouts, and amenities specifically for ${selectedProjectId}.\n\n`
                    : ''}${projectsOverview}

CRITICAL RESPONSE PRIORITY & NATURAL DIALOGUE RULES:
- PRIORITY 1 (DIRECT ANSWER MUST TAKE PRIORITY OVER SALES CONVERSION): Always answer the customer's direct question first!
  * PRODUCT & PROJECT LIST: If caller asks for product list or projects ("kitne products hain", "list batao", "options batao", "sab projects batao", "jo bhi projects hain"):
    - Present all eligible projects dynamically from AVAILABLE PROJECTS & INVENTORY below (categorized by in-budget first, stretch-budget with disclosure).
    - DO NOT arbitrarily limit recommendations to three projects. Include Future Estate, VVIP projects, Palace Heights, NCR Monarch, and all eligible inventory.
    - NEVER recommend any project from REJECTED BUILDERS or REJECTED PROJECTS!
    - Mention the developer alongside each project (e.g. "Palace Heights by Rudra", "Future Estate by Future World").
    - NEVER mix commercial properties (Saya Piazza / South X) into residential listings!
    - Do NOT claim every project suits their budget. Do NOT re-pitch an explicitly rejected project.
    - Ask which project or location they want to explore.
  * DIRECT SIZES & FLOOR PLANS: If customer asks for sizes ("मुझे sizes बता दीजिए एक एक", "size batao", "area kitna hai", "sqft") or floor plan ("floor plan बता दो", "map", "layout"):
    - ALWAYS ANSWER the exact configuration sizes directly from Available Projects (e.g. "Palace Heights mein 1 BHK 700 sq.ft, 2 BHK 1015 se 1088 sq.ft, 3 BHK 1341 se 1568 sq.ft, aur 4 BHK 1841 se 2285 sq.ft available hain").
    - If customer asks for floor plan map: state the configuration sizes, and say: "Main team ko bolkar floor plan layout map aapke WhatsApp par share karwa doongi."
    - NEVER replace or dodge a floor plan / sizes question by pitching a site visit instead!
  * If asked how you know their details/budget ("tumko kaise pata chala mera budget..."): Answer directly from history: "Ji, humari pichhli baat-cheet mein aapne bataya tha, usi aadhar par maine options suggest kiye hain. Agar isme koi badlav hai to aap bata sakte hain."
  * If customer asks an incomplete or ambiguous question like "क्या अभी?", "अभी?", "Kya abhi?": Clarify directly what they mean: "Ji, kya aap abhi site visit ke baare mein pooch rahe hain, ya abhi call par details discuss karna chahte hain?" NEVER treat "क्या अभी" as agreement or book an appointment on it!
  * If asked about project details, prices, possession, amenities: Answer from Available Projects & Knowledge first. Mention missing information honestly.
  * POSSESSION & READY-TO-MOVE ACCURACY (CRITICAL):
    - If customer specifically asks for ready-to-move / immediate possession / ready flats:
      * NEVER claim Under-Construction or Pre-Launch projects (Saya Pre-Launch, VVIP Pre-Launch, Future Estate) are Ready-to-Move!
      * Only offer projects verified as Ready-to-Move or Near-Ready (e.g. Palace Heights 3 towers in 6 months).
      * If customer asks for ready-to-move 3 BHK and no verified ready project exists, clearly state: "Abhi hamare paas Noida Extension mein mostly under-construction options hain jisme Palace Heights mein 6 months mein possession mil raha hai. Kya aap under-construction dekhna chahenge ya sirf ready-to-move hi chahiye?"
  * If they switch topics or ask something new: Immediately prioritize answering their new query! Never drag them back to site visit scheduling until answered.
  * If they correct information (e.g. "Actually mera budget 90 lakh hai" or "Nahi mujhe ready-to-move chahiye"): Immediately accept and update to their latest preference!
- PRIORITY 2 (STRICT BUDGET MATCHING, SOURCE FACTS & WHATSAPP RULES):
  * STRICT BUDGET MATCHING: When customer budget is known (e.g. ₹80 Lakh):
    - ALWAYS recommend matching in-budget properties first (<= budget, e.g. Saya Pre-Launch starting ₹69L, Palace Heights starting ₹60.9L, NCR Monarch starting ₹64L).
    - NEVER recommend above-budget properties (like Future Estate at ₹86.32 Lakh or VVIP at ₹90.625 Lakh) without FIRST stating clearly that it exceeds their budget and asking permission: e.g. "Future Estate ₹86.32 Lakh aur VVIP ₹90.625 Lakh se start hote hain jo aapke ₹80 Lakh budget se lagbhag ₹6.32 Lakh aur ₹10.63 Lakh upar hain — kya main inki aur details aapko bataun?"
    - NEVER invent or guess property prices.
  * SOURCE-BACKED PROJECT FACTS ONLY:
    - Only share facts verified in Available Projects / Knowledge (e.g. VVIP: 5 acres, 5 towers, G+30, 60,000 sq.ft modern clubhouse, starting ₹90.625 Lakh).
    - If a specific detail (like specific kitchen fittings or balcony dimensions) is not in Knowledge, state: "Is specific detail ki verified information main team se confirm karke WhatsApp par share karwa doongi." NEVER hallucinate unverified fittings.
  * WHATSAPP DISCLAIMER:
    - NEVER claim you have sent WhatsApp or that WhatsApp is already delivered.
    - Always say: "Main team ko note karwa deti hoon, wo details aur layout verify karke aapke WhatsApp number par share kar denge."
  * RESIDENTIAL VS COMMERCIAL:
    - For residential requirements (flats, apartments, living), NEVER recommend commercial projects (e.g. Saya Piazza, Saya South X shops) unless customer explicitly asks for commercial/shops.
  * APPOINTMENT BOOKING: Never consider an appointment booked from generic acks ("theek hai", "haan"). Only book when date, time, and project are explicitly confirmed by customer.
- PRIORITY 3 (ANTI-REPETITION & NATURAL DIALOGUE):
  * YOUR LAST SPOKEN STATEMENT WAS: "${(previousAgent || '').slice(0, 140)}"
  * NEVER repeat your last line! Never ask the same question twice!
  * GREETING: The opener was ALREADY delivered at connect. When caller says "Hello" / "Namaste" / "Aawaz aa rahi hai" after connect, DO NOT repeat the introductory pitch or company welcome! Acknowledge warmly: ${callerKnownName ? `"Haan ji ${callerKnownName} ji, main sun rahi hoon, boliye!"` : `"Haan ji, main sun rahi hoon, boliye!"`}
  * DO NOT repeat customer's name in every sentence! Use name at most once warmly, and only rarely thereafter.
  * Move the conversation FORWARD naturally:
    1) If caller says "Hello" / "Awaz aa rahi hai" mid-call: "Haan ji, main line par hoon, boliye!" ya "Haan ji, aawaz aa rahi hai, boliye!"
    2) If caller asks ANY question about project, flat, price, location, amenities, possession: ALWAYS answer their question first from Available Projects & Knowledge.
    3) PROGRESSIVE DETAIL COLLECTION (Check what is already answered in the transcript):
       * Name: ${callerKnownName ? `Known (${callerKnownName}) - Use their name ("${callerKnownName} ji") and DO NOT ask name again!` : 'UNKNOWN (CRITICAL: Politely ask their name early in call: "Vaise main aapka shubh naam jaan sakti hoon?")'}
       * Configuration: ${known.bhk ? `Known (${known.bhk}) - DO NOT ask BHK again!` : 'Ask: "Aap 2 BHK flat dekh rahe hain ya 3 BHK?"'}
       * Purpose: ${known.purpose ? `Known (${known.purpose}) - DO NOT ask purpose again!` : 'Ask: "Aap apne rehne ke liye dekh rahe hain ya investment ke liye?"'}
       * Location/Timeline: ${known.location ? `Known (${known.location})` : 'Ask: "Aap Sector 1 Noida Extension me dekh rahe hain? Aur kab tak lene ka plan hai?"'}
       * Budget: ${known.budgetLabel ? `Known (${known.budgetLabel})` : 'Ask: "Aapka approximate budget kya hai?"'}
       * Site Visit: ONLY after customer shows genuine interest in visiting a specific project. NEVER force site visit on information queries!
- Rule: 1-2 short spoken sentences. Answer their query first + ask ONE next question. Never ask multiple questions. Never interrogate.
Facts Known: ${JSON.stringify(known)}
${options.memory?.factContext?.missingFacts ? `Missing Facts: ${options.memory.factContext.missingFacts.join(', ')}` : ''}
${resolvedProject ? `Project: ${resolvedProject.name}` : ''}
${ragBlock ? `KB:\n${ragBlock.slice(0, 300)}` : ''}`
                : `You are ${options.agentName}, live RE phone agent for ${company}.
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
            const recentDialog = (options.priorTranscript || '')
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
                .slice(-8)
                .join('\n');
            const quickMessages = [
                { role: 'system', content: quickSystem },
                {
                    role: 'user',
                    content: options.isInbound
                        ? `Conversation so far:\n${recentDialog || 'Agent: Hello?'}\n\nCaller just said: "${options.userMessage}"\n\nCRITICAL: DO NOT repeat greetings ("Namaste/swagat hai"), DO NOT re-introduce yourself ("Main Neha hoon"), and DO NOT ask any question that was already asked above! Answer them directly and take the conversation forward:`
                        : `Conversation so far:\n${recentDialog || 'Agent: Hello'}\n\nCustomer: "${options.userMessage}"\nReply only to that:`,
                },
            ];
            const t0 = Date.now();
            streamed = false;
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
            if (!streamed && previousAgent && (0, call_scripts_1.isSameTalk)(replyText, previousAgent)) {
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
                    ? (realCustomerName ? `Sure ${realCustomerName}. ` : `Sure! `)
                    : (realCustomerName ? `अच्छा ${realCustomerName} जी. ` : `अच्छा! `);
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
        this.logger.log(`[Conversation] 🤖 Reply: "${replyText}" (LLM: ${usedLlm})`);
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
    cachedProjects = null;
    async getCachedProjects() {
        const now = Date.now();
        if (this.cachedProjects && this.cachedProjects.expiresAt > now) {
            return this.cachedProjects.data;
        }
        try {
            const projects = await this.prisma.project.findMany({
                select: {
                    id: true,
                    name: true,
                    companyName: true,
                    builder: true,
                    location: true,
                    propertyType: true,
                    startingPrice: true,
                    endingPrice: true,
                    reraNumber: true,
                    possessionDate: true,
                    amenities: true,
                    description: true,
                },
                take: 50,
            });
            this.cachedProjects = { data: projects, expiresAt: now + 300_000 };
            return projects;
        }
        catch {
            return [];
        }
    }
    async getProjectsOverview(budgetOrOptions) {
        const options = typeof budgetOrOptions === 'number'
            ? { customerBudgetRupees: budgetOrOptions }
            : budgetOrOptions || {};
        const customerBudgetRupees = options.customerBudgetRupees;
        const rejectedBuildersNorm = (options.rejectedBuilders || []).map((b) => b.trim().toLowerCase());
        const rejectedProjectsNorm = (options.rejectedProjects || []).map((p) => p.trim().toLowerCase());
        const isRejected = (p) => {
            const bNorm = (p.builder || '').toLowerCase();
            const pNorm = (p.name || '').toLowerCase();
            for (const rejB of rejectedBuildersNorm) {
                if (!rejB)
                    continue;
                if (bNorm.includes(rejB) || rejB.includes(bNorm))
                    return true;
                if (/saya/i.test(rejB) && /saya/i.test(bNorm))
                    return true;
                if (/vvip/i.test(rejB) && /vvip/i.test(bNorm))
                    return true;
                if (/rudra/i.test(rejB) && /rudra/i.test(bNorm))
                    return true;
                if (/future/i.test(rejB) && /future/i.test(bNorm))
                    return true;
                if (/godrej/i.test(rejB) && /godrej/i.test(bNorm))
                    return true;
            }
            for (const rejP of rejectedProjectsNorm) {
                if (!rejP)
                    continue;
                if (pNorm.includes(rejP) || rejP.includes(pNorm))
                    return true;
                if (/saya\s*pre/i.test(rejP) && /saya\s*pre/i.test(pNorm))
                    return true;
                if (/future\s*estate/i.test(rejP) && /future\s*estate/i.test(pNorm))
                    return true;
                if (/vvip/i.test(rejP) && /vvip/i.test(pNorm))
                    return true;
            }
            return false;
        };
        const projects = await this.getCachedProjects();
        const verifiedDetails = {
            'palace heights': {
                sizes: '1 BHK (700 sq.ft, from ₹60.9L furnished), 2 BHK (1015-1088 sq.ft), 3 BHK (1341-1568 sq.ft), 4 BHK (1841-2285 sq.ft)',
                club: '30,000 sq.ft clubhouse, 70% green area, 50:50 payment plan, 3 towers possession in 6 months',
                bsp: '₹8,700/sq.ft',
                possession: 'Near Possession (3 towers within 6 months, balance under construction)',
            },
            'ncr monarch': {
                sizes: '1 BHK (720-1010 sq.ft, from ₹64L), 2 BHK (1075-1255 sq.ft), 3 BHK (1345-1810 sq.ft)',
                club: 'Modern clubhouse & sports facilities',
                bsp: '₹8,888/sq.ft',
                possession: 'Under Construction (Possession 2026)',
            },
            'future estate': {
                sizes: '2 BHK (1110, 1130, 1170, 1240 sq.ft), 2 BHK + Study (1335 sq.ft), 3 BHK (2050 sq.ft), 4 BHK (2500 sq.ft)',
                club: '7.9 Acres, 9 Towers (G+10/S+22), 2 Clubhouses (32,000 sq.ft + 10,000 sq.ft), SWAMIH/SBI funded',
                bsp: '₹7,777/sq.ft (Pre-launch Tower DEF ₹9,500/sq.ft)',
                possession: 'Under Construction (SWAMIH funded, completion 2026)',
            },
            'vvip pre-launch': {
                sizes: '2 BHK (1250 sq.ft, ~₹90.6L-₹91L), 3 BHK (1800 sq.ft), 4 BHK (2400 sq.ft)',
                club: '5 Acres, 5 Towers (G+30 floors, 750 units, 4 lifts/floor), 60,000 sq.ft modern clubhouse',
                bsp: '₹7,250/sq.ft',
                possession: 'Pre-Launch / Under Construction (Possession 2028-2029)',
            },
            'vvip namah': {
                sizes: '3 BHK (1635, 1650, 1970, 1980, 2320 sq.ft), 4 BHK + Servant (2950, 3105 sq.ft)',
                club: '2.75 Acres, 3 Towers (G+23 floors)',
                bsp: '₹10,040 - ₹10,540/sq.ft',
                possession: 'Under Construction',
            },
            'saya pre-launch': {
                sizes: '2 BHK (1000 sq.ft, from ₹69L), 2+S BHK (1200 sq.ft), 3 BHK (1400, 1600, 1800 sq.ft), 4 BHK (2600 sq.ft)',
                club: '18 Acres, 17-18 Towers (G+22-25, 2200 units), 1,50,000 sq.ft mega luxury clubhouse, 20*5 payment plan',
                bsp: '₹6,900/sq.ft',
                possession: 'Pre-Launch / Under Construction (Possession 2028-2029)',
            },
            'aarya heights': {
                sizes: '3 BHK + 3T (1880, 2065 sq.ft), 4 BHK + 4T (2465 sq.ft)',
                club: '1.2 Acres, 1 iconic tower (G+27 floors, 160 units)',
                bsp: '₹5,750/sq.ft',
                possession: 'Under Construction',
            },
        };
        const getVerifiedMeta = (name) => {
            const lower = name.toLowerCase();
            for (const [key, val] of Object.entries(verifiedDetails)) {
                if (lower.includes(key))
                    return val;
            }
            return null;
        };
        let residentialList = [];
        let commercialList = [];
        if (projects.length) {
            residentialList = projects.filter((p) => p.propertyType !== 'COMMERCIAL');
            commercialList = projects.filter((p) => p.propertyType === 'COMMERCIAL');
        }
        else {
            residentialList = [
                {
                    name: 'Saya Pre-Launch',
                    builder: 'Saya Group',
                    location: 'Raj Nagar Extension, Ghaziabad',
                    propertyType: 'APARTMENT',
                    startingPrice: 6900000,
                    description: '18 Acres, 17-18 Towers, 1,50,000 sq.ft luxury club. 2/3/4 BHK',
                },
                {
                    name: 'Palace Heights by Rudra',
                    builder: 'Rudra Buildwell',
                    location: 'GH-02B, Sector 1, Greater Noida West',
                    propertyType: 'APARTMENT',
                    startingPrice: 6090000,
                    description: '1/2/3/4 BHK Luxury Apartments, 50:50 payment plan',
                },
                {
                    name: 'NCR Monarch',
                    builder: 'NCR Group',
                    location: 'GH-02C, Sector 1, Greater Noida West',
                    propertyType: 'APARTMENT',
                    startingPrice: 6400000,
                    description: '1/2/3 BHK Luxury Apartments, ₹8,888/sq.ft',
                },
                {
                    name: 'Future Estate by Future World',
                    builder: 'Future World',
                    location: 'Plot No 16 E, Sector 1, Greater Noida West',
                    propertyType: 'APARTMENT',
                    startingPrice: 8632470,
                    description: '7.9 Acres, 9 Towers. 2 BHK (1110-1240 sq.ft), SWAMIH funded',
                },
                {
                    name: 'VVIP Pre-Launch',
                    builder: 'VVIP Group',
                    location: 'Raj Nagar Extension, Ghaziabad',
                    propertyType: 'APARTMENT',
                    startingPrice: 9062500,
                    description: '5 Acres, 5 Towers (G+30, 750 units), 60,000 sq.ft club. 2/3/4 BHK',
                },
            ];
            commercialList = [
                {
                    name: 'Saya Piazza',
                    builder: 'Saya Group',
                    location: 'Noida Expressway',
                    propertyType: 'COMMERCIAL',
                    startingPrice: 4900000,
                    description: 'Commercial High-Street Retail & Shops',
                },
                {
                    name: 'Saya South X',
                    builder: 'Saya Group',
                    location: 'Greater Noida West',
                    propertyType: 'COMMERCIAL',
                    startingPrice: 5500000,
                    description: 'Commercial Retail Shops, Dining & Entertainment',
                },
            ];
        }
        residentialList = residentialList.filter((p) => !isRejected(p));
        commercialList = commercialList.filter((p) => !isRejected(p));
        if (options.propertyType === 'RESIDENTIAL') {
            commercialList = [];
        }
        else if (options.propertyType === 'COMMERCIAL') {
            residentialList = [];
        }
        const formatProjectEntry = (p, budget) => {
            const meta = getVerifiedMeta(p.name);
            const startPriceNum = p.startingPrice != null ? Number(p.startingPrice) : null;
            const priceStr = startPriceNum != null
                ? startPriceNum >= 10000000
                    ? `₹${(startPriceNum / 10000000).toFixed(2)} Cr onwards`
                    : `₹${(startPriceNum / 100000).toFixed(2)} Lakh onwards`
                : 'Price on request';
            const diffVal = budget && startPriceNum && startPriceNum > budget ? (startPriceNum - budget) / 100000 : 0;
            const diffNotice = diffVal > 0
                ? ` [STRETCH OPTION: ₹${Math.round(diffVal)} Lakh above customer's budget (exact: ₹${diffVal.toFixed(2)} Lakh) - Disclose price difference upfront & ask permission!]`
                : '';
            const devNotice = p.builder ? ` [Developer: ${p.builder}]` : '';
            const lines = [
                `- ${p.name}${devNotice} [Location: ${p.location}]: ${priceStr}${diffNotice}`,
            ];
            let possessionStatus = meta?.possession;
            if (!possessionStatus && p.possessionDate) {
                const pDate = new Date(p.possessionDate);
                if (pDate.getTime() <= Date.now()) {
                    possessionStatus = 'Ready to Move';
                }
                else {
                    possessionStatus = `Under Construction (Possession: ${pDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})`;
                }
            }
            if (!possessionStatus) {
                if (/ready/i.test(p.description || '')) {
                    possessionStatus = 'Ready to Move';
                }
                else if (/pre-launch/i.test(p.name)) {
                    possessionStatus = 'Pre-Launch / Under Construction (Possession 2028-2029)';
                }
                else {
                    possessionStatus = 'Under Construction';
                }
            }
            lines.push(`  * Possession Status: ${possessionStatus}`);
            if (meta?.sizes)
                lines.push(`  * Verified Unit Sizes: ${meta.sizes}`);
            if (meta?.bsp)
                lines.push(`  * Verified BSP: ${meta.bsp}`);
            if (meta?.club)
                lines.push(`  * Project Details: ${meta.club}`);
            else if (p.description)
                lines.push(`  * Overview: ${p.description.slice(0, 140)}`);
            if (p.reraNumber)
                lines.push(`  * RERA: ${p.reraNumber}`);
            return lines.join('\n');
        };
        if (options.selectedProjectLock && options.selectedProjectId) {
            const lockKey = options.selectedProjectId.toLowerCase();
            const locked = residentialList.find((p) => p.name.toLowerCase().includes(lockKey) || lockKey.includes(p.name.toLowerCase())) ||
                commercialList.find((p) => p.name.toLowerCase().includes(lockKey) || lockKey.includes(p.name.toLowerCase()));
            if (locked) {
                return (`[ACTIVE PROJECT CONTEXT LOCK: ${locked.name.toUpperCase()}]\n` +
                    `(STRICT INSTRUCTION: The customer has locked discussion onto this property. Discuss ONLY ${locked.name}. Do not introduce other projects unless the customer asks for alternatives!)\n` +
                    formatProjectEntry(locked, customerBudgetRupees));
            }
        }
        const sections = [];
        if (options.possessionPreference) {
            const isReadyPref = /ready/i.test(options.possessionPreference);
            if (isReadyPref) {
                sections.push(`[CUSTOMER POSSESSION PREFERENCE: READY-TO-MOVE / NEAR-READY INVENTORY]\n` +
                    `(STRICT INSTRUCTION: Customer requested ready-to-move flats. Prioritize near-ready options (such as Palace Heights towers possessing in 6 months). For under-construction or pre-launch projects like Saya Pre-Launch, VVIP Pre-Launch, or Future Estate, NEVER misrepresent them as ready-to-move!)`);
            }
        }
        if (customerBudgetRupees && customerBudgetRupees > 0) {
            const budgetLakh = Math.round(customerBudgetRupees / 100000);
            const inBudget = residentialList.filter((p) => p.startingPrice != null && Number(p.startingPrice) <= customerBudgetRupees);
            const stretchBudget = residentialList.filter((p) => p.startingPrice == null || Number(p.startingPrice) > customerBudgetRupees);
            if (inBudget.length) {
                sections.push(`[VERIFIED IN-BUDGET RESIDENTIAL PROPERTIES (<= ₹${budgetLakh} Lakh) - RECOMMEND FIRST]:\n` +
                    inBudget.map((p) => formatProjectEntry(p, customerBudgetRupees)).join('\n'));
            }
            if (stretchBudget.length) {
                sections.push(`[STRETCH-BUDGET RESIDENTIAL PROPERTIES (> ₹${budgetLakh} Lakh) - STRICT RULE: DISCLOSE PRICE DIFFERENCE UPFRONT & ASK PERMISSION BEFORE DISCUSSING]:\n` +
                    stretchBudget.map((p) => formatProjectEntry(p, customerBudgetRupees)).join('\n'));
            }
        }
        else {
            sections.push(`[RESIDENTIAL PROJECTS (Flats/Apartments)]:\n` +
                residentialList.map((p) => formatProjectEntry(p)).join('\n'));
        }
        if (commercialList.length) {
            sections.push(`[COMMERCIAL PROJECTS (Shops/Offices/Retail - ONLY IF CUSTOMER EXPLICITLY ASKS COMMERCIAL)]:\n` +
                commercialList.map((p) => formatProjectEntry(p)).join('\n'));
        }
        return sections.join('\n\n');
    }
    async matchProjectFromSpeech(text) {
        const raw = (text || '').trim();
        if (raw.length < 3)
            return null;
        const projects = await this.getCachedProjects();
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
            .replace(/\brudr[aa]\b/g, 'rudra')
            .replace(/\bpalace\s*heights?\b/g, 'palace heights')
            .replace(/\bncr\s*monarch\b/g, 'ncr monarch')
            .replace(/\bmonarc?h\b/g, 'monarch')
            .replace(/\bsec(?:tor)?\s*1\b/g, 'sector 1')
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
            if (/palace|पैलेस|rudra|रुद्रा|gh-?02b/i.test(hayExpanded) &&
                /palace|rudra/i.test(p.name)) {
                score = Math.max(score, 50);
            }
            if (/monarch|मोनार्क|ncr|gh-?02c/i.test(hayExpanded) &&
                /monarch/i.test(p.name)) {
                score = Math.max(score, 50);
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
            callerName: input.known.callerName || null,
            purpose: input.known.purpose || null,
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
            const cbSlot = (0, meeting_time_1.parseCallbackSlot)(input.userMessage, input.priorTranscript);
            if (cbSlot) {
                base.callbackAt = cbSlot.targetIso;
                base.suggestedNextAction = `Callback ${cbSlot.label}`;
            }
            else {
                base.suggestedNextAction = 'Schedule callback at preferred time';
            }
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
            outcome: String(base.outcome || 'CONNECTED'),
            siteVisitInterest: Boolean(base.siteVisitInterest),
            meetingBooked: Boolean(base.meetingAt),
        });
        base.interestLevel = `${(0, interest_score_1.interestLevelFromScore)(Number(base.interestScore) || 5)} (${base.interestScore}/10)`;
        if (input.skipLlm) {
            return base;
        }
        const llmJson = await this.llm.chat([
            {
                role: 'system',
                content: 'Extract lead qualification JSON with keys: callerName (if customer gave their personal name, e.g. Rahul, Vikas), language, budgetLabel, preferredLocation, bhkPreference, purchaseTimeline, interestLevel, interestScore (integer 0-10 how interested the lead is in buying/visiting), objections, siteVisitInterest, callbackAt, outcome, summary, suggestedNextAction. outcome one of CONNECTED, QUALIFIED, CALLBACK_REQUESTED, SITE_VISIT_INTERESTED, NOT_INTERESTED. summary max 2 sentences.',
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
                        previousScore: Number(base.interestScore) || 5,
                    });
                merged.interestLevel = `${(0, interest_score_1.interestLevelFromScore)(Number(merged.interestScore))} (${merged.interestScore}/10)`;
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
        const callerName = qualification.callerName;
        const projectId = qualification.projectId;
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
            ...(qualification.doNotCall === true ||
                /don't call|do not call|mat call|मत कॉल|wrong number|गलत नंबर/i.test(String(qualification.objections || '') + ' ' + String(qualification.summary || ''))
                ? { doNotCall: true, consentToCall: false }
                : outcome === 'NOT_INTERESTED'
                    ? { doNotCall: false }
                    : {}),
        };
        if (callerName && callerName.length >= 2 && !(0, call_scripts_1.isPlaceholderLeadName)(callerName) && !call_scripts_1.FORBIDDEN_NAME_WORDS.has(callerName.trim().toLowerCase())) {
            data.name = callerName;
        }
        if (projectId) {
            data.project = { connect: { id: projectId } };
        }
        const updatedLead = await this.prisma.lead.update({ where: { id: leadId }, data });
        if (updatedLead?.phone) {
            if (this.customerMemory) {
                void this.customerMemory.invalidateCustomerCache(updatedLead.phone);
            }
        }
        return updatedLead;
    }
};
exports.ConversationService = ConversationService;
exports.ConversationService = ConversationService = ConversationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        llm_service_1.LlmService,
        knowledge_service_1.KnowledgeService,
        customer_memory_service_1.CustomerMemoryService])
], ConversationService);
//# sourceMappingURL=conversation.service.js.map