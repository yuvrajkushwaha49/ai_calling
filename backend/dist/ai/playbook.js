"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.personalizeOpeningTip = exports.isOpeningStyleTip = void 0;
exports.appendImprovement = appendImprovement;
exports.normalizePlaybook = normalizePlaybook;
exports.formatPlaybookForPrompt = formatPlaybookForPrompt;
exports.latestOpeningStyleTip = latestOpeningStyleTip;
exports.deriveAutoLesson = deriveAutoLesson;
const opener_bank_1 = require("../calls/opener-bank");
var opener_bank_2 = require("../calls/opener-bank");
Object.defineProperty(exports, "isOpeningStyleTip", { enumerable: true, get: function () { return opener_bank_2.isOpeningStyleTip; } });
Object.defineProperty(exports, "personalizeOpeningTip", { enumerable: true, get: function () { return opener_bank_2.personalizeOpeningTip; } });
function appendImprovement(playbook, event) {
    const history = [...(playbook.improvementHistory || [])];
    history.push({
        at: event.at || new Date().toISOString(),
        kind: event.kind,
        summary: event.summary.slice(0, 280),
        detail: event.detail?.slice(0, 400),
        callId: event.callId,
    });
    playbook.improvementHistory = history.slice(-80);
    return playbook;
}
function normalizePlaybook(raw) {
    if (!raw)
        return { tips: [], autoLessons: [] };
    if (Array.isArray(raw)) {
        const tips = raw
            .map((item) => {
            if (!item || typeof item !== 'object')
                return null;
            const o = item;
            const note = String(o.note || o.reply || o.lesson || '').trim();
            if (!note)
                return null;
            return {
                note: note.slice(0, 280),
                rating: o.rating != null ? String(o.rating) : undefined,
                source: (o.source === 'auto' ? 'auto' : 'feedback'),
                at: String(o.approvedAt || o.at || new Date().toISOString()),
            };
        })
            .filter(Boolean);
        return { tips, autoLessons: [], improvementHistory: [] };
    }
    if (typeof raw !== 'object')
        return { tips: [], autoLessons: [], improvementHistory: [] };
    const obj = raw;
    const tipsRaw = Array.isArray(obj.tips) ? obj.tips : [];
    const lessonsRaw = Array.isArray(obj.autoLessons) ? obj.autoLessons : [];
    const histRaw = Array.isArray(obj.improvementHistory)
        ? obj.improvementHistory
        : [];
    const tips = tipsRaw
        .map((item) => {
        if (!item || typeof item !== 'object')
            return null;
        const o = item;
        const note = String(o.note || o.reply || '').trim();
        if (!note)
            return null;
        return {
            note: note.slice(0, 280),
            rating: o.rating != null ? String(o.rating) : undefined,
            source: (o.source === 'auto' ? 'auto' : 'feedback'),
            at: String(o.at || new Date().toISOString()),
        };
    })
        .filter(Boolean);
    const autoLessons = lessonsRaw
        .map((item) => {
        if (!item || typeof item !== 'object')
            return null;
        const o = item;
        const lesson = String(o.lesson || '').trim();
        if (!lesson)
            return null;
        return {
            lesson: lesson.slice(0, 280),
            outcome: String(o.outcome || 'CONNECTED'),
            at: String(o.at || new Date().toISOString()),
            callId: o.callId ? String(o.callId) : undefined,
        };
    })
        .filter(Boolean);
    const improvementHistory = histRaw
        .map((item) => {
        if (!item || typeof item !== 'object')
            return null;
        const o = item;
        const summary = String(o.summary || o.lesson || o.note || '').trim();
        if (!summary)
            return null;
        const kindRaw = String(o.kind || 'auto_lesson');
        const kind = kindRaw === 'feedback_tip' || kindRaw === 'opener_preferred'
            ? kindRaw
            : 'auto_lesson';
        return {
            at: String(o.at || new Date().toISOString()),
            kind,
            summary: summary.slice(0, 280),
            detail: o.detail != null ? String(o.detail).slice(0, 400) : undefined,
            callId: o.callId ? String(o.callId) : undefined,
        };
    })
        .filter(Boolean);
    if (!improvementHistory.length) {
        for (const l of autoLessons) {
            improvementHistory.push({
                at: l.at,
                kind: 'auto_lesson',
                summary: l.lesson,
                detail: `Outcome: ${l.outcome}`,
                callId: l.callId,
            });
        }
        for (const t of tips) {
            improvementHistory.push({
                at: t.at,
                kind: 'feedback_tip',
                summary: t.note,
                detail: t.rating ? `Rating: ${t.rating}` : undefined,
            });
        }
        improvementHistory.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    }
    return {
        openerLearning: (0, opener_bank_1.parseOpenerLearning)(obj),
        tips,
        autoLessons,
        improvementHistory: improvementHistory.slice(-80),
    };
}
function formatPlaybookForPrompt(raw, maxChars = 500) {
    const pb = normalizePlaybook(raw);
    const lines = [];
    for (const t of (pb.tips || []).slice(-8)) {
        if ((0, opener_bank_1.isOpeningStyleTip)(t.note))
            continue;
        lines.push(`- ${t.note}`);
    }
    for (const l of (pb.autoLessons || []).slice(-6)) {
        lines.push(`- (${l.outcome}) ${l.lesson}`);
    }
    if (!lines.length)
        return '';
    return `Learned tips (apply as principles, never recite verbatim):\n${lines.join('\n')}`.slice(0, maxChars);
}
function latestOpeningStyleTip(raw) {
    const pb = normalizePlaybook(raw);
    const tips = [...(pb.tips || [])].reverse();
    for (const tip of tips) {
        if ((0, opener_bank_1.isOpeningStyleTip)(tip.note))
            return tip.note;
    }
    return null;
}
function deriveAutoLesson(input) {
    const outcome = String(input.outcome || '').toUpperCase();
    const raw = input.transcript || '';
    const t = raw.toLowerCase();
    const score = input.interestScore;
    const leadSaid = raw
        .split('\n')
        .filter((l) => /^lead:/i.test(l.trim()))
        .map((l) => l.replace(/^lead:\s*/i, ''))
        .join(' ')
        .toLowerCase();
    const agentSaid = raw
        .split('\n')
        .filter((l) => /^agent:/i.test(l.trim()))
        .map((l) => l.replace(/^agent:\s*/i, ''))
        .join(' ')
        .toLowerCase();
    if (/baad\s*me(?:in)?|call\s*later|callback|abhi\s*(?:nahi|nhi).*(?:kar|kr)|busy/i.test(leadSaid) &&
        /ghar\s*\/\s*flat dekhna|configuration kaun|do bedroom|ask_planning|chaaloo hai kya/i.test(agentSaid)) {
        return 'If customer is busy or says call later, confirm a callback and stop — never restart discovery questions.';
    }
    if (/callback|callback_requested/i.test(outcome) ||
        /baad\s*me(?:in)?\s*call|call\s*later|abhi\s*(?:nahi|nhi)\s*(?:kar|kr)\s*sak/i.test(leadSaid)) {
        return 'When customer asks to call later, acknowledge once, note callback, and end politely.';
    }
    if (/not_interested|not interested/i.test(outcome) ||
        /नहीं देख|not looking|search नहीं|kuch nahi|nahi chahiye|nhi chahiye/i.test(leadSaid)) {
        return 'If customer is not looking, accept once, thank them briefly, and end — no pitch or budget ask.';
    }
    if (/site_visit|site visit/i.test(outcome) ||
        /visit|site|weekend|saturday|friday/.test(leadSaid)) {
        return 'When visit interest appears, confirm a day and offer one short reminder call before that day — keep wording fresh.';
    }
    if (typeof score === 'number' && score >= 7) {
        return 'High interest: move to matching options from Knowledge then visit timing; avoid restarting discovery.';
    }
    if (typeof score === 'number' && score <= 3 && /agent:/i.test(t)) {
        return 'Low engagement: ask one softer discovery question, stay shorter, and do not stack questions.';
    }
    if (/budget|बजट/.test(leadSaid) && /budget/i.test(agentSaid)) {
        return 'Do not lead with budget; first confirm planning → configuration → possession, then options.';
    }
    if (/got it|noted|perfect/.test(agentSaid)) {
        return 'Avoid stock English acks like Got it / Noted / Perfect; vary soft Hindi acks.';
    }
    const turns = raw.split('\n').filter((l) => /^lead:/i.test(l.trim())).length;
    if (turns >= 2) {
        if (/configuration kaun|ghar \/ flat dekhna|do bedroom yaa teen/i.test(agentSaid)) {
            return 'Do not loop the same discovery questions; listen to the last answer and advance the flow.';
        }
        return 'Keep one question per turn; paraphrase every line — same flow, fresh words.';
    }
    return null;
}
//# sourceMappingURL=playbook.js.map