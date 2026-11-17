"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var FactExtractorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactExtractorService = void 0;
const HINDI_LAKH_WORDS = {
    'पच्चीस': 25, 'छब्बीस': 26, 'सत्ताईस': 27, 'अट्ठाईस': 28, 'उनतीस': 29,
    'तीस': 30, 'इकत्तीस': 31, 'बत्तीस': 32, 'तैंतीस': 33, 'चौंतीस': 34,
    'पैंतीस': 35, 'छत्तीस': 36, 'सैंतीस': 37, 'अड़तीस': 38, 'उनतालीस': 39,
    'चालीस': 40, 'इकतालीस': 41, 'बयालीस': 42, 'तैंतालीस': 43, 'चवालीस': 44,
    'पैंतालीस': 45, 'छियालीस': 46, 'सैंतालीस': 47, 'अड़तालीस': 48, 'उनचास': 49,
    'पचास': 50, 'इक्यावन': 51, 'बावन': 52, 'तिरेपन': 53, 'चौवन': 54,
    'पचपन': 55, 'छप्पन': 56, 'सत्तावन': 57, 'अट्ठावन': 58, 'उनसठ': 59,
    'साठ': 60, 'इकसठ': 61, 'बासठ': 62, 'तिरेसठ': 63, 'चौंसठ': 64,
    'पैंसठ': 65, 'छियासठ': 66, 'सरसठ': 67, 'अड़सठ': 68, 'उनहत्तर': 69,
    'सत्तर': 70, 'इकहत्तर': 71, 'बहत्तर': 72, 'तिहत्तर': 73, 'चौहत्तर': 74,
    'पचहत्तर': 75, 'छिहत्तर': 76, 'सतहत्तर': 77, 'अठहत्तर': 78, 'उनासी': 79,
    'अस्सी': 80, 'इक्यासी': 81, 'बयासी': 82, 'तिरासी': 83, 'चौरासी': 84,
    'पचासी': 85, 'छियासी': 86, 'सत्तासी': 87, 'अट्ठासी': 88, 'नवासी': 89,
    'नब्बे': 90, 'इक्यानवे': 91, 'बानवे': 92, 'तिरानवे': 93, 'चौरानवे': 94,
    'पंचानवे': 95, 'छियानवे': 96, 'सत्तानवे': 97, 'अट्ठानवे': 98, 'निन्यानवे': 99,
    'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
    'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15, 'सोलह': 16, 'सत्रह': 17, 'अठारह': 18, 'उन्नीस': 19, 'बीस': 20,
};
const common_1 = require("@nestjs/common");
const call_scripts_1 = require("../calls/call-scripts");
let FactExtractorService = FactExtractorService_1 = class FactExtractorService {
    logger = new common_1.Logger(FactExtractorService_1.name);
    projectPatterns = [
        { name: 'Palace Heights by Rudra', pattern: /(?:palace\s*heights?|rudra|पैलेस\s*हाइट्स?|रुद्रा)/i },
        { name: 'NCR Monarch', pattern: /(?:ncr\s*monarch|monarch|मोनार्क|एनसीआर\s*मोनार्क)/i },
        { name: 'Future Estate by Future World', pattern: /(?:future\s*(?:estate|state|world|projects?)|फ्यूचर\s*(?:एस्टेट|स्टेट|वर्ल्ड))/i },
        { name: 'Aarya Heights by Divyansh', pattern: /(?:aarya\s*heights?|divyansh|आर्या\s*हाइट्स?)/i },
        { name: 'Dholera Capital City', pattern: /(?:dholera|capital\s*city|धोलेरा)/i },
        { name: 'VVIP Pre-Launch / Namah', pattern: /(?:vvip|namah|वीवीआईपी)/i },
        { name: 'Saya South X / Piazza', pattern: /(?:saya\s*(?:south|piazza|projects?|group)?|साया\s*(?:साउथ|पियाज़ा|प्रोजेक्ट|ग्रुप)?)/i },
        { name: 'Apex The Kremlin / Quebec / Rosario', pattern: /(?:apex|kremlin|quebec|rosario|एपेक्स|क्रेमलिन)/i },
        { name: 'Godrej Golf Links / Business City', pattern: /(?:godrej|golf\s*links|गोदरेज)/i },
        { name: 'Sobha Rivana', pattern: /(?:sobha|rivana|शोभा)/i },
        { name: 'Hummingbird by Gulshan', pattern: /(?:hummingbird|gulshan|गुलशन)/i },
    ];
    extractFacts(text, context) {
        return this.extractFromUtterance(text, context);
    }
    extractFromUtterance(text, context) {
        const raw = (text || '').trim();
        const result = {
            facts: {},
            confidenceMap: {},
            isCorrection: false,
            rawSnippets: {},
        };
        if (raw.length < 2)
            return result;
        const lower = raw.toLowerCase();
        const isCorrectionPhrase = /^(?:nahi|nhi|actually|galat|correction|change|not|badal|no|नहीं|बदल)/i.test(lower) ||
            /(?:nahi\s*mera|actually\s*mera|badha\s*kar|ghata\s*kar|pahle\s*nahi|nahi\s*nahi|नहीं\s*बजट|नहीं\s*\d)/i.test(lower);
        const bhkMatch = this.extractBhk(raw);
        if (bhkMatch) {
            result.facts.bhk = bhkMatch.bhk;
            result.confidenceMap.bhk = bhkMatch.confidence;
            result.rawSnippets.bhk = bhkMatch.snippet;
            if (isCorrectionPhrase && (lower.includes('bhk') || lower.includes('बीएचके') || lower.includes('bedroom'))) {
                result.isCorrection = true;
                result.correctionField = 'bhk';
            }
        }
        const budgetMatch = this.extractBudget(raw);
        if (budgetMatch) {
            result.facts.budget = budgetMatch.budget;
            result.facts.budgetLabel = budgetMatch.budgetLabel;
            result.confidenceMap.budget = budgetMatch.confidence;
            result.rawSnippets.budget = budgetMatch.snippet;
            if (isCorrectionPhrase && (lower.includes('budget') || lower.includes('बजट') || lower.includes('lakh') || lower.includes('लाख') || lower.includes('cr') || lower.includes('करोड़'))) {
                result.isCorrection = true;
                result.correctionField = 'budget';
            }
        }
        const purposeMatch = this.extractPurpose(raw);
        if (purposeMatch) {
            result.facts.purpose = purposeMatch.purpose;
            result.confidenceMap.purpose = purposeMatch.confidence;
            result.rawSnippets.purpose = purposeMatch.snippet;
        }
        const locationMatch = this.extractLocation(raw);
        if (locationMatch) {
            result.facts.location = locationMatch.location;
            result.confidenceMap.location = locationMatch.confidence;
            result.rawSnippets.location = locationMatch.snippet;
        }
        const timelineMatch = this.extractTimeline(raw);
        if (timelineMatch) {
            result.facts.timeline = timelineMatch.timeline;
            result.facts.possession = timelineMatch.possession;
            result.confidenceMap.timeline = timelineMatch.confidence;
            result.rawSnippets.timeline = timelineMatch.snippet;
        }
        const { interested, rejected } = this.extractProjects(raw);
        if (interested.length > 0) {
            result.facts.interestedProjects = interested;
            result.confidenceMap.interestedProjects = 'confirmed';
            result.rawSnippets.interestedProjects = interested.join(', ');
        }
        if (rejected.length > 0) {
            result.facts.rejectedProjects = rejected;
            result.confidenceMap.rejectedProjects = 'confirmed';
            result.rawSnippets.rejectedProjects = rejected.join(', ');
        }
        const nameMatch = this.extractName(raw, context);
        if (nameMatch) {
            result.facts.name = nameMatch.name;
            result.confidenceMap.name = nameMatch.confidence;
            result.rawSnippets.name = nameMatch.snippet;
        }
        const propertyTypeMatch = this.extractPropertyType(raw);
        if (propertyTypeMatch) {
            result.facts.propertyType = propertyTypeMatch.propertyType;
            result.confidenceMap.propertyType = propertyTypeMatch.confidence;
            result.rawSnippets.propertyType = propertyTypeMatch.snippet;
        }
        return result;
    }
    normalizeNumerals(text) {
        let out = text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
        for (const [w, n] of Object.entries(HINDI_LAKH_WORDS)) {
            if (out.includes(w)) {
                out = out.replace(new RegExp(w, 'g'), String(n));
            }
        }
        return out;
    }
    extractBhk(text) {
        const norm = this.normalizeNumerals(text);
        const matches = Array.from(norm.matchAll(/(?:^|[\s,।!?])([1-5])\s*(?:bhk|bedroom|bed\s*room|bed|बी\s*एच\s*के|बीएचके|बैडरूम|बेडरूम)(?:$|[\s,।!?])/gi));
        if (matches.length > 0) {
            const last = matches[matches.length - 1];
            return {
                bhk: `${last[1]} BHK`,
                confidence: 'confirmed',
                snippet: last[0].trim(),
            };
        }
        const wordMatches = Array.from(norm.matchAll(/(?:^|[\s,।!?])(studio|one|two|three|four|five|ek|do|teen|chaar|paanch|दो|तीन|चार|एक)\s*(?:bhk|bedroom|बीएचके)(?:$|[\s,।!?])/gi));
        if (wordMatches.length > 0) {
            const last = wordMatches[wordMatches.length - 1];
            const w = last[1].toLowerCase();
            let num = '2';
            if (w.includes('one') || w.includes('ek') || w.includes('एक'))
                num = '1';
            else if (w.includes('two') || w.includes('do') || w.includes('दो'))
                num = '2';
            else if (w.includes('three') || w.includes('teen') || w.includes('तीन'))
                num = '3';
            else if (w.includes('four') || w.includes('chaar') || w.includes('चार'))
                num = '4';
            else if (w.includes('five') || w.includes('paanch') || w.includes('पांच'))
                num = '5';
            else if (w.includes('studio'))
                num = '1';
            return {
                bhk: `${num} BHK`,
                confidence: 'confirmed',
                snippet: last[0].trim(),
            };
        }
        return null;
    }
    extractBudget(text) {
        const norm = this.normalizeNumerals(text);
        const crMatches = Array.from(norm.matchAll(/(\d+(?:\.\d+)?)\s*(?:cr|crore|करोड़|cr\.?)(?:$|[\s,।!?])/gi));
        if (crMatches.length > 0) {
            const last = crMatches[crMatches.length - 1];
            const val = parseFloat(last[1]);
            if (!isNaN(val) && val > 0 && val < 50) {
                return {
                    budget: Math.round(val * 10000000),
                    budgetLabel: `${val} Cr`,
                    confidence: 'confirmed',
                    snippet: last[0].trim(),
                };
            }
        }
        const lakhRangeMatches = Array.from(norm.matchAll(/(\d+)\s*(?:se|to|-)\s*(\d+)\s*(?:lakh|lac|lacs|lakhs|लाख|l)(?:$|[\s,।!?])/gi));
        if (lakhRangeMatches.length > 0) {
            const last = lakhRangeMatches[lakhRangeMatches.length - 1];
            const high = parseInt(last[2], 10);
            return {
                budget: high * 100000,
                budgetLabel: `${last[1]}-${high} Lakh`,
                confidence: 'approximate',
                snippet: last[0].trim(),
            };
        }
        const lakhMatches = Array.from(norm.matchAll(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|lacs|lakhs|लाख|l)(?:$|[\s,।!?])/gi));
        if (lakhMatches.length > 0) {
            const last = lakhMatches[lakhMatches.length - 1];
            const val = parseFloat(last[1]);
            if (!isNaN(val) && val >= 10 && val <= 500) {
                const isApprox = /aas\s*paas|around|lagbhag|लगभग|आसपास/i.test(norm);
                return {
                    budget: Math.round(val * 100000),
                    budgetLabel: `${val} Lakh`,
                    confidence: isApprox ? 'approximate' : 'confirmed',
                    snippet: last[0].trim(),
                };
            }
        }
        const bareMatch = norm.match(/(?:budget|बजट|around|lagbhag|लगभग)\s*(?:is|hai|around)?\s*(\d{2,3})(?:$|[\s,।!?])/i);
        if (bareMatch) {
            const num = parseInt(bareMatch[1], 10);
            if (num >= 25 && num <= 500) {
                return {
                    budget: num * 100000,
                    budgetLabel: `${num} Lakh`,
                    confidence: 'approximate',
                    snippet: bareMatch[0].trim(),
                };
            }
        }
        return null;
    }
    extractPurpose(text) {
        if (/rehne\s*(?:ke\s*liye|k\s*liye)?|apne\s*(?:rehne|liye)|khud\s*rehne|family\s*(?:ke\s*liye)?|रहने\s*(?:के\s*लिए)?|अपने\s*रहने|रहना\s*है/i.test(text)) {
            return { purpose: 'end_use', confidence: 'confirmed', snippet: 'rehne ke liye' };
        }
        if (/invest(?:ment)?|nivesh|rental|kiraye\s*(?:ke\s*liye)?|इन्वेस्टमेंट|निवेश|किराए/i.test(text)) {
            return { purpose: 'investment', confidence: 'confirmed', snippet: 'investment' };
        }
        return null;
    }
    extractLocation(text) {
        const locations = [
            { name: 'Noida Extension', pattern: /(?:noida\s*extension|नोएडा\s*एक्सटेंशन)/i },
            { name: 'Greater Noida West', pattern: /(?:greater\s*noida\s*west|ग्रेनो\s*वेस्ट|ग्रेटर\s*नोएडा\s*वेस्ट)/i },
            { name: 'Greater Noida', pattern: /(?:greater\s*noida|ग्रेटर\s*नोएडा)/i },
            { name: 'Noida', pattern: /(?:noida|नोएडा)/i },
            { name: 'Ghaziabad', pattern: /(?:ghaziabad|गाजियाबाद|raj\s*nagar\s*extension|राज\s*नगर)/i },
            { name: 'Gurgaon', pattern: /(?:gurgaon|gurugram|गुड़गांव|गुरुग्राम)/i },
            { name: 'Yamuna Expressway', pattern: /(?:yamuna\s*expressway|यमुना\s*एक्सप्रेसवे)/i },
            { name: 'Delhi', pattern: /(?:delhi|दिल्ली)/i },
            { name: 'Dholera', pattern: /(?:dholera|धोलेरा)/i },
        ];
        for (const loc of locations) {
            const match = text.match(loc.pattern);
            if (match) {
                return {
                    location: loc.name,
                    confidence: 'confirmed',
                    snippet: match[0],
                };
            }
        }
        return null;
    }
    extractTimeline(text) {
        if (/ready\s*to\s*move|rtm|तुरंत\s*शिफ्ट|रेडी\s*टू\s*मूव/i.test(text)) {
            return {
                timeline: 'Ready to Move',
                possession: 'ready_to_move',
                confidence: 'confirmed',
                snippet: 'ready to move',
            };
        }
        if (/under\s*construction|अंडर\s*कंस्ट्रक्शन|1\s*year|2\s*saal|ek\s*saal/i.test(text)) {
            return {
                timeline: 'Under Construction (1-2 years)',
                possession: 'under_construction',
                confidence: 'confirmed',
                snippet: 'under construction',
            };
        }
        if (/immediate|jaldi|turant|iss\s*mahine|1\s*mahina|3\s*mahine/i.test(text)) {
            return {
                timeline: '1-3 months',
                confidence: 'approximate',
                snippet: '1-3 months',
            };
        }
        return null;
    }
    extractPropertyType(text) {
        if (/(?:commercial|shop|dukaan|retail|office|mall|showroom|शोरूम|दुकान|कमर्शियल|ऑफिस)/i.test(text)) {
            return { propertyType: 'commercial', confidence: 'confirmed', snippet: 'commercial' };
        }
        if (/(?:residential|flat|apartment|ghar|फ्लैट|अपार्टमेंट|रेजिडेंशियल)/i.test(text)) {
            return { propertyType: 'residential', confidence: 'confirmed', snippet: 'residential' };
        }
        return null;
    }
    extractProjects(text) {
        const interested = [];
        const rejected = [];
        for (const proj of this.projectPatterns) {
            const match = proj.pattern.exec(text);
            if (match) {
                const after = text.slice(match.index + match[0].length, match.index + match[0].length + 45);
                const isNegativeImmediate = /^\s*(?:ka\s*nahi|nahi\s*chahiye|nhi\s*chahiye|nahi\s*dekhna|nahi\s*lena|nahi|mat|chodkar|छोड़कर|का\s*नहीं\s*चाहिए|नहीं\s*चाहिए|नहीं\s*देखना|नहीं|नही)/i.test(after);
                if (isNegativeImmediate) {
                    rejected.push(proj.name);
                }
                else {
                    interested.push(proj.name);
                }
            }
        }
        return { interested, rejected };
    }
    extractName(text, context) {
        const clean = (text || '').trim();
        if (clean.length < 2)
            return null;
        let match = null;
        match = clean.match(/(?:mera\s*(?:shubh\s*)?naam|मेरा\s*(?:शुभ\s*)?नाम|my\s*name\s*is|this\s*is|myself)\s*(?:hai|h|:)?\s*([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
        if (!match) {
            match = clean.match(/(?:(?:main|mai|hum|ham|मैं)\s+)?([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)\s+(?:bol\s*(?:raha|rahi)\s*hoon|bol\s*(?:raha|rahi)\s*hu|baat\s*kar\s*(?:raha|rahi)\s*hoon|speaking|here|बोल\s*रहा\s*हूँ|बोल\s*रही\s*हूँ|बात\s*कर\s*रहा\s*हूँ|बात\s*कर\s*रही\s*हूँ)/i);
        }
        if (!match) {
            match = clean.match(/(?:naam|name)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)\s+(?:hai|h)/i);
        }
        const priorAgentText = (context?.priorAgentText || '').toLowerCase();
        const agentAskedName = /shubh\s*naam|aapka\s*naam|your\s*name|may\s*i\s*know\s*your\s*name|naam\s*jaan\s*sakti|शुभ\s*नाम|आपका\s*नाम|नाम\s*जान\s*सकती/i.test(priorAgentText);
        if (!match && agentAskedName) {
            const direct = clean.match(/^(?:haan|ji|haanji|yes|हाँ|जी)?\s*(?:mera\s*naam\s*)?([A-Za-z\u0900-\u097F]{2,20}(?:\s+[A-Za-z\u0900-\u097F]{2,20})?)\s*(?:hai|ji|sir|है)?$/i);
            if (direct) {
                match = direct;
            }
        }
        if (match && match[1]) {
            const candidate = match[1].trim();
            let words = candidate.split(/\s+/).filter(Boolean);
            while (words.length > 0 && call_scripts_1.FORBIDDEN_NAME_WORDS.has(words[0].toLowerCase())) {
                words.shift();
            }
            while (words.length > 0 && call_scripts_1.FORBIDDEN_NAME_WORDS.has(words[words.length - 1].toLowerCase())) {
                words.pop();
            }
            if (words.length >= 1 && words.length <= 3) {
                const allValid = words.every((w) => w.length >= 2 && !call_scripts_1.FORBIDDEN_NAME_WORDS.has(w.toLowerCase()));
                const joined = words.join(' ');
                if (allValid && !(0, call_scripts_1.isPlaceholderLeadName)(joined)) {
                    const formatted = words
                        .map((w) => {
                        if (/^[\u0900-\u097F]+$/.test(w))
                            return w;
                        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
                    })
                        .join(' ');
                    return {
                        name: formatted,
                        confidence: 'confirmed',
                        snippet: match[0],
                    };
                }
            }
        }
        return null;
    }
};
exports.FactExtractorService = FactExtractorService;
exports.FactExtractorService = FactExtractorService = FactExtractorService_1 = __decorate([
    (0, common_1.Injectable)()
], FactExtractorService);
//# sourceMappingURL=fact-extractor.service.js.map