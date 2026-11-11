import { Injectable, Logger } from '@nestjs/common';
import { CustomerFacts, FactConfidence } from './memory.types';

export interface ExtractedTurnFacts {
  facts: Partial<CustomerFacts>;
  confidenceMap: Record<string, FactConfidence>;
  isCorrection: boolean;
  correctionField?: string;
  rawSnippets: Record<string, string>;
}

@Injectable()
export class FactExtractorService {
  private readonly logger = new Logger(FactExtractorService.name);

  // Common catalog projects for matching
  private readonly projectPatterns: Array<{ name: string; pattern: RegExp }> = [
    { name: 'Palace Heights by Rudra', pattern: /(?:palace\s*heights?|rudra|पैलेस\s*हाइट्स?|रुद्रा)/i },
    { name: 'NCR Monarch', pattern: /(?:ncr\s*monarch|monarch|मोनार्क|एनसीआर\s*मोनार्क)/i },
    { name: 'Future Estate by Future World', pattern: /(?:future\s*estate|future\s*world|फ्यूचर\s*एस्टेट)/i },
    { name: 'Aarya Heights by Divyansh', pattern: /(?:aarya\s*heights?|divyansh|आर्या\s*हाइट्स?)/i },
    { name: 'Dholera Capital City', pattern: /(?:dholera|capital\s*city|धोलेरा)/i },
    { name: 'VVIP Pre-Launch / Namah', pattern: /(?:vvip|namah|वीवीआईपी)/i },
    { name: 'Saya South X / Piazza', pattern: /(?:saya\s*south|saya\s*piazza|साया\s*साउथ|साया\s*पियाज़ा|साया)/i },
    { name: 'Apex The Kremlin / Quebec / Rosario', pattern: /(?:apex|kremlin|quebec|rosario|एपेक्स|क्रेमलिन)/i },
    { name: 'Godrej Golf Links / Business City', pattern: /(?:godrej|golf\s*links|गोदरेज)/i },
    { name: 'Sobha Rivana', pattern: /(?:sobha|rivana|शोभा)/i },
    { name: 'Hummingbird by Gulshan', pattern: /(?:hummingbird|gulshan|गुलशन)/i },
  ];

  /**
   * Alias for extractFromUtterance
   */
  extractFacts(text: string): ExtractedTurnFacts {
    return this.extractFromUtterance(text);
  }

  /**
   * Extract customer facts from the caller's latest utterance.
   */
  extractFromUtterance(text: string): ExtractedTurnFacts {
    const raw = (text || '').trim();
    const result: ExtractedTurnFacts = {
      facts: {},
      confidenceMap: {},
      isCorrection: false,
      rawSnippets: {},
    };

    if (raw.length < 2) return result;

    const lower = raw.toLowerCase();

    // Check for explicit correction indicators
    const isCorrectionPhrase =
      /^(?:nahi|nhi|actually|galat|correction|change|not|badal|no|नहीं|बदल)/i.test(lower) ||
      /(?:nahi\s*mera|actually\s*mera|badha\s*kar|ghata\s*kar|pahle\s*nahi|nahi\s*nahi|नहीं\s*बजट|नहीं\s*\d)/i.test(lower);

    // 1. BHK Extraction
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

    // 2. Budget Extraction
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

    // 3. Purpose Extraction (End-Use vs Investment)
    const purposeMatch = this.extractPurpose(raw);
    if (purposeMatch) {
      result.facts.purpose = purposeMatch.purpose;
      result.confidenceMap.purpose = purposeMatch.confidence;
      result.rawSnippets.purpose = purposeMatch.snippet;
    }

    // 4. Location Extraction
    const locationMatch = this.extractLocation(raw);
    if (locationMatch) {
      result.facts.location = locationMatch.location;
      result.confidenceMap.location = locationMatch.confidence;
      result.rawSnippets.location = locationMatch.snippet;
    }

    // 5. Possession / Timeline Extraction
    const timelineMatch = this.extractTimeline(raw);
    if (timelineMatch) {
      result.facts.timeline = timelineMatch.timeline;
      result.facts.possession = timelineMatch.possession;
      result.confidenceMap.timeline = timelineMatch.confidence;
      result.rawSnippets.timeline = timelineMatch.snippet;
    }

    // 6. Project Interest Extraction
    const matchedProjects = this.extractProjects(raw);
    if (matchedProjects.length > 0) {
      result.facts.interestedProjects = matchedProjects;
      result.confidenceMap.interestedProjects = 'confirmed';
      result.rawSnippets.interestedProjects = matchedProjects.join(', ');
    }

    // 7. Customer Name Extraction
    const nameMatch = this.extractName(raw);
    if (nameMatch) {
      result.facts.name = nameMatch.name;
      result.confidenceMap.name = nameMatch.confidence;
      result.rawSnippets.name = nameMatch.snippet;
    }

    return result;
  }

  private normalizeNumerals(text: string): string {
    return text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
  }

  private extractBhk(text: string): { bhk: string; confidence: FactConfidence; snippet: string } | null {
    const norm = this.normalizeNumerals(text);

    // Collect all matches to pick the last one in case of correction (e.g. "2 bhk nahi, 3 bhk chahiye")
    const matches = Array.from(
      norm.matchAll(/(?:^|[\s,।!?])([1-5])\s*(?:bhk|bedroom|bed\s*room|bed|बी\s*एच\s*के|बीएचके|बैडरूम|बेडरूम)(?:$|[\s,।!?])/gi),
    );

    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      return {
        bhk: `${last[1]} BHK`,
        confidence: 'confirmed',
        snippet: last[0].trim(),
      };
    }

    // Word forms (studio, two, three, teen, etc.)
    const wordMatches = Array.from(
      norm.matchAll(/(?:^|[\s,।!?])(studio|one|two|three|four|five|ek|do|teen|chaar|paanch|दो|तीन|चार|एक)\s*(?:bhk|bedroom|बीएचके)(?:$|[\s,।!?])/gi),
    );

    if (wordMatches.length > 0) {
      const last = wordMatches[wordMatches.length - 1];
      const w = last[1].toLowerCase();
      let num = '2';
      if (w.includes('one') || w.includes('ek') || w.includes('एक')) num = '1';
      else if (w.includes('two') || w.includes('do') || w.includes('दो')) num = '2';
      else if (w.includes('three') || w.includes('teen') || w.includes('तीन')) num = '3';
      else if (w.includes('four') || w.includes('chaar') || w.includes('चार')) num = '4';
      else if (w.includes('five') || w.includes('paanch') || w.includes('पांच')) num = '5';
      else if (w.includes('studio')) num = '1';

      return {
        bhk: `${num} BHK`,
        confidence: 'confirmed',
        snippet: last[0].trim(),
      };
    }

    return null;
  }

  private extractBudget(text: string): { budget: number; budgetLabel: string; confidence: FactConfidence; snippet: string } | null {
    const norm = this.normalizeNumerals(text);

    // Match Crore: e.g. 1.5 Cr, 1 करोड़, 2 cr
    const crMatches = Array.from(
      norm.matchAll(/(\d+(?:\.\d+)?)\s*(?:cr|crore|करोड़|cr\.?)(?:$|[\s,।!?])/gi),
    );
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

    // Match Lakh: e.g. 80 lakh, 80L, 80 लाख, 95 lac, 60-70 lakh
    const lakhRangeMatches = Array.from(
      norm.matchAll(/(\d+)\s*(?:se|to|-)\s*(\d+)\s*(?:lakh|lac|lacs|lakhs|लाख|l)(?:$|[\s,।!?])/gi),
    );
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

    const lakhMatches = Array.from(
      norm.matchAll(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|lacs|lakhs|लाख|l)(?:$|[\s,।!?])/gi),
    );
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

    // Bare numbers with budget context: e.g. "budget 80 hai", "budget around 75", "बजट 90"
    const bareMatch = norm.match(
      /(?:budget|बजट|around|lagbhag|लगभग)\s*(?:is|hai|around)?\s*(\d{2,3})(?:$|[\s,।!?])/i,
    );
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

  private extractPurpose(text: string): { purpose: 'end_use' | 'investment'; confidence: FactConfidence; snippet: string } | null {
    if (
      /rehne\s*(?:ke\s*liye|k\s*liye)?|apne\s*(?:rehne|liye)|khud\s*rehne|family\s*(?:ke\s*liye)?|रहने\s*(?:के\s*लिए)?|अपने\s*रहने|रहना\s*है/i.test(
        text,
      )
    ) {
      return { purpose: 'end_use', confidence: 'confirmed', snippet: 'rehne ke liye' };
    }

    if (
      /invest(?:ment)?|nivesh|rental|kiraye\s*(?:ke\s*liye)?|इन्वेस्टमेंट|निवेश|किराए/i.test(
        text,
      )
    ) {
      return { purpose: 'investment', confidence: 'confirmed', snippet: 'investment' };
    }

    return null;
  }

  private extractLocation(text: string): { location: string; confidence: FactConfidence; snippet: string } | null {
    const locations: Array<{ name: string; pattern: RegExp }> = [
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

  private extractTimeline(text: string): { timeline: string; possession?: string; confidence: FactConfidence; snippet: string } | null {
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

  private extractProjects(text: string): string[] {
    const matched: string[] = [];
    for (const proj of this.projectPatterns) {
      if (proj.pattern.test(text)) {
        matched.push(proj.name);
      }
    }
    return matched;
  }

  private extractName(text: string): { name: string; confidence: FactConfidence; snippet: string } | null {
    const match = text.match(
      /(?:mera\s*naam|my\s*name\s*is|naam\s*hai|naam\s*h|i\s*am|मैं|मेरा\s*नाम)\s*([A-Za-z\u0900-\u097F]+)/i,
    );
    if (match && match[1]) {
      const candidate = match[1].trim();
      const forbidden = /^(?:nahi|haan|bhk|flat|budget|ha|yes|no|sir|madam|ji)$/i;
      if (candidate.length >= 3 && !forbidden.test(candidate)) {
        return {
          name: candidate,
          confidence: 'confirmed',
          snippet: match[0],
        };
      }
    }
    return null;
  }
}
