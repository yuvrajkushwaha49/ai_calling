"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferGenderFromName = inferGenderFromName;
exports.agentGenderFromVoice = agentGenderFromVoice;
exports.resolveSpeechGender = resolveSpeechGender;
exports.ag = ag;
exports.normalizeLanguage = normalizeLanguage;
exports.normalizeTone = normalizeTone;
exports.phoneSpeechGuide = phoneSpeechGuide;
exports.sarvamSpeechGuide = sarvamSpeechGuide;
exports.toneStyleGuide = toneStyleGuide;
exports.compactToneGuide = compactToneGuide;
exports.parseBudgetToNumber = parseBudgetToNumber;
exports.inferBudgetFromShortReply = inferBudgetFromShortReply;
exports.extractFactsFromText = extractFactsFromText;
exports.mergeFacts = mergeFacts;
exports.factsFromLead = factsFromLead;
exports.lastAgentLine = lastAgentLine;
exports.isShortAffirmation = isShortAffirmation;
exports.isShortDecline = isShortDecline;
exports.lastAgentWasSoftClose = lastAgentWasSoftClose;
exports.lastAgentAskedTalkPermission = lastAgentAskedTalkPermission;
exports.lastAgentOfferedDetails = lastAgentOfferedDetails;
exports.lastAgentOfferedCallback = lastAgentOfferedCallback;
exports.resolveContextualShortReply = resolveContextualShortReply;
exports.isSameTalk = isSameTalk;
exports.priorAgentAsked = priorAgentAsked;
exports.buildGreetingText = buildGreetingText;
exports.detectIntent = detectIntent;
exports.buildFollowUpReply = buildFollowUpReply;
exports.previewSampleText = previewSampleText;
const client_1 = require("@prisma/client");
const place_names_1 = require("../elevenlabs/place-names");
const FEMALE_VOICES = new Set([
    'ritu',
    'priya',
    'neha',
    'pooja',
    'simran',
    'kavya',
    'ishita',
    'shreya',
    'roopa',
    'tanya',
    'shruti',
    'suhani',
    'kavitha',
    'rupali',
    'anushka',
    'manisha',
    'vidya',
    'rachel',
    'sarah',
    'lily',
    'charlotte',
    'matilda',
    'elli',
    'emily',
    'freya',
    'gigi',
    'nicole',
    'dorothy',
    'bella',
    'talia',
    'elara',
    'alicia',
    'custom',
]);
const FEMALE_FIRST_NAMES = new Set([
    'sneha',
    'priya',
    'pooja',
    'neha',
    'ananya',
    'kavya',
    'riya',
    'shreya',
    'anushka',
    'isha',
    'ishita',
    'kavitha',
    'manisha',
    'vidya',
    'tanya',
    'suhani',
    'shruti',
    'rupali',
    'simran',
    'roopa',
    'meera',
    'mira',
    'aisha',
    'fatima',
    'sunita',
    'kavita',
    'deepa',
    'divya',
    'nisha',
    'rekha',
    'seema',
    'swati',
    'pallavi',
    'rutuja',
    'sakshi',
    'shweta',
    'sonali',
    'sangeeta',
    'anjali',
    'aditi',
    'aarti',
    'arti',
    'jyoti',
    'lakshmi',
    'laxmi',
    'madhuri',
    'mamta',
    'manju',
    'geeta',
    'gita',
    'preeti',
    'priti',
    'radha',
    'rani',
    'rita',
    'ritu',
    'sapna',
    'sarika',
    'savita',
    'shilpa',
    'smita',
    'sushma',
    'usha',
    'vandana',
    'varsha',
    'vidya',
    'vrinda',
]);
const MALE_FIRST_NAMES = new Set([
    'rajesh',
    'amit',
    'vikram',
    'rahul',
    'rohan',
    'aditya',
    'arjun',
    'suresh',
    'ramesh',
    'sanjay',
    'vijay',
    'ajay',
    'ankit',
    'ankur',
    'ashish',
    'deepak',
    'gaurav',
    'harsh',
    'imran',
    'karan',
    'manish',
    'mohit',
    'nikhil',
    'nitin',
    'pranav',
    'prateek',
    'pratik',
    'ravi',
    'sachin',
    'sahil',
    'sameer',
    'samir',
    'shubham',
    'siddharth',
    'sumit',
    'sunil',
    'tarun',
    'varun',
    'vishal',
    'yogesh',
    'abhishek',
    'akash',
    'alok',
    'aman',
    'anand',
    'anuj',
    'arun',
    'ashok',
    'dev',
    'dinesh',
    'hari',
    'hemant',
    'jai',
    'jay',
    'kunal',
    'lokesh',
    'mahesh',
    'mukesh',
    'naveen',
    'pankaj',
    'parth',
    'raj',
    'rajeev',
    'rajiv',
    'rakesh',
    'rohit',
    'saurabh',
    'shivam',
    'uday',
    'vinay',
    'vivek',
]);
function inferGenderFromName(name) {
    const first = (name || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
    if (!first)
        return null;
    if (FEMALE_FIRST_NAMES.has(first))
        return 'female';
    if (MALE_FIRST_NAMES.has(first))
        return 'male';
    return null;
}
function agentGenderFromVoice(voice) {
    const v = (voice || '').trim().toLowerCase();
    if (!v)
        return 'female';
    if (v === 'custom' || /^[a-z0-9]{20,}$/i.test(v))
        return 'female';
    if (FEMALE_VOICES.has(v))
        return 'female';
    if (/talia|elara|alicia|rachel|sarah|lily|charlotte|matilda|ritu|priya|neha/.test(v)) {
        return 'female';
    }
    return 'male';
}
function resolveSpeechGender(options) {
    if (options.agentVoice) {
        return agentGenderFromVoice(options.agentVoice);
    }
    return (inferGenderFromName(options.agentName) ||
        agentGenderFromVoice('rachel'));
}
function ag(gender, male, female) {
    return gender === 'female' ? female : male;
}
function normalizeLanguage(language) {
    const allowed = [
        'en-IN',
        'hi-IN',
        'hinglish',
        'mr-IN',
        'gu-IN',
    ];
    if (allowed.includes(language))
        return language;
    return 'en-IN';
}
function normalizeTone(tone) {
    const allowed = [
        'professional',
        'friendly',
        'persuasive',
        'warm',
        'formal',
    ];
    if (allowed.includes(tone))
        return tone;
    return 'friendly';
}
function phoneSpeechGuide() {
    return `Write like a real Indian property caller on a live phone (not a chatbot script):
- Hinglish/hi-IN: Hindi in Devanagari, English nouns in Latin. Example: "अच्छा समझ गया। Budget लगभग कितना सोच रहे हो — 50 के आसपास या ऊपर?"
- NEVER Roman Hinglish like "Aapka budget kitna hai".
- Sound human: slight variety, natural pauses with commas. 1–2 short sentences.
- React to what they just said — don't use the same opener every turn.
- Avoid robotic stock lines: "Got it", "Noted", "Perfect", "How may I help you", "मुझे आपकी मदद करनी है".
- NEVER say "वाह" / "wah". Never say "bhai" / "भाई". No fake hype, no brochure language.
- One clear next question. Soft close toward site visit only when enough facts exist.`;
}
function sarvamSpeechGuide() {
    return phoneSpeechGuide();
}
function toneStyleGuide(tone) {
    const t = normalizeTone(tone);
    const guides = {
        friendly: 'Tone: happy, engaged, warm smile — curious about the customer, lightly upbeat, never loud or theatrical.',
        warm: 'Tone: warm, caring, soft smile, engaged listening. Unhurried but interested.',
        professional: 'Tone: polite, clear, friendly energy with soft "जी". Steady and engaged.',
        persuasive: 'Tone: confident closer with warm energy — engaged, one clear next step, zero hype.',
        formal: 'Tone: respectful आप, polished, still warmly engaged.',
    };
    return `${phoneSpeechGuide()}\n${guides[t]}`;
}
function compactToneGuide(tone) {
    const t = normalizeTone(tone);
    const flavour = t === 'formal'
        ? 'respectful आप, polished, warmly engaged'
        : t === 'warm'
            ? 'warm, caring, soft smile, engaged'
            : t === 'persuasive'
                ? 'confident closer with warm energy, one gentle next step'
                : t === 'professional'
                    ? 'polite broker with friendly energy'
                    : 'happy, engaged, warm smile — curious and lightly upbeat, never theatrical';
    return `Live phone speech. ${flavour}. Under 28 words, 1–2 short clear sentences. React to their exact words with interest. Never open with "Got it" / "Got it." / "Noted" / "Perfect". Vary acks or skip them. Match the customer's language. Prefer simple spoken Hindi in Devanagari with a few English nouns (budget, location, meeting, bedroom). No "वाह", no "bhai"/"भाई". One useful next question.`;
}
function softAck(tone, language, _gender) {
    if (language === 'en-IN') {
        if (tone === 'formal')
            return 'Understood';
        if (tone === 'warm')
            return 'Thank you';
        if (tone === 'persuasive')
            return 'Okay';
        return 'Okay';
    }
    if (language === 'mr-IN')
        return 'ठीक आहे';
    if (language === 'gu-IN')
        return 'બરાબર';
    if (tone === 'warm')
        return 'अच्छा';
    return 'ठीक है';
}
function formatLeadBudget(budget) {
    if (budget == null || Number.isNaN(Number(budget)) || Number(budget) <= 0) {
        return undefined;
    }
    const value = Number(budget);
    if (value >= 10_000_000) {
        const crore = value / 10_000_000;
        const label = Number.isInteger(crore) ? String(crore) : crore.toFixed(2).replace(/\.?0+$/, '');
        return `${label} crore`;
    }
    if (value >= 100_000) {
        const lakh = value / 100_000;
        const label = Number.isInteger(lakh) ? String(lakh) : lakh.toFixed(1).replace(/\.0$/, '');
        return `${label} lakh`;
    }
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
}
function parseBudgetToNumber(label) {
    if (!label)
        return undefined;
    const t = String(label).toLowerCase().replace(/,/g, '').trim();
    if (!t)
        return undefined;
    const rangeCrore = t.match(/(\d+(?:\.\d+)?)\s*(?:-|to|se|से)\s*(\d+(?:\.\d+)?)\s*(?:crore|cr\b|करोड़)/i);
    if (rangeCrore) {
        return Math.round(((Number(rangeCrore[1]) + Number(rangeCrore[2])) / 2) * 10_000_000);
    }
    const rangeLakh = t.match(/(\d+(?:\.\d+)?)\s*(?:-|to|se|से)\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|lakhs|लाख)/i);
    if (rangeLakh) {
        return Math.round(((Number(rangeLakh[1]) + Number(rangeLakh[2])) / 2) * 100_000);
    }
    const crore = t.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr\b|करोड़|કરોડ)/i);
    if (crore)
        return Math.round(Number(crore[1]) * 10_000_000);
    const lakh = t.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|lakhs|लाख|લાખ)/i);
    if (lakh)
        return Math.round(Number(lakh[1]) * 100_000);
    const underCrore = t.match(/(?:under|upto|up to|below|max|maximum|tak|तक)\s*(\d+(?:\.\d+)?)\s*(?:crore|cr\b|करोड़)/i);
    if (underCrore)
        return Math.round(Number(underCrore[1]) * 10_000_000);
    const underLakh = t.match(/(?:under|upto|up to|below|max|maximum|tak|तक)\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|लाख)/i);
    if (underLakh)
        return Math.round(Number(underLakh[1]) * 100_000);
    const rupees = t.match(/(?:₹|rs\.?|inr)?\s*(\d{5,12})/);
    if (rupees) {
        const n = Number(rupees[1]);
        if (n >= 100_000)
            return n;
    }
    return undefined;
}
function inferBudgetFromShortReply(raw, options) {
    if (!options?.agentAskedBudget)
        return undefined;
    const text = (raw || '').trim().toLowerCase();
    if (!text || /crore|cr\b|lakh|lac|लाख|करोड़|₹/.test(text))
        return undefined;
    const m = text.match(/(?:^|\s)(?:around|approx|about|mera|mere|nearly|लगभग)?\s*(\d+(?:\.\d+)?)(?:\s|$)/i);
    if (!m?.[1])
        return undefined;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0)
        return undefined;
    if (n > 0 && n < 20)
        return `${n} crore`;
    if (n >= 20 && n <= 999)
        return `${n} lakh`;
    if (n >= 100_000)
        return formatLeadBudget(n);
    return undefined;
}
function extractFactsFromText(raw) {
    const text = (raw || '').toLowerCase();
    const facts = {};
    const rangeCrore = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to|se|से)\s*(\d+(?:\.\d+)?)\s*(?:crore|cr\b|करोड़)/i);
    const rangeLakh = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to|se|से)\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|lakhs|लाख)/i);
    if (rangeCrore) {
        const mid = (Number(rangeCrore[1]) + Number(rangeCrore[2])) / 2;
        facts.budgetLabel = `${mid} crore`;
    }
    else if (rangeLakh) {
        const mid = (Number(rangeLakh[1]) + Number(rangeLakh[2])) / 2;
        facts.budgetLabel = `${mid} lakh`;
    }
    const crore = !facts.budgetLabel
        ? text.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr\b|करोड़|કરોડ|koti)/i)
        : null;
    const lakh = !facts.budgetLabel
        ? text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|lakhs|लाख|લાખ)/i)
        : null;
    const plainNumberBudget = text.match(/(?:budget|बजट|બજેટ)[^\d]{0,12}(\d{1,3}(?:,\d{2,3})+|\d{5,9})/i);
    const bareAmount = !facts.budgetLabel && !crore && !lakh
        ? text.match(/(?:around|approx|nearly|mera|mere|about|लगभग|આશરે)?\s*(\d+(?:\.\d+)?)\s*(?:crore|cr\b|lakh|lac|lakhs|करोड़|लाख)/i)
        : null;
    if (!facts.budgetLabel && crore?.[1]) {
        facts.budgetLabel = `${crore[1]} crore`;
    }
    else if (!facts.budgetLabel && lakh?.[1]) {
        facts.budgetLabel = `${lakh[1]} lakh`;
    }
    else if (!facts.budgetLabel && bareAmount?.[1] && /crore|cr\b|करोड़/i.test(bareAmount[0])) {
        facts.budgetLabel = `${bareAmount[1]} crore`;
    }
    else if (!facts.budgetLabel && bareAmount?.[1] && /lakh|lac|लाख/i.test(bareAmount[0])) {
        facts.budgetLabel = `${bareAmount[1]} lakh`;
    }
    else if (!facts.budgetLabel && plainNumberBudget?.[1]) {
        const n = Number(plainNumberBudget[1].replace(/,/g, ''));
        facts.budgetLabel = formatLeadBudget(n) || plainNumberBudget[1];
    }
    const under = !facts.budgetLabel
        ? text.match(/(?:under|upto|up to|below|max|maximum|tak|तक)\s*(\d+(?:\.\d+)?)\s*(crore|cr\b|lakh|lac|करोड़|लाख)/i)
        : null;
    if (under?.[1] && under[2]) {
        facts.budgetLabel = /crore|cr|करोड़/i.test(under[2])
            ? `${under[1]} crore`
            : `${under[1]} lakh`;
    }
    const bhk = text.match(/(?:^|[\s])([1-5])\s*(?:bhk|bedroom|बी\s*एच\s*के|बीएचके|બી\s*એચ\s*કે)/i);
    if (bhk?.[1])
        facts.bhk = `${bhk[1]}BHK`;
    if (!facts.bhk && /(?:बीएचके|बी\s*एच\s*के|bhk)/i.test(text)) {
        const n = text.match(/([1-5])/);
        if (n?.[1])
            facts.bhk = `${n[1]}BHK`;
    }
    const locationPatterns = [
        /(?:in|at|near|area|location|jagah|जगह|ठिकाण|સ્થળ|शहर|city)\s+([a-zA-Z\u0900-\u097F\u0A80-\u0AFF][a-zA-Z\u0900-\u097F\u0A80-\u0AFF\s-]{1,30})/i,
        /(?:prefer|preferred|pasand|पसंद|પસંદ)\s+(?:area|location|place)?\s*([a-zA-Z\u0900-\u097F\u0A80-\u0AFF][a-zA-Z\u0900-\u097F\u0A80-\u0AFF\s-]{1,30})/i,
    ];
    const isJunkLocation = (loc) => /assistant|real\s*estate|budget|bhk|visit|aria|agent|namaste|minute|shortlist|option|note|bol\s|calling|property|बीएच|bhk/i.test(loc);
    for (const re of locationPatterns) {
        const m = text.match(re);
        if (m?.[1]) {
            const loc = m[1]
                .replace(/\b(please|for|me|the|and|budget|bhk|apartment|flat)\b/gi, '')
                .trim()
                .replace(/\s+/g, ' ');
            if (loc.length >= 2 && loc.length <= 40 && !isJunkLocation(loc)) {
                facts.location = loc;
                break;
            }
        }
    }
    if (!facts.location && (0, place_names_1.mentionsSayaRajNagarExtension)(text)) {
        facts.location = place_names_1.SAYA_RAJ_NAGAR_EXTENSION;
    }
    const cities = text.match(/(?:^|[\s,./])(saya\s*raj\s*nagar(?:\s*extension)?|saya\s*rajnagar|mumbai|pune|thane|navi mumbai|andheri|borivali|powai|wakad|hinjewadi|baner|kothrud|hadapsar|ahmedabad|surat|vadodara|rajkot|nagpur|nashik|delhi|noida|gurgaon|gurugram|bangalore|bengaluru|hyderabad|chennai|kolkata|jaipur|indore|bhopal|lucknow|ghaziabad|साया\s*राज\s*नगर(?:\s*एक्सटेंशन)?|मुंबई|पुणे|दिल्ली|नोएडा|नॉएडा|गुड़गांव|गुरुग्राम|बैंगलोर|हैदराबाद|चेन्नई|कोलकाता|अहमदाबाद|सूरत|गाजियाबाद)(?=$|[\s,./!?])/i);
    if (!facts.location && cities?.[1]) {
        const raw = cities[1];
        const map = {
            नोएडा: 'Noida',
            नॉएडा: 'Noida',
            मुंबई: 'Mumbai',
            पुणे: 'Pune',
            दिल्ली: 'Delhi',
            गुड़गांव: 'Gurgaon',
            गुरुग्राम: 'Gurugram',
            गाजियाबाद: 'Ghaziabad',
        };
        facts.location =
            (0, place_names_1.normalizeKnownLocation)(raw) || map[raw] || raw;
    }
    if (facts.location) {
        facts.location =
            (0, place_names_1.normalizeKnownLocation)(facts.location) || facts.location;
    }
    if (/interested|yes interested|i am interested|site visit|visit|haan|हां|हाँ|होय|હા|sure|tell me more|go ahead/.test(text)) {
        facts.interested = true;
    }
    if (/site visit|visit|dekhna|देखना|भेट|મુલાકાત/.test(text)) {
        facts.askedVisit = true;
    }
    const timelineMatch = text.match(/(?:within|in|by|till|until|ke andar|mein|में)?\s*(\d+\s*(?:day|days|week|weeks|month|months|year|years)|this year|next year|jaldi|turant|जल्दी|तुरंत|3\s*month|6\s*month|1\s*year)/i);
    if (timelineMatch?.[1]) {
        facts.timeline = timelineMatch[1].trim();
    }
    else if (/(?:plan|planning|lena|खरीद|purchase|buy|book).{0,40}(?:month|year|jaldi|turant|जल्दी|इस साल)/i.test(text) ||
        /(?:kab|कब|timeline|by when).{0,20}(?:lena|buy|purchase|book)/i.test(text)) {
        const slice = text.slice(0, 80).trim();
        if (slice)
            facts.timeline = slice;
    }
    if (/ready\s*to\s*move|ready\s*to\s*move\s*in|ready\s*possession|रेडी\s*टू\s*मूव|तैयार\s*फ्लैट/i.test(text)) {
        facts.possession = 'ready';
    }
    else if (/under\s*construction|uc\b|निर्माणाधीन|अंडर\s*कंस्ट्रक्शन/i.test(text)) {
        facts.possession = 'under_construction';
    }
    const visitDay = text.match(/(?:next\s*)?(?:weekend|saturday|sunday|friday|monday|tuesday|wednesday|thursday|tomorrow|kal|कल|शनिवार|रविवार|शुक्रवार|अगले\s*वीकएंड)/i);
    if (visitDay?.[0])
        facts.visitDay = visitDay[0].trim();
    if (/(?:plan\s*kar|planning|dekh\s*rah|search\s*kar|looking|interested|खोज|देख\s*रह|प्लान\s*कर)/i.test(text) &&
        !/(?:nahi|नहीं|not\s*looking|not\s*search|kuch\s*nahi)/i.test(text)) {
        facts.interested = true;
    }
    return facts;
}
function mergeFacts(...parts) {
    const out = {};
    for (const part of parts) {
        if (!part)
            continue;
        if (part.budgetLabel)
            out.budgetLabel = part.budgetLabel;
        if (part.location)
            out.location = part.location;
        if (part.bhk)
            out.bhk = part.bhk;
        if (part.timeline)
            out.timeline = part.timeline;
        if (part.possession)
            out.possession = part.possession;
        if (part.visitDay)
            out.visitDay = part.visitDay;
        if (part.interested)
            out.interested = true;
        if (part.askedVisit)
            out.askedVisit = true;
    }
    return out;
}
function factsFromLead(lead) {
    const facts = {};
    if (lead?.trustProfileBudget) {
        const budgetLabel = formatLeadBudget(lead?.budget);
        if (budgetLabel)
            facts.budgetLabel = budgetLabel;
    }
    if (lead?.preferredLocation?.trim()) {
        facts.location = lead.preferredLocation.trim();
    }
    if (lead?.bhkPreference?.trim()) {
        facts.bhk = lead.bhkPreference.trim();
    }
    return facts;
}
function lastAgentLine(transcript) {
    if (!transcript)
        return '';
    const lines = transcript
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
        if (/^agent:/i.test(lines[i])) {
            return lines[i].replace(/^agent:\s*/i, '').trim();
        }
    }
    return '';
}
function isShortAffirmation(text) {
    const t = (text || '')
        .trim()
        .toLowerCase()
        .replace(/[.!?,।]+$/g, '')
        .trim();
    if (!t || t.split(/\s+/).length > 4)
        return false;
    return /^(haan|han|ha|haanji|ji|yes|yeah|yep|ok|okay|sure|bilkul|theek|theek hai|thik|thik hai|sahi|correct|done|hmm+|ach+a+|accha|bilkul ji|haan bilkul|yes please|ok ji|ठीक|बिल्कुल|हाँ|जी)$/i.test(t);
}
function isShortDecline(text) {
    const t = (text || '')
        .trim()
        .toLowerCase()
        .replace(/[.!?,।]+$/g, '')
        .trim();
    if (!t || t.split(/\s+/).length > 4)
        return false;
    return /^(nahi|nhi|na|no|nope|nah|नहीं|ना|no thanks|nahi ji|nhi ji|mat|abhi nahi|abhi nhi|nahi chahiye|nhi chahiye)$/i.test(t);
}
function lastAgentWasSoftClose(agentLine) {
    return /koi baat nahi|koi baat nhi|कोई बात नहीं|future me|future\s*में|phir (?:hum )?connect|धन्यवाद|ठीक है जी|shukriya|शुक्रिया|thank you|thanks ji|agar future|kabhi need|call (?:end|band)|no problem|connect कर लेना|connect kar lena/i.test(agentLine || '');
}
function lastAgentAskedTalkPermission(agentLine) {
    return /baat\s*k[ar]|do\s*minute|2\s*minute|minute\s*baat|talk\s*(?:for|a bit)|free\s*(?:hai|ho)|time\s*(?:hai|mile)|baat\s*kr/i.test(agentLine || '');
}
function lastAgentOfferedDetails(agentLine) {
    return /whatsapp|details\s*bhej|bhej\s*doo|bhej\s*dun|bhej\s*deti|bhej\s*deta|send\s*(?:you )?(?:the )?details|brochure|ditels/i.test(agentLine || '');
}
function lastAgentOfferedCallback(agentLine) {
    return /baad\s*me(?:in)?\s*call|call\s*kar\s*(?:leti|leta)|callback|phir\s*call|later\s*call/i.test(agentLine || '');
}
function resolveContextualShortReply(options) {
    const msg = options.userMessage || '';
    const last = lastAgentLine(options.priorTranscript);
    if (!last) {
        if (isShortDecline(msg)) {
            return { kind: 'not_interested', outcome: client_1.CallOutcome.NOT_INTERESTED };
        }
        return null;
    }
    if (isShortDecline(msg)) {
        if (lastAgentOfferedDetails(last)) {
            return { kind: 'not_interested', outcome: client_1.CallOutcome.NOT_INTERESTED };
        }
        if (lastAgentAskedTalkPermission(last) || lastAgentWasSoftClose(last)) {
            return { kind: 'not_interested', outcome: client_1.CallOutcome.NOT_INTERESTED };
        }
        if (msg.trim().length <= 8) {
            return { kind: 'not_interested', outcome: client_1.CallOutcome.NOT_INTERESTED };
        }
    }
    if (isShortAffirmation(msg)) {
        if (lastAgentWasSoftClose(last)) {
            return { kind: 'close_ack', outcome: client_1.CallOutcome.NOT_INTERESTED };
        }
        if (lastAgentOfferedCallback(last)) {
            return { kind: 'callback', outcome: client_1.CallOutcome.CALLBACK_REQUESTED };
        }
        if (lastAgentOfferedDetails(last)) {
            return { kind: 'confirm_details', outcome: client_1.CallOutcome.CONNECTED };
        }
        if (lastAgentAskedTalkPermission(last)) {
            return { kind: 'ask_planning', outcome: client_1.CallOutcome.CONNECTED };
        }
    }
    return null;
}
function normalizeForCompare(text) {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function isSameTalk(a, b) {
    const x = normalizeForCompare(a);
    const y = normalizeForCompare(b);
    if (!x || !y)
        return false;
    if (x === y)
        return true;
    if (x.length > 40 && y.length > 40 && (x.includes(y.slice(0, 60)) || y.includes(x.slice(0, 60)))) {
        return true;
    }
    const ax = new Set(x.split(' ').filter((w) => w.length > 3));
    const ay = new Set(y.split(' ').filter((w) => w.length > 3));
    if (ax.size < 4 || ay.size < 4)
        return false;
    let overlap = 0;
    for (const w of ax)
        if (ay.has(w))
            overlap += 1;
    return overlap / Math.min(ax.size, ay.size) >= 0.72;
}
function priorAgentAsked(prior) {
    const agentText = (prior || '')
        .split('\n')
        .filter((l) => /^agent:/i.test(l.trim()))
        .join(' ')
        .toLowerCase();
    return {
        askedBudget: /(budget|बजट|બજેટ).{0,40}\?|(kitna|kitni|what budget|share your budget|budget bata|budget rakh|बजट बता|बजट कितना)/i.test(agentText),
        askedLocation: /(location|area|इलाके|लोकेशन|ठिकाण|વિસ્તાર).{0,40}\?|(kaunsi location|which location|which area|किस लोकेशन|કયા વિસ્તાર)/i.test(agentText),
        askedBhk: /(2bhk|3bhk|bhk|bedroom|2 bhk|3 bhk).{0,40}\?|(bhk chahiye|prefer 2|prefer 3|देख रहे हैं या)/i.test(agentText),
        askedTimeline: /(timeline|kab tak|कब तक|kitne mahine|within|purchase|lena|खरीद).{0,40}\?|(by when|when (?:do|are) you|kab lena)/i.test(agentText),
        askedPossession: /ready\s*to\s*move|under\s*construction|रेडी|अंडर\s*कंस्ट्रक्शन|possession/i.test(agentText),
        askedPlanning: /plan\s*kar|plan\s*कर|query\s*receive|property\s*ke\s*regarding|कुछ\s*plan|देख\s*रहे\s*हैं|देख रहे हैं क्या|plan कर रहे/i.test(agentText),
        offeredVisit: /site visit|visit कब|visit kar|साइट|भेट|વિઝિટ|meeting|fix (?:a )?visit|visit arrange/i.test(agentText),
        askedDay: /weekday|weekend|which day|saturday|sunday|friday|evening|दिन|સાંજ|follow.?up/i.test(agentText),
    };
}
function leadLinesFromTranscript(transcript) {
    if (!transcript)
        return '';
    return transcript
        .split('\n')
        .filter((line) => /^lead:/i.test(line.trim()))
        .map((line) => line.replace(/^lead:\s*/i, ''))
        .join(' ');
}
function buildGreetingText(options) {
    const { buildVariedOpening } = require('./opener-bank');
    return buildVariedOpening({
        leadName: options.leadName,
        agentName: options.agentName,
        projectName: options.projectName,
        companyName: options.companyName,
        language: options.language,
        tone: options.tone,
        agentVoice: options.agentVoice,
    }).text;
}
function detectIntent(text) {
    const t = text.toLowerCase();
    const wantsCallback = /callback|call\s*back|call\s*later|baad\s*me(?:in)?|बाद\s*में|नंतर|પછી|busy|व्यस्त|abhi\s*(?:nahi|nhi)\s*(?:kar|kr|bol|baat|time)|(?:nahi|nhi)\s*(?:kar|kr)\s*sak|baad\s*me(?:in)?\s*call|call\s*(?:karna|krna|karo|kar\s*dena)|phir\s*call|later\s*call/i.test(t) && !/weekend|saturday|sunday|friday|site\s*visit/i.test(t);
    const isGreetingOnly = /^(?:hello|helo|halo|haan\s*ji|ha\s*ji|namaste|pranam|hello\s*ji|suno|boliye|haan|han|ha)[!?.\s]*$/i.test(t.trim()) || /^(?:नमस्ते|हेलो|हाँजी|प्रणाम|हाँ\s*जी|सुनिए|हाँ)[!?.\s]*$/.test(t.trim());
    const askingIdentityOnly = /kaun|कौन|kon|aap kaun|kaha se|kahan se|kisne kiya|kiski company|kis company|kisko lagaya|kahan lag gaya/i.test(t);
    return {
        notInterested: !wantsCallback &&
            /not interested|no thanks|don't call|do not call|wrong number|nahi chahiye|nahi chaiye|nhi chahiye|nhi chaiye|नहीं चाहिए|नाही पाहिजे|નથી જોઈએ|not looking|not searching|kuch nahi|kuch bhi nahi|khuch bhi|कुछ नहीं|कुछ भी नहीं|नहीं\s*देख|search नहीं|कोई property search नहीं|अभी नहीं देख|mere liye nahi|अपने लिए नहीं|rakho phone|rakh do phone|cut (?:the )?call|mat call|band karo|hang up|phone rakh|nhi chahiye khuch|nahi chahiye kuch/i.test(t),
        callback: wantsCallback,
        askingWhyCall: askingIdentityOnly ||
            /kis liye|kyun (?:call|phone)|kyu (?:call|phone)|why (?:did you |have you )?call|kya baat|kaun (?:ho|hai)|reason for (?:call|calling)|phone kyun|phone kis liye|क्यों\s*फोन|किस\s*लिए\s*फोन|किस लिये/i.test(t),
        askingIdentity: askingIdentityOnly,
        isGreeting: isGreetingOnly,
        askingPrice: /(?:what(?:'s| is)? (?:the )?price|kitna|कितना|किंमत|કિંમત|pricing|emi|payment plan|cost of)/.test(t) || /^(?:price|cost|emi)\b/.test(t.trim()),
        statingBhk: /\b[1-5]\s*(?:bhk|bedroom|बी\s*एच\s*के|बीएचके)/i.test(t) ||
            /(?:2|3|4|दो|तीन|चार)\s*(?:bhk|बीएचके|बी\s*एच)/i.test(t),
        statingPossession: /ready\s*to\s*move|under\s*construction|uc\b|रेडी|अंडर\s*कंस्ट्रक्शन|निर्माणाधीन/i.test(t),
        statingVisitDay: /(?:next\s*)?(?:weekend|saturday|sunday|friday|monday|tomorrow|kal|कल|शनिवार|रविवार|शुक्रवार)/i.test(t),
        positive: !isGreetingOnly &&
            /interested|yes|sure|ok|okay|haan|हां|हाँ|होय|હા|bilkul|बिल्कुल|theek|tell me|go ahead|site visit|visit|arrange|book|plan kar|planning|dekh rah|search kar|looking|खोज रहा|देख रहा|प्लान कर/i.test(t) &&
            !/nahi|nhi|नहीं|rakho phone|kis liye|kyu|kyun/i.test(t),
    };
}
function buildFollowUpReply(options) {
    const language = normalizeLanguage(options.language);
    const tone = normalizeTone(options.tone);
    const leadName = options.leadName || 'जी';
    const gender = options.speechGender ||
        resolveSpeechGender({
            agentVoice: options.agentVoice,
        });
    const current = options.transcript || '';
    const priorLeadText = leadLinesFromTranscript(options.priorTranscript);
    const spokenFacts = mergeFacts(extractFactsFromText(priorLeadText), extractFactsFromText(current));
    const facts = mergeFacts({
        budgetLabel: options.knownFacts?.budgetLabel,
        location: options.knownFacts?.location,
        interested: options.knownFacts?.interested,
    }, spokenFacts);
    const intent = detectIntent(current);
    const already = priorAgentAsked(options.priorTranscript);
    const lastReply = lastAgentLine(options.priorTranscript);
    const letaHi = ag(gender, 'लेता', 'लेती');
    const samajhHi = ag(gender, 'समझ गया', 'समझ गई');
    const contextual = resolveContextualShortReply({
        userMessage: current,
        priorTranscript: options.priorTranscript,
    });
    let kind = 'ask_planning';
    let outcome = client_1.CallOutcome.CONNECTED;
    const nextSampleStep = () => {
        if (!facts.bhk)
            return 'ask_bhk';
        if (!facts.possession)
            return 'ask_possession';
        if (!facts.visitDay && !already.offeredVisit)
            return 'offer_visit';
        if (facts.visitDay || already.offeredVisit)
            return 'confirm_followup';
        return 'offer_visit';
    };
    if (contextual) {
        kind = contextual.kind;
        outcome = contextual.outcome;
    }
    else if (intent.callback && !intent.statingVisitDay) {
        kind = 'callback';
        outcome = client_1.CallOutcome.CALLBACK_REQUESTED;
    }
    else if (intent.notInterested) {
        kind = 'not_interested';
        outcome = client_1.CallOutcome.NOT_INTERESTED;
    }
    else if (intent.isGreeting && options.isInbound) {
        kind = 'greeting_inbound';
        outcome = client_1.CallOutcome.CONNECTED;
    }
    else if (intent.askingWhyCall || intent.askingIdentity) {
        kind = 'explain_why_call';
        outcome = client_1.CallOutcome.CONNECTED;
    }
    else if (intent.statingVisitDay || spokenFacts.visitDay) {
        if (spokenFacts.visitDay)
            facts.visitDay = spokenFacts.visitDay;
        kind = 'confirm_followup';
        outcome = client_1.CallOutcome.SITE_VISIT_INTERESTED;
    }
    else if (intent.statingPossession || spokenFacts.possession) {
        if (spokenFacts.possession)
            facts.possession = spokenFacts.possession;
        facts.interested = true;
        kind = nextSampleStep();
        outcome = client_1.CallOutcome.QUALIFIED;
    }
    else if (intent.statingBhk || spokenFacts.bhk) {
        facts.interested = true;
        kind = nextSampleStep();
        if (kind === 'ask_bhk')
            kind = 'ask_possession';
        outcome = client_1.CallOutcome.QUALIFIED;
    }
    else if (intent.askingPrice) {
        kind = facts.bhk ? 'ask_possession' : 'price_soft';
    }
    else if (intent.positive || facts.interested) {
        if (isShortAffirmation(current) && lastAgentWasSoftClose(lastReply)) {
            kind = 'close_ack';
            outcome = client_1.CallOutcome.NOT_INTERESTED;
        }
        else {
            facts.interested = true;
            kind = nextSampleStep();
            outcome = client_1.CallOutcome.QUALIFIED;
        }
    }
    else {
        kind = already.askedPlanning || facts.interested ? nextSampleStep() : 'ask_planning';
    }
    const bhk = facts.bhk || '2 BHK या 3 BHK';
    const possessionLabel = facts.possession === 'ready'
        ? 'ready to move in'
        : facts.possession === 'under_construction'
            ? 'under construction'
            : 'ready / under construction';
    const visitDay = facts.visitDay || 'next weekend';
    const scripts = {
        not_interested: {
            'en-IN': `Koi baat nahi ji. Future me dekhna ho toh connect kar lena — shukriya.`,
            'hi-IN': `कोई बात नहीं जी। Future में देखना हो तो connect कर लेना — शुक्रिया।`,
            hinglish: `Koi baat nahi ji. Future me dekhna ho toh connect kar lena — shukriya.`,
            'mr-IN': `ठीक आहे, धन्यवाद.`,
            'gu-IN': `કોઈ વાત નહીં, આભાર.`,
        },
        close_ack: {
            'en-IN': `Theek hai ji, shukriya. Kabhi need ho toh connect kar lena.`,
            'hi-IN': `ठीक है जी, शुक्रिया। कभी need हो तो connect कर लेना।`,
            hinglish: `Theek hai ji, shukriya. Kabhi need ho toh connect kar lena.`,
            'mr-IN': `ठीक आहे, धन्यवाद.`,
            'gu-IN': `બરાબર, આભાર.`,
        },
        callback: {
            'en-IN': `Bilkul, abhi time nahi hai — baad mein call kar ${letaHi} हूँ।`,
            'hi-IN': `बिल्कुल, अभी समय नहीं है — बाद में call कर ${letaHi} हूँ।`,
            hinglish: `Bilkul, abhi time nahi — baad mein call kar ${letaHi} हूँ।`,
            'mr-IN': `ठीक, नंतर कॉल करतो.`,
            'gu-IN': `બરાબર, પછી કૉલ કરીશ.`,
        },
        confirm_details: {
            'en-IN': `Theek hai — details WhatsApp pe bhej ${letaHi} हूँ, ek baar check kar lena.`,
            'hi-IN': `ठीक है — details WhatsApp पे भेज ${letaHi} हूँ, एक बार check कर लेना।`,
            hinglish: `Theek hai — details WhatsApp pe bhej ${letaHi} हूँ, ek baar check kar lena.`,
            'mr-IN': `ठीक, details WhatsApp वर पाठवतो.`,
            'gu-IN': `બરાબર, details WhatsApp પર મોકલીશ.`,
        },
        explain_why_call: {
            'en-IN': options.isInbound
                ? `Ji Namaste! Main ${options.companyName || 'Saya Group'} helpline se ${options.agentName || 'Neha'} baat kar rahi hoon. Batayein main aapki kya sahayata kar sakti hoon?`
                : `${leadName} जी, आपकी property enquiry आई थी इसलिए कॉल किया — अभी देखना चालू है क्या?`,
            'hi-IN': options.isInbound
                ? `जी नमस्ते! मैं ${options.companyName || 'Saya Group'} helpline से ${options.agentName || 'नेहा'} बात कर रही हूँ। बताएं मैं आपकी क्या सहायता कर सकती हूँ?`
                : `${leadName} जी, आपकी property enquiry आई थी इसलिए कॉल किया — अभी घर/flat देखना चालू है क्या?`,
            hinglish: options.isInbound
                ? `Ji Namaste! Main ${options.companyName || 'Saya Group'} helpline se ${options.agentName || 'Neha'} baat kar rahi hoon. Batayein main aapki kya sahayata kar sakti hoon?`
                : `${leadName} जी, आपकी property enquiry आई थी इसलिए कॉल किया — अभी देखना चालू है क्या?`,
            'mr-IN': `${leadName}, property enquiry आली होती म्हणून कॉल — आता पाहत आहात का?`,
            'gu-IN': `${leadName}, property enquiry આવી હતી એટલે કૉલ — અત્યારે જોઈ રહ્યા છો?`,
        },
        greeting_inbound: {
            'en-IN': `Haan ji Namaste! ${options.companyName || 'Saya Group'} real estate helpline me aapka swagat hai. Main aapki kya sahayata kar sakti hoon?`,
            'hi-IN': `हाँ जी नमस्ते! ${options.companyName || 'Saya Group'} real estate helpline में आपका स्वागत है। मैं आपकी क्या सहायता कर सकती हूँ?`,
            hinglish: `Haan ji Namaste! ${options.companyName || 'Saya Group'} real estate helpline me aapka swagat hai. Main aapki kya sahayata kar sakti hoon?`,
            'mr-IN': `नमस्कार! ${options.companyName || 'Saya Group'} हेल्पलाईनमध्ये आपले स्वागत आहे. मी आपली काय मदत करू शकते?`,
            'gu-IN': `નમસ્તે! ${options.companyName || 'Saya Group'} હેલ્પલાઇનમાં આપનું સ્વાગત છે. હું આપની શું સહાયતા કરી શકું?`,
        },
        ask_planning: {
            'en-IN': `${leadName} जी, घर / flat देखना अभी चालू है क्या आपके side?`,
            'hi-IN': `${leadName} जी, घर या flat देखना अभी चालू है क्या आपके side?`,
            hinglish: `${leadName} जी, घर या flat देखना अभी चालू है क्या आपके side?`,
            'mr-IN': `${leadName}, घर पाहणे सुरू आहे का?`,
            'gu-IN': `${leadName}, ઘર જોવાનું ચાલુ છે?`,
        },
        ask_bhk: {
            'en-IN': `Accha — configuration कौनसी सोच रहे हो, दो bedroom या तीन?`,
            'hi-IN': `Accha — configuration कौनसी सोच रहे हो, दो bedroom या तीन?`,
            hinglish: `Accha — configuration कौनसी सोच रहे हो, दो bedroom या तीन?`,
            'mr-IN': `छान — दोन bedroom की तीन?`,
            'gu-IN': `સરસ — બે bedroom કે ત્રણ?`,
        },
        ask_possession: {
            'en-IN': `${samajhHi} — possession कब चाहिए, तुरंत move-in या thoda wait chalega construction?`,
            'hi-IN': `${samajhHi} — possession कब चाहिए, तुरंत move-in या थोड़ा wait चलेगा construction में?`,
            hinglish: `${samajhHi} — possession कब चाहिए, तुरंत move-in या थोड़ा wait चलेगा construction में?`,
            'mr-IN': `समजलो — लगेच move-in की थोडा वाट construction?`,
            'gu-IN': `સમજાયું — તરત move-in કે થોડું wait construction?`,
        },
        offer_visit: {
            'en-IN': `ठीक है, ${bhk} ${possessionLabel} match कर सकता हूँ। Site कब देख पाओगे?`,
            'hi-IN': `ठीक है, ${bhk} ${possessionLabel} side match कर ${letaHi === 'लेती' ? 'सकती' : 'सकता'} हूँ। Site कब देख पाओगे?`,
            hinglish: `ठीक है, ${bhk} ${possessionLabel} side match हो सकता है। Site कब देख पाओगे?`,
            'mr-IN': `ठीक, ${bhk} match होईल. Site कधी बघाल?`,
            'gu-IN': `બરાબર, ${bhk} match થઈ શકે. Site ક્યારે જોશો?`,
        },
        confirm_followup: {
            'en-IN': `${visitDay} note कर लिया — visit से पहले एक short reminder call कर ${letaHi} हूँ।`,
            'hi-IN': `${visitDay} note कर लिया — visit से पहले एक short reminder call कर ${letaHi} हूँ।`,
            hinglish: `${visitDay} note कर लिया — visit से पहले एक short reminder call कर ${letaHi} हूँ।`,
            'mr-IN': `${visitDay} नोंदले — भेटी आधी reminder कॉल.`,
            'gu-IN': `${visitDay} નોંધ્યું — visit પહેલાં reminder કૉલ.`,
        },
        price_soft: {
            'en-IN': `Rate unit pe depend karta hai — pehle configuration clear kar lein, 2 ya 3 bedroom?`,
            'hi-IN': `Rate unit पर depend करता है — पहले configuration clear कर लें, दो या तीन bedroom?`,
            hinglish: `Rate unit पर depend करता है — पहले configuration clear कर लें, दो या तीन bedroom?`,
            'mr-IN': `दर युनिटवर — आधी 2 की 3 bedroom?`,
            'gu-IN': `રેટ યુનિટ પર — પહેલાં 2 કે 3 bedroom?`,
        },
        default: {
            'en-IN': `बताइए, अभी property देखना आपके mind में है?`,
            'hi-IN': `बताइए, अभी property देखना आपके mind में है?`,
            hinglish: `बताइए, अभी property देखना आपके mind में है?`,
            'mr-IN': `सांगा, आता property पाहत आहात का?`,
            'gu-IN': `કહો, અત્યારે property જોઈ રહ્યા છો?`,
        },
    };
    let text = scripts[kind][language] || scripts[kind]['hi-IN'];
    if (lastReply &&
        isSameTalk(text, lastReply) &&
        kind !== 'not_interested' &&
        kind !== 'close_ack' &&
        kind !== 'explain_why_call') {
        const advance = nextSampleStep();
        const advanced = scripts[advance][language] || scripts[advance]['hi-IN'];
        if (!isSameTalk(advanced, lastReply) && advance !== kind) {
            text = advanced;
            kind = advance;
        }
        else {
            text =
                scripts.explain_why_call[language] || scripts.explain_why_call['hi-IN'];
            kind = 'explain_why_call';
        }
    }
    void tone;
    return {
        text,
        outcome,
        facts,
    };
}
function previewSampleText(agentName, language) {
    const lang = normalizeLanguage(language);
    const name = agentName || 'your AI agent';
    const samples = {
        'en-IN': `Hello, this is ${name} from our real estate team. How can I help you today?`,
        'hi-IN': `नमस्ते, मैं ${name} ${ag(agentGenderFromVoice('shubh'), 'बोल रहा', 'बोल रही')} हूँ, real estate team से। आज कैसे help करूँ?`,
        hinglish: `नमस्ते, मैं ${name} बोल रहा हूँ, real estate team से। आज कैसे help करूँ?`,
        'mr-IN': `नमस्कार, मी ${name} आहे, आमच्या रिअल एस्टेट टीममधून. मी तुम्हाला कशी मदत करू शकतो?`,
        'gu-IN': `નમસ્તે, હું ${name} છું, અમારી રિયલ એસ્ટેટ ટીમ તરફથી. હું તમારી કેવી રીતે મદદ કરી શકું?`,
    };
    return samples[lang];
}
//# sourceMappingURL=call-scripts.js.map