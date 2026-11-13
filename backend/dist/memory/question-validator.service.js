"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var QuestionValidatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionValidatorService = void 0;
const common_1 = require("@nestjs/common");
let QuestionValidatorService = QuestionValidatorService_1 = class QuestionValidatorService {
    logger = new common_1.Logger(QuestionValidatorService_1.name);
    questionDetectors = {
        bhk: /(?:2\s*(?:bhk|बीएचके).*?(?:ya|या|or).*?3\s*(?:bhk|बीएचके)|kitne\s*bhk|कितने\s*(?:bhk|बीएचके)|kaunsa\s*bhk|कौनसा\s*(?:bhk|बीएचके)|configuration|कॉन्फ़िगरेशन|दो\s*bedroom\s*या\s*तीन|two\s*bedroom\s*ya\s*three)/i,
        budget: /(?:budget|kitna\s*budget|approximate\s*budget|बजट|कितना\s*बजट)/i,
        purpose: /(?:rehne\s*ke\s*liye|investment\s*ke\s*liye|end\s*use|रहने\s*के\s*लिए|इन्वेस्टमेंट)/i,
        name: /(?:shubh\s*naam|aapka\s*naam|शुभ\s*नाम|आपका\s*नाम)/i,
        timeline: /(?:kab\s*tak\s*shift|possession\s*kab|ready\s*to\s*move|under\s*construction|कब\s*तक|पजेशन|शिफ्ट)/i,
        siteVisit: /(?:site\s*visit|sample\s*flat|साइट\s*विजिट|सैंपल\s*फ्लैट)/i,
    };
    validateAndSanitize(first, second) {
        let state;
        let sentence;
        if (typeof first === 'string') {
            sentence = first;
            state = second;
        }
        else {
            state = first;
            sentence = second;
        }
        const raw = (sentence || '').trim();
        if (!raw) {
            return { sanitized: '', sanitizedText: '', allowed: true, wasRepeated: false };
        }
        const isPastContextGreeting = /(?:swagat|स्वागत|welcome|pichhli\s*baar|पिछली\s*बार|baat\s*hui\s*thi|बात\s*हुई\s*थी|usi\s*ke\s*regarding|उसी\s*के\s*रिगार्डिंग|phir\s*se\s*swagat|फिर\s*से\s*स्वागत|dobara\s*call|दोबारा\s*कॉल)/i.test(raw);
        if (isPastContextGreeting) {
            return { sanitized: raw, sanitizedText: raw, allowed: true, wasRepeated: false };
        }
        const isQuestion = raw.includes('?') || /^(?:kya|aap|bataiye|kaun|kitna|क्या|आप|बताइए|कितना)/i.test(raw);
        if (!isQuestion) {
            return { sanitized: raw, sanitizedText: raw, allowed: true, wasRepeated: false };
        }
        const answered = new Set((state.answeredFields || []).map((f) => f.toLowerCase()));
        const customer = state.customer || {};
        if (this.questionDetectors.bhk.test(raw) &&
            (customer.bhk || answered.has('bhk'))) {
            this.logger.warn(`[Anti-Repetition] Blocked repeated BHK question for callId=${state.callId}. Customer already provided: ${customer.bhk}`);
            const ack = customer.bhk ? `जी बिल्कुल, आप ${customer.bhk} देख रहे हैं। ` : '';
            const replacement = `${ack}${this.getNextUnaskedQuestion(state, 'bhk')}`;
            return {
                sanitized: replacement,
                sanitizedText: replacement,
                allowed: false,
                wasRepeated: true,
                blockedField: 'bhk',
                targetField: 'bhk',
                replacementApplied: Boolean(replacement),
            };
        }
        if (this.questionDetectors.budget.test(raw) &&
            (customer.budget || customer.budgetLabel || answered.has('budget'))) {
            this.logger.warn(`[Anti-Repetition] Blocked repeated Budget question for callId=${state.callId}. Customer already provided: ${customer.budgetLabel || customer.budget}`);
            const ack = customer.budgetLabel ? `जी, आपका बजट ${customer.budgetLabel} हमने नोट कर लिया है। ` : '';
            const replacement = `${ack}${this.getNextUnaskedQuestion(state, 'budget')}`;
            return {
                sanitized: replacement,
                sanitizedText: replacement,
                allowed: false,
                wasRepeated: true,
                blockedField: 'budget',
                targetField: 'budget',
                replacementApplied: Boolean(replacement),
            };
        }
        if (this.questionDetectors.purpose.test(raw) &&
            (customer.purpose || answered.has('purpose'))) {
            this.logger.warn(`[Anti-Repetition] Blocked repeated Purpose question for callId=${state.callId}. Customer purpose is: ${customer.purpose}`);
            const replacement = this.getNextUnaskedQuestion(state, 'purpose');
            return {
                sanitized: replacement,
                sanitizedText: replacement,
                allowed: false,
                wasRepeated: true,
                blockedField: 'purpose',
                targetField: 'purpose',
                replacementApplied: Boolean(replacement),
            };
        }
        if (this.questionDetectors.name.test(raw) &&
            (customer.name && customer.name !== 'Inbound Caller' || answered.has('name'))) {
            this.logger.warn(`[Anti-Repetition] Blocked repeated Name question for callId=${state.callId}. Caller name is: ${customer.name}`);
            const replacement = this.getNextUnaskedQuestion(state, 'name');
            return {
                sanitized: replacement,
                sanitizedText: replacement,
                allowed: false,
                wasRepeated: true,
                blockedField: 'name',
                targetField: 'name',
                replacementApplied: Boolean(replacement),
            };
        }
        if (this.questionDetectors.timeline.test(raw) &&
            (customer.timeline || customer.possession || answered.has('timeline'))) {
            this.logger.warn(`[Anti-Repetition] Blocked repeated Timeline question for callId=${state.callId}.`);
            const replacement = this.getNextUnaskedQuestion(state, 'timeline');
            return {
                sanitized: replacement,
                sanitizedText: replacement,
                allowed: false,
                wasRepeated: true,
                blockedField: 'timeline',
                targetField: 'timeline',
                replacementApplied: Boolean(replacement),
            };
        }
        let detectedTargetField;
        if (this.questionDetectors.timeline.test(raw))
            detectedTargetField = 'timeline';
        else if (this.questionDetectors.budget.test(raw))
            detectedTargetField = 'budget';
        else if (this.questionDetectors.purpose.test(raw))
            detectedTargetField = 'purpose';
        else if (this.questionDetectors.bhk.test(raw))
            detectedTargetField = 'bhk';
        return {
            sanitized: raw,
            sanitizedText: raw,
            allowed: true,
            wasRepeated: false,
            targetField: detectedTargetField,
        };
    }
    getNextUnaskedQuestion(state, skipField) {
        const answered = new Set((state.answeredFields || []).map((f) => f.toLowerCase()));
        const asked = new Set((state.askedQuestions || []).map((q) => q.toLowerCase()));
        const c = state.customer || {};
        if (skipField !== 'bhk' && !c.bhk && !answered.has('bhk') && !asked.has('ask_bhk')) {
            return 'आप 2 बीएचके फ्लैट देख रहे हैं या 3 बीएचके?';
        }
        if (skipField !== 'purpose' && !c.purpose && !answered.has('purpose') && !asked.has('ask_purpose')) {
            return 'क्या आप इसमें रहने के लिए फ्लैट चाहते हैं या इन्वेस्टमेंट के लिए?';
        }
        if (skipField !== 'budget' && !c.budget && !c.budgetLabel && !answered.has('budget') && !asked.has('ask_budget')) {
            return 'आपका लगभग बजट कितना है?';
        }
        if (skipField !== 'timeline' && !c.timeline && !answered.has('timeline') && !asked.has('ask_timeline')) {
            return 'आप कब तक शिफ्ट करने का प्लान कर रहे हैं — रेडी टू मूव या अंडर कंस्ट्रक्शन चलेगा?';
        }
        if (!c.siteVisit?.interested && !asked.has('offer_visit')) {
            return 'क्या आप इस वीकेंड प्रोजेक्ट का सैंपल फ्लैट देखने के लिए साइट विजिट प्लान करना चाहेंगे?';
        }
        return 'क्या इस प्रोजेक्ट के बारे में आप कुछ और भी जानना चाहते हैं?';
    }
};
exports.QuestionValidatorService = QuestionValidatorService;
exports.QuestionValidatorService = QuestionValidatorService = QuestionValidatorService_1 = __decorate([
    (0, common_1.Injectable)()
], QuestionValidatorService);
//# sourceMappingURL=question-validator.service.js.map