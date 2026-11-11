/**
 * Phone number normalization and utility functions for consistent international telephony handling.
 */

export function normalizePhoneNumber(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed || /^(?:inbound|unknown|caller|guest)$/i.test(trimmed)) {
    return '';
  }

  // Remove whitespace, hyphens, brackets, dots
  let cleaned = trimmed.replace(/[\s\-\(\)\.]+/g, '');

  // If starts with +, remember
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/\D/g, '');

  if (cleaned.length < 10) {
    return '';
  }

  // Handle standard Indian mobile numbers
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `+91${cleaned.slice(1)}`;
  }

  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }

  // If already had plus and is standard length
  if (hasPlus) {
    return `+${cleaned}`;
  }

  return `+${cleaned}`;
}

export function canonicalPhone10(phone?: string | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function isValidPhoneNumber(phone?: string | null): boolean {
  if (!phone) return false;
  const normalized = normalizePhoneNumber(phone);
  // Valid E.164 has at least + and 10 digits, max 15
  return /^\+[1-9]\d{9,14}$/.test(normalized);
}

/**
 * Mask phone number for secure logging (e.g., +919****3210 or 98****3210)
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return 'Unknown';
  const str = String(phone).trim();
  if (str.length <= 4) return '***';
  if (str.startsWith('+')) {
    const prefix = str.slice(0, 4);
    const suffix = str.slice(-4);
    return `${prefix}****${suffix}`;
  }
  const prefix = str.slice(0, 2);
  const suffix = str.slice(-4);
  return `${prefix}****${suffix}`;
}
