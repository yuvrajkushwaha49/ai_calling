/** Shared PCM / μ-law helpers for Twilio Media Streams. */

export function asNodeBuffer(data: Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(data)) return data as Buffer;
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

export function boostPcm16(pcm: Buffer, gain: number): Buffer {
  const src = asNodeBuffer(pcm);
  const out = Buffer.alloc(src.length);
  for (let i = 0; i + 1 < src.length; i += 2) {
    const sample = Math.round(src.readInt16LE(i) * gain);
    const clipped = Math.max(-32768, Math.min(32767, sample));
    out.writeInt16LE(clipped, i);
  }
  return out;
}

export function pcmEnergy(buf: Buffer): number {
  let sum = 0;
  const n = Math.floor(buf.length / 2);
  if (!n) return 0;
  for (let i = 0; i + 1 < buf.length; i += 2) {
    sum += Math.abs(buf.readInt16LE(i));
  }
  return sum / n;
}

export interface AudioFilterState {
  prevIn: number;
  prevOut: number;
}

export function createAudioFilterState(): AudioFilterState {
  return { prevIn: 0, prevOut: 0 };
}

/**
 * 1st-order DC-blocking / high-pass filter for 16-bit PCM audio.
 * Attenuates DC bias, mic handling noise, and sub-100Hz rumble while preserving speech.
 * Transfer function: y[n] = x[n] - x[n-1] + R * y[n-1]
 * At 8kHz sample rate, R=0.92 gives -3dB cutoff around ~105Hz.
 */
export function filterDcBlockPcm16(
  pcm: Buffer,
  state?: AudioFilterState,
  r = 0.92,
): Buffer {
  const src = asNodeBuffer(pcm);
  const out = Buffer.alloc(src.length);
  let prevIn = state ? state.prevIn : 0;
  let prevOut = state ? state.prevOut : 0;
  for (let i = 0; i + 1 < src.length; i += 2) {
    const x = src.readInt16LE(i);
    const y = x - prevIn + r * prevOut;
    prevIn = x;
    prevOut = y;
    const sample = Math.round(y);
    const clipped = Math.max(-32768, Math.min(32767, sample));
    out.writeInt16LE(clipped, i);
  }
  if (state) {
    state.prevIn = prevIn;
    state.prevOut = prevOut;
  }
  return out;
}

export interface DynamicNoiseThresholds {
  voiceThreshold: number;
  bargeThreshold: number;
}

/**
 * Calculates adaptive voice and barge-in thresholds based on measured ambient noise floor.
 * - In quiet environments (~100 ambient), keeps default high sensitivity (voice: 450, barge: 900).
 * - In noisy environments (traffic, fans ~300-500 ambient), elevates thresholds to prevent false speech/barge triggers.
 */
export function calculateDynamicNoiseThresholds(ambientEnergy: number): DynamicNoiseThresholds {
  const safeAmbient = Math.max(0, ambientEnergy || 0);
  const voice = Math.max(450, Math.min(850, Math.round(safeAmbient * 1.6 + 100)));
  const barge = Math.max(900, Math.min(1600, Math.round(voice * 1.7)));
  return { voiceThreshold: voice, bargeThreshold: barge };
}

export function pcm16ToWav(pcm: Buffer, sampleRate: number): Buffer {
  const body = asNodeBuffer(pcm);
  const header = Buffer.alloc(44);
  const dataSize = body.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return asNodeBuffer(Buffer.concat([header, body]));
}

export function truncateForPhone(text: string, max = 280): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(
    cut.lastIndexOf('।'),
    cut.lastIndexOf('.'),
    cut.lastIndexOf('!'),
    cut.lastIndexOf('?'),
  );
  return (lastStop > 30 ? cut.slice(0, lastStop + 1) : cut).trim();
}

export function pcm16ToMulaw(pcm: Buffer): Buffer {
  const src = asNodeBuffer(pcm);
  const out = Buffer.alloc(Math.floor(src.length / 2));
  for (let i = 0, j = 0; i + 1 < src.length; i += 2, j++) {
    out[j] = linearToMulaw(src.readInt16LE(i));
  }
  return out;
}

// Precomputed standard ITU-T G.711 mu-law expansion table (256 entries)
const MULAW_DECODE_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const mu = ~i & 0xff;
  const sign = mu & 0x80;
  const exponent = (mu >> 4) & 0x07;
  const mantissa = mu & 0x0f;
  let sample = ((mantissa << 3) + 132) << exponent;
  sample -= 132;
  MULAW_DECODE_TABLE[i] = sign ? -sample : sample;
}

export function mulawToLinear(mulawByte: number): number {
  return MULAW_DECODE_TABLE[mulawByte & 0xff];
}

export function mulawToPcm16(mulaw: Buffer): Buffer {
  const src = asNodeBuffer(mulaw);
  const out = Buffer.alloc(src.length * 2);
  for (let i = 0; i < src.length; i++) {
    const val = MULAW_DECODE_TABLE[src[i]];
    out.writeInt16LE(val, i * 2);
  }
  return out;
}

export function downsamplePcm16(
  pcm: Buffer,
  fromRate: number,
  toRate: number,
): Buffer {
  if (fromRate === toRate) return asNodeBuffer(pcm);
  const ratio = fromRate / toRate;
  const src = asNodeBuffer(pcm);
  const outLen = Math.floor(src.length / 2 / ratio) * 2;
  const out = Buffer.alloc(outLen);
  for (let o = 0; o < outLen / 2; o++) {
    const i = Math.floor(o * ratio) * 2;
    out.writeInt16LE(src.readInt16LE(Math.min(i, src.length - 2)), o * 2);
  }
  return out;
}

function linearToMulaw(sample: number): number {
  const BIAS = 132;
  const CLIP = 32635;
  const sign = sample < 0 ? 0x80 : 0;
  if (sample < 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample = sample + BIAS;
  let exponent = 7;
  for (
    let expMask = 0x4000;
    (sample & expMask) === 0 && exponent > 0;
    exponent--, expMask >>= 1
  ) {
    /* find exponent */
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

const HINDI_ONES: Record<number, string> = {
  1: 'ek', 2: 'do', 3: 'teen', 4: 'chaar', 5: 'paanch', 6: 'chhah', 7: 'saat', 8: 'aath', 9: 'nau', 10: 'das',
  11: 'gyaarah', 12: 'baarah', 13: 'terah', 14: 'chaudah', 15: 'pandrah', 16: 'solah', 17: 'satrah', 18: 'athaarah', 19: 'unnis', 20: 'bees',
  21: 'ikkis', 22: 'baais', 23: 'teis', 24: 'chaubis', 25: 'pachchis', 26: 'chabbis', 27: 'sattais', 28: 'atthaais', 29: 'unattis', 30: 'tees',
  31: 'ikattis', 32: 'battis', 33: 'tentis', 34: 'chauntis', 35: 'paintis', 36: 'chhattis', 37: 'saintis', 38: 'adhtis', 39: 'untaalis', 40: 'chaalis',
  41: 'iktaalis', 42: 'bayaalis', 43: 'tentaalis', 44: 'chauvaalis', 45: 'paintalis', 46: 'chhiyaalis', 47: 'saintaalis', 48: 'adhtaalis', 49: 'unachaas', 50: 'pachaas',
  51: 'ikyaavan', 52: 'baavan', 53: 'tirpan', 54: 'chauvan', 55: 'pachpan', 56: 'chhappan', 57: 'sattaavan', 58: 'atthaavan', 59: 'unsath', 60: 'saath',
  61: 'iksath', 62: 'baasath', 63: 'tirasath', 64: 'chaunsath', 65: 'painsath', 66: 'chhiyaasath', 67: 'sadsath', 68: 'adhsath', 69: 'unhattar', 70: 'sattar',
  71: 'ikhattar', 72: 'bahattar', 73: 'tihattar', 74: 'chauhattar', 75: 'pachhattar', 76: 'chhihattar', 77: 'satattar', 78: 'athahattar', 79: 'uniyasi', 80: 'assi',
  81: 'ikyaasi', 82: 'bayaasi', 83: 'tiraasi', 84: 'chauraasi', 85: 'pachaasi', 86: 'chhiyaasi', 87: 'sattaasi', 88: 'athasi', 89: 'navaasi', 90: 'nabbe',
  91: 'ikyaanve', 92: 'baanve', 93: 'tiraanve', 94: 'chauraanve', 95: 'pachaanve', 96: 'chhiyaanve', 97: 'sattaanve', 98: 'athaanve', 99: 'ninyanve',
};

export function numberToHindiWords(num: number): string {
  if (num <= 0) return 'shunya';
  if (num < 100) return HINDI_ONES[num] || String(num);

  const parts: string[] = [];
  if (num >= 10000000) {
    const cr = Math.floor(num / 10000000);
    parts.push(`${numberToHindiWords(cr)} crore`);
    num %= 10000000;
  }
  if (num >= 100000) {
    const lk = Math.floor(num / 100000);
    parts.push(`${numberToHindiWords(lk)} lakh`);
    num %= 100000;
  }
  if (num >= 1000) {
    const th = Math.floor(num / 1000);
    parts.push(`${numberToHindiWords(th)} hazaar`);
    num %= 1000;
  }
  if (num >= 100) {
    const hu = Math.floor(num / 100);
    parts.push(`${numberToHindiWords(hu)} sau`);
    num %= 100;
  }
  if (num > 0) {
    parts.push(HINDI_ONES[num] || String(num));
  }
  return parts.join(' ');
}

/**
 * Speech-normalization layer:
 * Converts currency amounts, decimal values, and measurement units to natural spoken words
 * before passing to ElevenLabs TTS synthesis.
 * Ensures clean word boundary spacing to prevent word concatenation (e.g. "2 BHKsaath lakh").
 */
export function normalizeTextForSpeech(text: string, lang = 'hinglish'): string {
  if (!text) return '';
  let s = text;

  // 0. Ensure space around currency symbols, BHK, and numbers to prevent word concatenation
  s = s.replace(/([a-zA-Z0-9])([₹])/g, '$1 $2');
  s = s.replace(/([₹])([a-zA-Z0-9])/g, '$1 $2');
  s = s.replace(/\b([1-5])\s*bhk\b/gi, '$1 BHK');

  // 1. BSP pattern: ₹8,888 per sq.ft / ₹8,888/sq.ft / ₹8888 per sq.ft
  s = s.replace(/(?:₹|rs\.?|inr)\s*([0-9]{1,2}),([0-9]{3})\s*(?:\/|per)\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)/gi, (_, th, rest) => {
    const val = parseInt(th, 10) * 1000 + parseInt(rest, 10);
    return ` ${numberToHindiWords(val)} rupaye per square foot `;
  });
  s = s.replace(/(?:₹|rs\.?|inr)\s*([0-9]{4,5})\s*(?:\/|per)\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)/gi, (_, raw) => {
    const val = parseInt(raw, 10);
    return ` ${numberToHindiWords(val)} rupaye per square foot `;
  });

  // 2. Currency with decimals: ₹60.90 Lakh / ₹60.9 Lakh / ₹63.99 Lakh / ₹86.32 Lakh / 60.9L / 60.9 Lakh
  s = s.replace(/(?:₹|rs\.?|inr)?\s*([0-9]{1,3})\.([0-9]{1,3})\s*(?:lakhs?|lakh|लाख|l)\b/gi, (_, lkStr, decStr) => {
    const lk = parseInt(lkStr, 10);
    // Pad decimal to 2 digits for thousand calculation: e.g. .9 -> 90 thousand, .90 -> 90 thousand, .99 -> 99 thousand, .32 -> 32 thousand
    const decNorm = decStr.length === 1 ? `${decStr}0` : decStr.slice(0, 2);
    const th = parseInt(decNorm, 10);
    const lkWords = HINDI_ONES[lk] || String(lk);
    const thWords = HINDI_ONES[th] || String(th);
    return th > 0
      ? ` ${lkWords} lakh ${thWords} hazaar rupaye `
      : ` ${lkWords} lakh rupaye `;
  });

  // 3. Integer Lakhs: ₹69 Lakh / ₹80 Lakh / ₹64 Lakh
  s = s.replace(/(?:₹|rs\.?|inr)\s*([0-9]{1,3})\s*(?:lakhs?|lakh|लाख|l)\b/gi, (_, lkStr) => {
    const lk = parseInt(lkStr, 10);
    const lkWords = HINDI_ONES[lk] || String(lk);
    return ` ${lkWords} lakh rupaye `;
  });

  // 4. Crores: ₹1.5 Cr / ₹2 Cr
  s = s.replace(/(?:₹|rs\.?|inr)?\s*([0-9]{1,2})\.([0-9]{1,2})\s*(?:cr|crore|करोड़)\b/gi, (_, crStr, decStr) => {
    const cr = parseInt(crStr, 10);
    const crWords = HINDI_ONES[cr] || String(cr);
    const decVal = parseInt(decStr.length === 1 ? `${decStr}0` : decStr, 10);
    const lkWords = HINDI_ONES[decVal] || String(decVal);
    return ` ${crWords} crore ${lkWords} lakh rupaye `;
  });
  s = s.replace(/(?:₹|rs\.?|inr)\s*([0-9]{1,2})\s*(?:cr|crore|करोड़)\b/gi, (_, crStr) => {
    const cr = parseInt(crStr, 10);
    return ` ${HINDI_ONES[cr] || String(cr)} crore rupaye `;
  });

  // 5. Area / sq.ft measurements:
  // 1,50,000 sq.ft -> 150000 square feet (Indian two-comma numbering: Lakhs)
  s = s.replace(/\b([0-9]{1,2}),([0-9]{2}),([0-9]{3})\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)\b/gi, ' $1$2$3 square feet ');
  // 1,250 sq.ft -> 1250 square feet (Standard single-comma numbering: Thousands)
  s = s.replace(/\b([0-9]{1,2}),([0-9]{3})\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)\b/gi, ' $1$2 square feet ');
  // 720 sq.ft -> 720 square feet
  s = s.replace(/\b([0-9]{2,6})\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)\b/gi, ' $1 square feet ');
  // per sq.ft / /sq.ft -> per square foot
  s = s.replace(/(?:\/|per)\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet|वर्ग\s*फुट)/gi, ' per square foot ');
  // remaining sq.ft / sqft / sq ft -> square feet
  s = s.replace(/\b(?:sq\.?\s*ft\.?|sqft|वर्ग\s*फुट)\b/gi, ' square feet ');

  // 5b. Indian numbering comma removal for remaining numbers (e.g. 1,50,000 -> 150000)
  s = s.replace(/\b([0-9]{1,2}),([0-9]{2}),([0-9]{3})\b/g, '$1$2$3');
  s = s.replace(/\b([0-9]{1,2}),([0-9]{3})\b/g, '$1$2');

  // 6. Generic ₹ / Rs. symbol removal if remaining
  s = s.replace(/[₹]/g, ' rupaye ');

  // 7. Cleanup extra spaces and punctuation attachment
  s = s.replace(/\s+/g, ' ').replace(/\s+([.,!?:;।])/g, '$1').trim();
  return s;
}
