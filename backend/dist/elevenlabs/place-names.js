"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAYA_RAJ_NAGAR_EXTENSION_EN = exports.SAYA_RAJ_NAGAR_EXTENSION_HI = exports.SAYA_RAJ_NAGAR_EXTENSION = void 0;
exports.normalizeKnownLocation = normalizeKnownLocation;
exports.applyPlacePronunciation = applyPlacePronunciation;
exports.mentionsSayaRajNagarExtension = mentionsSayaRajNagarExtension;
exports.SAYA_RAJ_NAGAR_EXTENSION = 'Saya Raj Nagar Extension';
exports.SAYA_RAJ_NAGAR_EXTENSION_HI = 'साया राज नगर एक्सटेंशन';
exports.SAYA_RAJ_NAGAR_EXTENSION_EN = 'Saa ya Raaj Nagar Extension';
function normalizeKnownLocation(raw) {
    if (!raw)
        return undefined;
    const t = raw.trim();
    if (!t)
        return undefined;
    if (/साया\s*राज\s*नगर/i.test(t) ||
        /\bsaya\s*raj\s*nagar/i.test(t) ||
        /\bsaya\s*rajnagar/i.test(t) ||
        /\bsaa\s*ya\s*raaj\s*nagar/i.test(t)) {
        return exports.SAYA_RAJ_NAGAR_EXTENSION;
    }
    if (/राज\s*नगर\s*(?:एक्सटेंशन|extension)/i.test(t) || /\braj\s*nagar\s*ext/i.test(t)) {
        return exports.SAYA_RAJ_NAGAR_EXTENSION;
    }
    return t;
}
function applyPlacePronunciation(text, language) {
    let out = text || '';
    if (!out)
        return out;
    const lang = (language || '').toLowerCase();
    const preferHindi = hasDevanagari(out) ||
        lang.includes('hi') ||
        lang.includes('hinglish') ||
        lang.startsWith('mr') ||
        !lang.startsWith('en');
    const spoken = preferHindi
        ? exports.SAYA_RAJ_NAGAR_EXTENSION_HI
        : exports.SAYA_RAJ_NAGAR_EXTENSION_EN;
    const patterns = [
        /साया\s*राज\s*नगर\s*(?:एक्सटेंशन|एक्सटेनशन|extension)?/gi,
        /\bsayaa\s*raaj\s*nagar\s*(?:ext(?:ension)?\.?)?\b/gi,
        /\bsaya\s*raj\s*nagar\s*(?:ext(?:ension)?\.?)?\b/gi,
        /\bsaya\s*rajnagar\s*(?:ext(?:ension)?\.?)?\b/gi,
        /\bsaa\s*ya\s*raaj\s*nagar\s*(?:ext(?:ension)?\.?)?\b/gi,
    ];
    for (const re of patterns) {
        out = out.replace(re, spoken);
    }
    if (preferHindi) {
        out = out.replace(/\bSaya Group\b/gi, 'साया ग्रुप');
        out = out.replace(/\bSaya\b(?!\s*Group)/g, 'साया');
    }
    else {
        out = out.replace(/\bSayaa\b/gi, 'Saa ya');
        out = out.replace(/\bSaya Group\b/gi, 'Saa ya Group');
        out = out.replace(/\bSaya\b(?!\s*Group)/g, 'Saa ya');
    }
    return out;
}
function hasDevanagari(text) {
    return /[\u0900-\u097F]/.test(text || '');
}
function mentionsSayaRajNagarExtension(text) {
    const t = text || '';
    return (/साया\s*राज\s*नगर/i.test(t) ||
        /\bsayaa?\s*raaj?\s*nagar/i.test(t) ||
        /\bsaya\s*rajnagar/i.test(t) ||
        /\bsaa\s*ya\s*raaj?\s*nagar/i.test(t) ||
        /\braj\s*nagar\s*ext/i.test(t));
}
//# sourceMappingURL=place-names.js.map