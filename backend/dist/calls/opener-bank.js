"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPENER_STYLES = void 0;
exports.pickOpenerStyle = pickOpenerStyle;
exports.parseOpenerLearning = parseOpenerLearning;
exports.bestOpenerStyle = bestOpenerStyle;
exports.isOpeningStyleTip = isOpeningStyleTip;
exports.personalizeOpeningTip = personalizeOpeningTip;
exports.speakAgentName = speakAgentName;
exports.buildVariedOpening = buildVariedOpening;
const call_scripts_1 = require("./call-scripts");
exports.OPENER_STYLES = [
    'soft_time',
    'project_hook',
    'warm_checkin',
    'curiosity',
    'availability',
];
function greetingNowIst() {
    const hour = Number(new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false,
    }).format(new Date()));
    if (hour < 12)
        return 'Good morning';
    if (hour < 17)
        return 'Good afternoon';
    return 'Good evening';
}
function pickOne(items) {
    return items[Math.floor(Math.random() * items.length)];
}
function pickOpenerStyle(learning) {
    const last = learning?.lastStyle;
    const avoidSame = (style) => !last || style !== last || exports.OPENER_STYLES.length < 2;
    const explore = Math.random() < 0.4;
    if (explore || !learning?.styles || !Object.keys(learning.styles).length) {
        const pool = exports.OPENER_STYLES.filter(avoidSame);
        return pickOne(pool.length ? pool : exports.OPENER_STYLES);
    }
    const scored = exports.OPENER_STYLES.map((style) => {
        const s = learning.styles[style] || { uses: 0, wins: 0 };
        const score = (s.wins + 1) / (s.uses + 2);
        return { style, score };
    }).filter((x) => avoidSame(x.style));
    const list = scored.length ? scored : exports.OPENER_STYLES.map((style) => ({ style, score: 1 }));
    const total = list.reduce((a, b) => a + b.score, 0);
    let r = Math.random() * total;
    for (const item of list) {
        r -= item.score;
        if (r <= 0)
            return item.style;
    }
    return list[0].style;
}
function parseOpenerLearning(raw) {
    if (!raw || typeof raw !== 'object')
        return { styles: {} };
    const obj = raw;
    const nested = obj.openerLearning && typeof obj.openerLearning === 'object'
        ? obj.openerLearning
        : obj;
    const stylesRaw = nested.styles && typeof nested.styles === 'object'
        ? nested.styles
        : {};
    const styles = {};
    for (const key of exports.OPENER_STYLES) {
        const s = stylesRaw[key];
        if (s && typeof s === 'object') {
            const uses = Number(s.uses) || 0;
            const wins = Number(s.wins) || 0;
            styles[key] = { uses, wins };
        }
    }
    const preferred = nested.preferredStyle;
    const last = nested.lastStyle;
    return {
        styles,
        preferredStyle: typeof preferred === 'string' &&
            exports.OPENER_STYLES.includes(preferred)
            ? preferred
            : undefined,
        lastStyle: typeof last === 'string' && exports.OPENER_STYLES.includes(last)
            ? last
            : undefined,
    };
}
function bestOpenerStyle(learning) {
    let best = 'soft_time';
    let bestScore = -1;
    for (const style of exports.OPENER_STYLES) {
        const s = learning.styles[style] || { uses: 0, wins: 0 };
        if (s.uses < 2)
            continue;
        const score = s.wins / s.uses;
        if (score > bestScore) {
            bestScore = score;
            best = style;
        }
    }
    return best;
}
function isOpeningStyleTip(note) {
    const t = String(note || '').toLowerCase();
    if (t.length < 35)
        return false;
    const hasGreeting = /namaste|नमस्ते|\bhi\b|बोल रही|बोल रहा|enquiry|enquir/.test(t);
    const hasAsk = /दो मिनट|do minute|mil sakta|मिल सकता|time|baat|conversation|opener|starting|shuru/.test(t);
    return hasGreeting && hasAsk;
}
function personalizeOpeningTip(tipNote, ctx) {
    let t = String(tipNote || '')
        .replace(/\|/g, ' ')
        .replace(/,?\s*aisa\s+kh?uch\s+\w*\s*conve?r?sation\s+rakho\.?/gi, '')
        .replace(/,?\s*aisa\s+kh?uch\s+conversation\s+rakho\.?/gi, '')
        .replace(/,?\s*aisa\s+hi\s+(rakho|bolo|start|shuru).*/gi, '')
        .replace(/\s+,/g, ',')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[,\s]+$/g, '');
    const leadFirst = (ctx.leadName || '')
        .trim()
        .replace(/\s*जी\s*$/u, '')
        .replace(/\s+ji$/i, '')
        .split(/\s+/)[0] || 'जी';
    t = t.replace(/^(Namaste|Hi|नमस्ते|सादर\s*Hi)\s+[^\s,]+(\s*जी)?/i, (_m, g, ji) => `${g} ${leadFirst}${ji || ' जी'}`);
    t = t.replace(/\bNeha\b/gi, ctx.agentName);
    t = t.replace(/\bAria\b/gi, ctx.agentName);
    t = t.replace(/बोल रही हूँ|बोल रहा हूँ/g, `${ctx.bolHi} हूँ`);
    t = t.replace(/bol rahi hoon|bol raha hoon/gi, `${ctx.bolHi} हूँ`);
    t = t.replace(/साया\s*ग्रुप|Saya\s*Group/gi, ctx.companyHi);
    if (ctx.hasProject && ctx.projectHi) {
        t = t.replace(/साया\s*राज\s*नगर\s*एक्सटेंशन|Sayaa?\s*Raj\s*Nagar\s*Extension/gi, ctx.projectHi);
    }
    t = t.replace(/दो मिनट मिल sakta hai aapka/gi, 'दो मिनट baat kr सकते हैं क्या');
    t = t.replace(/मिल\s*sakta\s*hai\s*aapka/gi, 'baat kr सकते हैं क्या');
    t = t.replace(/दो मिनट मिल सकते हैं( क्या)?/gi, 'दो मिनट baat kr सकते हैं क्या');
    t = t.replace(/दो मिनट मिल सकते हैं\?/gi, 'दो मिनट baat kr सकते हैं क्या');
    t = t.replace(/[—\-–]?\s*(दो मिनट|do minute).{0,40}(\?|क्या)?\s*$/i, ' दो मिनट baat kr सकते हैं क्या');
    return t.replace(/\s+/g, ' ').trim();
}
function firstName(name) {
    const n = (name || '')
        .trim()
        .replace(/\s*जी\s*$/u, '')
        .replace(/\s+ji$/i, '');
    const first = (n.split(/\s+/)[0] || '').trim();
    return first || 'जी';
}
function speakAgentName(raw) {
    let n = String(raw || '').trim();
    if (!n)
        return 'नेहा';
    n = n.split(/[-–—|:/]/)[0].trim();
    n = n
        .replace(/\b(ai|a\.i\.|assistant|agent|bot|real\s*estate|calling|voice|crm)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const first = (n.split(/\s+/)[0] || '').trim();
    if (!first || /^(real|estate|ai|the|your)$/i.test(first)) {
        return 'नेहा';
    }
    return first;
}
function speakProjectName(projectRaw, _language) {
    if (/saya\s*raj/i.test(projectRaw) || /साया/.test(projectRaw)) {
        return 'साया राज नगर एक्सटेंशन';
    }
    return projectRaw;
}
function speakCompanyName(raw, language) {
    const t = (raw || '').trim();
    if (!t)
        return language === 'en-IN' ? 'Saya Group' : 'साया ग्रुप';
    if (/^saya\s*group$/i.test(t) || /साया\s*ग्रुप/.test(t)) {
        return language === 'en-IN' ? 'Saya Group' : 'साया ग्रुप';
    }
    if (/^saya$/i.test(t)) {
        return language === 'en-IN' ? 'Saya Group' : 'साया ग्रुप';
    }
    return t;
}
function buildVariedOpening(options) {
    const language = 'hi-IN';
    void options.language;
    const tone = (0, call_scripts_1.normalizeTone)(options.tone);
    const name = firstName(options.leadName || 'जी');
    const agent = speakAgentName(options.agentName);
    const hasProject = options.hasLinkedProject !== false && Boolean(options.projectName?.trim());
    const projectRaw = options.projectName?.trim() || 'हमारे प्रोजेक्ट';
    const project = speakProjectName(projectRaw, language);
    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    let company = options.companyName?.trim() || '';
    const builder = options.builderName?.trim() || '';
    if (hasProject &&
        (!company ||
            norm(company) === norm(projectRaw) ||
            norm(company).includes(norm(projectRaw)) ||
            norm(projectRaw).includes(norm(company)))) {
        company = builder || company || 'Saya Group';
    }
    if (!company)
        company = builder || 'Saya Group';
    const companyHi = speakCompanyName(company || 'Saya Group', 'hi-IN');
    const gender = (0, call_scripts_1.resolveSpeechGender)({
        agentName: options.agentName || agent,
        agentVoice: options.agentVoice,
    });
    const bolHi = (0, call_scripts_1.ag)(gender, 'बोल रहा', 'बोल रही');
    const style = options.style || pickOpenerStyle(options.learning);
    const greet = greetingNowIst();
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
    const withProject = {
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
    const noProject = {
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
//# sourceMappingURL=opener-bank.js.map