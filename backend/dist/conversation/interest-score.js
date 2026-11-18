"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateLeadQualification = evaluateLeadQualification;
exports.computeInterestScore = computeInterestScore;
exports.interestLevelFromScore = interestLevelFromScore;
function evaluateLeadQualification(input) {
    const msg = (input.userMessage || '').toLowerCase();
    const prior = (input.priorTranscript || '').toLowerCase();
    const all = `${prior}\n${msg}`.trim();
    const known = input.known || {};
    const now = new Date().toISOString();
    const isDisqualified = /not interested|nahi chahiye|नहीं चाहिए|don't call|do not call|no thanks|mat call|मत कॉल|wrong number|गलत नंबर|rakho phone|rakh do/i.test(msg) || input.outcome === 'NOT_INTERESTED';
    const preferenceSources = {};
    let bhkVerified = false;
    let bhkVal = null;
    let bhkSource = 'customer_explicit';
    const bhkMsgMatch = msg.match(/\b([1-5])\s*(?:bhk|bedroom|बी\s*एच\s*के|बीएचके)\b/i);
    if (bhkMsgMatch) {
        bhkVerified = true;
        bhkVal = `${bhkMsgMatch[1]} BHK`;
        bhkSource = 'customer_explicit';
    }
    else if (known.bhk) {
        bhkVerified = true;
        bhkVal = known.bhk;
        bhkSource = 'crm_profile';
    }
    else {
        const bhkPriorMatch = prior.match(/\b([1-5])\s*(?:bhk|bedroom|बी\s*एच\s*के|बीएचके)\b/i);
        if (bhkPriorMatch) {
            bhkVerified = true;
            bhkVal = `${bhkPriorMatch[1]} BHK`;
            bhkSource = 'prior_transcript';
        }
    }
    if (bhkVerified && bhkVal) {
        preferenceSources.bhk = { value: bhkVal, source: bhkSource, timestamp: now };
    }
    let budgetVerified = false;
    let budgetVal = null;
    let budgetSource = 'customer_explicit';
    const budgetMsgMatch = msg.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|crore|cr|लाख|करोड़)\b/i);
    if (budgetMsgMatch) {
        budgetVerified = true;
        budgetVal = budgetMsgMatch[0].trim();
        budgetSource = 'customer_explicit';
    }
    else if (known.budgetLabel || known.budget) {
        budgetVerified = true;
        budgetVal = known.budgetLabel || `${known.budget} INR`;
        budgetSource = 'crm_profile';
    }
    else {
        const budgetPriorMatch = prior.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|crore|cr|लाख|करोड़)\b/i);
        if (budgetPriorMatch) {
            budgetVerified = true;
            budgetVal = budgetPriorMatch[0].trim();
            budgetSource = 'prior_transcript';
        }
    }
    if (budgetVerified && budgetVal) {
        preferenceSources.budget = { value: budgetVal, source: budgetSource, timestamp: now };
    }
    let locationVerified = false;
    let locVal = null;
    let locSource = 'customer_explicit';
    const locMatch = msg.match(/(?:noida\s*(?:extension|west|expressway)?|greater\s*noida(?:\s*west)?|ghaziabad|gurgaon|gurugram|delhi\s*ncr|raj\s*nagar|sector\s*\d+)/i);
    if (locMatch) {
        locationVerified = true;
        locVal = locMatch[0].trim();
        locSource = 'customer_explicit';
    }
    else if (known.location) {
        locationVerified = true;
        locVal = known.location;
        locSource = 'crm_profile';
    }
    else {
        const locPriorMatch = prior.match(/(?:noida\s*(?:extension|west|expressway)?|greater\s*noida(?:\s*west)?|ghaziabad|gurgaon|gurugram|delhi\s*ncr|raj\s*nagar|sector\s*\d+)/i);
        if (locPriorMatch) {
            locationVerified = true;
            locVal = locPriorMatch[0].trim();
            locSource = 'prior_transcript';
        }
    }
    if (locationVerified && locVal) {
        preferenceSources.location = { value: locVal, source: locSource, timestamp: now };
    }
    let timelineVerified = false;
    let timelineVal = null;
    let timelineSource = 'customer_explicit';
    const timelineMatch = all.match(/(?:ready\s*to\s*move|under\s*construction|rtm|uc\b|within\s*\d+\s*(?:month|year)s?|immediate|jaldi|turant|6\s*month|1\s*year)/i);
    if (timelineMatch) {
        timelineVerified = true;
        timelineVal = timelineMatch[0].trim();
        timelineSource = msg.includes(timelineMatch[0]) ? 'customer_explicit' : 'prior_transcript';
    }
    else if (known.timeline) {
        timelineVerified = true;
        timelineVal = known.timeline;
        timelineSource = 'crm_profile';
    }
    if (timelineVerified && timelineVal) {
        preferenceSources.timeline = { value: timelineVal, source: timelineSource, timestamp: now };
    }
    let purposeVerified = false;
    let purposeVal = null;
    let purposeSource = 'customer_explicit';
    const purposeMatch = all.match(/(?:self\s*use|end\s*use|rehne\s*ke\s*liye|family\s*ke\s*liye|khud\s*ke\s*liye|investment|rental|rent\s*ke\s*liye|invest)/i);
    if (purposeMatch) {
        purposeVerified = true;
        purposeVal = purposeMatch[0].trim();
        purposeSource = msg.includes(purposeMatch[0]) ? 'customer_explicit' : 'prior_transcript';
    }
    else if (known.purpose) {
        purposeVerified = true;
        purposeVal = known.purpose;
        purposeSource = 'crm_profile';
    }
    if (purposeVerified && purposeVal) {
        preferenceSources.purpose = { value: purposeVal, source: purposeSource, timestamp: now };
    }
    let visitVerified = false;
    let visitSource = 'customer_explicit';
    if (input.meetingBooked || /booked your meeting|meeting booked|मीटिंग.*सेट|calendar/i.test(prior)) {
        visitVerified = true;
        visitSource = 'customer_explicit';
    }
    else if (input.siteVisitInterest ||
        known.askedVisit ||
        input.outcome === 'SITE_VISIT_INTERESTED' ||
        /(?:site\s*visit|visit\s*karna|visit\s*karein|dekhna\s*hai|site\s*pe\s*aana|aunga|aayenge)/i.test(msg)) {
        visitVerified = true;
        visitSource = input.siteVisitInterest ? 'customer_explicit' : 'prior_transcript';
    }
    if (visitVerified) {
        preferenceSources.siteVisit = { value: true, source: visitSource, timestamp: now };
    }
    const leadTurns = (all.match(/(?:^|\n)\s*lead\s*:/gi) || []).length;
    let engagementPoints = 0;
    if (leadTurns >= 6) {
        engagementPoints = 10;
    }
    else if (leadTurns >= 3) {
        engagementPoints = 5;
    }
    const breakdown = {
        bhk: { points: bhkVerified ? 20 : 0, max: 20, verified: bhkVerified, value: bhkVal, source: bhkSource, timestamp: now },
        budget: { points: budgetVerified ? 20 : 0, max: 20, verified: budgetVerified, value: budgetVal, source: budgetSource, timestamp: now },
        location: { points: locationVerified ? 15 : 0, max: 15, verified: locationVerified, value: locVal, source: locSource, timestamp: now },
        timeline: { points: timelineVerified ? 15 : 0, max: 15, verified: timelineVerified, value: timelineVal, source: timelineSource, timestamp: now },
        purpose: { points: purposeVerified ? 10 : 0, max: 10, verified: purposeVerified, value: purposeVal, source: purposeSource, timestamp: now },
        siteVisit: { points: visitVerified ? 20 : 0, max: 20, verified: visitVerified, value: visitVerified, source: visitSource, timestamp: now },
        engagement: { points: engagementPoints, max: 10, leadTurns },
        disqualified: isDisqualified,
        disqualificationReason: isDisqualified ? 'Customer stated not interested / opt-out / wrong number' : undefined,
    };
    if (isDisqualified) {
        return {
            score100: 10,
            score10: 1,
            isQualified: false,
            breakdown,
            preferenceSources,
        };
    }
    let rawScore = breakdown.bhk.points +
        breakdown.budget.points +
        breakdown.location.points +
        breakdown.timeline.points +
        breakdown.purpose.points +
        breakdown.siteVisit.points +
        breakdown.engagement.points;
    const score100 = Math.max(0, Math.min(100, rawScore));
    const score10 = Math.max(0, Math.min(10, Math.round(score100 / 10)));
    const isQualified = score100 >= 60;
    return {
        score100,
        score10,
        isQualified,
        breakdown,
        preferenceSources,
    };
}
function computeInterestScore(input) {
    if (!input.userMessage && !input.priorTranscript && !input.known && !input.outcome) {
        return 0;
    }
    const result = evaluateLeadQualification(input);
    return result.score10;
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