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
};

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
  /\b(?:parso|परसों|day\s+after\s+tomorrow)\b/i;
/** Plain tomorrow/kal — must NOT match inside "day after tomorrow". */
const TOMORROW_RE =
  /(?<!day\s+after\s+)\b(?:kal|कल|tomorrow|tmrw|tomoro)\b/i;
const TODAY_RE = /\b(?:aaj|ajj|aj|आज|today|tdy)\b/i;

function isSlotStillAhead(slot: ParsedMeetingSlot, cushionMs = 5 * 60_000): boolean {
  const ms = Date.parse(slot.startIso);
  return Number.isFinite(ms) && ms > Date.now() + cushionMs;
}

/** Prefer today if that time is still upcoming; otherwise tomorrow. */
function defaultDayForTimeOnly(
  base: ReturnType<typeof nowIst>,
  hour24: number,
  minute: number,
): ParsedMeetingSlot {
  const today = addIstDays(base, 0, hour24, minute);
  if (isSlotStillAhead(today)) return today;
  return addIstDays(base, 1, hour24, minute);
}

function addIstDays(
  base: ReturnType<typeof nowIst>,
  days: number,
  hour24: number,
  minute: number,
): ParsedMeetingSlot {
  const dt = new Date(Date.UTC(base.y, base.m - 1, base.d + days));
  return buildSlot(
    dt.getUTCFullYear(),
    dt.getUTCMonth(),
    dt.getUTCDate(),
    hour24,
    minute,
  );
}

/** True if text looks like scheduling a meeting / visit / callback with time. */
export function looksLikeMeetingRequest(text: string): boolean {
  const t = normalizeRelativeDayText(text || '');
  return /meeting|meet|appointment|visit|site visit|callback|call back|slot|book|fix|कल|tomorrow|parso|परसों|day after tomorrow|aaj|today|saturday|sunday|monday|tuesday|wednesday|thursday|friday|शनिवार|रविवार|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|baje|bajey|bje|बजे|\d{1,2}\s*(am|pm|:)|morning|evening|subah|shaam|सुबह|शाम/i.test(
    t,
  );
}

/**
 * Extract a concrete meeting slot from customer text (+ optional prior for context).
 */
export function parseMeetingSlot(
  userMessage: string,
  priorTranscript?: string | null,
): ParsedMeetingSlot | null {
  const text = normalizeRelativeDayText(
    `${priorTranscript || ''}\n${userMessage || ''}`.trim(),
  );
  if (!text) return null;
  const base = nowIst();

  // Need a time somewhere in the latest user line preferably
  const focus = normalizeRelativeDayText(userMessage || text);
  const hm =
    parseHourMinute(focus) ||
    parseHourMinute(text.slice(-120));
  if (!hm) return null;

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
    const candidate = buildSlot(year, monthIndex, day, hm.hour24, hm.minute);
    const candMs = Date.parse(candidate.startIso);
    if (candMs < Date.now() - 60_000 && !m[3]) {
      return buildSlot(year + 1, monthIndex, day, hm.hour24, hm.minute);
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
      return buildSlot(year, monthIndex, day, hm.hour24, hm.minute);
    }
  }

  // Relative days — LATEST user line wins (agent "shaam ya kal?" must not force kal)
  const priorTail = normalizeRelativeDayText(
    (priorTranscript || '').split('\n').slice(-8).join('\n'),
  );
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
    return addIstDays(base, 2, hm.hour24, hm.minute);
  }
  if (focusPicksToday) {
    const today = addIstDays(base, 0, hm.hour24, hm.minute);
    if (isSlotStillAhead(today)) return today;
    return addIstDays(base, 1, hm.hour24, hm.minute);
  }
  if (focusPicksTomorrow) {
    return addIstDays(base, 1, hm.hour24, hm.minute);
  }

  // Prior cues — skip if agent only offered a choice (shaam ya kal)
  if (!priorIsChoiceOffer) {
    if (DAY_AFTER_RE.test(priorTail)) {
      return addIstDays(base, 2, hm.hour24, hm.minute);
    }
    if (TODAY_RE.test(priorTail)) {
      const today = addIstDays(base, 0, hm.hour24, hm.minute);
      if (isSlotStillAhead(today)) return today;
      return addIstDays(base, 1, hm.hour24, hm.minute);
    }
    if (TOMORROW_RE.test(priorTail)) {
      return addIstDays(base, 1, hm.hour24, hm.minute);
    }
  }

  // Weekday in latest message
  for (const [name, dow] of Object.entries(DAY_MAP)) {
    const re = new RegExp(`(?:^|\\s)${name}(?:\\s|$)`, 'i');
    if (re.test(focus)) {
      const next = nextWeekday(base.dow, dow, base);
      return buildSlot(next.y, next.monthIndex, next.d, hm.hour24, hm.minute);
    }
  }

  // Time-only confirm — use prior day cue only when not a choice-offer
  if (
    hm &&
    /haan|हां|हाँ|ok|okay|yes|theek|ठीक|book|confirm|fix|rakh|रखा|बजे|baje|bje|morning|evening|subah|shaam|सुबह|शाम|am|pm|\d|meeting|meet/i.test(
      focus,
    )
  ) {
    const prior = priorTail;
    if (!priorIsChoiceOffer) {
      if (DAY_AFTER_RE.test(prior)) {
        return addIstDays(base, 2, hm.hour24, hm.minute);
      }
      if (TODAY_RE.test(prior)) {
        const today = addIstDays(base, 0, hm.hour24, hm.minute);
        return isSlotStillAhead(today)
          ? today
          : addIstDays(base, 1, hm.hour24, hm.minute);
      }
      if (TOMORROW_RE.test(prior)) {
        return addIstDays(base, 1, hm.hour24, hm.minute);
      }
      for (const [name, dow] of Object.entries(DAY_MAP)) {
        if (new RegExp(name, 'i').test(prior.slice(-400))) {
          const next = nextWeekday(base.dow, dow, base);
          return buildSlot(next.y, next.monthIndex, next.d, hm.hour24, hm.minute);
        }
      }
    }
    // Default: today if clock still ahead, else tomorrow
    if (/\d/.test(focus) || /baje|bje|shaam|subah|am|pm/i.test(focus)) {
      return defaultDayForTimeOnly(base, hm.hour24, hm.minute);
    }
  }

  return null;
}
