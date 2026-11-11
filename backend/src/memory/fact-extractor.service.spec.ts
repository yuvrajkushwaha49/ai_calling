import { FactExtractorService } from './fact-extractor.service';

describe('FactExtractorService', () => {
  let service: FactExtractorService;

  beforeEach(() => {
    service = new FactExtractorService();
  });

  describe('BHK extraction', () => {
    it('should extract 3 BHK from Hindi utterance', () => {
      const res = service.extractFacts('मुझे ग्रेटर नोएडा में 3 बीएचके चाहिए');
      expect(res.facts.bhk).toBe('3 BHK');
      expect(res.confidenceMap.bhk).toBe('confirmed');
    });

    it('should extract 2 BHK from English utterance', () => {
      const res = service.extractFacts('I am looking for a 2 bhk flat in Noida');
      expect(res.facts.bhk).toBe('2 BHK');
      expect(res.confidenceMap.bhk).toBe('confirmed');
    });

    it('should handle written Hindi numerals like ३ बीएचके', () => {
      const res = service.extractFacts('मुझे ३ BHK फ्लैट देखना है');
      expect(res.facts.bhk).toBe('3 BHK');
    });
  });

  describe('Budget extraction', () => {
    it('should extract 80 Lakh budget from Hindi', () => {
      const res = service.extractFacts('मेरा बजट 80 लाख के आसपास है');
      expect(res.facts.budget).toBe(8000000);
      expect(res.facts.budgetLabel).toBe('80 Lakh');
      expect(res.confidenceMap.budget).toBe('approximate');
    });

    it('should extract Crore budget correctly', () => {
      const res = service.extractFacts('Maximum 1.5 Cr tak ja sakta hu');
      expect(res.facts.budget).toBe(15000000);
      expect(res.facts.budgetLabel).toBe('1.5 Cr');
    });
  });

  describe('Purpose extraction', () => {
    it('should identify investment purpose', () => {
      const res = service.extractFacts('मैं इन्वेस्टमेंट के लिए प्रॉपर्टी देख रहा हूँ');
      expect(res.facts.purpose).toBe('investment');
    });

    it('should identify end-use / self use purpose', () => {
      const res = service.extractFacts('मुझे रहने के लिए फ्लैट चाहिए परिवार के साथ');
      expect(res.facts.purpose).toBe('end_use');
    });
  });

  describe('Location extraction', () => {
    it('should extract known Delhi NCR locations', () => {
      const res = service.extractFacts('Noida Extension me koi project hai kya?');
      expect(res.facts.location).toBe('Noida Extension');
    });

    it('should extract Greater Noida West', () => {
      const res = service.extractFacts('Greater Noida West mein flat chahiye');
      expect(res.facts.location).toBe('Greater Noida West');
    });
  });

  describe('Customer corrections', () => {
    it('should detect budget correction', () => {
      const res = service.extractFacts('नहीं बजट 80 लाख नहीं, मेरा बजट 95 लाख है');
      expect(res.isCorrection).toBe(true);
      expect(res.correctionField).toBe('budget');
      expect(res.facts.budget).toBe(9500000);
    });

    it('should detect BHK correction', () => {
      const res = service.extractFacts('Actually 2 BHK nahi, 3 BHK chahiye');
      expect(res.isCorrection).toBe(true);
      expect(res.correctionField).toBe('bhk');
      expect(res.facts.bhk).toBe('3 BHK');
    });
  });
});
