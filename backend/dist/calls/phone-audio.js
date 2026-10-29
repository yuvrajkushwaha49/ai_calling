"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asNodeBuffer = asNodeBuffer;
exports.boostPcm16 = boostPcm16;
exports.pcmEnergy = pcmEnergy;
exports.pcm16ToWav = pcm16ToWav;
exports.truncateForPhone = truncateForPhone;
exports.pcm16ToMulaw = pcm16ToMulaw;
exports.mulawToLinear = mulawToLinear;
exports.mulawToPcm16 = mulawToPcm16;
exports.downsamplePcm16 = downsamplePcm16;
function asNodeBuffer(data) {
    if (Buffer.isBuffer(data))
        return data;
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
function boostPcm16(pcm, gain) {
    const src = asNodeBuffer(pcm);
    const out = Buffer.alloc(src.length);
    for (let i = 0; i + 1 < src.length; i += 2) {
        const sample = Math.round(src.readInt16LE(i) * gain);
        const clipped = Math.max(-32768, Math.min(32767, sample));
        out.writeInt16LE(clipped, i);
    }
    return out;
}
function pcmEnergy(buf) {
    let sum = 0;
    const n = Math.floor(buf.length / 2);
    if (!n)
        return 0;
    for (let i = 0; i + 1 < buf.length; i += 2) {
        sum += Math.abs(buf.readInt16LE(i));
    }
    return sum / n;
}
function pcm16ToWav(pcm, sampleRate) {
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
function truncateForPhone(text, max = 85) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max)
        return clean;
    const cut = clean.slice(0, max);
    const lastStop = Math.max(cut.lastIndexOf('।'), cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    return (lastStop > 30 ? cut.slice(0, lastStop + 1) : cut).trim();
}
function pcm16ToMulaw(pcm) {
    const src = asNodeBuffer(pcm);
    const out = Buffer.alloc(Math.floor(src.length / 2));
    for (let i = 0, j = 0; i + 1 < src.length; i += 2, j++) {
        out[j] = linearToMulaw(src.readInt16LE(i));
    }
    return out;
}
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
function mulawToLinear(mulawByte) {
    return MULAW_DECODE_TABLE[mulawByte & 0xff];
}
function mulawToPcm16(mulaw) {
    const src = asNodeBuffer(mulaw);
    const out = Buffer.alloc(src.length * 2);
    for (let i = 0; i < src.length; i++) {
        const val = MULAW_DECODE_TABLE[src[i]];
        out.writeInt16LE(val, i * 2);
    }
    return out;
}
function downsamplePcm16(pcm, fromRate, toRate) {
    if (fromRate === toRate)
        return asNodeBuffer(pcm);
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
function linearToMulaw(sample) {
    const BIAS = 132;
    const CLIP = 32635;
    const sign = sample < 0 ? 0x80 : 0;
    if (sample < 0)
        sample = -sample;
    if (sample > CLIP)
        sample = CLIP;
    sample = sample + BIAS;
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {
    }
    const mantissa = (sample >> (exponent + 3)) & 0x0f;
    return ~(sign | (exponent << 4) | mantissa) & 0xff;
}
//# sourceMappingURL=phone-audio.js.map