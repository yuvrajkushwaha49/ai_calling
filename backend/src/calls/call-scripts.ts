import { CallOutcome } from '@prisma/client';
import { isGenericAcknowledgement, parseCallbackSlot } from '../appointments/meeting-time';
import {
  mentionsSayaRajNagarExtension,
  normalizeKnownLocation,
  SAYA_RAJ_NAGAR_EXTENSION,
} from '../elevenlabs/place-names';

export type AppLanguage = 'en-IN' | 'hi-IN' | 'hinglish' | 'mr-IN' | 'gu-IN';
export type AppTone =
  | 'professional'
  | 'friendly'
  | 'persuasive'
  | 'warm'
  | 'formal';
export type SpeechGender = 'male' | 'female';

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
  // ElevenLabs
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
  'custom', // configured custom voice (female)
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

export function inferGenderFromName(name?: string | null): SpeechGender | null {
  const first = (name || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (!first) return null;
  if (FEMALE_FIRST_NAMES.has(first)) return 'female';
  if (MALE_FIRST_NAMES.has(first)) return 'male';
  return null;
}

export function agentGenderFromVoice(voice?: string | null): SpeechGender {
  const v = (voice || '').trim().toLowerCase();
  if (!v) return 'female';
  // Raw ElevenLabs voice ids / custom → female by default (our configured voice is female)
  if (v === 'custom' || /^[a-z0-9]{20,}$/i.test(v)) return 'female';
  if (FEMALE_VOICES.has(v)) return 'female';
  if (
    /talia|elara|alicia|rachel|sarah|lily|charlotte|matilda|ritu|priya|neha/.test(
      v,
    )
  ) {
    return 'female';
  }
  return 'male';
}

/** Agent first-person gender (गया/गई, raha/rahi) — must match voice, not lead. */
export function resolveSpeechGender(options: {
  leadName?: string | null;
  agentName?: string | null;
  agentVoice?: string | null;
}): SpeechGender {
  // Voice is source of truth: male voice → समझ गया, female voice → समझ गई
  if (options.agentVoice) {
    return agentGenderFromVoice(options.agentVoice);
  }
  return (
    inferGenderFromName(options.agentName) ||
    agentGenderFromVoice('rachel')
  );
}

/** Pick male/female wording — never return "gaya/gayi" slash forms for TTS. */
export function ag(gender: SpeechGender, male: string, female: string): string {
  return gender === 'female' ? female : male;
}

/**
 * Comprehensive set of words that can never be a person's name in Hindi/Hinglish/English.
 * Includes greetings, common conversational words, pronouns, questions, real-estate terms.
 */
export const FORBIDDEN_NAME_WORDS = new Set<string>([
  // English greetings & conversational words
  'hello', 'hi', 'hey', 'namaste', 'namaskar', 'yes', 'no', 'yeah', 'yep', 'nope',
  'haan', 'ha', 'nahi', 'nhi', 'na', 'ok', 'okay', 'theek', 'thik', 'sure',
  'sir', 'madam', 'maam', 'mam', 'ji', 'bhai', 'bhaiya', 'bro', 'friend', 'dost',
  // Devanagari greetings & conversational words
  'हैलो', 'हेलो', 'हॅलो', 'हालो', 'नमस्ते', 'नमस्कार', 'प्रणाम', 'हाय',
  'हाँ', 'हां', 'नहीं', 'नही', 'ना', 'ओके', 'ठीक', 'सही', 'बिल्कुल',
  'सर', 'मैडम', 'जी', 'भाई', 'भैया',
  // Question & pronouns
  'kya', 'kaun', 'kaha', 'kidhar', 'kab', 'kyun', 'kaise', 'kitna', 'kitne',
  'main', 'mai', 'hum', 'ham', 'aap', 'apne', 'apna', 'apni', 'tum', 'mera', 'meri', 'mere',
  'क्या', 'कौन', 'कहाँ', 'कहा', 'किधर', 'कब', 'क्यों', 'क्यूं', 'कैसे', 'कितना', 'कितने',
  'मैं', 'हम', 'आप', 'अपने', 'अपना', 'अपनी', 'तुम', 'मेरा', 'मेरी', 'मेरे',
  // Telephony & verbs
  'call', 'calling', 'caller', 'inbound', 'customer', 'agent', 'lead', 'guest', 'unknown',
  'bol', 'boliye', 'bolo', 'baat', 'batao', 'bataiye', 'suno', 'suniye', 'sun', 'aawaz', 'awaz',
  'कॉल', 'कॉलर', 'कस्टमर', 'एजेंट', 'लीड', 'गेस्ट', 'बोल', 'बोलिए', 'बोलो', 'बात', 'बताओ', 'बताइए', 'सुनो', 'सुनिए', 'आवाज़', 'आवाज',
  'raha', 'rahi', 'hoon', 'hu', 'hai', 'h', 'tha', 'thi', 'the',
  'रहा', 'रही', 'हूँ', 'हु', 'है', 'था', 'थी', 'थे',
  // Real estate & projects
  'bhk', 'flat', 'apartment', 'property', 'plot', 'house', 'ghar', 'villa', 'floor',
  'budget', 'price', 'rate', 'cr', 'crore', 'lakh', 'cost', 'payment', 'plan',
  'बीएचके', 'फ्लैट', 'प्रॉपर्टी', 'प्लॉट', 'घर', 'विला', 'फ्लोर', 'बजट', 'प्राइस', 'रेट', 'लाख', 'करोड़',
  'saya', 'rudra', 'ncr', 'monarch', 'palace', 'heights', 'group', 'noida', 'delhi', 'extension',
  'साया', 'रुद्रा', 'मोनार्क', 'पैलेस', 'हाइट्स', 'ग्रुप', 'नोएडा', 'एक्सटेंशन', 'ग्रेटर',
  'ready', 'possession', 'under', 'construction', 'visit', 'site', 'details', 'whatsapp', 'location',
  'रेडी', 'पजेशन', 'विजिट', 'डिटेल्स', 'व्हाट्सएप', 'लोकेशन',
  // Number words
  'one', 'two', 'three', 'four', 'five', 'ek', 'do', 'teen', 'chaar', 'paanch',
  'एक', 'दो', 'तीन', 'चार', 'पांच'
]);

/**
 * Checks if a lead name is a placeholder, system-generated, generic label, or greeting.
 * E.g., "Lead 3089", "Lead", "Lead-xxxx", "Inbound Caller", "Guest", "Unknown", "Caller", "Customer", "हैलो", "Hello".
 */
export function isPlaceholderLeadName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return true;
  const n = name.trim();
  if (n.length < 2) return true;
  const lower = n.toLowerCase();
  if (/^lead(\b|\s|\d|_|-|$)/i.test(n) || /^lead/i.test(n)) return true;
  if (/^(?:inbound|guest|unknown|caller|customer|user|कस्टमर|कॉलर)/i.test(n)) return true;
  if (/^(?:hello|namaste|namaskar|hi|hey|pranam|हैलो|हेलो|हॅलो|हालो|नमस्ते|नमस्कार|प्रणाम|हाय)/i.test(n)) return true;
  if (FORBIDDEN_NAME_WORDS.has(lower)) return true;
  return false;
}

/**
 * Generates varied, non-repetitive conversational filler phrases when data retrieval / LLM takes time.
 * Supports gender (male/female voice), language (Hinglish/Hindi/English/Marathi/Gujarati),
 * question-aware context (price, inventory, visit), and tracks already-used phrases to guarantee freshness.
 */
export function getThinkingFiller(options: {
  language?: string;
  speechGender?: SpeechGender;
  userMessage?: string;
  usedFillers?: string[];
}): string {
  const lang = (options.language || 'hinglish').toLowerCase();
  const isEn = lang.startsWith('en');
  const isMr = lang.includes('mr');
  const isGu = lang.includes('gu');
  const isDevanagari = lang.includes('hi') && !lang.includes('hinglish');
  const gender = options.speechGender || 'female';
  const isFemale = gender === 'female';
  const msg = (options.userMessage || '').toLowerCase();
  const used = options.usedFillers || [];

  const asksPrice = /price|cost|budget|rate|lakh|cr|payment|kitna|प्राइस|रेट|बजट|कीमत|लाख|करोड़/.test(msg);
  const asksInventory = /flat|bhk|apartment|villa|size|sqft|possession|floor|ready|फ्लैट|बीएचके|साइज|फ्लोर/.test(msg);

  let pool: string[] = [];

  if (isEn) {
    if (asksPrice) pool.push('Sure, let me check the pricing details for you...');
    if (asksInventory) pool.push('Right, let me check the available inventory for you...');
    pool.push(
      'Yes, let me check that for you...',
      'Sure, just a second while I pull up the details...',
      'Right, let me verify that for you...',
      "I'm checking that right now, one moment...",
      'Sure, let me confirm the latest details...',
    );
  } else if (isMr) {
    pool.push(
      'हो, मी डिटेल्स पाहतेय, एक सेकंद...',
      'होय, मी लगेच चेक करते...',
      'एकच मिनिट, मी माहिती काढते...',
      'हो, मी सिस्टीममध्ये पाहतेय...',
    );
  } else if (isGu) {
    pool.push(
      'હા, હું વિગતો જોઉં છું, એક સેકન્ડ...',
      'ચોક્કસ, હું હમણાં જ ચેક કરી લઉં છું...',
      'એક જ મિનિટ, હું જોઈને જણાવું છું...',
    );
  } else if (isDevanagari) {
    if (asksPrice) {
      pool.push(
        isFemale
          ? 'हाँ जी, मैं प्राइस डिटेल्स चेक कर लेती हूँ...'
          : 'हाँ जी, मैं प्राइस डिटेल्स चेक कर लेता हूँ...',
        isFemale
          ? 'जी बिल्कुल, मैं रेट्स और पेमेंट प्लान देख रही हूँ...'
          : 'जी बिल्कुल, मैं रेट्स और पेमेंट प्लान देख रहा हूँ...',
      );
    }
    if (asksInventory) {
      pool.push(
        isFemale
          ? 'जी बिल्कुल, मैं इन्वेंटरी डिटेल्स देख रही हूँ...'
          : 'जी बिल्कुल, मैं इन्वेंटरी डिटेल्स देख रहा हूँ...',
        isFemale
          ? 'हाँ जी, मैं उपलब्ध फ्लैट्स चेक कर लेती हूँ...'
          : 'हाँ जी, मैं उपलब्ध फ्लैट्स चेक कर लेता हूँ...',
      );
    }
    pool.push(
      isFemale
        ? 'जी एक सेकंड दीजिए, मैं देख रही हूँ...'
        : 'जी एक सेकंड दीजिए, मैं देख रहा हूँ...',
      'जी बिल्कुल, बस एक सेकंड...',
      isFemale
        ? 'ठीक है, मैं डिटेल्स देख लेती हूँ...'
        : 'ठीक है, मैं डिटेल्स देख लेता हूँ...',
      isFemale
        ? 'जी सुन रही हूँ, बस एक सेकंड...'
        : 'जी सुन रहा हूँ, बस एक सेकंड...',
      isFemale
        ? 'हाँ जी, मैं सिस्टम में चेक कर रही हूँ...'
        : 'हाँ जी, मैं सिस्टम में चेक कर रहा हूँ...',
      isFemale
        ? 'अच्छा जी, मैं अभी देख कर बताती हूँ...'
        : 'अच्छा जी, मैं अभी देख कर बताता हूँ...',
      isFemale
        ? 'हाँ जी, मैं कन्फर्म कर लेती हूँ...'
        : 'हाँ जी, मैं कन्फर्म कर लेता हूँ...',
    );
  } else {
    // Default: Hinglish
    if (asksPrice) {
      pool.push(
        isFemale
          ? 'Haan ji, main price details check kar leti hoon...'
          : 'Haan ji, main price details check kar leta hoon...',
        isFemale
          ? 'Ji bilkul, main rates aur payment plan dekh rahi hoon...'
          : 'Ji bilkul, main rates aur payment plan dekh raha hoon...',
      );
    }
    if (asksInventory) {
      pool.push(
        isFemale
          ? 'Ji bilkul, main inventory details open kar rahi hoon...'
          : 'Ji bilkul, main inventory details open kar raha hoon...',
        isFemale
          ? 'Haan ji, main available flats check kar leti hoon...'
          : 'Haan ji, main available flats check kar leta hoon...',
      );
    }
    pool.push(
      isFemale
        ? 'Ji ek second dijiye, main dekh rahi hoon...'
        : 'Ji ek second dijiye, main dekh raha hoon...',
      'Ji bilkul, bas ek second...',
      isFemale
        ? 'Theek hai, main details open kar leti hoon...'
        : 'Theek hai, main details open kar leta hoon...',
      isFemale
        ? 'Ji sun rahi hoon, bas ek second...'
        : 'Ji sun raha hoon, bas ek second...',
      isFemale
        ? 'Haan ji, main system me check kar rahi hoon...'
        : 'Haan ji, main system me check kar raha hoon...',
      isFemale
        ? 'Accha ji, main abhi verify kar leti hoon...'
        : 'Accha ji, main abhi verify kar leta hoon...',
      isFemale
        ? 'Haan ji, main dekh ke batati hoon...'
        : 'Haan ji, main dekh ke batata hoon...',
      isFemale
        ? 'Bilkul, main confirm kar leti hoon...'
        : 'Bilkul, main confirm kar leta hoon...',
    );
  }

  // Filter out phrases already used in this call session
  const fresh = pool.filter((p) => !used.includes(p));
  const candidateList = fresh.length > 0 ? fresh : pool;

  return candidateList[0] || pool[0];
}

type ReplyKind =
  | 'not_interested'
  | 'close_ack'
  | 'callback'
  | 'explain_why_call'
  | 'greeting_inbound'
  | 'liveness_ack'
  | 'thinking_filler'
  | 'ask_planning'
  | 'ask_bhk'
  | 'ask_possession'
  | 'offer_visit'
  | 'confirm_followup'
  | 'confirm_details'
  | 'clarify_ambiguous'
  | 'clarify_missing_feature'
  | 'clarify_ncr'
  | 'generic_ack'
  | 'recall_past_project'
  | 'continue_current_project'
  | 'query_price_current'
  | 'query_size_current'
  | 'query_location_current'
  | 'query_tell_more'
  | 'budget_uncertain_guide'
  | 'clarify_which_project'
  | 'show_alternatives'
  | 'price_soft'
  | 'reject_builder_pivot'
  | 'confirm_future_estate'
  | 'default';

export type ConversationFacts = {
  budgetLabel?: string;
  location?: string;
  bhk?: string;
  timeline?: string;
  /** ready | under_construction */
  possession?: string;
  visitDay?: string;
  interested?: boolean;
  askedVisit?: boolean;
  callerName?: string;
  purpose?: string;
  lastDiscussedProject?: string | null;
  lastDiscussedBuilder?: string | null;
  selectedProjectId?: string | null;
  selectedProjectLock?: boolean;
  lastDiscussedConfiguration?: string | null;
  lastDiscussedPrice?: string | null;
};

export function normalizeLanguage(language?: string): AppLanguage {
  const allowed: AppLanguage[] = [
    'en-IN',
    'hi-IN',
    'hinglish',
    'mr-IN',
    'gu-IN',
  ];
  if (allowed.includes(language as AppLanguage)) return language as AppLanguage;
  return 'en-IN';
}

export function normalizeTone(tone?: string): AppTone {
  const allowed: AppTone[] = [
    'professional',
    'friendly',
    'persuasive',
    'warm',
    'formal',
  ];
  if (allowed.includes(tone as AppTone)) return tone as AppTone;
  return 'friendly';
}

/**
 * Spoken-style writing for Indian phone calls (ElevenLabs TTS).
 * Hindi in Devanagari, English nouns in Latin, short phone-friendly lines.
 */
export function phoneSpeechGuide(): string {
  return `Write like a real Indian property caller on a live phone (not a chatbot script):
- Hinglish/hi-IN: Hindi in Devanagari, English nouns in Latin. Example: "अच्छा समझ गया। Budget लगभग कितना सोच रहे हो — 50 के आसपास या ऊपर?"
- NEVER Roman Hinglish like "Aapka budget kitna hai".
- Sound human: slight variety, natural pauses with commas. 1–2 short sentences.
- React to what they just said — don't use the same opener every turn.
- Avoid robotic stock lines: "Got it", "Noted", "Perfect", "How may I help you", "मुझे आपकी मदद करनी है".
- NEVER say "वाह" / "wah". Never say "bhai" / "भाई". No fake hype, no brochure language.
- One clear next question. Soft close toward site visit only when enough facts exist.`;
}

/** @deprecated use phoneSpeechGuide */
export function sarvamSpeechGuide(): string {
  return phoneSpeechGuide();
}

/** Style guide injected into LLM / used to soften script openers. */
export function toneStyleGuide(tone?: string): string {
  const t = normalizeTone(tone);
  const guides: Record<AppTone, string> = {
    friendly:
      'Tone: happy, engaged, warm smile — curious about the customer, lightly upbeat, never loud or theatrical.',
    warm:
      'Tone: warm, caring, soft smile, engaged listening. Unhurried but interested.',
    professional:
      'Tone: polite, clear, friendly energy with soft "जी". Steady and engaged.',
    persuasive:
      'Tone: confident closer with warm energy — engaged, one clear next step, zero hype.',
    formal:
      'Tone: respectful आप, polished, still warmly engaged.',
  };
  return `${phoneSpeechGuide()}\n${guides[t]}`;
}

/** Tiny guide for live call turns — keeps Gemini prompt short (faster TTFT). */
export function compactToneGuide(tone?: string): string {
  const t = normalizeTone(tone);
  const flavour =
    t === 'formal'
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

function softAck(tone: AppTone, language: AppLanguage, _gender: SpeechGender): string {
  if (language === 'en-IN') {
    if (tone === 'formal') return 'Understood';
    if (tone === 'warm') return 'Thank you';
    if (tone === 'persuasive') return 'Okay';
    return 'Okay';
  }
  if (language === 'mr-IN') return 'ठीक आहे';
  if (language === 'gu-IN') return 'બરાબર';
  // hi-IN + hinglish — short soft ack (longer acks sound odd on TTS)
  if (tone === 'warm') return 'अच्छा';
  return 'ठीक है';
}

function formatLeadBudget(budget?: number | null): string | undefined {
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

/** Convert spoken/CRM budget labels into rupees. */
export function parseBudgetToNumber(label?: string | null): number | undefined {
  if (!label) return undefined;
  const t = String(label).toLowerCase().replace(/,/g, '').trim();
  if (!t) return undefined;

  const rangeCrore = t.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to|se|से)\s*(\d+(?:\.\d+)?)\s*(?:crore|cr\b|करोड़)/i,
  );
  if (rangeCrore) {
    return Math.round(((Number(rangeCrore[1]) + Number(rangeCrore[2])) / 2) * 10_000_000);
  }
  const rangeLakh = t.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to|se|से)\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|lakhs|लाख)/i,
  );
  if (rangeLakh) {
    return Math.round(((Number(rangeLakh[1]) + Number(rangeLakh[2])) / 2) * 100_000);
  }

  const crore = t.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr\b|करोड़|કરોડ)/i);
  if (crore) return Math.round(Number(crore[1]) * 10_000_000);

  const lakh = t.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|lakhs|लाख|લાખ)/i);
  if (lakh) return Math.round(Number(lakh[1]) * 100_000);

  const underCrore = t.match(
    /(?:under|upto|up to|below|max|maximum|tak|तक)\s*(\d+(?:\.\d+)?)\s*(?:crore|cr\b|करोड़)/i,
  );
  if (underCrore) return Math.round(Number(underCrore[1]) * 10_000_000);

  const underLakh = t.match(
    /(?:under|upto|up to|below|max|maximum|tak|तक)\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|लाख)/i,
  );
  if (underLakh) return Math.round(Number(underLakh[1]) * 100_000);

  const rupees = t.match(/(?:₹|rs\.?|inr)?\s*(\d{5,12})/);
  if (rupees) {
    const n = Number(rupees[1]);
    if (n >= 100_000) return n;
  }

  return undefined;
}

/**
 * When agent just asked budget and lead replies with a bare number ("80", "1.5"),
 * map to lakh/crore the way Indian real-estate buyers usually mean it.
 */
export function inferBudgetFromShortReply(
  raw: string,
  options?: { agentAskedBudget?: boolean },
): string | undefined {
  if (!options?.agentAskedBudget) return undefined;
  const text = (raw || '').trim().toLowerCase();
  if (!text || /crore|cr\b|lakh|lac|लाख|करोड़|₹/.test(text)) return undefined;

  const m = text.match(
    /(?:^|\s)(?:around|approx|about|mera|mere|nearly|लगभग)?\s*(\d+(?:\.\d+)?)(?:\s|$)/i,
  );
  if (!m?.[1]) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // Typical spoken shortcuts: "1.5" → crore, "80" → lakh
  if (n > 0 && n < 20) return `${n} crore`;
  if (n >= 20 && n <= 999) return `${n} lakh`;
  if (n >= 100_000) return formatLeadBudget(n);
  return undefined;
}

/** Pull budget / location / BHK from free text (current + prior turns). */
export function extractFactsFromText(raw: string): ConversationFacts {
  const text = (raw || '').toLowerCase();
  const facts: ConversationFacts = {};

  const rangeCrore = text.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to|se|से)\s*(\d+(?:\.\d+)?)\s*(?:crore|cr\b|करोड़)/i,
  );
  const rangeLakh = text.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to|se|से)\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|lakhs|लाख)/i,
  );
  if (rangeCrore) {
    const mid = (Number(rangeCrore[1]) + Number(rangeCrore[2])) / 2;
    facts.budgetLabel = `${mid} crore`;
  } else if (rangeLakh) {
    const mid = (Number(rangeLakh[1]) + Number(rangeLakh[2])) / 2;
    facts.budgetLabel = `${mid} lakh`;
  }

  const crore = !facts.budgetLabel
    ? text.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr\b|करोड़|કરોડ|koti)/i)
    : null;
  const lakh = !facts.budgetLabel
    ? text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|lakhs|लाख|લાખ)/i)
    : null;
  const plainNumberBudget = text.match(
    /(?:budget|बजट|બજેટ)[^\d]{0,12}(\d{1,3}(?:,\d{2,3})+|\d{5,9})/i,
  );
  // Also accept bare amounts like "mera 80 lakh hai" / "around 1 crore"
  const bareAmount =
    !facts.budgetLabel && !crore && !lakh
      ? text.match(
          /(?:around|approx|nearly|mera|mere|about|लगभग|આશરે)?\s*(\d+(?:\.\d+)?)\s*(?:crore|cr\b|lakh|lac|lakhs|करोड़|लाख)/i,
        )
      : null;

  if (!facts.budgetLabel && crore?.[1]) {
    facts.budgetLabel = `${crore[1]} crore`;
  } else if (!facts.budgetLabel && lakh?.[1]) {
    facts.budgetLabel = `${lakh[1]} lakh`;
  } else if (!facts.budgetLabel && bareAmount?.[1] && /crore|cr\b|करोड़/i.test(bareAmount[0])) {
    facts.budgetLabel = `${bareAmount[1]} crore`;
  } else if (!facts.budgetLabel && bareAmount?.[1] && /lakh|lac|लाख/i.test(bareAmount[0])) {
    facts.budgetLabel = `${bareAmount[1]} lakh`;
  } else if (!facts.budgetLabel && plainNumberBudget?.[1]) {
    const n = Number(plainNumberBudget[1].replace(/,/g, ''));
    facts.budgetLabel = formatLeadBudget(n) || plainNumberBudget[1];
  }

  const under = !facts.budgetLabel
    ? text.match(
        /(?:under|upto|up to|below|max|maximum|tak|तक)\s*(\d+(?:\.\d+)?)\s*(crore|cr\b|lakh|lac|करोड़|लाख)/i,
      )
    : null;
  if (under?.[1] && under[2]) {
    facts.budgetLabel = /crore|cr|करोड़/i.test(under[2])
      ? `${under[1]} crore`
      : `${under[1]} lakh`;
  }

  // Normalize spoken numbers and colloquial phrases before BHK matching
  const normalizedForBhk = text
    .replace(/\b(one|ek|एक)\b/gi, '1')
    .replace(/\b(two|do|दो)\b/gi, '2')
    .replace(/\b(three|teen|तीन)\b/gi, '3')
    .replace(/\b(four|char|चार)\b/gi, '4')
    .replace(/\b(five|paanch|पांच)\b/gi, '5')
    .replace(/\bbh\s*के\b/gi, 'bhk')
    .replace(/\bb\s*h\s*k\b/gi, 'bhk');

  const bhk = normalizedForBhk.match(
    /(?:^|[\s])([1-5])\s*(?:bhk|bedroom|bed|बी\s*एच\s*के|बीएचके|બી\s*એચ\s*કે)/i,
  );
  if (bhk?.[1]) facts.bhk = `${bhk[1]}BHK`;
  if (!facts.bhk && /(?:बीएचके|बी\s*एच\s*के|bhk)/i.test(normalizedForBhk)) {
    const n = normalizedForBhk.match(/([1-5])/);
    if (n?.[1]) facts.bhk = `${n[1]}BHK`;
  }

  // Caller name extraction: "mera naam rahul hai" / "main rahul bol raha hoon" / "this is rahul"
  const nameMatch =
    text.match(/(?:mera\s*(?:shubh\s*)?naam|मेरा\s*(?:शुभ\s*)?नाम|my\s*name\s*is|this\s*is|myself)\s*(?:hai|h|:)?\s*([a-zA-Z\u0900-\u097F]{2,25}(?:\s+[a-zA-Z\u0900-\u097F]{2,25})?)/i) ||
    text.match(/([a-zA-Z\u0900-\u097F]{2,25}(?:\s+[a-zA-Z\u0900-\u097F]{2,25})?)\s+(?:bol\s*(?:raha|rahi)\s*hoon|bol\s*(?:raha|rahi)\s*hu|baat\s*kar\s*(?:raha|rahi)\s*hoon|speaking|here|बोल\s*रहा\s*हूँ|बोल\s*रही\s*हूँ)/i) ||
    text.match(/(?:main|mai|मैं)\s+([a-zA-Z\u0900-\u097F]{2,25}(?:\s+[a-zA-Z\u0900-\u097F]{2,25})?)\s+(?:bol\s*(?:raha|rahi)|baat\s*kar\s*(?:raha|rahi)|hoon|हु|हूँ)/i) ||
    text.match(/(?:naam|name)\s+([a-zA-Z\u0900-\u097F]{2,25})\s+(?:hai|h)/i);
  if (nameMatch?.[1]) {
    const rawName = nameMatch[1].trim();
    const words = rawName.split(/\s+/).filter(Boolean);
    const hasForbidden = words.some((w) => FORBIDDEN_NAME_WORDS.has(w.toLowerCase()));
    if (!hasForbidden && !isPlaceholderLeadName(rawName)) {
      facts.callerName = words.map((w) => /^[\u0900-\u097F]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // End-use vs Investment purpose
  if (/rehne\s+ke\s+liye|end\s*use|self\s*use|family\s+ke\s+liye|khud\s+ke\s+liye/i.test(text)) {
    facts.purpose = 'end-use';
  } else if (/invest|investment|rent|rental|kiraya|return/i.test(text)) {
    facts.purpose = 'investment';
  }

  const locationPatterns = [
    /(?:in|at|near|area|location|jagah|जगह|ठिकाण|સ્થળ|शहर|city)\s+([a-zA-Z\u0900-\u097F\u0A80-\u0AFF][a-zA-Z\u0900-\u097F\u0A80-\u0AFF\s-]{1,30})/i,
    /(?:prefer|preferred|pasand|पसंद|પસંદ)\s+(?:area|location|place)?\s*([a-zA-Z\u0900-\u097F\u0A80-\u0AFF][a-zA-Z\u0900-\u097F\u0A80-\u0AFF\s-]{1,30})/i,
  ];
  const isJunkLocation = (loc: string) =>
    /assistant|real\s*estate|budget|bhk|visit|aria|agent|namaste|minute|shortlist|option|note|bol\s|calling|property|बीएच|bhk/i.test(
      loc,
    );

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

  // Common city / area names (English + Hindi) — avoid \b (breaks on Devanagari)
  if (!facts.location && mentionsSayaRajNagarExtension(text)) {
    facts.location = SAYA_RAJ_NAGAR_EXTENSION;
  }
  const cities =
    text.match(
      /(?:^|[\s,./])(saya\s*raj\s*nagar(?:\s*extension)?|saya\s*rajnagar|mumbai|pune|thane|navi mumbai|andheri|borivali|powai|wakad|hinjewadi|baner|kothrud|hadapsar|ahmedabad|surat|vadodara|rajkot|nagpur|nashik|noida extension|greater noida west|greater noida|sector 1|sec-1|delhi|noida|gurgaon|gurugram|bangalore|bengaluru|hyderabad|chennai|kolkata|jaipur|indore|bhopal|lucknow|ghaziabad|साया\s*राज\s*नगर(?:\s*एक्सटेंशन)?|मुंबई|पुणे|नोएडा एक्सटेंशन|ग्रेटर नोएडा|सेक्टर 1|दिल्ली|नोएडा|नॉएडा|गुड़गांव|गुरुग्राम|बैंगलोर|हैदराबाद|चेन्नई|कोलकाता|अहमदाबाद|सूरत|गाजियाबाद)(?=$|[\s,./!?])/i,
    );
  if (!facts.location && cities?.[1]) {
    const raw = cities[1];
    const map: Record<string, string> = {
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
      normalizeKnownLocation(raw) || map[raw] || raw;
  }
  if (facts.location) {
    facts.location =
      normalizeKnownLocation(facts.location) || facts.location;
  }

  if (
    /interested|yes interested|i am interested|site visit|visit|haan|हां|हाँ|होय|હા|sure|tell me more|go ahead/.test(
      text,
    )
  ) {
    facts.interested = true;
  }
  if (/site visit|visit|dekhna|देखना|भेट|મુલાકાત/.test(text)) {
    facts.askedVisit = true;
  }

  // Purchase timeline
  const timelineMatch = text.match(
    /(?:within|in|by|till|until|ke andar|mein|में)?\s*(\d+\s*(?:day|days|week|weeks|month|months|year|years)|this year|next year|jaldi|turant|जल्दी|तुरंत|3\s*month|6\s*month|1\s*year)/i,
  );
  if (timelineMatch?.[1]) {
    facts.timeline = timelineMatch[1].trim();
  } else if (
    /(?:plan|planning|lena|खरीद|purchase|buy|book).{0,40}(?:month|year|jaldi|turant|जल्दी|इस साल)/i.test(
      text,
    ) ||
    /(?:kab|कब|timeline|by when).{0,20}(?:lena|buy|purchase|book)/i.test(text)
  ) {
    const slice = text.slice(0, 80).trim();
    if (slice) facts.timeline = slice;
  }

  if (
    /ready\s*to\s*move|ready\s*to\s*move\s*in|ready\s*possession|रेडी\s*टू\s*मूव|तैयार\s*फ्लैट/i.test(
      text,
    )
  ) {
    facts.possession = 'ready';
  } else if (
    /under\s*construction|uc\b|निर्माणाधीन|अंडर\s*कंस्ट्रक्शन/i.test(text)
  ) {
    facts.possession = 'under_construction';
  }

  const visitDay = text.match(
    /(?:next\s*)?(?:weekend|saturday|sunday|friday|monday|tuesday|wednesday|thursday|tomorrow|kal|कल|शनिवार|रविवार|शुक्रवार|अगले\s*वीकएंड)/i,
  );
  if (visitDay?.[0]) facts.visitDay = visitDay[0].trim();

  if (
    /(?:plan\s*kar|planning|dekh\s*rah|search\s*kar|looking|interested|खोज|देख\s*रह|प्लान\s*कर)/i.test(
      text,
    ) &&
    !/(?:nahi|नहीं|not\s*looking|not\s*search|kuch\s*nahi)/i.test(text)
  ) {
    facts.interested = true;
  }

  return facts;
}

export function mergeFacts(
  ...parts: Array<ConversationFacts | undefined>
): ConversationFacts {
  const out: ConversationFacts = {};
  for (const part of parts) {
    if (!part) continue;
    if (part.budgetLabel) out.budgetLabel = part.budgetLabel;
    if (part.location) out.location = part.location;
    if (part.bhk) out.bhk = part.bhk;
    if (part.timeline) out.timeline = part.timeline;
    if (part.possession) out.possession = part.possession;
    if (part.visitDay) out.visitDay = part.visitDay;
    if (part.interested) out.interested = true;
    if (part.askedVisit) out.askedVisit = true;
    if (part.callerName) out.callerName = part.callerName;
    if (part.purpose) out.purpose = part.purpose;
  }
  return out;
}

export function factsFromLead(lead?: {
  budget?: number | null;
  preferredLocation?: string | null;
  bhkPreference?: string | null;
  propertyType?: string | null;
  project?: { location?: string | null; name?: string | null } | null;
  /** When false/undefined, ignore profile budget — pre-leads usually have none */
  trustProfileBudget?: boolean;
}): ConversationFacts {
  const facts: ConversationFacts = {};
  // Pre-leads: do NOT assume CRM budget — agent must ask on the call
  if (lead?.trustProfileBudget) {
    const budgetLabel = formatLeadBudget(lead?.budget);
    if (budgetLabel) facts.budgetLabel = budgetLabel;
  }
  if (lead?.preferredLocation?.trim()) {
    facts.location = lead.preferredLocation.trim();
  }
  if (lead?.bhkPreference?.trim()) {
    facts.bhk = lead.bhkPreference.trim();
  }
  return facts;
}

/** Last agent line from call transcript — used to avoid repeating the same reply. */
export function lastAgentLine(transcript?: string | null): string {
  if (!transcript) return '';
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

/** Short yes / ok / bilkul — meaning depends on what agent just said. */
export function isShortAffirmation(text: string): boolean {
  const t = (text || '')
    .trim()
    .toLowerCase()
    .replace(/[.!?,।]+$/g, '')
    .trim();
  if (!t || t.split(/\s+/).length > 4) return false;
  return /^(haan|han|ha|haanji|ji|yes|yeah|yep|ok|okay|sure|bilkul|theek|theek hai|thik|thik hai|sahi|correct|done|hmm+|ach+a+|accha|bilkul ji|haan bilkul|yes please|ok ji|ठीक|बिल्कुल|हाँ|जी)$/i.test(
    t,
  );
}

/** Short no / nhi — often declines talk permission or a soft offer. */
export function isShortDecline(text: string): boolean {
  const t = (text || '')
    .trim()
    .toLowerCase()
    .replace(/[.!?,।]+$/g, '')
    .trim();
  if (!t || t.split(/\s+/).length > 4) return false;
  return /^(nahi|nhi|na|no|nope|nah|नहीं|ना|no thanks|nahi ji|nhi ji|mat|abhi nahi|abhi nhi|nahi chahiye|nhi chahiye)$/i.test(
    t,
  );
}

export function lastAgentWasSoftClose(agentLine: string): boolean {
  return /koi baat nahi|koi baat nhi|कोई बात नहीं|future me|future\s*में|phir (?:hum )?connect|धन्यवाद|ठीक है जी|shukriya|शुक्रिया|thank you|thanks ji|agar future|kabhi need|call (?:end|band)|no problem|connect कर लेना|connect kar lena/i.test(
    agentLine || '',
  );
}

export function lastAgentAskedTalkPermission(agentLine: string): boolean {
  return /baat\s*k[ar]|do\s*minute|2\s*minute|minute\s*baat|talk\s*(?:for|a bit)|free\s*(?:hai|ho)|time\s*(?:hai|mile)|baat\s*kr/i.test(
    agentLine || '',
  );
}

export function lastAgentOfferedDetails(agentLine: string): boolean {
  return /whatsapp|details\s*bhej|bhej\s*doo|bhej\s*dun|bhej\s*deti|bhej\s*deta|send\s*(?:you )?(?:the )?details|brochure|ditels/i.test(
    agentLine || '',
  );
}

export function lastAgentOfferedCallback(agentLine: string): boolean {
  return /baad\s*me(?:in)?\s*call|call\s*kar\s*(?:leti|leta)|callback|phir\s*call|later\s*call/i.test(
    agentLine || '',
  );
}

/**
 * Detect incomplete, trailing or ambiguous queries such as "क्या अभी", "अभी?", "kya abhi", fragments.
 */
export function isIncompleteOrAmbiguousQuery(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  // Specific patterns like "क्या अभी", "क्या अभी?", "kya abhi", "abhi kya", "abhi?", "अभी?"
  if (/^(?:क्या\s*अभी|kya\s*abhi|abhi\s*kya|अभी\s*क्या|abhi|अभी)[!?.\s]*$/i.test(t)) {
    return true;
  }
  // Short fragment ending in question mark with no full verb or subject
  if (/^(?:मतलब|matlab|means|kyun|kyu|क्यो|क्यों|kaise|कैसे|kab|कब|aur|और|par|पर|lekin|लेकिन)[!?.\s]*$/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Resolve short yes/no using the previous agent line.
 * Returns null when context is not enough — caller continues normal flow.
 */
export function resolveContextualShortReply(options: {
  userMessage: string;
  priorTranscript?: string | null;
}): { kind: ReplyKind; outcome: CallOutcome } | null {
  const msg = options.userMessage || '';
  if (isIncompleteOrAmbiguousQuery(msg)) {
    return { kind: 'clarify_ambiguous', outcome: CallOutcome.CONNECTED };
  }
  const last = lastAgentLine(options.priorTranscript);
  if (!last) {
    if (isShortDecline(msg)) {
      return { kind: 'not_interested', outcome: CallOutcome.NOT_INTERESTED };
    }
    return null;
  }

  if (isShortDecline(msg)) {
    if (lastAgentOfferedDetails(last)) {
      return { kind: 'not_interested', outcome: CallOutcome.NOT_INTERESTED };
    }
    if (lastAgentAskedTalkPermission(last) || lastAgentWasSoftClose(last)) {
      return { kind: 'not_interested', outcome: CallOutcome.NOT_INTERESTED };
    }
    // Bare nhi mid-call after a pitch question → soft close, don't invent interest
    if (msg.trim().length <= 8) {
      return { kind: 'not_interested', outcome: CallOutcome.NOT_INTERESTED };
    }
  }

  if (isShortAffirmation(msg)) {
    // "BILKUL" after soft-close = agree to end / future connect — NOT WhatsApp pitch
    if (lastAgentWasSoftClose(last)) {
      return { kind: 'close_ack', outcome: CallOutcome.NOT_INTERESTED };
    }
    if (lastAgentOfferedCallback(last)) {
      return { kind: 'callback', outcome: CallOutcome.CALLBACK_REQUESTED };
    }
    if (lastAgentOfferedDetails(last)) {
      return { kind: 'confirm_details', outcome: CallOutcome.CONNECTED };
    }
    if (lastAgentAskedTalkPermission(last)) {
      return { kind: 'ask_planning', outcome: CallOutcome.CONNECTED };
    }
  }

  return null;
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True if two agent replies are basically the same talk. */
export function isSameTalk(a: string, b: string): boolean {
  const x = normalizeForCompare(a);
  const y = normalizeForCompare(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length > 40 && y.length > 40 && (x.includes(y.slice(0, 60)) || y.includes(x.slice(0, 60)))) {
    return true;
  }
  // Token overlap
  const ax = new Set(x.split(' ').filter((w) => w.length > 3));
  const ay = new Set(y.split(' ').filter((w) => w.length > 3));
  if (ax.size < 4 || ay.size < 4) return false;
  let overlap = 0;
  for (const w of ax) if (ay.has(w)) overlap += 1;
  return overlap / Math.min(ax.size, ay.size) >= 0.72;
}

export function priorAgentAsked(prior?: string | null): {
  askedBudget: boolean;
  askedLocation: boolean;
  askedBhk: boolean;
  askedTimeline: boolean;
  askedPossession: boolean;
  askedPlanning: boolean;
  offeredVisit: boolean;
  askedDay: boolean;
} {
  const agentText = (prior || '')
    .split('\n')
    .filter((l) => /^agent:/i.test(l.trim()))
    .join(' ')
    .toLowerCase();
  return {
    askedBudget:
      /(budget|बजट|બજેટ).{0,40}\?|(kitna|kitni|what budget|share your budget|budget bata|budget rakh|बजट बता|बजट कितना)/i.test(
        agentText,
      ),
    askedLocation:
      /(location|area|इलाके|लोकेशन|ठिकाण|વિસ્તાર).{0,40}\?|(kaunsi location|which location|which area|किस लोकेशन|કયા વિસ્તાર)/i.test(
        agentText,
      ),
    askedBhk: /(2bhk|3bhk|bhk|bedroom|2 bhk|3 bhk).{0,40}\?|(bhk chahiye|prefer 2|prefer 3|देख रहे हैं या)/i.test(
      agentText,
    ),
    askedTimeline:
      /(timeline|kab tak|कब तक|kitne mahine|within|purchase|lena|खरीद).{0,40}\?|(by when|when (?:do|are) you|kab lena)/i.test(
        agentText,
      ),
    askedPossession:
      /ready\s*to\s*move|under\s*construction|रेडी|अंडर\s*कंस्ट्रक्शन|possession/i.test(
        agentText,
      ),
    askedPlanning:
      /plan\s*kar|plan\s*कर|query\s*receive|property\s*ke\s*regarding|कुछ\s*plan|देख\s*रहे\s*हैं|देख रहे हैं क्या|plan कर रहे/i.test(
        agentText,
      ),
    offeredVisit:
      /site visit|visit कब|visit kar|साइट|भेट|વિઝિટ|meeting|fix (?:a )?visit|visit arrange/i.test(
        agentText,
      ),
    askedDay: /weekday|weekend|which day|saturday|sunday|friday|evening|दिन|સાંજ|follow.?up/i.test(
      agentText,
    ),
  };
}

function leadLinesFromTranscript(transcript?: string | null): string {
  if (!transcript) return '';
  return transcript
    .split('\n')
    .filter((line) => /^lead:/i.test(line.trim()))
    .map((line) => line.replace(/^lead:\s*/i, ''))
    .join(' ');
}

export function buildGreetingText(options: {
  leadName: string;
  agentName: string;
  projectName?: string | null;
  hasBudget?: boolean;
  budgetLabel?: string;
  language?: string;
  tone?: string;
  agentVoice?: string;
  companyName?: string | null;
}): string {
  // Varied openings — never hard-ask budget in the greeting
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildVariedOpening } = require('./opener-bank') as typeof import('./opener-bank');
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


export function buildContextualLivenessAck(options: {
  priorTranscript?: string | null;
  language?: string;
  projectName?: string | null;
}): string {
  const prior = options.priorTranscript || '';
  const last = lastAgentLine(prior).trim();
  const lastLower = last.toLowerCase();

  // If there is an active project in the conversation
  const projectMatch =
    options.projectName ||
    (prior.match(/(palace heights|ncr monarch|future estate|aarya heights|dholera|vvip|saya|apex|godrej|sobha|gulshan|parx laureate|eternia|synq|biigtech|town square|autograph|kutumb|पैलेस|मोनार्क)/i)?.[0]);

  if (/2\s*bhk|3\s*bhk|bedroom|configuration|बीएचके/i.test(lastLower)) {
    return 'हाँ जी, मैं लाइन पर हूँ, सुन रही हूँ! मैंने पूछा था कि आप 2 बीएचके फ्लैट देख रहे हैं या 3 बीएचके?';
  }
  if (/budget|बजट/i.test(lastLower)) {
    return 'हाँ जी सुन रही हूँ, बोलिए! आपका बजट लगभग कितना है?';
  }
  if (/rehne|end use|investment|रहने|इन्वेस्टमेंट/i.test(lastLower)) {
    return 'हाँ जी, मैं लाइन पर हूँ! मैं पूछ रही थी कि आप अपने रहने के लिए देख रहे हैं या इन्वेस्टमेंट के लिए?';
  }
  if (/possession|ready to move|under construction|पजेशन|रेडी|अंडर/i.test(lastLower)) {
    return 'हाँ जी, बिल्कुल आवाज़ आ रही है! आप रेडी-टू-मूव देख रहे हैं या अंडर-कंस्ट्रक्शन चलेगा?';
  }
  if (/site visit|visit|weekend|sample flat|विजिट|सैंपल/i.test(lastLower)) {
    return 'हाँ जी, बिल्कुल सुन रही हूँ! क्या आप इस वीकेंड सैंपल फ्लैट विजिट प्लान करना चाहेंगे?';
  }
  if (/naam|shubh naam|नाम|शुभ नाम/i.test(lastLower)) {
    return 'हाँ जी, मैं लाइन पर हूँ! मैं आपका शुभ नाम जान सकती हूँ?';
  }
  if (projectMatch && lastLower.length > 10) {
    const pName = projectMatch.replace(/\b\w/g, (c) => c.toUpperCase());
    return `हाँ जी, मैं लाइन पर हूँ, सुन रही हूँ! हम ${pName} के बारे में बात कर रहे थे — बोलिए!`;
  }
  if (lastLower.length > 12 && !/hello\?|हेलो\?/i.test(lastLower)) {
    return 'हाँ जी, मैं लाइन पर हूँ, आप बोलिए।';
  }
  return 'हाँ जी, आवाज़ आ रही है! बोलिए, मैं सुन रही हूँ।';
}

export function detectIntent(text: string): {
  notInterested: boolean;
  callback: boolean;
  askingWhyCall: boolean;
  askingIdentity: boolean;
  isGreeting: boolean;
  askingPrice: boolean;
  statingBhk: boolean;
  statingPossession: boolean;
  statingVisitDay: boolean;
  positive: boolean;
  incompleteOrAmbiguous: boolean;
  builderRejection?: boolean;
  specificProjectInquiry?: boolean;
  askingPastProject?: boolean;
  askingAlternatives?: boolean;
  askingContinueCurrentProject?: boolean;
  askingPriceCurrent?: boolean;
  askingSizeCurrent?: boolean;
  askingLocationCurrent?: boolean;
  askingTellMore?: boolean;
  budgetUncertain?: boolean;
  askingWhatsApp?: boolean;
  askingPriorConversation?: boolean;
} {
  const t = text.toLowerCase();
  const asksLocationCurrent =
    /(?:location\s*kahan\s*hai|kahan\s*(?:par\s*)?hai|kis\s*jagah\s*hai|kahan\s*padta\s*hai|where\s*is\s*it\s*located|exact\s*location|kaha\s*pe\s*hai)/i.test(t);

  const asksTellMore =
    /(?:(?:aur\s*batao|aur\s*bataiye|details\s*batao|details\s*bataiye|aur\s*kya\s*hai)|(?:haan\s*,?\s*batao)|(?:uske\s*baare\s*mein\s*aur))/i.test(t);

  const isBudgetUncertain =
    /(?:(?:abhi\s*)?budget\s*(?:clear|fix|decide)?\s*(?:nahi|nhi)\s*hai)|(?:budget\s*ka\s*idea\s*nahi)|(?:abhi\s*socha\s*nahi)|(?:budget\s*clear\s*nahi)/i.test(t);

  const asksWhatsApp =
    /(?:whatsapp|वाट्सएप|व्हाट्सएप).*(?:bhej|send|share|kar|do|karo|dena)/i.test(t) ||
    /(?:bhej|send|share)\s*(?:do|dena|karo|kar\s*do)?.*(?:whatsapp|वाट्सएप|व्हाट्सएप)/i.test(t);

  const asksContinueCurrentProject =
    /(?:(?:nahi|ha+n|ji)?\s*(?:usi|wahi|vahi|same)\s*(?:ke\s*baare|project|ko)?\s*(?:mein\s*)?(?:continue|batao|charcha|rakho|karo|karte\s*hai[n]?))|(?:aage\s*batao)|(?:usi\s*ka\s*detail\s*do)|(?:usi\s*ke\s*baare\s*mein)|(?:pehle\s*to\??)|(?:pehle\s*wala\s*project)|(?:wahi\s*project\s*continue)|(?:kisi\s*ek\s*project\s*ke\s*baare\s*mein\s*to\s*usi\s*ka\s*detail\s*do)|(?:usi\s*ki\s*details\s*do)|(?:haan\s*,?\s*continue\s*karo)|(?:same\s*project\s*ke\s*baare)/i.test(t);

  const asksPriceCurrent =
    /(?:kitne\s*ka\s*hai|kitne\s*ka\s*padega|price\s*kya\s*hai|kya\s*rate\s*hai|kya\s*cost\s*hai|kitna\s*daam\s*hai|kitne\s*mein\s*aayega)/i.test(t);

  const asksSizeCurrent =
    /(?:kitna\s*bada\s*hai|size\s*kya\s*hai|area\s*kitna\s*hai|carpet\s*area|super\s*area|kitna\s*size\s*hai)/i.test(t);

  const asksPriorConversation =
    /(?:jab\s*maine\s*pehle\s*hi|pehle\s*bhi\s*baat\s*hui\s*thi|pehle\s*hi\s*tumse\s*baat\s*kar\s*li|already\s*baat\s*ho\s*chuki\s*hai)/i.test(t);

  const asksPastProject =
    /(?:pichhli|pichle|last|pehle|previous)\s*(?:baar|call|time)?\s*(?:humne|maine|aapne)?\s*(?:kis|konsa|kaunse|kiske|what)\s*(?:project|property|flat|builder|details)/i.test(t) ||
    /(?:which|what)\s*project\s*(?:did\s*we|was\s*discussed|last\s*time|previously)/i.test(t);

  const asksAlternatives =
    /(?:uske|inke|iske)?\s*(?:alawa|chhod\s*kar|other\s*than|apart\s*from)\s*(?:aur\s*)?(?:kya|konsa|kaunse|other)?\s*(?:options?|projects?|flats?)/i.test(t) ||
    /(?:kisi\s*aur|dusra|doosra|dusre|doosre|koi\s*aur|aur\s*koi)\s*(?:ka\s*)?(?:chahiye|dikhao|batao|options?)/i.test(t);
  const isDncOrOptOut = /mat\s*call|don't\s*call|do\s*not\s*call|phone\s*rakh|band\s*karo/i.test(t);
  const wantsCallback =
    !isDncOrOptOut &&
    /callback|call\s*back|call\s*later|baad\s*me(?:in)?|बाद\s*में|नंतर|પછી|busy|व्यस्त|abhi\s*(?:nahi|nhi)\s*(?:kar|kr|bol|baat|time)|(?:nahi|nhi)\s*(?:kar|kr)\s*sak|baad\s*me(?:in)?\s*call|call\s*(?:karna|krna|karo|kar\s*dena)|phir\s*call|later\s*call/i.test(
      t,
    ) && !/weekend|saturday|sunday|friday|site\s*visit/i.test(t);

  const isGreetingOnly =
    /^(?:hello|helo|halo|haan\s*ji|ha\s*ji|namaste|pranam|hello\s*ji|suno|boliye|haan|han|ha)[!?.\s]*$/i.test(
      t.trim(),
    ) ||
    /^(?:नमस्ते|हेलो|हाँजी|प्रणाम|हाँ\s*जी|सुनिए|हाँ)[!?.\s]*$/.test(t.trim()) ||
    /(?:aawaz|awaaz|awaz|voice|sound)\s*(?:aa\s*rahi|nhi|nahi|aarhi|cut|aarahi|gayab)/i.test(t) ||
    /(?:sun\s*(?:rahe|rahi|pa\s*rahe|sakte)|hear\s*me|koi\s*hai|bolte\s*kyu\s*nahi|kuch\s*bolo)/i.test(t) ||
    /^(?:hello\s*)+[!?.]*$/i.test(t.trim());

  const isIncompleteOrAmbiguous = isIncompleteOrAmbiguousQuery(text);
  const isGenericAck = isGenericAcknowledgement(text);

  // Must be asking who the agent/company is ("aap kaun", "kaun ho", "kaun bol rahe ho")
  // Must NOT match project queries like "kaun se project", "kaun-kaun se option", "kaun sa floor"
  const isWhichOptionQuestion =
    /(?:kaun|कौन|kon)\s*(?:[- ]?(?:kaun|कौन)|se|sa|si|wale|wala|wali)\b/i.test(t) ||
    /project|flats?|property|floor|location|list\b/i.test(t);

  const askingIdentityOnly =
    !isWhichOptionQuestion &&
    /(?:\b(?:aap|tum)\s+(?:kaun|kon)\b|\b(?:kaun|kon)\s+(?:ho|hai|bol\s*rahe?|baat\s*kar)\b|कौन\s*(?:हो|हैं?|बोल\s*रहे|बात\s*कर)|\b(?:aap|tum)\s+kaha(?:n)?\s*se\b|आप\s*कहाँ\s*से|\bkiski\s*company\b|किसकी\s*कंपनी|\bkis\s*company\s*(?:se)?\b|\bkisko\s*(?:call|phone|lagaya)\b|किसको\s*(?:कॉल|फोन|लगाया)|\bkaha(?:n)?\s*lag\s*gaya|कहाँ\s*लग\s*गया|\bkisne\s*(?:kiya|lagaya)\b|किसने\s*(?:किया|लगाया))/i.test(
      t,
    );

  const isProjectRejection =
    /(?:kisi\s*aur|dusra|doosra|dusre|doosre|koi\s*aur|aur\s*koi|kisi\s*aur\s*ka)\s*(?:ka\s*)?(?:chahiye|dikhao|batao|options?)/i.test(t) ||
    /(?:ka\s*nahi\s*chahiye|ka\s*nhi\s*chahiye|wala\s*nahi|nahi\s*chahiye.*(?:balki|lekin|but|chahiye|dikhao|batao|options?|hai\s*kya|tumhare\s*paas))/i.test(t) ||
    /(?:nahi\s*chahiye.*(?:future|state|estate|vvip|rudra|palace|monarch|aarya|dholera))/i.test(t) ||
    /(?:future\s*(?:state|estate)|vvip|palace\s*heights?|ncr\s*monarch).*(?:chahiye|hai\s*kya|hai)/i.test(t) ||
    /(?:continue.*but|continue.*lekin)/i.test(t);

  const rawNotInterested =
    /not interested|no thanks|don't call|do not call|wrong number|nahi chahiye|nahi chaiye|nhi chahiye|nhi chaiye|नहीं चाहिए|नाही पाहिजे|નથી જોઈએ|not looking|not searching|kuch nahi|kuch bhi nahi|khuch bhi|कुछ नहीं|कुछ भी नहीं|नहीं\s*देख|search नहीं|कोई property search नहीं|अभी नहीं देख|mere liye nahi|अपने लिए नहीं|rakho phone|rakh do phone|cut (?:the )?call|mat call|band karo|hang up|phone rakh|nhi chahiye khuch|nahi chahiye kuch/i.test(
      t,
    );

  const isSpecificProject =
    /(?:future\s*(?:estate|state)|फ्यूचर\s*(?:एस्टेट|स्टेट)).*(?:chahiye|hai\s*kya|hai|details?)/i.test(t) ||
    /tumhare\s*paas\s*future/i.test(t);

  const isBuilderRej =
    /(?:saya\s*group|saya|साया\s*ग्रुप|साया|future\s*world|rudra|vvip).*(?:ka\s*nahi|nahi\s*chahiye|nhi\s*chahiye|nahi\s*dekhna|nahi\s*lena|nahi|mat|chodkar|छोड़कर|नहीं\s*चाहिए|नहीं\s*देखना|नहीं|नही)/i.test(t) ||
    /(?:kisi\s*aur\s*ka|kisi\s*aur\s*builder|doosre\s*builder|dusre\s*builder)\s*(?:chahiye|dikhao|options?)/i.test(t);

  return {
    notInterested: !wantsCallback && rawNotInterested && !isProjectRejection,
    builderRejection: isBuilderRej,
    specificProjectInquiry: isSpecificProject,
    callback: wantsCallback,
    askingWhyCall:
      askingIdentityOnly ||
      /kis liye|kyun (?:call|phone)|kyu (?:call|phone)|why (?:did you |have you )?call|kya baat|kaun (?:ho|hai)|reason for (?:call|calling)|phone kyun|phone kis liye|क्यों\s*फोन|किस\s*लिए\s*फोन|किस लिये/i.test(
        t,
      ),
    askingIdentity: askingIdentityOnly,
    isGreeting: isGreetingOnly,
    askingPrice:
      /(?:what(?:'s| is)? (?:the )?price|kitna|कितना|किंमत|કિંમત|pricing|emi|payment plan|cost of)/.test(
        t,
      ) || /^(?:price|cost|emi)\b/.test(t.trim()),
    statingBhk:
      /\b[1-5]\s*(?:bhk|bedroom|बी\s*एच\s*के|बीएचके)/i.test(t) ||
      /(?:2|3|4|दो|तीन|चार)\s*(?:bhk|बीएचके|बी\s*एच)/i.test(t),
    statingPossession:
      /ready\s*to\s*move|under\s*construction|uc\b|रेडी|अंडर\s*कंस्ट्रक्शन|निर्माणाधीन/i.test(
        t,
      ),
    statingVisitDay:
      /(?:next\s*)?(?:weekend|saturday|sunday|friday|monday|tomorrow|kal|कल|शनिवार|रविवार|शुक्रवार)/i.test(
        t,
      ),
    positive:
      !isGreetingOnly &&
      !isIncompleteOrAmbiguous &&
      !isGenericAck &&
      /interested|yes|sure|ok|okay|haan|हां|हाँ|होय|હા|bilkul|बिल्कुल|tell me|go ahead|site visit|visit|arrange|book|plan kar|planning|dekh rah|search kar|looking|खोज रहा|देख रहा|प्लान कर/i.test(
        t,
      ) &&
      !/nahi|nhi|नहीं|rakho phone|kis liye|kyu|kyun/i.test(t),
    incompleteOrAmbiguous: isIncompleteOrAmbiguous,
    askingPastProject: asksPastProject,
    askingAlternatives: asksAlternatives,
    askingContinueCurrentProject: asksContinueCurrentProject,
    askingPriceCurrent: asksPriceCurrent,
    askingSizeCurrent: asksSizeCurrent,
    askingLocationCurrent: asksLocationCurrent,
    askingTellMore: asksTellMore,
    budgetUncertain: isBudgetUncertain,
    askingWhatsApp: asksWhatsApp,
    askingPriorConversation: asksPriorConversation,
  };
}

export function buildFollowUpReply(options: {
  transcript: string;
  leadName: string;
  language?: string;
  tone?: string;
  priorTranscript?: string | null;
  knownFacts?: ConversationFacts;
  speechGender?: SpeechGender;
  agentVoice?: string;
  agentName?: string;
  companyName?: string;
  isInbound?: boolean;
}): { text: string; outcome: CallOutcome; facts: ConversationFacts } {
  const language = normalizeLanguage(options.language);
  const tone = normalizeTone(options.tone);
  const rawLeadName = (options.leadName || '').trim();
  const hasRealName = !isPlaceholderLeadName(rawLeadName);
  const leadName = hasRealName ? rawLeadName : 'जी';
  const gender =
    options.speechGender ||
    resolveSpeechGender({
      agentVoice: options.agentVoice,
    });
  const current = options.transcript || '';
  const priorLeadText = leadLinesFromTranscript(options.priorTranscript);
  // Only trust BHK/possession/visit from THIS call speech — never CRM profile jumps
  const spokenFacts = mergeFacts(
    extractFactsFromText(priorLeadText),
    extractFactsFromText(current),
  );
  const facts = mergeFacts(
    {
      bhk: options.knownFacts?.bhk,
      budgetLabel: options.knownFacts?.budgetLabel,
      location: options.knownFacts?.location,
      interested: options.knownFacts?.interested,
      lastDiscussedProject: options.knownFacts?.lastDiscussedProject,
      selectedProjectId: options.knownFacts?.selectedProjectId,
      selectedProjectLock: options.knownFacts?.selectedProjectLock,
    },
    spokenFacts,
  );
  const intent = detectIntent(current);
  const already = priorAgentAsked(options.priorTranscript);
  const lastReply = lastAgentLine(options.priorTranscript);
  const letaHi = ag(gender, 'लेता', 'लेती');
  const samajhHi = ag(gender, 'समझ गया', 'समझ गई');
  const contextual = resolveContextualShortReply({
    userMessage: current,
    priorTranscript: options.priorTranscript,
  });

  let kind: ReplyKind = 'ask_planning';
  let outcome: CallOutcome = CallOutcome.CONNECTED;

  const nextSampleStep = (): ReplyKind => {
    if (!facts.bhk) return 'ask_bhk';
    if (!facts.possession) return 'ask_possession';
    if (!facts.visitDay && !already.offeredVisit) return 'offer_visit';
    if (facts.visitDay || already.offeredVisit) return 'confirm_followup';
    return 'offer_visit';
  };

  if (contextual) {
    kind = contextual.kind;
    outcome = contextual.outcome;
  } else if (intent.builderRejection) {
    kind = 'reject_builder_pivot';
    outcome = CallOutcome.CONNECTED;
    facts.selectedProjectLock = false;
  } else if (intent.askingContinueCurrentProject) {
    kind = 'continue_current_project';
    outcome = CallOutcome.CONNECTED;
    const resolvedProj =
      options.knownFacts?.selectedProjectId ||
      options.knownFacts?.lastDiscussedProject ||
      'Palace Heights by Rudra';
    facts.selectedProjectId = resolvedProj;
    facts.lastDiscussedProject = resolvedProj;
    facts.selectedProjectLock = true;
  } else if (intent.askingPriceCurrent) {
    kind = 'query_price_current';
    outcome = CallOutcome.CONNECTED;
  } else if (intent.askingSizeCurrent) {
    kind = 'query_size_current';
    outcome = CallOutcome.CONNECTED;
  } else if (intent.askingLocationCurrent) {
    kind = 'query_location_current';
    outcome = CallOutcome.CONNECTED;
  } else if (intent.askingTellMore) {
    kind = 'query_tell_more';
    outcome = CallOutcome.CONNECTED;
  } else if (intent.budgetUncertain) {
    kind = 'budget_uncertain_guide';
    outcome = CallOutcome.CONNECTED;
  } else if (intent.specificProjectInquiry) {
    kind = 'confirm_future_estate';
    outcome = CallOutcome.QUALIFIED;
    facts.selectedProjectId = 'Future Estate by Future World';
    facts.lastDiscussedProject = 'Future Estate by Future World';
    facts.selectedProjectLock = true;
  } else if (intent.askingPastProject) {
    kind = 'recall_past_project';
    outcome = CallOutcome.CONNECTED;
  } else if (intent.askingAlternatives) {
    kind = 'show_alternatives';
    outcome = CallOutcome.CONNECTED;
    facts.selectedProjectLock = false;
  } else if (/^(?:क्या\s*(?:नहीं|नही)\s*है|kya\s*(?:nahi|nhi)\s*hai)[!?.\s]*$/i.test(current.trim())) {
    kind = 'clarify_missing_feature';
    outcome = CallOutcome.CONNECTED;
  } else if (
    /(?:whatsapp|वाट्सएप|व्हाट्सएप).*(?:bhej|send|share|kar|do|karo|dena)/i.test(current) ||
    /(?:bhej|send|share)\s*(?:do|dena|karo|kar\s*do)?.*(?:whatsapp|वाट्सएप|व्हाट्सएप)/i.test(current)
  ) {
    kind = 'confirm_details';
    outcome = CallOutcome.CONNECTED;
  } else if (
    /(?:^|\b)(?:ncr\s*(?:ke\s*baare|batao|kya\s*hai|project)|एनसीआर\s*(?:के\s*बारे|बताओ|प्रोजेक्ट)|about\s*ncr)(?:\b|$)/i.test(current) &&
    !/(?:monarch|मोनार्क)/i.test(current)
  ) {
    if (/(?:monarch|मोनार्क)/i.test(priorLeadText || '') || /(?:monarch|मोनार्क)/i.test(lastReply || '')) {
      kind = 'confirm_details';
    } else {
      kind = 'clarify_ncr';
      outcome = CallOutcome.CONNECTED;
    }
  } else if (isIncompleteOrAmbiguousQuery(current)) {
    kind = 'clarify_ambiguous';
    outcome = CallOutcome.CONNECTED;
  } else if (isGenericAcknowledgement(current)) {
    kind = 'generic_ack';
    outcome = CallOutcome.CONNECTED;
  } else if (intent.callback && !intent.statingVisitDay) {
    kind = 'callback';
    outcome = CallOutcome.CALLBACK_REQUESTED;
    const cbSlot = parseCallbackSlot(current, options.priorTranscript);
    if (cbSlot) {
      (facts as any).callbackLabel = cbSlot.label;
    }
  } else if (intent.notInterested) {
    kind = 'not_interested';
    outcome = CallOutcome.NOT_INTERESTED;
  } else if (intent.isGreeting) {
    const hasPriorLead = Boolean(priorLeadText && priorLeadText.trim().length > 3);
    const hasRealPriorAgent = Boolean(
      lastReply && lastReply.length > 5 && !/^(?:agent:\s*)?hello\??$/i.test(lastReply.trim()),
    );
    if (options.isInbound && !hasPriorLead && !hasRealPriorAgent) {
      kind = 'greeting_inbound';
    } else {
      kind = 'liveness_ack';
    }
    outcome = CallOutcome.CONNECTED;
  } else if (intent.askingWhyCall || intent.askingIdentity) {
    kind = 'explain_why_call';
    outcome = CallOutcome.CONNECTED;
  } else if (intent.statingVisitDay || spokenFacts.visitDay) {
    if (spokenFacts.visitDay) facts.visitDay = spokenFacts.visitDay;
    kind = 'confirm_followup';
    outcome = CallOutcome.SITE_VISIT_INTERESTED;
  } else if (intent.statingPossession || spokenFacts.possession) {
    if (spokenFacts.possession) facts.possession = spokenFacts.possession;
    facts.interested = true;
    kind = nextSampleStep();
    outcome = CallOutcome.QUALIFIED;
  } else if (intent.statingBhk || spokenFacts.bhk) {
    facts.interested = true;
    kind = nextSampleStep();
    if (kind === 'ask_bhk') kind = 'ask_possession';
    outcome = CallOutcome.QUALIFIED;
  } else if (intent.askingPrice) {
    kind = facts.bhk ? 'ask_possession' : 'price_soft';
  } else if (intent.positive || facts.interested) {
    // Bare "haan/bilkul" without contextual match must NOT restart discovery
    // after a soft close — resolveContextualShortReply already handled that.
    if (isShortAffirmation(current) && lastAgentWasSoftClose(lastReply)) {
      kind = 'close_ack';
      outcome = CallOutcome.NOT_INTERESTED;
    } else {
      facts.interested = true;
      kind = nextSampleStep();
      outcome = CallOutcome.QUALIFIED;
    }
  } else {
    kind = already.askedPlanning || facts.interested ? nextSampleStep() : 'ask_planning';
  }

  const bhk = facts.bhk || '2 BHK या 3 BHK';
  const possessionLabel =
    facts.possession === 'ready'
      ? 'ready to move in'
      : facts.possession === 'under_construction'
        ? 'under construction'
        : 'ready / under construction';
  const visitDay = facts.visitDay || 'next weekend';

  const scripts: Record<ReplyKind, Record<AppLanguage, string>> = {
    confirm_future_estate: {
      'en-IN': `Ji, Future Estate ka project hamari available inventory mein hai. Main aapko uski verified details batati hoon.`,
      'hi-IN': `जी, Future Estate का प्रोजेक्ट हमारी available inventory में है। मैं आपको उसकी verified details बताती हूँ।`,
      hinglish: `Ji, Future Estate ka project hamari available inventory mein hai. Main aapko uski verified details batati hoon.`,
      'mr-IN': `होय, Future Estate प्रकल्प आमच्याकडे उपलब्ध आहे. मी तुम्हाला माहिती सांगते.`,
      'gu-IN': `હા, Future Estate પ્રોજેક્ટ અમારી પાસે ઉપલબ્ધ છે. હું તમને વિગતો જણાવું છું.`,
    },
    reject_builder_pivot: {
      'en-IN': `Ji bilkul, koi baat nahi. Main Saya Group ke options hata deti hoon. Aapke liye doosre builders ke projects check karti hoon.`,
      'hi-IN': `जी बिल्कुल, कोई बात नहीं। मैं Saya Group के options हटा देती हूँ। आपके लिए दूसरे builders के projects check करती हूँ।`,
      hinglish: `Ji bilkul, koi baat nahi. Main Saya Group ke options hata deti hoon. Aapke liye doosre builders ke projects check karti hoon.`,
      'mr-IN': `काही हरकत नाही, आम्ही इतर बिल्डर्सचे पर्याय तपासतो.`,
      'gu-IN': `કોઈ વાંધો નહીં, અમે બીજા બિલ્ડર્સના વિકલ્પો જોઈએ છીએ.`,
    },
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
      'en-IN': (facts as any).callbackLabel
        ? `Bilkul, main ${(facts as any).callbackLabel} baad mein call kar ${letaHi} hoon — shukriya!`
        : `Bilkul, abhi time nahi hai — baad mein call kar ${letaHi} हूँ।`,
      'hi-IN': (facts as any).callbackLabel
        ? `बिल्कुल, मैं ${(facts as any).callbackLabel} बाद में call कर ${letaHi} हूँ — शुक्रिया!`
        : `बिल्कुल, अभी समय नहीं है — बाद में call कर ${letaHi} हूँ।`,
      hinglish: (facts as any).callbackLabel
        ? `Bilkul, main ${(facts as any).callbackLabel} baad mein call kar ${letaHi} hoon — shukriya!`
        : `Bilkul, abhi time nahi — baad mein call kar ${letaHi} हूँ।`,
      'mr-IN': `ठीक, नंतर कॉल करतो.`,
      'gu-IN': `બરાબર, પછી કૉલ કરીશ.`,
    },
    confirm_details: {
      'en-IN': `Theek hai — main team ko note karwa deti hoon, wo details aur layout verify karke aapke WhatsApp pe share kar denge.`,
      'hi-IN': `ठीक है — मैं team को note करवा देती हूँ, वो details और layout verify करके आपके WhatsApp पे share कर देंगे।`,
      hinglish: `Theek hai — main team ko note karwa deti hoon, wo details aur layout verify karke aapke WhatsApp pe share kar denge.`,
      'mr-IN': `ठीक आहे, आमची टीम पडताळणी करून WhatsApp वर माहिती पाठवेल.`,
      'gu-IN': `બરાબર, અમારી ટીમ ચકાસણી કરીને WhatsApp પર વિગતો મોકલશે.`,
    },
    explain_why_call: {
      'en-IN': options.isInbound
        ? `Ji Namaste! Main ${options.companyName || 'Workains Realty'} helpline se ${options.agentName || 'Aria'} baat kar rahi hoon. Batayein main aapki kya sahayata kar sakti hoon?`
        : `${hasRealName ? `${leadName} जी` : 'जी'}, आपकी property enquiry आई थी इसलिए कॉल किया — अभी देखना चालू है क्या?`,
      'hi-IN': options.isInbound
        ? `जी नमस्ते! मैं ${options.companyName || 'Workains Realty'} helpline से ${options.agentName || 'Aria'} बात कर रही हूँ। बताएं मैं आपकी क्या सहायता कर सकती हूँ?`
        : `${hasRealName ? `${leadName} जी` : 'जी'}, आपकी property enquiry आई थी इसलिए कॉल किया — अभी घर/flat देखना चालू है क्या?`,
      hinglish: options.isInbound
        ? `Ji Namaste! Main ${options.companyName || 'Workains Realty'} helpline se ${options.agentName || 'Aria'} baat kar rahi hoon. Batayein main aapki kya sahayata kar sakti hoon?`
        : `${hasRealName ? `${leadName} जी` : 'जी'}, आपकी property enquiry आई थी इसलिए कॉल किया — अभी देखना चालू है क्या?`,
      'mr-IN': `${hasRealName ? `${leadName}, ` : ''}property enquiry आली होती म्हणून कॉल — आता पाहत आहात का?`,
      'gu-IN': `${hasRealName ? `${leadName}, ` : ''}property enquiry આવી હતી એટલે કૉલ — અત્યારે જોઈ રહ્યા છો?`,
    },
    greeting_inbound: {
      'en-IN': `Haan ji Namaste! ${options.companyName || 'Workains Realty'} real estate helpline me aapka swagat hai. Main aapki kya sahayata kar sakti hoon?`,
      'hi-IN': `हाँ जी नमस्ते! ${options.companyName || 'Workains Realty'} real estate helpline में आपका स्वागत है। मैं आपकी क्या सहायता कर सकती हूँ?`,
      hinglish: `हाँ जी नमस्ते! ${options.companyName || 'Workains Realty'} रियल एस्टेट हेल्पलाइन में आपका स्वागत है। मैं आपकी क्या सहायता कर सकती हूँ?`,
      'mr-IN': `नमस्कार! ${options.companyName || 'Workains Realty'} हेल्पलाईनमध्ये आपले स्वागत आहे. मी आपली काय मदत करू शकते?`,
      'gu-IN': `નમસ્તે! ${options.companyName || 'Workains Realty'} હેલ્પલાઇનમાં આપનું સ્વાગત છે. હું આપની શું સહાયતા કરી શકું?`,
    },
    liveness_ack: {
      'en-IN': buildContextualLivenessAck({
        priorTranscript: options.priorTranscript,
        language: 'en-IN',
        projectName: options.knownFacts?.location || null,
      }),
      'hi-IN': buildContextualLivenessAck({
        priorTranscript: options.priorTranscript,
        language: 'hi-IN',
        projectName: options.knownFacts?.location || null,
      }),
      hinglish: buildContextualLivenessAck({
        priorTranscript: options.priorTranscript,
        language: 'hinglish',
        projectName: options.knownFacts?.location || null,
      }),
      'mr-IN': `होय, आवाज येतोय! मी ऐकतेय, बोला.`,
      'gu-IN': `હા, અવાજ આવે છે! હું સાંભળું છું, બોલો.`,
    },
    thinking_filler: {
      'en-IN': getThinkingFiller({ language: 'en-IN', speechGender: gender, userMessage: current, usedFillers: [] }),
      'hi-IN': getThinkingFiller({ language: 'hi-IN', speechGender: gender, userMessage: current, usedFillers: [] }),
      hinglish: getThinkingFiller({ language: 'hinglish', speechGender: gender, userMessage: current, usedFillers: [] }),
      'mr-IN': getThinkingFiller({ language: 'mr-IN', speechGender: gender, userMessage: current, usedFillers: [] }),
      'gu-IN': getThinkingFiller({ language: 'gu-IN', speechGender: gender, userMessage: current, usedFillers: [] }),
    },
    ask_planning: {
      'en-IN': `${hasRealName ? `${leadName} जी, ` : ''}घर / flat देखना अभी चालू है क्या आपके side?`,
      'hi-IN': `${hasRealName ? `${leadName} जी, ` : ''}घर या flat देखना अभी चालू है क्या आपके side?`,
      hinglish: `${hasRealName ? `${leadName} जी, ` : ''}घर या flat देखना अभी चालू है क्या आपके side?`,
      'mr-IN': `${hasRealName ? `${leadName}, ` : ''}घर पाहणे सुरू आहे का?`,
      'gu-IN': `${hasRealName ? `${leadName}, ` : ''}ઘર જોવાનું ચાલુ છે?`,
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
    clarify_ambiguous: {
      'en-IN': `Are you asking about visiting the site right now, or discussing details over the call right now?`,
      'hi-IN': `जी, क्या आप अभी साईट विज़िट के लिए पूछ रहे हैं, या अभी कॉल पर बात करने के लिए?`,
      hinglish: `Ji, kya aap abhi site visit ke baare mein pooch rahe hain, ya abhi call par details discuss karna chahte hain?`,
      'mr-IN': `तुम्ही आत्ता साईट व्हिजिटबद्दल विचारत आहात की फोनवर माहिती हवी आहे?`,
      'gu-IN': `તમે અત્યારે સાઇટ મુલાકાત વિશે પૂછી રહ્યા છો કે ફોન પર વાત કરવા માંગો છો?`,
    },
    clarify_missing_feature: {
      'en-IN': `Are you asking about any specific amenity, feature, or facility that might not be available?`,
      'hi-IN': `जी, क्या आप किसी specific amenity, feature या facility के बारे में पूछ रहे हैं कि क्या उपलब्ध नहीं है?`,
      hinglish: `Ji, kya aap kisi specific amenity, feature ya facility ke baare mein pooch rahe hain ki kya available nahi hai?`,
      'mr-IN': `तुम्ही कोणत्याही विशिष्ट सुविधेबद्दल विचारत आहात का की काय उपलब्ध नाही?`,
      'gu-IN': `શું તમે કોઈ ચોક્કસ સુવિધા વિશે પૂછી રહ્યા છો જે ઉપલબ્ધ નથી?`,
    },
    clarify_ncr: {
      'en-IN': `Are you asking about the NCR Monarch project in Greater Noida West, or the overall Delhi NCR region?`,
      'hi-IN': `जी, आप सेक्टर 1 ग्रेटर नोएडा वेस्ट वाले प्रोजेक्ट NCR Monarch के बारे में पूछ रहे हैं, या पूरे दिल्ली NCR रीजन के बारे में?`,
      hinglish: `Ji, aap Sector 1 Greater Noida West wale project NCR Monarch ke baare mein pooch rahe hain, ya overall Delhi NCR region ke baare mein?`,
      'mr-IN': `तुम्ही ग्रेटर नोएडा वेस्ट मधील NCR Monarch प्रकल्पाबद्दल विचारत आहात की दिल्ली NCR बद्दल?`,
      'gu-IN': `તમે ગ્રેટર નોઈડા વેસ્ટના NCR Monarch પ્રોજેક્ટ વિશે પૂછી રહ્યા છો કે દિલ્હી NCR વિશે?`,
    },
    generic_ack: {
      'en-IN': facts.bhk
        ? `Sure! Would you like to see the floor plan layout map, or discuss pricing details?`
        : `Sure! Would you be looking for a 2 BHK or a 3 BHK flat?`,
      'hi-IN': facts.bhk
        ? `जी बिल्कुल! क्या आप इसका floor plan layout map देखना चाहेंगे, या price details discuss करें?`
        : `जी बिल्कुल! आप 2 BHK फ़्लैट देख रहे हैं या 3 BHK?`,
      hinglish: facts.bhk
        ? `Ji bilkul! Iske alawa kya aap iska floor plan layout map dekhna chahenge ya price details discuss karein?`
        : `Ji bilkul! Aap 2 BHK flat dekh rahe hain ya 3 BHK?`,
      'mr-IN': facts.bhk
        ? `नक्कीच! तुम्हाला फ्लोअर प्लॅन पाहायचा आहे की किमतीबद्दल चर्चा करायची आहे?`
        : `होय, तुम्हाला २ BHK की ३ BHK फ्लॅट हवा आहे?`,
      'gu-IN': facts.bhk
        ? `ચોક્કસ! શું તમે ફ્લોર પ્લાન જોવા માંગો છો કે કિંમતની વિગતો જાણવા માંગો છો?`
        : `હા, તમે ૨ BHK કે ૩ BHK ફ્લેટ શોધી રહ્યા છો?`,
    },
    recall_past_project: {
      'en-IN': options.knownFacts?.lastDiscussedProject
        ? `Last time we discussed ${options.knownFacts.lastDiscussedProject}! Would you like to check its layout and price, or explore new options today?`
        : `Last time we noted your requirements for a ${options.knownFacts?.bhk || 'home'} in Sector 1 Greater Noida West! Would you like to review those options?`,
      'hi-IN': options.knownFacts?.lastDiscussedProject
        ? `जी, पिछली बार हमने ${options.knownFacts.lastDiscussedProject} के बारे में बात की थी! क्या आप इसकी details दोबारा चेक करना चाहते हैं या कोई नया प्रोजेक्ट देखना है?`
        : `जी, पिछली बार हमने आपके ${options.knownFacts?.bhk || 'प्रॉपर्टी'} रिक्वायरमेंट्स नोट किए थे! क्या आप आज के ताज़ा ऑप्शन्स देखना चाहेंगे?`,
      hinglish: options.knownFacts?.lastDiscussedProject
        ? `Ji, pichhli baar humne ${options.knownFacts.lastDiscussedProject} ke baare mein baat ki thi! Kya aap iski details recall karna chahte hain ya koi naya option dekhna hai?`
        : `Ji, pichhli baar humne aapke ${options.knownFacts?.bhk || 'property'} requirements note kiye the! Kya aap aaj ke fresh options check karna chahenge?`,
      'mr-IN': `मागील वेळी आम्ही प्रकल्पाबद्दल चर्चा केली होती. तुम्हाला त्याची माहिती हवी आहे का?`,
      'gu-IN': `ગઈ વખતે અમે પ્રોજેક્ટ વિશે વાત કરી હતી. શું તમે તેની વિગતો જાણવા માંગો છો?`,
    },
    continue_current_project: {
      'en-IN': `Certainly! Let's continue with ${options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || 'Palace Heights by Rudra'}. Based on your ${facts.bhk || '2 BHK'} requirement, I'll share its available layout and pricing details.`,
      'hi-IN': `जी बिल्कुल! चलिए ${options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || 'Palace Heights'} की डिटेल्स कंटिन्यू करते हैं। आपके ${facts.bhk || '2 BHK'} रिक्वायरमेंट के हिसाब से मैं इसका साइज़ और प्राइसिंग बताती हूँ।`,
      hinglish: `Ji bilkul! Chaliye ${options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || 'Palace Heights'} ki details continue karte hain. Aapke ${facts.bhk || '2 BHK'} requirement ke hisaab se main iska available size aur pricing batati hoon.`,
      'mr-IN': `नक्कीच! चला आपण प्रकल्पाची माहिती सुरू ठेवूया.`,
      'gu-IN': `ચોક્કસ! ચાલો આપણે પ્રોજેક્ટની વિગતો આગળ વધારીએ.`,
    },
    query_price_current: {
      'en-IN': (options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || '').toLowerCase().includes('monarch')
        ? `In NCR Monarch, 1 BHK starts at ₹64 Lakh, with a BSP of ₹8,888 per sq.ft. Would you like to check the 2 BHK pricing?`
        : `In Palace Heights by Rudra, 1 BHK starts at ₹60.90 Lakh, and 2 BHK ranges between ₹80 to ₹88 Lakh with a 50:50 payment plan. Would you like more details?`,
      'hi-IN': (options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || '').toLowerCase().includes('monarch')
        ? `NCR Monarch में 1 BHK ₹64 Lakh से शुरू होता है और BSP ₹8,888 per sq.ft है। क्या आप 2 BHK की प्राइस डिटेल्स देखना चाहेंगे?`
        : `Palace Heights में 1 BHK ₹60.90 Lakh से स्टार्ट होता है, और 2 BHK लगभग ₹80 से ₹88 Lakh की रेंज में आता है। क्या आप इसका पेमेंट प्लान देखना चाहेंगे?`,
      hinglish: (options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || '').toLowerCase().includes('monarch')
        ? `NCR Monarch mein 1 BHK ₹64 Lakh se start hota hai aur BSP ₹8,888 per sq.ft hai. Kya aap iska payment plan check karna chahenge?`
        : `Palace Heights mein 1 BHK ₹60.90 Lakh se start hota hai, aur 2 BHK lagbhag ₹80 se ₹88 Lakh ke range mein aata hai. Kya aap iska 50:50 payment plan dekhna chahenge?`,
      'mr-IN': `प्रकल्पाची किंमत उपलब्ध युनिटनुसार सुरू होते.`,
      'gu-IN': `પ્રોજેક્ટની કિંમત ઉપલબ્ધ સાઇઝ મુજબ છે.`,
    },
    query_size_current: {
      'en-IN': `In Palace Heights by Rudra, 2 BHK configurations are available in 1015 sq.ft and 1088 sq.ft sizes. Would you like to review the floor plan layout?`,
      'hi-IN': `Palace Heights में 2 BHK के साइज़ 1015 sq.ft और 1088 sq.ft में आते हैं। क्या आप इसका फ्लोर प्लान लेआउट देखना चाहेंगे?`,
      hinglish: `Palace Heights mein 2 BHK configurations 1015 sq.ft aur 1088 sq.ft sizes mein available hain. Kya aap iska floor plan layout dekhna chahenge?`,
      'mr-IN': `२ BHK चे आकार १०१५ आणि १०८८ चौरस फूट उपलब्ध आहेत.`,
      'gu-IN': `૨ BHK ના કદ ૧૦૧૫ અને ૧૦૮૮ ચોરસ ફૂટમાં ઉપલબ્ધ છે.`,
    },
    query_location_current: {
      'en-IN': (options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || '').toLowerCase().includes('monarch')
        ? `NCR Monarch is located in Sector 1 Greater Noida West, right on the wide 130-meter road with excellent metro connectivity.`
        : `Palace Heights by Rudra is located in Sector 1 Greater Noida West near Gaur Chowk, with seamless access to central Noida.`,
      'hi-IN': (options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || '').toLowerCase().includes('monarch')
        ? `NCR Monarch सेक्टर 1 ग्रेटर नोएडा वेस्ट में 130 मीटर रोड पर स्थित है, जिसकी मेट्रो और हाईवे कनेक्टिविटी बेहतरीन है।`
        : `Palace Heights by Rudra सेक्टर 1 ग्रेटर नोएडा वेस्ट में गौर चौक के पास स्थित है, जहाँ से सेंट्रल नोएडा की कनेक्टिविटी सीधी है।`,
      hinglish: (options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || '').toLowerCase().includes('monarch')
        ? `NCR Monarch Sector 1 Greater Noida West mein 130-meter road par sthit hai, jahan se metro connectivity bilkul paas hai.`
        : `Palace Heights by Rudra Sector 1 Greater Noida West mein Gaur Chowk ke paas sthit hai, jahan se Noida aur Delhi dono smoothly connected hain.`,
      'mr-IN': `प्रकल्प ग्रेटर नोएडा वेस्ट सेक्टर १ मध्ये मोक्याच्या ठिकाणी आहे.`,
      'gu-IN': `પ્રોજેક્ટ ગ્રેટર નોઈડા વેસ્ટ સેક્ટર ૧ માં મુખ્ય સ્થળે છે.`,
    },
    query_tell_more: {
      'en-IN': (options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || '').toLowerCase().includes('monarch')
        ? `NCR Monarch is a premium 4-side open development featuring clubhouse, sports arenas, and 1 to 3 BHK homes. Would you like to check available unit layouts?`
        : `Palace Heights by Rudra features 2 BHK homes in 1015 and 1088 sq.ft with swimming pool, gym, and an attractive 50:50 payment plan. Would you like to review the floor plan?`,
      'hi-IN': (options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || '').toLowerCase().includes('monarch')
        ? `NCR Monarch एक 4-side open प्रोजेक्ट है जिसमें क्लबहाउस, स्विमिंग पूल और 1 से 3 BHK ऑप्शन्स उपलब्ध हैं। क्या आप इसका लेआउट देखना चाहेंगे?`
        : `Palace Heights by Rudra में 1015 और 1088 sq.ft के 2 BHK, क्लबहाउस और 50:50 पेमेंट प्लान उपलब्ध है। क्या आप इसका फ्लोर प्लान देखना चाहेंगे?`,
      hinglish: (options.knownFacts?.selectedProjectId || options.knownFacts?.lastDiscussedProject || '').toLowerCase().includes('monarch')
        ? `NCR Monarch 4-side open project hai jisme clubhouse, sports arena aur 1 to 3 BHK flats available hain. Kya aap iska floor plan layout dekhna chahenge?`
        : `Palace Heights by Rudra mein 1015 aur 1088 sq.ft ke 2 BHK, clubhouse aur 50:50 payment plan available hai. Kya aap iska layout dekhna chahenge?`,
      'mr-IN': `प्रकल्पामध्ये सर्व आधुनिक सुविधा आणि उत्तम लेआउट उपलब्ध आहेत.`,
      'gu-IN': `પ્રોજેક્ટમાં તમામ આધુનિક સુવિધાઓ અને સુંદર લેઆઉટ ઉપલબ્ધ છે.`,
    },
    budget_uncertain_guide: {
      'en-IN': `No problem at all! In Sector 1 Greater Noida West, verified homes start from ₹60 Lakh up to ₹90 Lakh. Which configuration would you prefer — 2 BHK or 3 BHK?`,
      'hi-IN': `कोई बात नहीं जी! सेक्टर 1 ग्रेटर नोएडा वेस्ट में हमारे पास ₹60 Lakh से ₹90 Lakh तक verified ऑप्शन्स हैं। आप 2 BHK पसंद करेंगे या 3 BHK?`,
      hinglish: `Koi baat nahi ji! Sector 1 Greater Noida West mein verified homes ₹60 Lakh se ₹90 Lakh tak start hote hain. Aap 2 BHK prefer karenge ya 3 BHK?`,
      'mr-IN': `काही अडचण नाही! आमच्याकडे ६० ते ९० लाखांपर्यंत उत्तम पर्याय आहेत.`,
      'gu-IN': `કોઈ વાંધો નહીં! અમારી પાસે ૬૦ થી ૯૦ લાખ સુધીના સારા વિકલ્પો છે.`,
    },
    clarify_which_project: {
      'en-IN': `Certainly! Which project would you like to explore — Palace Heights by Rudra or NCR Monarch?`,
      'hi-IN': `जी बिल्कुल! आप किस प्रोजेक्ट के बारे में जानना चाहते हैं — Palace Heights या NCR Monarch?`,
      hinglish: `Ji bilkul! Aap kis project ke baare mein jaanna chahte hain — Palace Heights ya NCR Monarch?`,
      'mr-IN': `तुम्हाला कोणत्या प्रकल्पाबद्दल जाणून घ्यायचे आहे?`,
      'gu-IN': `તમે કયા પ્રોજેક્ટ વિશે જાણવા માંગો છો?`,
    },
    show_alternatives: {
      'en-IN': `Certainly! Apart from that, we have top verified options like Palace Heights by Rudra and NCR Monarch in Sector 1 Greater Noida West. Would you like to know their unit sizes and pricing?`,
      'hi-IN': `जी बिल्कुल! इसके अलावा हमारे पास सेक्टर 1 ग्रेटर नोएडा वेस्ट में Palace Heights by Rudra और NCR Monarch जैसे टॉप ऑप्शन्स हैं। क्या आप इनके साइज़ और प्राइस चेक करना चाहेंगे?`,
      hinglish: `Ji bilkul! Iske alawa hamare paas Sector 1 Greater Noida West mein Palace Heights by Rudra aur NCR Monarch jaise top verified options available hain. Kya aap inke unit sizes aur pricing check karna chahenge?`,
      'mr-IN': `नक्कीच! याव्यतिरिक्त आमच्याकडे इतर उत्तम प्रकल्प उपलब्ध आहेत.`,
      'gu-IN': `ચોક્કસ! આ સિવાય અમારી પાસે અન્ય ઉત્તમ પ્રોજેક્ટ્સ ઉપલબ્ધ છે.`,
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

  if (
    lastReply &&
    isSameTalk(text, lastReply) &&
    kind !== 'not_interested' &&
    kind !== 'close_ack' &&
    kind !== 'explain_why_call'
  ) {
    const advance = nextSampleStep();
    const advanced = scripts[advance][language] || scripts[advance]['hi-IN'];
    if (!isSameTalk(advanced, lastReply) && advance !== kind) {
      text = advanced;
      kind = advance;
    } else {
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

export function previewSampleText(
  agentName: string,
  language?: string,
): string {
  const lang = normalizeLanguage(language);
  const name = agentName || 'your AI agent';
  const samples: Record<AppLanguage, string> = {
    'en-IN': `Hello, this is ${name} from our real estate team. How can I help you today?`,
    'hi-IN': `नमस्ते, मैं ${name} ${ag(agentGenderFromVoice('shubh'), 'बोल रहा', 'बोल रही')} हूँ, real estate team से। आज कैसे help करूँ?`,
    hinglish: `नमस्ते, मैं ${name} बोल रहा हूँ, real estate team से। आज कैसे help करूँ?`,
    'mr-IN': `नमस्कार, मी ${name} आहे, आमच्या रिअल एस्टेट टीममधून. मी तुम्हाला कशी मदत करू शकतो?`,
    'gu-IN': `નમસ્તે, હું ${name} છું, અમારી રિયલ એસ્ટેટ ટીમ તરફથી. હું તમારી કેવી રીતે મદદ કરી શકું?`,
  };
  return samples[lang];
}

