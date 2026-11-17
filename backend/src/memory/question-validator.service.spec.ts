import { QuestionValidatorService } from './question-validator.service';
import { ConversationState } from './memory.types';

describe('QuestionValidatorService', () => {
  let service: QuestionValidatorService;

  beforeEach(() => {
    service = new QuestionValidatorService();
  });

  const mockState = (overrides?: Partial<ConversationState>): ConversationState => ({
    callId: 'call-123',
    leadId: 'lead-456',
    phone: '+919876543210',
    isReturningCustomer: false,
    customer: {
      name: 'Rahul',
      purpose: 'end_use',
      bhk: '3 BHK',
      budget: 8000000,
      budgetLabel: '80 Lakh',
      location: 'Noida Extension',
      timeline: null,
      possession: null,
      interestedProjects: [],
      siteVisit: null,
    },
    answeredFields: ['bhk', 'budget', 'purpose', 'location'],
    askedQuestions: ['कितने बीएचके देख रहे हैं?'],
    pendingQuestion: null,
    lastIntent: null,
    conversationStage: 'requirement_gathering',
    conversationSummary: '',
    lastAssistantResponse: '',
    confirmedFacts: {},
    approximateFacts: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  it('should flag and replace BHK question if BHK is already answered in memory', () => {
    const state = mockState();
    const result = service.validateAndSanitize(
      'आप 2 बीएचके देख रहे हैं या 3 बीएचके?',
      state,
    );

    expect(result.allowed).toBe(false);
    expect(result.targetField).toBe('bhk');
    expect(result.sanitizedText).not.toContain('2 बीएचके');
    expect(result.sanitizedText).toContain('3 BHK');
  });

  it('should flag and replace budget question if budget is already answered in memory', () => {
    const state = mockState();
    const result = service.validateAndSanitize(
      'आपका बजट कितना है?',
      state,
    );

    expect(result.allowed).toBe(false);
    expect(result.targetField).toBe('budget');
    expect(result.sanitizedText).not.toContain('बजट कितना है');
  });

  it('should allow asking a field that has NOT been answered yet (e.g. timeline)', () => {
    const state = mockState({ answeredFields: ['bhk', 'budget'] });
    const result = service.validateAndSanitize(
      'आप कब तक शिफ्ट होने की सोच रहे हैं?',
      state,
    );

    expect(result.allowed).toBe(true);
    expect(result.targetField).toBe('timeline');
    expect(result.sanitizedText).toBe('आप कब तक शिफ्ट होने की सोच रहे हैं?');
  });

  it('should allow normal conversation sentences that are not repetitive questions', () => {
    const state = mockState();
    const sentence = 'जी बिल्कुल, हमारे पास बहुत अच्छे विकल्प उपलब्ध हैं।';
    const result = service.validateAndSanitize(sentence, state);

    expect(result.allowed).toBe(true);
    expect(result.sanitizedText).toBe(sentence);
  });

  it('should preserve informative prefix and replace only the repeated question clause', () => {
    const state = mockState({
      answeredFields: ['bhk', 'budget', 'purpose'],
      customer: {
        name: 'Rahul',
        bhk: '2 BHK',
        budget: 8000000,
        budgetLabel: '80 Lakh',
        purpose: 'end_use',
        location: null,
        timeline: null,
        possession: 'ready_to_move',
        interestedProjects: [],
        siteVisit: null,
      },
    });

    const input = 'जी बिल्कुल, Ready-to-Move property ही देखते हैं। आप 2 BHK देख रहे हैं या 3 BHK?';
    const result = service.validateAndSanitize(input, state);

    expect(result.allowed).toBe(false);
    expect(result.targetField).toBe('bhk');
    // Informational prefix MUST be preserved!
    expect(result.sanitizedText).toContain('जी बिल्कुल, Ready-to-Move property ही देखते हैं।');
    // Repeated question clause must be replaced with next missing field (location)
    expect(result.sanitizedText).not.toContain('2 BHK देख रहे हैं या 3 BHK');
    expect(result.sanitizedText).toContain('लोकेशन');
  });
});

