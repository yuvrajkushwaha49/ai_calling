import { ag, normalizeTone, resolveSpeechGender } from './call-scripts';
import type { AppLanguage, AppTone, SpeechGender } from './call-scripts';

/** Opening styles — short, natural phone openers. */
export type OpenerStyle =
  | 'soft_time'
  | 'project_hook'
  | 'warm_checkin'
  | 'curiosity'
  | 'availability';

export const OPENER_STYLES: OpenerStyle[] = [
  'soft_time',
  'project_hook',
  'warm_checkin',
  'curiosity',
  'availability',
];

export type OpenerStat = { uses: number; wins: number };
export type OpenerLearning = {
  styles: Partial<Record<OpenerStyle, OpenerStat>>;
  preferredStyle?: OpenerStyle;
  /** Avoid sounding identical call-after-call */
  lastStyle?: OpenerStyle;
};

function greetingNowIst(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/** Prefer proven openers; explore often so openings stay fresh. */
export function pickOpenerStyle(learning?: OpenerLearning | null): OpenerStyle {
  const last = learning?.lastStyle;
  const avoidSame = (style: OpenerStyle) =>
    !last || style !== last || OPENER_STYLES.length < 2;

  // Explore more often so learning does not lock one greeting forever
  const explore = Math.random() < 0.4;
  if (explore || !learning?.styles || !Object.keys(learning.styles).length) {
    const pool = OPENER_STYLES.filter(avoidSame);
    return pickOne(pool.length ? pool : OPENER_STYLES);
  }

  // Softmax-ish: score styles, then sample (not always take #1)
  const scored = OPENER_STYLES.map((style) => {
    const s = learning.styles[style] || { uses: 0, wins: 0 };
    const score = (s.wins + 1) / (s.uses + 2);
    return { style, score };
  }).filter((x) => avoidSame(x.style));

  const list = scored.length ? scored : OPENER_STYLES.map((style) => ({ style, score: 1 }));
  const total = list.reduce((a, b) => a + b.score, 0);
  let r = Math.random() * total;
  for (const item of list) {
    r -= item.score;
    if (r <= 0) return item.style;
  }
  return list[0]!.style;
}

export function parseOpenerLearning(raw: unknown): OpenerLearning {
  if (!raw || typeof raw !== 'object') return { styles: {} };
  const obj = raw as Record<string, unknown>;
  const nested =
    obj.openerLearning && typeof obj.openerLearning === 'object'
      ? (obj.openerLearning as Record<string, unknown>)
      : obj;
  const stylesRaw =
    nested.styles && typeof nested.styles === 'object'
      ? (nested.styles as Record<string, unknown>)
      : {};
  const styles: OpenerLearning['styles'] = {};
  for (const key of OPENER_STYLES) {
    const s = stylesRaw[key];
    if (s && typeof s === 'object') {
      const uses = Number((s as OpenerStat).uses) || 0;
      const wins = Number((s as OpenerStat).wins) || 0;
      styles[key] = { uses, wins };
    }
  }
  const preferred = nested.preferredStyle;
  const last = nested.lastStyle;
  return {
    styles,
    preferredStyle:
      typeof preferred === 'string' &&
      OPENER_STYLES.includes(preferred as OpenerStyle)
        ? (preferred as OpenerStyle)
        : undefined,
    lastStyle:
      typeof last === 'string' && OPENER_STYLES.includes(last as OpenerStyle)
        ? (last as OpenerStyle)
        : undefined,
  };
}

export function bestOpenerStyle(learning: OpenerLearning): OpenerStyle {
  let best: OpenerStyle = 'soft_time';
  let bestScore = -1;
  for (const style of OPENER_STYLES) {
    const s = learning.styles[style] || { uses: 0, wins: 0 };
    if (s.uses < 2) continue;
    const score = s.wins / s.uses;
    if (score > bestScore) {
      bestScore = score;
      best = style;
    }
  }
  return best;
}

/** True when a human tip is meant as the call opening / greeting style. */
export function isOpeningStyleTip(note: string): boolean {
  const t = String(note || '').toLowerCase();
  if (t.length < 35) return false;
  const hasGreeting =
    /namaste|नमस्ते|\bhi\b|बोल रही|बोल रहा|enquiry|enquir/.test(t);
  const hasAsk =
    /दो मिनट|do minute|mil sakta|मिल सकता|time|baat|conversation|opener|starting|shuru/.test(
      t,
    );
  return hasGreeting && hasAsk;
}

/**
 * Turn a human opening example into a live greeting for this lead.
 * Keeps the tip's flow; swaps name / agent / company / project.
 */
export function personalizeOpeningTip(
  tipNote: string,
  ctx: {
    leadName: string;
    agentName: string;
    companyHi: string;
    projectHi: string;
    bolHi: string;
    hasProject: boolean;
  },
): string {
  let t = String(tipNote || '')
    .replace(/\|/g, ' ')
    .replace(/,?\s*aisa\s+kh?uch\s+\w*\s*conve?r?sation\s+rakho\.?/gi, '')
    .replace(/,?\s*aisa\s+kh?uch\s+conversation\s+rakho\.?/gi, '')
    .replace(/,?\s*aisa\s+hi\s+(rakho|bolo|start|shuru).*/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,\s]+$/g, '');

  const leadFirst =
    (ctx.leadName || '')
      .trim()
      .replace(/\s*जी\s*$/u, '')
      .replace(/\s+ji$/i, '')
      .split(/\s+/)[0] || 'जी';

  t = t.replace(
    /^(Namaste|Hi|नमस्ते|सादर\s*Hi)\s+[^\s,]+(\s*जी)?/i,
    (_m, g: string, ji?: string) => `${g} ${leadFirst}${ji || ' जी'}`,
  );

  t = t.replace(/\bNeha\b/gi, ctx.agentName);
  t = t.replace(/\bAria\b/gi, ctx.agentName);
  t = t.replace(/बोल रही हूँ|बोल रहा हूँ/g, `${ctx.bolHi} हूँ`);
  t = t.replace(/bol rahi hoon|bol raha hoon/gi, `${ctx.bolHi} हूँ`);
  t = t.replace(/साया\s*ग्रुप|Saya\s*Group/gi, ctx.companyHi);

  if (ctx.hasProject && ctx.projectHi) {
    t = t.replace(
      /साया\s*राज\s*नगर\s*एक्सटेंशन|Sayaa?\s*Raj\s*Nagar\s*Extension/gi,
      ctx.projectHi,
    );
  }

  t = t.replace(/दो मिनट मिल sakta hai aapka/gi, 'दो मिनट baat kr सकते हैं क्या');
  t = t.replace(/मिल\s*sakta\s*hai\s*aapka/gi, 'baat kr सकते हैं क्या');
  t = t.replace(/दो मिनट मिल सकते हैं( क्या)?/gi, 'दो मिनट baat kr सकते हैं क्या');
  t = t.replace(/दो मिनट मिल सकते हैं\?/gi, 'दो मिनट baat kr सकते हैं क्या');
  // Normalize any "do minute free / mil sakte" ask to preferred closer
  t = t.replace(
    /[—\-–]?\s*(दो मिनट|do minute).{0,40}(\?|क्या)?\s*$/i,
    ' दो मिनट baat kr सकते हैं क्या',
  );

  return t.replace(/\s+/g, ' ').trim();
}

/** First name only — templates add "जी" themselves (avoids "जी जी"). */
function firstName(name: string) {
  const n = (name || '')
    .trim()
    .replace(/\s*जी\s*$/u, '')
    .replace(/\s+ji$/i, '');
  const first = (n.split(/\s+/)[0] || '').trim();
  return first || 'जी';
}

/**
 * Phone-friendly agent first name.
 * Strips "AI / Assistant / Real Estate Agent" style CRM labels.
 */
export function speakAgentName(raw?: string | null): string {
  let n = String(raw || '').trim();
  if (!n) return 'नेहा';
  // "Aria - Real Estate Assistant" → Aria
  n = n.split(/[-–—|:/]/)[0].trim();
  n = n
    .replace(
      /\b(ai|a\.i\.|assistant|agent|bot|real\s*estate|calling|voice|crm)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  const first = (n.split(/\s+/)[0] || '').trim();
  if (!first || /^(real|estate|ai|the|your)$/i.test(first)) {
    return 'नेहा';
  }
  return first;
}

function speakProjectName(projectRaw: string, _language: AppLanguage): string {
  if (/saya\s*raj/i.test(projectRaw) || /साया/.test(projectRaw)) {
    // Always Devanagari for clear TTS on Indian voices
    return 'साया राज नगर एक्सटेंशन';
  }
  return projectRaw;
}

function speakCompanyName(raw: string, language: AppLanguage): string {
  const t = (raw || '').trim();
  if (!t) return language === 'en-IN' ? 'Saya Group' : 'साया ग्रुप';
  if (/^saya\s*group$/i.test(t) || /साया\s*ग्रुप/.test(t)) {
    return language === 'en-IN' ? 'Saya Group' : 'साया ग्रुप';
  }
  if (/^saya$/i.test(t)) {
    return language === 'en-IN' ? 'Saya Group' : 'साया ग्रुप';
  }
  return t;
}

export function buildVariedOpening(options: {
  leadName: string;
  agentName: string;
  projectName?: string | null;
  companyName?: string | null;
  builderName?: string | null;
  language?: string;
  tone?: string;
  agentVoice?: string;
  style?: OpenerStyle;
  learning?: OpenerLearning | null;
  /** When false, open without naming a project — discovery call */
  hasLinkedProject?: boolean;
  /** Human tip that describes preferred opening — used when present */
  openingTip?: string | null;
}): { text: string; style: OpenerStyle; language: AppLanguage } {
  // Sales rule: always open in Hindi; later turns mirror the customer.
  const language: AppLanguage = 'hi-IN';
  void options.language;
  const tone = normalizeTone(options.tone) as AppTone;
  const name = firstName(options.leadName || 'जी');
  const agent = speakAgentName(options.agentName);
  const hasProject = options.hasLinkedProject !== false && Boolean(options.projectName?.trim());
  const projectRaw = options.projectName?.trim() || 'हमारे प्रोजेक्ट';
  const project = speakProjectName(projectRaw, language);

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  let company = options.companyName?.trim() || '';
  const builder = options.builderName?.trim() || '';
  // Company same as project (Saya…) → use builder "Saya Group"
  if (
    hasProject &&
    (!company ||
      norm(company) === norm(projectRaw) ||
      norm(company).includes(norm(projectRaw)) ||
      norm(projectRaw).includes(norm(company)))
  ) {
    company = builder || company || 'Saya Group';
  }
  if (!company) company = builder || 'Saya Group';
  const companyHi = speakCompanyName(company || 'Saya Group', 'hi-IN');

  const gender: SpeechGender = resolveSpeechGender({
    agentName: options.agentName || agent,
    agentVoice: options.agentVoice,
  });
  const bolHi = ag(gender, 'बोल रहा', 'बोल रही');
  const style = options.style || pickOpenerStyle(options.learning);
  const greet = greetingNowIst();

  // Approved human tip for opening → prefer that flow (personalized)
  if (options.openingTip?.trim()) {
    const fromTip = personalizeOpeningTip(options.openingTip, {
      leadName: options.leadName,
      agentName: agent,
      companyHi,
      projectHi: project,
      bolHi,
      hasProject,
    });
    if (fromTip.length >= 25) {
      let text = fromTip;
      if (tone === 'formal') {
        text = text.replace(/^(Hi|Namaste|नमस्ते) /, 'सादर $1 ');
      }
      return { text, style: 'soft_time', language };
    }
  }

  const withProject: Record<OpenerStyle, string[]> = {
    soft_time: [
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। ${project} की enquiry aayi thi… दो मिनट baat kr सकते हैं क्या`,
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। ${project} की enquiry aayi thi aapki — दो मिनट baat kr सकते हैं क्या?`,
    ],
    project_hook: [
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। ${project} की enquiry aayi thi… दो मिनट baat kr सकते हैं क्या`,
      `${name} जी, ${greet}. ${agent} ${companyHi} से — ${project} की थोड़ी जानकारी share करनी थी।`,
    ],
    warm_checkin: [
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। ${project} की enquiry aayi thi… दो मिनट baat kr सकते हैं क्या`,
      `${name} जी, ${greet}. ${agent} ${bolHi} हूँ ${companyHi} से — कैसे हैं आप?`,
    ],
    curiosity: [
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। ${project} की enquiry aayi thi… दो मिनट baat kr सकते हैं क्या`,
      `${name} जी, ${agent} ${companyHi} से। ${project} में दो bedroom soch रहे हो या तीन?`,
    ],
    availability: [
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। ${project} की enquiry aayi thi… दो मिनट baat kr सकते हैं क्या`,
      `${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। ${project} ke liye ek chhoti si call — abhi theek rahega?`,
    ],
  };

  const noProject: Record<OpenerStyle, string[]> = {
    soft_time: [
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। Property enquiry aayi thi… दो मिनट baat kr सकते हैं क्या`,
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। Aapki property enquiry aayi thi — दो मिनट baat kr सकते हैं क्या?`,
    ],
    project_hook: [
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। Property enquiry aayi thi… दो मिनट baat kr सकते हैं क्या`,
      `${name} जी, ${greet}. ${agent} ${companyHi} से — residential options ki baat karni thi.`,
    ],
    warm_checkin: [
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। Property enquiry aayi thi… दो मिनट baat kr सकते हैं क्या`,
      `${name} जी, ${greet}. ${agent} ${bolHi} हूँ ${companyHi} से — कैसे हैं आप?`,
    ],
    curiosity: [
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। Property enquiry aayi thi… दो मिनट baat kr सकते हैं क्या`,
      `${name} जी, ${agent} ${companyHi} से। Flat dekh rahe ho ya ghar?`,
    ],
    availability: [
      `Namaste ${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। Property enquiry aayi thi… दो मिनट baat kr सकते हैं क्या`,
      `${name} जी, ${agent} ${bolHi} हूँ ${companyHi} से। Chhoti si property call — abhi theek?`,
    ],
  };

  const pool = (hasProject ? withProject : noProject)[style];
  let text = pickOne(pool);
  if (tone === 'formal') {
    text = text.replace(/^(Hi|Namaste) /, 'सादर $1 ');
  }
  return { text, style, language };
}
