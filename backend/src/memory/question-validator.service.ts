import { Injectable, Logger } from '@nestjs/common';
import { ConversationState } from './memory.types';
import { isPlaceholderLeadName } from '../calls/call-scripts';

export interface ValidationResult {
  sanitized: string;
  sanitizedText?: string;
  allowed?: boolean;
  wasRepeated: boolean;
  blockedField?: string;
  targetField?: string;
  replacementApplied?: boolean;
  reason?: string;
}

@Injectable()
export class QuestionValidatorService {
  private readonly logger = new Logger(QuestionValidatorService.name);

  // Regex patterns detecting specific questions being asked by the AI
  private readonly questionDetectors = {
    bhk: /(?:2\s*(?:bhk|बीएचके).*?(?:ya|या|or).*?3\s*(?:bhk|बीएचके)|kitne\s*bhk|कितने\s*(?:bhk|बीएचके)|kaunsa\s*bhk|कौनसा\s*(?:bhk|बीएचके)|configuration|कॉन्फ़िगरेशन|दो\s*(?:bhk|बीएचके|bedroom)\s*या\s*तीन|two\s*bedroom\s*ya\s*three)/i,
    budget: /(?:(?:aapka|approximate|lagbhag|kya|kitna)\s*(?:kitna\s*)?budget|budget\s*(?:kitna|kya|hoga|bataiye|bataen|hona\s*chahiye)|kitne\s*budget\s*tak|कितना\s*बजट|बजट\s*(?:कितना|क्या|बताइए|होगा)|आपका\s*बजट)/i,
    purpose: /(?:rehne\s*ke\s*liye|investment\s*ke\s*liye|end\s*use|रहने\s*के\s*लिए|इन्वेस्टमेंट)/i,
    name: /(?:shubh\s*naam|aapka\s*naam|शुभ\s*नाम|आपका\s*नाम)/i,
    timeline: /(?:kab\s*tak\s*shift|possession\s*kab|कब\s*तक|पजेशन|शिफ्ट)/i,
    location: /(?:kaunsi\s*location|kaha\s*pe|kahan\s*dekh|preferred\s*location|लोकेशन|कहाँ\s*पर)/i,
    siteVisit: /(?:site\s*visit|sample\s*flat|साइट\s*विजिट|सैंपल\s*फ्लैट)/i,
  };

  /**
   * Check if text is informing about an above-budget property, disclosing price difference,
   * or asking permission to discuss stretch-budget details (Categories 2, 3, 4).
   * These must NEVER be classified as a repeated budget question.
   */
  isBudgetInformingOrPermission(text: string): boolean {
    const s = text.toLowerCase();
    // Category 2: Informing customer about an above-budget property
    // e.g. "budget se 11 Lakh upar hai", "budget se thoda upar", "budget exceed karta hai"
    if (/(?:budget\s*se\s*(?:upar|jyada|extra|above|exceed|\d+)|बजट\s*से\s*(?:ऊपर|ज्यादा|\d+))/i.test(s)) {
      return true;
    }
    // Category 3: Disclosing exact price difference in Lakhs / Cr
    // e.g. "₹80 Lakh budget se ₹11 Lakh upar", "₹6.32 Lakh above budget"
    if (/(?:₹?\d+(?:\.\d+)?\s*(?:lakh|cr|लाख|करोड़).*?(?:upar|above|diff|extra)|(?:upar|above|difference|diff).*?₹?\d+(?:\.\d+)?\s*(?:lakh|cr|लाख|करोड़))/i.test(s)) {
      return true;
    }
    // Category 4: Asking permission to discuss a stretch-budget property
    // e.g. "kya main iski aur details aapko bataun?", "kya aap stretch budget dekhna chahenge?"
    if (/(?:stretch\s*budget|details\s*(?:aapko\s*)?bataun|aur\s*details\s*bataun|iski\s*details\s*bataun|details\s*share\s*karun|kya\s*main\s*iski|kya\s*aap\s*dekhna\s*chahenge|kya\s*hum\s*discuss\s*karein)/i.test(s)) {
      return true;
    }
    // In-budget property guidance: e.g. "aapke budget mein fit hota hai", "budget ke mutabik"
    if (/(?:budget\s*mein|budget\s*ke\s*(?:hisaab|mutabik|andar)|बजट\s*में|बजट\s*के\s*अनुसार)/i.test(s)) {
      return true;
    }
    return false;
  }

  /**
   * Only Category 1: Asking customer to state or confirm their budget.
   */
  isAskingCustomerBudget(text: string): boolean {
    if (this.isBudgetInformingOrPermission(text)) {
      return false;
    }
    return this.questionDetectors.budget.test(text);
  }

  /**
   * Asking customer for their BHK preference.
   * Stating property configurations (e.g. "2 BHK ₹91 Lakh se start hota hai") is NOT asking BHK.
   */
  isAskingCustomerBhk(text: string): boolean {
    const s = text.toLowerCase();
    if (/(?:start\s*hota|available\s*hai|available\s*hain|ka\s*size|sqft|sq\.?\s*ft|₹|bsp)/i.test(s)) {
      return false;
    }
    return this.questionDetectors.bhk.test(text);
  }

  /**
   * Split a sentence into an informational prefix (which must be preserved)
   * and a trailing question clause.
   */
  splitInfoAndQuestion(sentence: string): { prefix: string; questionClause: string } {
    const raw = sentence.trim();

    // 1. Standard sentence punctuation dividers (preserve punctuation with prefix)
    const lastPunctuation = Math.max(
      raw.lastIndexOf('. '),
      raw.lastIndexOf('! '),
      raw.lastIndexOf('। '),
      raw.lastIndexOf('? '),
    );

    if (lastPunctuation > 8) {
      return {
        prefix: raw.slice(0, lastPunctuation + 1).trim(),
        questionClause: raw.slice(lastPunctuation + 1).trim(),
      };
    }

    // 2. Dash or comma clause dividers
    const clauseMarkers = [
      /\s+—\s+(?=(?:kya|aap|क्या|आप))/i,
      /\s+-\s+(?=(?:kya|aap|क्या|आप))/i,
      /,\s+(?=(?:kya|aap|bataiye|क्या|आप|बताइए))/i,
    ];

    for (const marker of clauseMarkers) {
      const match = marker.exec(raw);
      if (match && match.index > 8) {
        const prefix = raw.slice(0, match.index).trim();
        const questionClause = raw.slice(match.index + match[0].length).trim();
        return { prefix, questionClause };
      }
    }

    return { prefix: '', questionClause: raw };
  }

  /**
   * Validate a sentence before sending to TTS.
   * If it repeatedly asks a question that the customer has already answered,
   * it intelligently replaces or removes the redundant question.
   */
  validateAndSanitize(
    first: ConversationState | string,
    second: ConversationState | string,
  ): ValidationResult {
    let state: ConversationState;
    let sentence: string;

    if (typeof first === 'string') {
      sentence = first;
      state = second as ConversationState;
    } else {
      state = first;
      sentence = second as string;
    }

    const raw = (sentence || '').trim();
    if (!raw) {
      return { sanitized: '', sanitizedText: '', allowed: true, wasRepeated: false };
    }

    // Do NOT sanitize opening greetings or past-interaction references
    const isPastContextGreeting =
      /(?:swagat|स्वागत|welcome|pichhli\s*baar|पिछली\s*बार|baat\s*hui\s*thi|बात\s*हुई\s*थी|usi\s*ke\s*regarding|उसी\s*के\s*रिगार्डिंग|phir\s*se\s*swagat|फिर\s*से\s*स्वागत|dobara\s*call|दोबारा\s*कॉल)/i.test(
        raw,
      );
    if (isPastContextGreeting) {
      return { sanitized: raw, sanitizedText: raw, allowed: true, wasRepeated: false };
    }

    const isQuestion = raw.includes('?') || /^(?:kya|aap|bataiye|kaun|kitna|क्या|आप|बताइए|कितना)/i.test(raw);

    // If it's not a question (e.g. an informational answer or greeting), keep it!
    if (!isQuestion) {
      return { sanitized: raw, sanitizedText: raw, allowed: true, wasRepeated: false };
    }

    const { prefix, questionClause } = this.splitInfoAndQuestion(raw);
    const targetText = questionClause || raw;

    const answered = new Set((state.answeredFields || []).map((f) => f.toLowerCase()));
    const customer = state.customer || {};
    const isRoman = !/[\u0900-\u097F]/.test(raw);

    const buildSanitized = (blockedField: string, ackText: string): string => {
      const nextQ = this.getNextUnaskedQuestion(state, blockedField, isRoman);
      if (prefix && prefix.trim().length > 8) {
        return `${prefix.trim()} ${nextQ}`.trim();
      }
      return `${ackText}${nextQ}`.trim();
    };

    // 1. Check BHK question repetition (strictly check if asking preference, not project data)
    if (
      this.isAskingCustomerBhk(targetText) &&
      (customer.bhk || answered.has('bhk'))
    ) {
      this.logger.warn(
        `[Anti-Repetition] Blocked repeated BHK question for callId=${state.callId}. Customer already provided: ${customer.bhk}`,
      );
      const ack = customer.bhk
        ? isRoman
          ? `Ji bilkul, aap ${customer.bhk} dekh rahe hain. `
          : `जी बिल्कुल, आप ${customer.bhk} देख रहे हैं। `
        : '';
      const replacement = buildSanitized('bhk', ack);
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

    // 2. Check Budget question repetition (strictly check Category 1; never block Categories 2, 3, 4)
    if (
      this.isAskingCustomerBudget(targetText) &&
      (customer.budget || customer.budgetLabel || answered.has('budget'))
    ) {
      this.logger.warn(
        `[Anti-Repetition] Blocked repeated Budget question for callId=${state.callId}. Customer already provided: ${customer.budgetLabel || customer.budget}`,
      );
      const ack = customer.budgetLabel
        ? isRoman
          ? `Ji, aapka budget ${customer.budgetLabel} humne note kar liya hai. `
          : `जी, आपका बजट ${customer.budgetLabel} हमने नोट कर लिया है। `
        : '';
      const replacement = buildSanitized('budget', ack);
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

    // 3. Check Purpose question repetition
    if (
      this.questionDetectors.purpose.test(targetText) &&
      (customer.purpose || answered.has('purpose'))
    ) {
      this.logger.warn(
        `[Anti-Repetition] Blocked repeated Purpose question for callId=${state.callId}. Customer purpose is: ${customer.purpose}`,
      );
      const replacement = buildSanitized('purpose', '');
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

    // 4. Check Name question repetition
    if (
      this.questionDetectors.name.test(targetText) &&
      ((customer.name && customer.name !== 'Inbound Caller' && !isPlaceholderLeadName(customer.name)) || answered.has('name'))
    ) {
      this.logger.warn(
        `[Anti-Repetition] Blocked repeated Name question for callId=${state.callId}. Caller name is: ${customer.name}`,
      );
      const replacement = buildSanitized('name', '');
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

    // 5. Check Timeline / Possession question repetition
    if (
      this.questionDetectors.timeline.test(targetText) &&
      (customer.timeline || customer.possession || answered.has('timeline') || answered.has('possession'))
    ) {
      this.logger.warn(
        `[Anti-Repetition] Blocked repeated Timeline question for callId=${state.callId}.`,
      );
      const replacement = buildSanitized('timeline', '');
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

    // Passed all anti-repetition checks cleanly
    let detectedTargetField: string | undefined;
    if (this.questionDetectors.timeline.test(raw)) detectedTargetField = 'timeline';
    else if (this.questionDetectors.budget.test(raw)) detectedTargetField = 'budget';
    else if (this.questionDetectors.purpose.test(raw)) detectedTargetField = 'purpose';
    else if (this.questionDetectors.bhk.test(raw)) detectedTargetField = 'bhk';
    else if (this.questionDetectors.location.test(raw)) detectedTargetField = 'location';

    return {
      sanitized: raw,
      sanitizedText: raw,
      allowed: true,
      wasRepeated: false,
      targetField: detectedTargetField,
    };
  }

  /**
   * Determine the next logical, unasked question in the real-estate qualification journey.
   */
  private getNextUnaskedQuestion(
    state: ConversationState,
    skipField?: string,
    isRoman = false,
  ): string {
    const answered = new Set((state.answeredFields || []).map((f) => f.toLowerCase()));
    const asked = new Set((state.askedQuestions || []).map((q) => q.toLowerCase()));
    const c = state.customer || {};

    if (skipField !== 'bhk' && !c.bhk && !answered.has('bhk') && !asked.has('ask_bhk')) {
      return isRoman
        ? 'Aap 2 BHK flat dekh rahe hain ya 3 BHK?'
        : 'आप 2 बीएचके फ्लैट देख रहे हैं या 3 बीएचके?';
    }

    if (skipField !== 'purpose' && !c.purpose && !answered.has('purpose') && !asked.has('ask_purpose')) {
      return isRoman
        ? 'Kya aap isme rehne ke liye flat dekh rahe hain ya investment ke liye?'
        : 'क्या आप इसमें रहने के लिए फ्लैट चाहते हैं या इन्वेस्टमेंट के लिए?';
    }

    if (skipField !== 'budget' && !c.budget && !c.budgetLabel && !answered.has('budget') && !asked.has('ask_budget')) {
      return isRoman
        ? 'Aapka lagbhag budget kitna hai?'
        : 'आपका लगभग बजट कितना है?';
    }

    if (skipField !== 'location' && !c.location && !answered.has('location') && !asked.has('ask_location')) {
      return isRoman
        ? 'Aap kis location mein property prefer karenge?'
        : 'आप किस लोकेशन में प्रॉपर्टी प्रेफर करेंगे?';
    }

    if (skipField !== 'timeline' && !c.timeline && !c.possession && !answered.has('timeline') && !answered.has('possession') && !asked.has('ask_timeline')) {
      return isRoman
        ? 'Aap kab tak shift karne ka plan kar rahe hain — ready to move ya under construction chalega?'
        : 'आप कब तक शिफ्ट करने का प्लान कर रहे हैं — रेडी टू मूव या अंडर कंस्ट्रक्शन चलेगा?';
    }

    // If all essential profile fields are answered, ask politely if they want more details about the project
    return isRoman
      ? 'Kya is project ke baare mein aap kuch aur jaanna chahte hain?'
      : 'क्या इस प्रोजेक्ट के बारे में आप कुछ और जानना चाहते हैं?';
  }
}
