/**
 * Known place names — normalize for memory + clear TTS pronunciation.
 */

export const SAYA_RAJ_NAGAR_EXTENSION = 'Saya Raj Nagar Extension';

/** Hindi / multilingual TTS — Devanagari is clearest for "Saya". */
export const SAYA_RAJ_NAGAR_EXTENSION_HI = 'साया राज नगर एक्सटेंशन';

/**
 * Latin TTS phonetic (NOT "Sayaa" — that gets misread).
 * "Saa ya" = साया
 */
export const SAYA_RAJ_NAGAR_EXTENSION_EN = 'Saa ya Raaj Nagar Extension';

/** Detect / canonicalize the place for CRM memory (facts.location). */
export function normalizeKnownLocation(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (
    /साया\s*राज\s*नगर/i.test(t) ||
    /\bsaya\s*raj\s*nagar/i.test(t) ||
    /\bsaya\s*rajnagar/i.test(t) ||
    /\bsaa\s*ya\s*raaj\s*nagar/i.test(t)
  ) {
    return SAYA_RAJ_NAGAR_EXTENSION;
  }
  if (/राज\s*नगर\s*(?:एक्सटेंशन|extension)/i.test(t) || /\braj\s*nagar\s*ext/i.test(t)) {
    return SAYA_RAJ_NAGAR_EXTENSION;
  }
  return t;
}

/**
 * Rewrite place names for TTS.
 * Hindi/Hinglish/Devanagari context → Devanagari.
 * Pure English → spaced phonetic Latin.
 */
export function applyPlacePronunciation(
  text: string,
  language?: string,
): string {
  let out = text || '';
  if (!out) return out;

  const lang = (language || '').toLowerCase();
  const preferHindi =
    hasDevanagari(out) ||
    lang.includes('hi') ||
    lang.includes('hinglish') ||
    lang.startsWith('mr') ||
    !lang.startsWith('en');

  const spoken = preferHindi
    ? SAYA_RAJ_NAGAR_EXTENSION_HI
    : SAYA_RAJ_NAGAR_EXTENSION_EN;

  const patterns: RegExp[] = [
    /साया\s*राज\s*नगर\s*(?:एक्सटेंशन|एक्सटेनशन|extension)?/gi,
    /\bsayaa\s*raaj\s*nagar\s*(?:ext(?:ension)?\.?)?\b/gi,
    /\bsaya\s*raj\s*nagar\s*(?:ext(?:ension)?\.?)?\b/gi,
    /\bsaya\s*rajnagar\s*(?:ext(?:ension)?\.?)?\b/gi,
    /\bsaa\s*ya\s*raaj\s*nagar\s*(?:ext(?:ension)?\.?)?\b/gi,
  ];

  for (const re of patterns) {
    out = out.replace(re, spoken);
  }

  // Standalone "Saya" brand (not "Saya Group")
  if (preferHindi) {
    out = out.replace(/\bSaya Group\b/gi, 'साया ग्रुप');
    out = out.replace(/\bSaya\b(?!\s*Group)/g, 'साया');
  } else {
    out = out.replace(/\bSayaa\b/gi, 'Saa ya');
    out = out.replace(/\bSaya Group\b/gi, 'Saa ya Group');
    out = out.replace(/\bSaya\b(?!\s*Group)/g, 'Saa ya');
  }

  return out;
}

function hasDevanagari(text: string) {
  return /[\u0900-\u097F]/.test(text || '');
}

/** True if text mentions Saya Raj Nagar Extension (any spelling). */
export function mentionsSayaRajNagarExtension(text: string): boolean {
  const t = text || '';
  return (
    /साया\s*राज\s*नगर/i.test(t) ||
    /\bsayaa?\s*raaj?\s*nagar/i.test(t) ||
    /\bsaya\s*rajnagar/i.test(t) ||
    /\bsaa\s*ya\s*raaj?\s*nagar/i.test(t) ||
    /\braj\s*nagar\s*ext/i.test(t)
  );
}
