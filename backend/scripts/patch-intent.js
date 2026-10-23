const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/calls/call-scripts.ts');
let s = fs.readFileSync(file, 'utf8');
const start = s.indexOf('function detectIntent');
const end = s.indexOf('export function previewSampleText');
if (start < 0 || end < 0) {
  console.error('markers missing');
  process.exit(1);
}

const replacement = `function detectIntent(text: string): {
  notInterested: boolean;
  callback: boolean;
  askingWhyCall: boolean;
  askingPrice: boolean;
  statingBhk: boolean;
  statingPossession: boolean;
  statingVisitDay: boolean;
  positive: boolean;
} {
  const t = text.toLowerCase();
  return {
    notInterested:
      /not interested|no thanks|don't call|do not call|wrong number|nahi chahiye|nahi chaiye|nhi chahiye|nhi chaiye|नहीं चाहिए|नाही पाहिजे|નથી જોઈએ|not looking|not searching|kuch nahi|kuch bhi nahi|khuch bhi|कुछ नहीं|कुछ भी नहीं|नहीं\\s*देख|search नहीं|नहीं\\s*कर\\s*रहा|नहीं\\s*कर\\s*रही|कोई property search नहीं|abhi nahi|अभी नहीं देख|mere liye nahi|अपने लिए नहीं|rakho phone|rakh do phone|cut (?:the )?call|mat call|band karo|hang up|phone rakh|nhi chahiye khuch|nahi chahiye kuch/i.test(
        t,
      ),
    callback:
      /callback|call back|later|baad mein|बाद में|नंतर|પછી|call later|busy|व्यस्त/i.test(
        t,
      ) &&
      !/weekend|saturday|sunday|friday|visit|rakho phone|nahi|nhi/i.test(t),
    askingWhyCall:
      /kis liye|kyun (?:call|phone)|kyu (?:call|phone)|why (?:did you |have you )?call|kya baat|kaun (?:ho|hai)|reason for (?:call|calling)|phone kyun|phone kis liye|क्यों\\s*फोन|किस\\s*लिए\\s*फोन|किस लिये/i.test(
        t,
      ),
    askingPrice:
      /(?:what(?:'s| is)? (?:the )?price|kitna|कितना|किंमत|કિંમત|pricing|emi|payment plan|cost of)/.test(
        t,
      ) || /^(?:price|cost|emi)\\b/.test(t.trim()),
    statingBhk:
      /\\b[1-5]\\s*(?:bhk|bedroom|बी\\s*एच\\s*के|बीएचके)/i.test(t) ||
      /(?:2|3|4|दो|तीन|चार)\\s*(?:bhk|बीएचके|बी\\s*एच)/i.test(t),
    statingPossession:
      /ready\\s*to\\s*move|under\\s*construction|uc\\b|रेडी|अंडर\\s*कंस्ट्रक्शन|निर्माणाधीन/i.test(
        t,
      ),
    statingVisitDay:
      /(?:next\\s*)?(?:weekend|saturday|sunday|friday|monday|tomorrow|kal|कल|शनिवार|रविवार|शुक्रवार)/i.test(
        t,
      ),
    positive:
      /interested|yes|sure|ok|okay|haan|हां|हाँ|होय|હા|tell me|go ahead|site visit|visit|arrange|book|plan kar|planning|dekh rah|search kar|looking|खोज रहा|देख रहा|प्लान कर/i.test(
        t,
      ) &&
      !/nahi|nhi|नहीं|rakho phone|kis liye|kyu|kyun/i.test(t),
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
}): { text: string; outcome: CallOutcome; facts: ConversationFacts } {
  const language = normalizeLanguage(options.language);
  const tone = normalizeTone(options.tone);
  const leadName = options.leadName || 'जी';
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
      budgetLabel: options.knownFacts?.budgetLabel,
      location: options.knownFacts?.location,
      interested: options.knownFacts?.interested,
    },
    spokenFacts,
  );
  const intent = detectIntent(current);
  const already = priorAgentAsked(options.priorTranscript);
  const lastReply = lastAgentLine(options.priorTranscript);
  const letaHi = ag(gender, 'लेता', 'लेती');
  const samajhHi = ag(gender, 'समझ गया', 'समझ गई');

  let kind: ReplyKind = 'ask_planning';
  let outcome: CallOutcome = CallOutcome.CONNECTED;

  const nextSampleStep = (): ReplyKind => {
    if (!facts.bhk) return 'ask_bhk';
    if (!facts.possession) return 'ask_possession';
    if (!facts.visitDay && !already.offeredVisit) return 'offer_visit';
    if (facts.visitDay || already.offeredVisit) return 'confirm_followup';
    return 'offer_visit';
  };

  if (intent.notInterested) {
    kind = 'not_interested';
    outcome = CallOutcome.NOT_INTERESTED;
  } else if (intent.askingWhyCall) {
    kind = 'explain_why_call';
    outcome = CallOutcome.CONNECTED;
  } else if (intent.callback && !intent.statingVisitDay) {
    kind = 'callback';
    outcome = CallOutcome.CALLBACK_REQUESTED;
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
    facts.interested = true;
    kind = nextSampleStep();
    outcome = CallOutcome.QUALIFIED;
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
    not_interested: {
      'en-IN': \`ठीक है जी, कोई बात नहीं। धन्यवाद।\`,
      'hi-IN': \`ठीक है जी, कोई बात नहीं। धन्यवाद।\`,
      hinglish: \`ठीक है जी, कोई बात नहीं। धन्यवाद।\`,
      'mr-IN': \`ठीक आहे, धन्यवाद.\`,
      'gu-IN': \`બરાબર, આભાર.\`,
    },
    callback: {
      'en-IN': \`ठीक है, सुविधा अनुसार बाद में dial कर \${letaHi} हूँ।\`,
      'hi-IN': \`ठीक है, सुविधा अनुसार बाद में dial कर \${letaHi} हूँ।\`,
      hinglish: \`ठीक है, सुविधा अनुसार बाद में dial कर \${letaHi} हूँ।\`,
      'mr-IN': \`ठीक, नंतर कॉल करतो.\`,
      'gu-IN': \`બરાબર, પછી કૉલ કરીશ.\`,
    },
    explain_why_call: {
      'en-IN': \`\${leadName} जी, आपकी property enquiry आई थी इसलिए कॉल किया — अभी देखना चालू है क्या?\`,
      'hi-IN': \`\${leadName} जी, आपकी property enquiry आई थी इसलिए कॉल किया — अभी घर/flat देखना चालू है क्या?\`,
      hinglish: \`\${leadName} जी, आपकी property enquiry आई थी इसलिए कॉल किया — अभी देखना चालू है क्या?\`,
      'mr-IN': \`\${leadName}, property enquiry आली होती म्हणून कॉल — आता पाहत आहात का?\`,
      'gu-IN': \`\${leadName}, property enquiry આવી હતી એટલે કૉલ — અત્યારે જોઈ રહ્યા છો?\`,
    },
    ask_planning: {
      'en-IN': \`\${leadName} जी, घर / flat देखना अभी चालू है क्या आपके side?\`,
      'hi-IN': \`\${leadName} जी, घर या flat देखना अभी चालू है क्या आपके side?\`,
      hinglish: \`\${leadName} जी, घर या flat देखना अभी चालू है क्या आपके side?\`,
      'mr-IN': \`\${leadName}, घर पाहणे सुरू आहे का?\`,
      'gu-IN': \`\${leadName}, ઘર જોવાનું ચાલુ છે?\`,
    },
    ask_bhk: {
      'en-IN': \`Accha — configuration कौनसी सोच रहे हो, दो bedroom या तीन?\`,
      'hi-IN': \`Accha — configuration कौनसी सोच रहे हो, दो bedroom या तीन?\`,
      hinglish: \`Accha — configuration कौनसी सोच रहे हो, दो bedroom या तीन?\`,
      'mr-IN': \`छान — दोन bedroom की तीन?\`,
      'gu-IN': \`સરસ — બે bedroom કે ત્રણ?\`,
    },
    ask_possession: {
      'en-IN': \`\${samajhHi} — possession कब चाहिए, तुरंत move-in या thoda wait chalega construction?\`,
      'hi-IN': \`\${samajhHi} — possession कब चाहिए, तुरंत move-in या थोड़ा wait चलेगा construction में?\`,
      hinglish: \`\${samajhHi} — possession कब चाहिए, तुरंत move-in या थोड़ा wait चलेगा construction में?\`,
      'mr-IN': \`समजलो — लगेच move-in की थोडा वाट construction?\`,
      'gu-IN': \`સમજાયું — તરત move-in કે થોડું wait construction?\`,
    },
    offer_visit: {
      'en-IN': \`ठीक है, \${bhk} \${possessionLabel} match कर सकता हूँ। Site कब देख पाओगे?\`,
      'hi-IN': \`ठीक है, \${bhk} \${possessionLabel} side match कर \${letaHi === 'लेती' ? 'सकती' : 'सकता'} हूँ। Site कब देख पाओगे?\`,
      hinglish: \`ठीक है, \${bhk} \${possessionLabel} side match हो सकता है। Site कब देख पाओगे?\`,
      'mr-IN': \`ठीक, \${bhk} match होईल. Site कधी बघाल?\`,
      'gu-IN': \`બરાબર, \${bhk} match થઈ શકે. Site ક્યારે જોશો?\`,
    },
    confirm_followup: {
      'en-IN': \`\${visitDay} note कर लिया — visit से पहले एक short reminder call कर \${letaHi} हूँ।\`,
      'hi-IN': \`\${visitDay} note कर लिया — visit से पहले एक short reminder call कर \${letaHi} हूँ।\`,
      hinglish: \`\${visitDay} note कर लिया — visit से पहले एक short reminder call कर \${letaHi} हूँ।\`,
      'mr-IN': \`\${visitDay} नोंदले — भेटी आधी reminder कॉल.\`,
      'gu-IN': \`\${visitDay} નોંધ્યું — visit પહેલાં reminder કૉલ.\`,
    },
    price_soft: {
      'en-IN': \`Rate unit pe depend karta hai — pehle configuration clear kar lein, 2 ya 3 bedroom?\`,
      'hi-IN': \`Rate unit पर depend करता है — पहले configuration clear कर लें, दो या तीन bedroom?\`,
      hinglish: \`Rate unit पर depend करता है — पहले configuration clear कर लें, दो या तीन bedroom?\`,
      'mr-IN': \`दर युनिटवर — आधी 2 की 3 bedroom?\`,
      'gu-IN': \`રેટ યુનિટ પર — પહેલાં 2 કે 3 bedroom?\`,
    },
    default: {
      'en-IN': \`बताइए, अभी property देखना आपके mind में है?\`,
      'hi-IN': \`बताइए, अभी property देखना आपके mind में है?\`,
      hinglish: \`बताइए, अभी property देखना आपके mind में है?\`,
      'mr-IN': \`सांगा, आता property पाहत आहात का?\`,
      'gu-IN': \`કહો, અત્યારે property જોઈ રહ્યા છો?\`,
    },
  };

  let text = scripts[kind][language] || scripts[kind]['hi-IN'];

  if (
    lastReply &&
    isSameTalk(text, lastReply) &&
    kind !== 'not_interested' &&
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

`;

// The replacement above used escaped template literals for the write script.
// Convert \` and \${ back to real template literals for TypeScript source.
const fixed = replacement
  .replace(/\\`/g, '`')
  .replace(/\\\$\{/g, '${')
  .replace(/\\\\s\*/g, '\\s*')
  .replace(/\\\\b/g, '\\b');

s = s.slice(0, start) + fixed + s.slice(end);
fs.writeFileSync(file, s);
console.log('patched call-scripts.ts');
