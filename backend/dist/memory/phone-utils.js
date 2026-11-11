"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.canonicalPhone10 = canonicalPhone10;
exports.isValidPhoneNumber = isValidPhoneNumber;
exports.maskPhoneNumber = maskPhoneNumber;
function normalizePhoneNumber(raw) {
    if (!raw)
        return '';
    const trimmed = String(raw).trim();
    if (!trimmed || /^(?:inbound|unknown|caller|guest)$/i.test(trimmed)) {
        return '';
    }
    let cleaned = trimmed.replace(/[\s\-\(\)\.]+/g, '');
    const hasPlus = cleaned.startsWith('+');
    cleaned = cleaned.replace(/\D/g, '');
    if (cleaned.length < 10) {
        return '';
    }
    if (cleaned.length === 10) {
        return `+91${cleaned}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
        return `+91${cleaned.slice(1)}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        return `+${cleaned}`;
    }
    if (hasPlus) {
        return `+${cleaned}`;
    }
    return `+${cleaned}`;
}
function canonicalPhone10(phone) {
    if (!phone)
        return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length >= 10) {
        return digits.slice(-10);
    }
    return digits;
}
function isValidPhoneNumber(phone) {
    if (!phone)
        return false;
    const normalized = normalizePhoneNumber(phone);
    return /^\+[1-9]\d{9,14}$/.test(normalized);
}
function maskPhoneNumber(phone) {
    if (!phone)
        return 'Unknown';
    const str = String(phone).trim();
    if (str.length <= 4)
        return '***';
    if (str.startsWith('+')) {
        const prefix = str.slice(0, 4);
        const suffix = str.slice(-4);
        return `${prefix}****${suffix}`;
    }
    const prefix = str.slice(0, 2);
    const suffix = str.slice(-4);
    return `${prefix}****${suffix}`;
}
//# sourceMappingURL=phone-utils.js.map