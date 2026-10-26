"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeInterestScore = computeInterestScore;
exports.interestLevelFromScore = interestLevelFromScore;
function computeInterestScore(input) {
    const msg = (input.userMessage || '').toLowerCase();
    const prior = (input.priorTranscript || '').toLowerCase();
    const all = `${prior}\n${msg}`;
    const known = input.known || {};
    let score = typeof input.previousScore === 'number' && Number.isFinite(input.previousScore)
        ? Math.max(0, Math.min(10, Math.round(input.previousScore)))
        : 4;
    if (/not interested|nahi chahiye|नहीं चाहिए|don't call|do not call|no thanks| मत कॉल/.test(msg)) {
        return 1;
    }
    if (input.outcome === 'NOT_INTERESTED')
        return 1;
    if (input.meetingBooked || /booked your meeting|मीटिंग.*सेट|calendar/i.test(prior)) {
        score = Math.max(score, 9);
    }
    if (input.siteVisitInterest ||
        known.askedVisit ||
        /site visit|visit|dekhna|देखना|site pe|मीटिंग|meeting/.test(msg)) {
        score = Math.max(score, 8);
    }
    if (input.outcome === 'SITE_VISIT_INTERESTED')
        score = Math.max(score, 8);
    if (input.outcome === 'QUALIFIED')
        score = Math.max(score, 7);
    if (input.outcome === 'CALLBACK_REQUESTED')
        score = Math.max(score, 5);
    if (known.budgetLabel || /\b\d+\s*(lakh|lac|crore|लाख|करोड़)\b/i.test(all)) {
        score += 1;
    }
    if (known.location || /noida|ghaziabad|gurgaon|gurugram|delhi|extension|sector/i.test(msg)) {
        score += 1;
    }
    if (known.bhk || /\b[1-5]\s*bhk\b/i.test(all)) {
        score += 1;
    }
    if (known.interested ||
        /interested|haan|हां|हाँ|sure|ok|okay|theek|ठीक|batao|बताओ|tell me|yes\b/.test(msg)) {
        score += 1;
    }
    if (/busy|later|baad|callback|call back|कल|tomorrow/.test(msg) && score < 7) {
        score = Math.max(3, Math.min(score, 6));
    }
    if (/price|budget|emi|payment|possession|amenities|floor|parking/.test(msg)) {
        score += 1;
    }
    const leadTurns = (all.match(/(?:^|\n)\s*lead\s*:/gi) || []).length;
    if (leadTurns >= 3)
        score += 1;
    if (leadTurns >= 6)
        score += 1;
    return Math.max(0, Math.min(10, Math.round(score)));
}
function interestLevelFromScore(score) {
    if (score <= 2)
        return 'none';
    if (score <= 4)
        return 'low';
    if (score <= 6)
        return 'medium';
    if (score <= 8)
        return 'high';
    return 'hot';
}
//# sourceMappingURL=interest-score.js.map