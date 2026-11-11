import {
  normalizePhoneNumber,
  canonicalPhone10,
  isValidPhoneNumber,
  maskPhoneNumber,
} from './phone-utils';

describe('PhoneUtils', () => {
  describe('normalizePhoneNumber', () => {
    it('should normalize standard 10-digit Indian numbers to E.164 (+91)', () => {
      expect(normalizePhoneNumber('9876543210')).toBe('+919876543210');
      expect(normalizePhoneNumber('09876543210')).toBe('+919876543210');
    });

    it('should handle numbers already having +91 prefix', () => {
      expect(normalizePhoneNumber('+919876543210')).toBe('+919876543210');
      expect(normalizePhoneNumber('+91 98765-43210')).toBe('+919876543210');
    });

    it('should preserve international non-Indian numbers', () => {
      expect(normalizePhoneNumber('+14155552671')).toBe('+14155552671');
    });

    it('should strip punctuation and spaces', () => {
      expect(normalizePhoneNumber('+91 (987) 654-3210')).toBe('+919876543210');
    });
  });

  describe('canonicalPhone10', () => {
    it('should extract canonical 10-digit number for Indian numbers', () => {
      expect(canonicalPhone10('+919876543210')).toBe('9876543210');
      expect(canonicalPhone10('09876543210')).toBe('9876543210');
      expect(canonicalPhone10('9876543210')).toBe('9876543210');
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate 10-digit Indian phone numbers starting with 6-9', () => {
      expect(isValidPhoneNumber('9876543210')).toBe(true);
      expect(isValidPhoneNumber('+919876543210')).toBe(true);
      expect(isValidPhoneNumber('12345')).toBe(false);
      expect(isValidPhoneNumber('')).toBe(false);
      expect(isValidPhoneNumber('abcdefghij')).toBe(false);
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask phone number preserving leading and trailing digits for privacy', () => {
      expect(maskPhoneNumber('+919876543210')).toBe('+919****3210');
      expect(maskPhoneNumber('9876543210')).toBe('98****3210');
      expect(maskPhoneNumber('123')).toBe('***');
    });
  });
});
