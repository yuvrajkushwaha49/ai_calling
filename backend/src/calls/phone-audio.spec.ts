import {
  pcmEnergy,
  filterDcBlockPcm16,
  createAudioFilterState,
  calculateDynamicNoiseThresholds,
} from './phone-audio';

describe('PhoneAudio Helpers', () => {
  describe('pcmEnergy', () => {
    it('returns 0 for empty buffer', () => {
      expect(pcmEnergy(Buffer.alloc(0))).toBe(0);
    });

    it('calculates average absolute amplitude correctly', () => {
      // 4 samples of 16-bit PCM: 100, -200, 300, -400 -> avg = 250
      const buf = Buffer.alloc(8);
      buf.writeInt16LE(100, 0);
      buf.writeInt16LE(-200, 2);
      buf.writeInt16LE(300, 4);
      buf.writeInt16LE(-400, 6);
      expect(pcmEnergy(buf)).toBe(250);
    });
  });

  describe('filterDcBlockPcm16', () => {
    it('attenuates constant DC bias', () => {
      // 100 samples with constant DC offset = 2000
      const buf = Buffer.alloc(200);
      for (let i = 0; i < 200; i += 2) {
        buf.writeInt16LE(2000, i);
      }

      const state = createAudioFilterState();
      const filtered = filterDcBlockPcm16(buf, state);

      const initialEnergy = pcmEnergy(buf);
      const filteredEnergy = pcmEnergy(filtered);

      expect(initialEnergy).toBe(2000);
      // DC blocker reduces constant bias significantly
      expect(filteredEnergy).toBeLessThan(initialEnergy * 0.2);
    });

    it('preserves alternating audio signals (AC voice speech)', () => {
      // Alternating samples: +1500, -1500, +1500, -1500... (Nyquist frequency)
      const buf = Buffer.alloc(200);
      for (let i = 0; i < 200; i += 2) {
        const val = (i / 2) % 2 === 0 ? 1500 : -1500;
        buf.writeInt16LE(val, i);
      }

      const state = createAudioFilterState();
      const filtered = filterDcBlockPcm16(buf, state);

      const initialEnergy = pcmEnergy(buf);
      const filteredEnergy = pcmEnergy(filtered);

      expect(initialEnergy).toBe(1500);
      // AC speech frequencies are preserved with minimal attenuation
      expect(filteredEnergy).toBeGreaterThan(1400);
    });
  });

  describe('calculateDynamicNoiseThresholds', () => {
    it('clamps to default minimums in quiet ambient environments', () => {
      const { voiceThreshold, bargeThreshold } = calculateDynamicNoiseThresholds(100);
      expect(voiceThreshold).toBe(450);
      expect(bargeThreshold).toBe(900);
    });

    it('scales thresholds appropriately in noisy environments', () => {
      // ambient = 350 (room with fan / background chatter)
      // voice: 350 * 1.6 + 100 = 660
      // barge: 660 * 1.7 = 1122
      const { voiceThreshold, bargeThreshold } = calculateDynamicNoiseThresholds(350);
      expect(voiceThreshold).toBe(660);
      expect(bargeThreshold).toBe(1122);
    });

    it('caps at safety limits in extremely loud environments', () => {
      const { voiceThreshold, bargeThreshold } = calculateDynamicNoiseThresholds(1200);
      expect(voiceThreshold).toBe(850);
      expect(bargeThreshold).toBe(1445); // clamped to <= 1600
    });
  });

  describe('normalizeTextForSpeech (Round 6 Verification)', () => {
    const { normalizeTextForSpeech } = require('./phone-audio');

    it('preserves word boundaries and fixes concatenation on 2 BHK₹60.90 Lakh', () => {
      const res = normalizeTextForSpeech('2 BHK₹60.90 Lakh');
      expect(res).toBe('2 BHK saath lakh nabbe hazaar rupaye');
      expect(res).not.toContain('BHKsaath');
    });

    it('correctly normalizes ₹60.90 Lakh', () => {
      const res = normalizeTextForSpeech('Starting price ₹60.90 Lakh hai');
      expect(res).toBe('Starting price saath lakh nabbe hazaar rupaye hai');
    });

    it('correctly normalizes ₹63.99 Lakh without splitting decimals', () => {
      const res = normalizeTextForSpeech('Price ₹63.99 Lakh se shuru hai');
      expect(res).toBe('Price tirasath lakh ninyanve hazaar rupaye se shuru hai');
    });

    it('correctly normalizes ₹86.32 Lakh', () => {
      const res = normalizeTextForSpeech('Future Estate starting from ₹86.32 Lakh');
      expect(res).toBe('Future Estate starting from chhiyaasi lakh battis hazaar rupaye');
    });

    it('correctly normalizes ₹8,888 per sq.ft', () => {
      const res = normalizeTextForSpeech('BSP ₹8,888 per sq.ft hai');
      expect(res).toBe('BSP aath hazaar aath sau athasi rupaye per square foot hai');
    });

    it('correctly normalizes 720 sq.ft and 1,250 sq.ft', () => {
      const res1 = normalizeTextForSpeech('Unit size 720 sq.ft hai');
      expect(res1).toBe('Unit size 720 square feet hai');

      const res2 = normalizeTextForSpeech('Super area 1,250 sq.ft available');
      expect(res2).toBe('Super area 1250 square feet available');
    });

    it('preserves 2 BHK and 3 BHK clean formatting', () => {
      const res1 = normalizeTextForSpeech('Aapko 2 BHK chahiye ya 3 BHK?');
      expect(res1).toBe('Aapko 2 BHK chahiye ya 3 BHK?');
    });
  });
});

