"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.devanagariToRoman = devanagariToRoman;
exports.hasDevanagari = hasDevanagari;
exports.softenForNaturalSpeech = softenForNaturalSpeech;
const VOWEL_SIGNS = {
    'ा': 'aa',
    'ि': 'i',
    'ी': 'ee',
    'ु': 'u',
    'ू': 'oo',
    'े': 'e',
    'ै': 'ai',
    'ो': 'o',
    'ौ': 'au',
    'ृ': 'ri',
    'ॉ': 'o',
    'ॊ': 'o',
    'ॅ': 'e',
    'ं': 'n',
    'ँ': 'n',
    'ः': 'h',
    '्': '',
};
const INDEPENDENT_VOWELS = {
    अ: 'a',
    आ: 'aa',
    इ: 'i',
    ई: 'ee',
    उ: 'u',
    ऊ: 'oo',
    ऋ: 'ri',
    ए: 'e',
    ऐ: 'ai',
    ओ: 'o',
    औ: 'au',
    ऑ: 'o',
};
const CONSONANTS = {
    क: 'k',
    ख: 'kh',
    ग: 'g',
    घ: 'gh',
    ङ: 'ng',
    च: 'ch',
    छ: 'chh',
    ज: 'j',
    झ: 'jh',
    ञ: 'ny',
    ट: 't',
    ठ: 'th',
    ड: 'd',
    ढ: 'dh',
    ण: 'n',
    त: 't',
    थ: 'th',
    द: 'd',
    ध: 'dh',
    न: 'n',
    प: 'p',
    फ: 'ph',
    ब: 'b',
    भ: 'bh',
    म: 'm',
    य: 'y',
    र: 'r',
    ल: 'l',
    व: 'v',
    श: 'sh',
    ष: 'sh',
    स: 's',
    ह: 'h',
    क्ष: 'ksh',
    त्र: 'tr',
    ज्ञ: 'gy',
    ळ: 'l',
    ड़: 'd',
    ढ़: 'dh',
};
const DIGITS = {
    '०': '0',
    '१': '1',
    '२': '2',
    '३': '3',
    '४': '4',
    '५': '5',
    '६': '6',
    '७': '7',
    '८': '8',
    '९': '9',
};
const DEVANAGARI_LEXICON = [
    [/नमस्ते/g, 'namaste'],
    [/धन्यवाद/g, 'dhanyavaad'],
    [/बोल रही हूँ/g, 'bol rahi hoon'],
    [/बोल रहा हूँ/g, 'bol raha hoon'],
    [/समझ गई/g, 'samajh gayi'],
    [/समझ गया/g, 'samajh gaya'],
    [/समझ/g, 'samajh'],
    [/बताइए/g, 'bataiye'],
    [/बताऊँगी/g, 'bataungi'],
    [/बताऊँगा/g, 'bataunga'],
    [/करूँगी/g, 'karungi'],
    [/करूँगा/g, 'karunga'],
    [/सकती हूँ/g, 'sakti hoon'],
    [/सकता हूँ/g, 'sakta hoon'],
    [/चाहती हूँ/g, 'chahti hoon'],
    [/चाहता हूँ/g, 'chahta hoon'],
    [/लगभग/g, 'lagbhag'],
    [/कितना/g, 'kitna'],
    [/कितने/g, 'kitne'],
    [/कितनी/g, 'kitni'],
    [/आपका/g, 'aapka'],
    [/आपके/g, 'aapke'],
    [/आपकी/g, 'aapki'],
    [/आसपास/g, 'aaspaas'],
    [/चाहिए/g, 'chahiye'],
    [/ठीक है/g, 'theek hai'],
    [/ठीक/g, 'theek'],
    [/अच्छा/g, 'accha'],
    [/बढ़िया/g, 'badiya'],
    [/खरीदने/g, 'khareedne'],
    [/देखना/g, 'dekhna'],
    [/देखूँ/g, 'dekhoon'],
    [/मीटिंग/g, 'meeting'],
    [/लोकेशन/g, 'location'],
    [/बजट/g, 'budget'],
    [/प्रॉपर्टी/g, 'property'],
    [/प्रोजेक्ट/g, 'project'],
    [/विकल्प/g, 'options'],
    [/सुविधा/g, 'suvidha'],
    [/किस्त/g, 'kist'],
    [/रुपये/g, 'rupees'],
    [/लाख/g, 'lakh'],
    [/करोड़/g, 'crore'],
    [/मिनट/g, 'minute'],
    [/बता दीजिए/g, 'bata dijiye'],
    [/कृपया/g, 'kripya'],
    [/वापस/g, 'wapas'],
    [/साइट विजिट/g, 'site visit'],
    [/साइट\s*विजिट/g, 'site visit'],
    [/साया\s*राज\s*नगर\s*(?:एक्सटेंशन|एक्सटेनशन)?/g, 'Saa ya Raaj Nagar Extension'],
    [/राज\s*नगर\s*(?:एक्सटेंशन|एक्सटेनशन)/g, 'Raaj Nagar Extension'],
];
const ROMAN_PRONUNCIATION_FIXES = [
    [/\baapaka\b/gi, 'aapka'],
    [/\baapake\b/gi, 'aapke'],
    [/\baapaki\b/gi, 'aapki'],
    [/\bkitana\b/gi, 'kitna'],
    [/\bkitanaa\b/gi, 'kitna'],
    [/\bkitane\b/gi, 'kitne'],
    [/\bkitanee\b/gi, 'kitni'],
    [/\bpriyaa\b/gi, 'priya'],
    [/\blagabhag\b/gi, 'lagbhag'],
    [/\bbaare\b/gi, 'baare'],
    [/\brahee\b/gi, 'rahi'],
    [/\brahaa\b/gi, 'raha'],
    [/\bkaraha\b/gi, 'kar raha'],
    [/\bkarhee\b/gi, 'kar rahi'],
    [/\bsamajh\b/gi, 'samajh'],
    [/\bbataie\b/gi, 'bataiye'],
    [/\bbataaiye\b/gi, 'bataiye'],
    [/\bkaroongee\b/gi, 'karungi'],
    [/\bkaroonga\b/gi, 'karunga'],
    [/\bbataoongee\b/gi, 'bataungi'],
    [/\bbataoonga\b/gi, 'bataunga'],
    [/\bsaktee\b/gi, 'sakti'],
    [/\bsaktaa\b/gi, 'sakta'],
    [/\bchahtee\b/gi, 'chahti'],
    [/\bchahtaa\b/gi, 'chahta'],
    [/\btheek\b/gi, 'theek'],
    [/\bacchaa\b/gi, 'accha'],
    [/\bacchi\b/gi, 'acchi'],
    [/\bhoon\b/gi, 'hoon'],
    [/\bhain\b/gi, 'hain'],
    [/\bhai\b/gi, 'hai'],
    [/\bkyaa\b/gi, 'kya'],
    [/\bkyun\b/gi, 'kyun'],
    [/\babhee\b/gi, 'abhi'],
    [/\bthodee\b/gi, 'thodi'],
    [/\bthoda\b/gi, 'thoda'],
    [/\bbaat\b/gi, 'baat'],
    [/\bminute\b/gi, 'minute'],
    [/\bpropartee\b/gi, 'property'],
    [/\bvikalp\b/gi, 'options'],
    [/\bkhareedne\b/gi, 'khareedne'],
    [/\bdekhna\b/gi, 'dekhna'],
    [/\bnamasate\b/gi, 'namaste'],
    [/\bnmaste\b/gi, 'namaste'],
    [/\bdhanyavad\b/gi, 'dhanyavaad'],
    [/\bmein\b/gi, 'mein'],
    [/\bmen\b/gi, 'mein'],
    [/\bmain\b/gi, 'main'],
    [/\bsaya\s*raj\s*nagar\s*(?:ext(?:ension)?\.?)?\b/gi, 'Saa ya Raaj Nagar Extension'],
    [/\bsaya\s*rajnagar\s*(?:ext(?:ension)?\.?)?\b/gi, 'Saa ya Raaj Nagar Extension'],
    [/\bsayaa\s*raaj\s*nagar\s*(?:ext(?:ension)?\.?)?\b/gi, 'Saa ya Raaj Nagar Extension'],
    [/\braj\s*nagar\s*extension\b/gi, 'Raaj Nagar Extension'],
    [/\s+aur\s+/gi, ', aur '],
    [/\s+toh\s+/gi, ', toh '],
    [/\s+phir\s+/gi, ', phir '],
];
function isDevanagari(ch) {
    const code = ch.charCodeAt(0);
    return code >= 0x0900 && code <= 0x097f;
}
function applyLexicon(text) {
    let out = text;
    for (const [re, rep] of DEVANAGARI_LEXICON) {
        out = out.replace(re, rep);
    }
    return out;
}
function applyRomanFixes(text) {
    let out = text;
    for (const [re, rep] of ROMAN_PRONUNCIATION_FIXES) {
        out = out.replace(re, rep);
    }
    return out;
}
function devanagariToRoman(input) {
    if (!input)
        return input;
    let prepared = applyLexicon(input);
    let out = '';
    const chars = Array.from(prepared);
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const next = chars[i + 1] || '';
        if (DIGITS[ch]) {
            out += DIGITS[ch];
            continue;
        }
        if (ch === '।' || ch === '॥') {
            out += '.';
            continue;
        }
        if (ch === 'ऽ')
            continue;
        if (!isDevanagari(ch)) {
            out += ch;
            continue;
        }
        if (INDEPENDENT_VOWELS[ch]) {
            out += INDEPENDENT_VOWELS[ch];
            continue;
        }
        if (VOWEL_SIGNS[ch] !== undefined) {
            out += VOWEL_SIGNS[ch];
            continue;
        }
        if ((ch === 'ड' || ch === 'ढ') && next === '़') {
            out += ch === 'ड' ? 'd' : 'dh';
            i += 1;
            const matra = chars[i + 1] || '';
            if (VOWEL_SIGNS[matra] !== undefined) {
                out += VOWEL_SIGNS[matra];
                i += 1;
            }
            else if (matra === '्') {
                i += 1;
            }
            else if (matra && isDevanagari(matra) && !VOWEL_SIGNS[matra] && !INDEPENDENT_VOWELS[matra]) {
                out += 'a';
            }
            continue;
        }
        const cons = CONSONANTS[ch];
        if (cons !== undefined) {
            if (next === '्') {
                out += cons;
                i += 1;
                continue;
            }
            if (VOWEL_SIGNS[next] !== undefined) {
                out += cons + VOWEL_SIGNS[next];
                i += 1;
                continue;
            }
            const after = chars[i + 1] || '';
            if (!after || !isDevanagari(after) || after === '।') {
                out += cons;
            }
            else {
                out += cons + 'a';
            }
            continue;
        }
        if (ch === '़')
            continue;
        out += ch;
    }
    return applyRomanFixes(out
        .replace(/\s{2,}/g, ' ')
        .replace(/([.?!])\1+/g, '$1')
        .trim());
}
function hasDevanagari(text) {
    return /[\u0900-\u097F]/.test(text || '');
}
function softenForNaturalSpeech(text) {
    return (text || '')
        .replace(/\.{4,}/g, '...')
        .replace(/[—–]+/g, ', ')
        .replace(/\?{3,}/g, '??')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
//# sourceMappingURL=hindi-romanize.js.map