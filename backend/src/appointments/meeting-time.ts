/**
 * Parse meeting date/time from customer speech (Hindi + English).
 * Returns Asia/Kolkata local date + display time.
 */

export type ParsedMeetingSlot = {
  /** YYYY-MM-DD in IST */
  date: string;
  /** Display time e.g. "11:00 AM" */
  time: string;
  /** ISO start for Google Calendar (with offset +05:30) */
  startIso: string;
  /** ISO end (+1 hour default) */
  endIso: string;
  label: string;
  /** True if time was explicitly specified by customer */
  isTimeExplicit?: boolean;
  /** True if date was explicitly specified by customer */
  isDateExplicit?: boolean;
};

export type ParsedCallbackSlot = {
  targetDate: string; // YYYY-MM-DD
  targetTime: string; // e.g. "05:00 PM"
  targetIso: string;  // ISO timestamp with +05:30 offset
  label: string;      // e.g. "Kal shaam 5:00 PM"
  relativeDescription: string;
};

/**
 * Detect generic acknowledgements that DO NOT constitute meeting date/time confirmation.
 * Customer saying "theek hai", "haan", "accha", "sahi hai" must never auto-book a slot.
 */
export function isGenericAcknowledgement(text: string): boolean {
  const t = (text || '').trim();
  return /^(?:theek\s*hai|theek\s*h|theek|thik|thik\s*hai|haan|ha|haan\s*ji|haanji|han\s*ji|hanji|achha|accha|acha|sahi\s*hai|sahi\s*h|sahi|ok|okay|sure|chalega|chlega|done|bilkul|hmmm|hmm|yep|yeah|yes|ठीक\s*है|ठीक|हाँ|हां|हाँ\s*जी|अच्छा|सही\s*है|सही|बिल्कुल)[!.,\s]*$/i.test(t);
}

/**
 * Detect whether the customer explicitly confirmed a scheduled meeting slot.
 */
export function isExplicitMeetingConfirmation(text: string): boolean {
  const t = (text || '').toLowerCase().trim();
  return (
    /(?:confirm|final|kar do|kar dijiye|book kar|book kar do|book kar dijiye|fix kar|fix kar do|rakh do|rakh dijiye|कंफर्म|फाइनल|बुक कर|फिक्स कर)/i.test(t) ||
    (/(?:haan|ha|yes|sure|done|theek|bilkul)\b/i.test(t) && /(?:confirm|book|visit|slot|meeting|time|chalega|आऊंगा|आएंगे)/i.test(t))
  );
}

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  ravivar: 0,
  रविवार: 0,
  monday: 1,
  mon: 1,
  somvar: 1,
  सोमवार: 1,
  tuesday: 2,
  tue: 2,
  mangalvar: 2,
  मंगलवार: 2,
  wednesday: 3,
  wed: 3,
  budhvar: 3,
  बुधवार: 3,
  thursday: 4,
  thu: 4,
  guruvar: 4,
  गुरुवार: 4,
  friday: 5,
  fri: 5,
  shukravar: 5,
  शुक्रवार: 5,
  saturday: 6,
  sat: 6,
  shanivar: 6,
  शनिवार: 6,
};

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  जनवरी: 0,
  feb: 1,
  february: 1,
  फरवरी: 1,
  mar: 2,
  march: 2,
  मार्च: 2,
  apr: 3,
  april: 3,
  अप्रैल: 3,
  may: 4,
  मई: 4,
  jun: 5,
  june: 5,
  जून: 5,
  jul: 6,
  july: 6,
  जुलाई: 6,
  aug: 7,
  august: 7,
  अगस्त: 7,
  sep: 8,
  sept: 8,
  september: 8,
  सितंबर: 8,
  सितम्बर: 8,
  oct: 9,
  october: 9,
  अक्टूबर: 9,
  nov: 10,
  november: 10,
  नवंबर: 10,
  नवम्बर: 10,
  dec: 11,
  december: 11,
  दिसंबर: 11,
  दिसम्बर: 11,
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatDisplayTime(hour24: number, minute: number): string {
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const h12 = hour24 % 12 || 12;
  return `${h12}:${pad(minute)} ${ampm}`;
}

function toIstParts(d: Date) {
  // Interpret as IST wall-clock by formatting in Asia/Kolkata
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour === '24' ? '0' : parts.hour),
    min: Number(parts.minute),
  };
}

function nowIst(): { y: number; m: number; d: number; h: number; min: number; dow: number } {
  const n = new Date();
  const p = toIstParts(n);
  const dow = new Date(
    Date.UTC(p.y, p.m - 1, p.d, 6, 30),
  ).getUTCDay(); // rough; better:
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(n);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { ...p, dow: map[weekday] ?? 0 };
}

function buildSlot(
  y: number,
  monthIndex: number,
  day: number,
  hour24: number,
  minute: number,
  options?: { isTimeExplicit?: boolean; isDateExplicit?: boolean },
): ParsedMeetingSlot {
  const date = `${y}-${pad(monthIndex + 1)}-${pad(day)}`;
  const time = formatDisplayTime(hour24, minute);
  const startIso = `${date}T${pad(hour24)}:${pad(minute)}:00+05:30`;
  let endH = hour24 + 1;
  let endD = day;
  let endM = monthIndex;
  let endY = y;
  if (endH >= 24) {
    endH -= 24;
    const next = new Date(Date.UTC(y, monthIndex, day + 1));
    endY = next.getUTCFullYear();
    endM = next.getUTCMonth();
    endD = next.getUTCDate();
  }
  const endDate = `${endY}-${pad(endM + 1)}-${pad(endD)}`;
  const endIso = `${endDate}T${pad(endH)}:${pad(minute)}:00+05:30`;
  return {
    date,
    time,
    startIso,
    endIso,
    label: `${date} ${time}`,
    isTimeExplicit: options?.isTimeExplicit ?? false,
    isDateExplicit: options?.isDateExplicit ?? false,
  };
}

function nextWeekday(fromDow: number, targetDow: number, base: ReturnType<typeof nowIst>) {
  let add = (targetDow - fromDow + 7) % 7;
  if (add === 0) add = 7; // next occurrence, not today
  const dt = new Date(Date.UTC(base.y, base.m - 1, base.d + add));
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
    monthIndex: dt.getUTCMonth(),
  };
}

function parseHourMinute(raw: string): { hour24: number; minute: number } | null {
  const t = raw.toLowerCase().trim();

  // Prefer explicit am/pm so "20 August 3 pm" does not take "20" as the hour
  let m = t.match(
    /(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/i,
  );
  if (m) {
    let hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    const ap = m[3].replace(/\./g, '').toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour24: hour, minute };
    }
  }

  // "4 baje" / "11 बजे" / common typos "6 bje"
  m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(?:baje|bajey|bjay|bje|बजे)/i);
  if (m) {
    let hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    if (/subah|morning|सुबह/i.test(t)) {
      /* keep morning hour */
    } else if (/shaam|evening|शाम|raat|रात/i.test(t)) {
      if (hour < 12) hour += 12;
    } else if (hour >= 1 && hour <= 7) {
      // Bare evening-ish hours without am/pm → assume PM
      hour += 12;
    }
    if (hour >= 0 && hour <= 23) return { hour24: hour, minute };
  }

  // "shaam 6" / "6 shaam" without baje word
  m = t.match(
    /(?:shaam|evening|शाम|raat|रात)\s*(?:me|mein|ko|pe|par)?\s*(\d{1,2})(?::(\d{2}))?/i,
  ) || t.match(/(\d{1,2})(?::(\d{2}))?\s*(?:ko\s+)?(?:shaam|evening|शाम)/i);
  if (m) {
    let hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    if (hour < 12) hour += 12;
    if (hour >= 0 && hour <= 23) return { hour24: hour, minute };
  }

  // Bare "11:30" (no am/pm) — only if not part of a date like 20/08
  m = t.match(/(?:^|[^\d/])(\d{1,2}):(\d{2})(?:\s|$)/);
  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour >= 0 && hour <= 23) return { hour24: hour, minute };
  }

  if (/subah|morning|सुबह/i.test(t)) return { hour24: 11, minute: 0 };
  if (/dopahar|afternoon|दोपहर/i.test(t)) return { hour24: 14, minute: 0 };
  if (/shaam|evening|शाम/i.test(t)) return { hour24: 17, minute: 0 };
  if (/raat|night|रात/i.test(t)) return { hour24: 20, minute: 0 };

  return null;
}

/** Normalize common relative-day misspellings before matching. */
function normalizeRelativeDayText(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/tom+or+ow/g, 'tomorrow')
    .replace(/day\s+after\s+tom+or+ow/g, 'day after tomorrow');
}

const DAY_AFTER_RE =
  /\bparso\b|परसों|\bday\s+after\s+tomorrow\b/i;
/** Plain tomorrow/kal — must NOT match inside "day after tomorrow". */
const TOMORROW_RE =
  /(?<!day\s+after\s+)(?:\b(?:kal|tomorrow|tmrw|tomoro)\b|कल)/i;
const TODAY_RE = /\b(?:aaj|ajj|aj|today|tdy)\b|आज/i;
const WEEKEND_RE = /\b(?:weekend|weekends)\b|वीकेंड|हफ्ते\s*के\s*अंत/i;

function isSlotStillAhead(slot: ParsedMeetingSlot, cushionMs = 5 * 60_000): boolean {
  const ms = Date.parse(slot.startIso);
  return Number.isFinite(ms) && ms > Date.now() + cushionMs;
}

function getWeekendSlot(
  base: ReturnType<typeof nowIst>,
  hm: { hour24: number; minute: number },
  options?: { isTimeExplicit?: boolean; isDateExplicit?: boolean },
): ParsedMeetingSlot {
  if (base.dow === 6) {
    // Today is Saturday
    const today = addIstDays(base, 0, hm.hour24, hm.minute, options);
    if (isSlotStillAhead(today)) return today;
    return addIstDays(base, 1, hm.hour24, hm.minute, options); // Sunday
  }
  if (base.dow === 0) {
    // Today is Sunday
    const today = addIstDays(base, 0, hm.hour24, hm.minute, options);
    if (isSlotStillAhead(today)) return today;
    const nextSat = nextWeekday(0, 6, base);
    return buildSlot(nextSat.y, nextSat.monthIndex, nextSat.d, hm.hour24, hm.minute, options);
  }
  // Monday to Friday -> upcoming Saturday
  const sat = nextWeekday(base.dow, 6, base);
  return buildSlot(sat.y, sat.monthIndex, sat.d, hm.hour24, hm.minute, options);
}

/** Prefer today if that time is still upcoming; otherwise tomorrow. */
function defaultDayForTimeOnly(
  base: ReturnType<typeof nowIst>,
  hour24: number,
  minute: number,
  options?: { isTimeExplicit?: boolean; isDateExplicit?: boolean },
): ParsedMeetingSlot {
  const today = addIstDays(base, 0, hour24, minute, options);
  if (isSlotStillAhead(today)) return today;
  return addIstDays(base, 1, hour24, minute, options);
}

function addIstDays(
  base: ReturnType<typeof nowIst>,
  days: number,
  hour24: number,
  minute: number,
  options?: { isTimeExplicit?: boolean; isDateExplicit?: boolean },
): ParsedMeetingSlot {
  const dt = new Date(Date.UTC(base.y, base.m - 1, base.d + days));
  return buildSlot(
    dt.getUTCFullYear(),
    dt.getUTCMonth(),
    dt.getUTCDate(),
    hour24,
    minute,
    options,
  );
}

/** True if text looks like scheduling a meeting / visit / callback with time. */
export function looksLikeMeetingRequest(text: string): boolean {
  const t = normalizeRelativeDayText(text || '');
  return /meeting|meet|appointment|visit|site\s*visit|callback|call back|slot|book|fix|weekend|weekends|वीकेंड|हफ्ते\s*के\s*अंत|सैंपल|sample|विजिट|साइट|कल|tomorrow|parso|परसों|day after tomorrow|aaj|today|saturday|sunday|monday|tuesday|wednesday|thursday|friday|शनिवार|रविवार|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|baje|bajey|bje|बजे|\d{1,2}\s*(am|pm|:)|morning|evening|subah|shaam|सुबह|शाम|dekhne|aaunga|aate hain/i.test(
    t,
  );
}

/**
 * Extract a concrete meeting slot from customer text (+ optional prior for context).
 */
export function parseMeetingSlot(
  userMessage: string,
  priorTranscript?: string | null,
  options?: { requireExplicitTime?: boolean },
): ParsedMeetingSlot | null {
  const text = normalizeRelativeDayText(
    `${priorTranscript || ''}\n${userMessage || ''}`.trim(),
  );
  if (!text) return null;

  const focus = normalizeRelativeDayText(userMessage || text);
  const priorTail = normalizeRelativeDayText(
    (priorTranscript || '').split('\n').slice(-8).join('\n'),
  );

  // If customer explicitly declined or said no/not interested, do not book
  // (unless they are correcting a day/time, e.g. "Saturday nahi, Sunday 4 baje", "kal nahi parso")
  const isCorrection = /(?:nahi|nahin)\s*,?\s*(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|रविवार|शनिवार|kal|parso|कल|परसों|shaam|subah|शाम|सुबह|\d{1,2}\s*(?:baje|बजे|am|pm)|balki|lekin)/i.test(focus);
  if (
    !isCorrection &&
    /(?:nahi|nahin|no\b|not\s+interested|nahi\s+chahiye|cancel|manna)/i.test(focus) &&
    !/(?:kyun|kyu)\s+nahi/i.test(focus)
  ) {
    return null;
  }

  // If the focus message is purely a generic acknowledgement ("theek hai", "haan", "accha", "sahi hai"):
  // NEVER infer or create a default appointment time from generic acknowledgement!
  if (isGenericAcknowledgement(focus)) {
    return null;
  }

  const base = nowIst();

  const explicitHm = parseHourMinute(focus) || parseHourMinute(text.slice(-120));
  const isTimeExplicit = Boolean(explicitHm);

  if (options?.requireExplicitTime && !explicitHm) {
    return null;
  }

  // Find explicit time or provisional 11:00 AM if meeting intent is explicitly in focus
  const hm =
    explicitHm ||
    (looksLikeMeetingRequest(focus) ? { hour24: 11, minute: 0 } : null);

  if (!hm) return null;

  const hasExplicitDateInFocus =
    DAY_AFTER_RE.test(focus) ||
    TODAY_RE.test(focus) ||
    TOMORROW_RE.test(focus) ||
    WEEKEND_RE.test(focus) ||
    Object.keys(DAY_MAP).some((name) =>
      /[\u0900-\u097F]/.test(name)
        ? new RegExp(name, 'i').test(focus)
        : new RegExp(`(?:^|\\s)${name}(?:\\s|$)`, 'i').test(focus),
    );

  const slotOptions = {
    isTimeExplicit,
    isDateExplicit: hasExplicitDateInFocus,
  };

  // Absolute date in the latest message first (before weekday from prior)
  let m = focus.match(
    /(\d{1,2})(?:st|nd|rd|th)?[\s\/\-]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितं?बर|अक्टूबर|नव(?:ं|म्)बर|दिसं?बर)(?:[\s\/\-]+(\d{2,4}))?/i,
  );
  if (m) {
    const day = Number(m[1]);
    const monthKey = m[2].toLowerCase();
    const monthIndex =
      MONTH_MAP[monthKey] ??
      MONTH_MAP[monthKey.slice(0, 3)] ??
      MONTH_MAP[m[2]];
    let year = m[3] ? Number(m[3]) : base.y;
    if (year < 100) year += 2000;
    if (monthIndex == null || Number.isNaN(monthIndex)) return null;
    const candidate = buildSlot(year, monthIndex, day, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
    const candMs = Date.parse(candidate.startIso);
    if (candMs < Date.now() - 60_000 && !m[3]) {
      return buildSlot(year + 1, monthIndex, day, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
    }
    return candidate;
  }

  m = focus.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (m && !/baje|बजे|am|pm/i.test(m[0])) {
    const day = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    let year = m[3] ? Number(m[3]) : base.y;
    if (year < 100) year += 2000;
    if (monthIndex >= 0 && monthIndex <= 11) {
      return buildSlot(year, monthIndex, day, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
    }
  }

  // Relative days — LATEST user line wins (agent "shaam ya kal?" must not force kal)
  const priorIsChoiceOffer =
    /(?:shaam|शाम|evening|aaj|आज).{0,40}(?:ya|या|or|phir|फिर).{0,20}(?:kal|कल|tomorrow)/i.test(
      priorTail,
    ) ||
    /(?:kal|कल|tomorrow).{0,40}(?:ya|या|or|phir|फिर).{0,20}(?:shaam|शाम|evening|aaj|आज)/i.test(
      priorTail,
    );

  const focusPicksTomorrow =
    TOMORROW_RE.test(focus) && !/(?:shaam|शाम|evening|aaj|आज)/i.test(focus);
  const focusPicksTodayEvening =
    /(?:shaam|शाम|evening)/i.test(focus) &&
    !TOMORROW_RE.test(focus) &&
    !DAY_AFTER_RE.test(focus);
  const focusPicksToday =
    TODAY_RE.test(focus) || focusPicksTodayEvening;

  if (DAY_AFTER_RE.test(focus)) {
    return addIstDays(base, 2, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
  }
  if (focusPicksToday) {
    const today = addIstDays(base, 0, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
    if (isSlotStillAhead(today)) return today;
    return addIstDays(base, 1, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
  }
  if (focusPicksTomorrow) {
    return addIstDays(base, 1, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
  }

  // Weekday in latest message
  for (const [name, dow] of Object.entries(DAY_MAP)) {
    const re = /[\u0900-\u097F]/.test(name)
      ? new RegExp(name, 'i')
      : new RegExp(`(?:^|\\s)${name}(?:\\s|$)`, 'i');
    if (re.test(focus)) {
      if (base.dow === dow) {
        const todaySlot = addIstDays(base, 0, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
        if (isSlotStillAhead(todaySlot)) return todaySlot;
      }
      const next = nextWeekday(base.dow, dow, base);
      return buildSlot(next.y, next.monthIndex, next.d, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
    }
  }

  // Weekend in latest message
  if (WEEKEND_RE.test(focus)) {
    return getWeekendSlot(base, hm, { ...slotOptions, isDateExplicit: true });
  }

  // Prior cues — skip if agent only offered a choice (shaam ya kal)
  if (!priorIsChoiceOffer) {
    if (DAY_AFTER_RE.test(priorTail)) {
      return addIstDays(base, 2, hm.hour24, hm.minute, slotOptions);
    }
    if (TODAY_RE.test(priorTail)) {
      const today = addIstDays(base, 0, hm.hour24, hm.minute, slotOptions);
      if (isSlotStillAhead(today)) return today;
      return addIstDays(base, 1, hm.hour24, hm.minute, slotOptions);
    }
    if (TOMORROW_RE.test(priorTail)) {
      return addIstDays(base, 1, hm.hour24, hm.minute, slotOptions);
    }
    if (
      WEEKEND_RE.test(priorTail) &&
      (looksLikeMeetingRequest(focus) || isExplicitMeetingConfirmation(focus) || /visit|aaunga|aate|aayenge|book|chalega/i.test(focus))
    ) {
      return getWeekendSlot(base, hm, slotOptions);
    }
    for (const [name, dow] of Object.entries(DAY_MAP)) {
      const re = /[\u0900-\u097F]/.test(name)
        ? new RegExp(name, 'i')
        : new RegExp(`(?:^|\\s)${name}(?:\\s|$)`, 'i');
      if (re.test(priorTail.slice(-400))) {
        const next = nextWeekday(base.dow, dow, base);
        return buildSlot(next.y, next.monthIndex, next.d, hm.hour24, hm.minute, slotOptions);
      }
    }
  }

  // Time-only confirm — use prior day cue only when not a choice-offer
  if (
    hm &&
    /baje|bje|morning|evening|subah|shaam|सुबह|शाम|am|pm|\d/i.test(focus)
  ) {
    const prior = priorTail;
    if (!priorIsChoiceOffer) {
      if (DAY_AFTER_RE.test(prior)) {
        return addIstDays(base, 2, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
      }
      if (TODAY_RE.test(prior)) {
        const today = addIstDays(base, 0, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
        return isSlotStillAhead(today)
          ? today
          : addIstDays(base, 1, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
      }
      if (TOMORROW_RE.test(prior)) {
        return addIstDays(base, 1, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
      }
      if (WEEKEND_RE.test(prior)) {
        return getWeekendSlot(base, hm, { ...slotOptions, isDateExplicit: true });
      }
      for (const [name, dow] of Object.entries(DAY_MAP)) {
        if (new RegExp(name, 'i').test(prior.slice(-400))) {
          const next = nextWeekday(base.dow, dow, base);
          return buildSlot(next.y, next.monthIndex, next.d, hm.hour24, hm.minute, { ...slotOptions, isDateExplicit: true });
        }
      }
    }
    // Default: today if clock still ahead, else tomorrow
    if (/\d/.test(focus) || /baje|bje|shaam|subah|am|pm/i.test(focus)) {
      return defaultDayForTimeOnly(base, hm.hour24, hm.minute, slotOptions);
    }
  }

  return null;
}

/**
 * Resolves customer callback requests with relative date and time handling in IST.
 * e.g. "kal call karna", "evening mein call karna", "kal shaam 5 baje", "parso subah".
 */
export function parseCallbackSlot(
  focusText: string,
  priorTranscript?: string | null,
): ParsedCallbackSlot | null {
  const focus = (focusText || '').trim().toLowerCase();
  if (
    !/callback|call\s*later|baad\s*me(?:in)?|बाद\s*में|busy|abhi\s*(?:nahi|nhi)|call\s*(?:karna|krna|karo|kar\s*dena)|phir\s*call|later\s*call|kal|parso|shaam|evening|tomorrow/i.test(
      focus,
    )
  ) {
    return null;
  }

  const base = nowIst();
  let daysToAdd = 1; // Default to tomorrow for callbacks
  let relativeDesc = 'Kal';

  if (DAY_AFTER_RE.test(focus)) {
    daysToAdd = 2;
    relativeDesc = 'Parso';
  } else if (TOMORROW_RE.test(focus)) {
    daysToAdd = 1;
    relativeDesc = 'Kal';
  } else if (TODAY_RE.test(focus)) {
    daysToAdd = 0;
    relativeDesc = 'Aaj';
  }

  if (/shaam|evening|शाम/i.test(focus)) {
    if (!relativeDesc.toLowerCase().includes('shaam') && !relativeDesc.toLowerCase().includes('evening')) {
      relativeDesc = `${relativeDesc} shaam`;
    }
  }

  let hm = parseHourMinute(focus);
  if (!hm) {
    if (/shaam|evening|शाम/i.test(focus)) {
      hm = { hour24: 17, minute: 0 };
    } else if (/dophar|afternoon|दोपहर/i.test(focus)) {
      hm = { hour24: 14, minute: 0 };
    } else if (/subah|morning|सुबह/i.test(focus)) {
      hm = { hour24: 10, minute: 0 };
    } else {
      hm = { hour24: 11, minute: 0 };
    }
  }

  const slot = addIstDays(base, daysToAdd, hm.hour24, hm.minute);
  return {
    targetDate: slot.date,
    targetTime: slot.time,
    targetIso: slot.startIso,
    label: `${relativeDesc} ${slot.time}`,
    relativeDescription: relativeDesc,
  };
}
