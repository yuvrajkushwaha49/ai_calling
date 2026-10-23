import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { devanagariToRoman, hasDevanagari, softenForNaturalSpeech } from './hindi-romanize';
import { applyPlacePronunciation } from './place-names';

/** Friendly aliases → ElevenLabs voice IDs (free-plan default voices that work via API) */
export const ELEVENLABS_VOICES: Record<
  string,
  { id: string; label: string; gender: 'male' | 'female' }
> = {
  // Recommended for AI calling (5/5) — maps to ElevenLabs default "Darian"
  darian: {
    id: 'CwhRBWXzGAHq8TQ4Fs17',
    label: 'Darian – Warm Grounded Storyteller',
    gender: 'male',
  },
  elara: {
    id: 'FGY2WhTYpPnrIDTdsKH5',
    label: 'Elara – Crisp Pro Narrator',
    gender: 'female',
  },
  kellan: {
    id: 'N2lVS1w4EtoT3dr4eOWO',
    label: 'Kellan – Casual Friendly Speaker',
    gender: 'male',
  },
  talia: {
    id: 'EXAVITQu4vr4xnSDxMaL',
    label: 'Talia – Warm Soft Guide',
    gender: 'female',
  },
  alicia: {
    id: 'Xb7hH8MSUJpSbSDYk0k2',
    label: 'Alicia – Polished Global Anchor',
    gender: 'female',
  },
  custom: {
    id: 'zmh5xhBvMzqR4ZlXgcgL',
    label: 'Shared Voice Lab (zmh5xhBvMzqR4ZlXgcgL)',
    gender: 'female',
  },
};

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
  /** Cached free-tier usable voice (owned generated/cloned — not Voice Library). */
  private freeVoiceIdCache: string | null = null;

  constructor(private config: ConfigService) {
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  isConfigured() {
    return Boolean(this.config.get<string>('ELEVENLABS_API_KEY')?.trim());
  }

  private getApiKey() {
    const key = this.config.get<string>('ELEVENLABS_API_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'ELEVENLABS_API_KEY is not configured. Add it to backend/.env',
      );
    }
    return key;
  }

  private getModel() {
    return (
      this.config.get<string>('ELEVENLABS_MODEL')?.trim() ||
      'eleven_multilingual_v2'
    );
  }

  /** Resolve alias (darian) or raw voice id. Prefer env custom voice when set. */
  normalizeSpeaker(speaker?: string): string {
    const envDefault = this.config.get<string>('ELEVENLABS_DEFAULT_VOICE_ID')?.trim();
    const value = (speaker || '').trim() || envDefault || 'darian';
    const lower = value.toLowerCase();
    if (ELEVENLABS_VOICES[lower]) return lower;
    if (/^[a-zA-Z0-9]{20,}$/.test(value)) return value;
    const legacy: Record<string, string> = {
      rachel: 'talia',
      sarah: 'talia',
      lily: 'elara',
      charlotte: 'alicia',
      matilda: 'talia',
      adam: 'darian',
      george: 'darian',
      brian: 'kellan',
      josh: 'kellan',
      daniel: 'darian',
      roger: 'darian',
      callum: 'kellan',
      laura: 'elara',
      alice: 'alicia',
      shubh: 'darian',
      ritu: 'elara',
      priya: 'talia',
    };
    return legacy[lower] || 'custom';
  }

  resolveVoiceId(speaker?: string): string {
    const envDefault = this.config.get<string>('ELEVENLABS_DEFAULT_VOICE_ID')?.trim();
    if (envDefault && /^[a-zA-Z0-9]{20,}$/.test(envDefault)) {
      return envDefault;
    }
    if (this.freeVoiceIdCache) return this.freeVoiceIdCache;
    const normalized = this.normalizeSpeaker(speaker);
    const mapped = ELEVENLABS_VOICES[normalized]?.id;
    if (mapped) return mapped;
    if (/^[a-zA-Z0-9]{20,}$/.test(normalized)) return normalized;
    return ELEVENLABS_VOICES.custom.id || ELEVENLABS_VOICES.darian.id;
  }

  /**
   * Free plan cannot use Voice Library / premade voices via API.
   * Pick first owned voice: generated (Voice Design) or cloned.
   */
  async pickFreePlanVoiceId(): Promise<string | null> {
    if (this.freeVoiceIdCache) return this.freeVoiceIdCache;
    const envDefault = this.config.get<string>('ELEVENLABS_DEFAULT_VOICE_ID')?.trim();
    if (envDefault && /^[a-zA-Z0-9]{20,}$/.test(envDefault)) {
      this.freeVoiceIdCache = envDefault;
      return envDefault;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/voices`, {
        headers: { 'xi-api-key': this.getApiKey() },
      });
    } catch (error) {
      this.logger.warn(
        `ElevenLabs voices list failed: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }

    if (!response.ok) {
      const errText = await response.text();
      this.logger.warn(
        `Cannot list ElevenLabs voices (${response.status}): ${errText.slice(0, 200)}. Create an API key with voices_read, or set ELEVENLABS_DEFAULT_VOICE_ID to a Voice Design voice from My Voices.`,
      );
      return null;
    }

    const data = (await response.json()) as {
      voices?: Array<{ voice_id?: string; name?: string; category?: string }>;
    };
    const voices = data.voices || [];
    const preferred = voices.find((v) =>
      /^(generated|cloned)$/i.test(v.category || ''),
    );
    const anyOwned = preferred || voices.find((v) => v.voice_id);
    if (anyOwned?.voice_id) {
      this.freeVoiceIdCache = anyOwned.voice_id;
      this.logger.log(
        `Using free-plan ElevenLabs voice: ${anyOwned.name || anyOwned.voice_id} (${anyOwned.category || 'unknown'})`,
      );
      return anyOwned.voice_id;
    }
    return null;
  }

  voiceGender(speaker?: string): 'male' | 'female' {
    const normalized = this.normalizeSpeaker(speaker);
    return ELEVENLABS_VOICES[normalized]?.gender || 'female';
  }

  listVoices() {
    return Object.entries(ELEVENLABS_VOICES).map(([value, meta]) => ({
      value,
      label: meta.label,
      gender: meta.gender,
      voiceId: meta.id,
    }));
  }

  private freePlanHelpMessage() {
    return (
      'ElevenLabs free plan cannot use Voice Library voices via API. ' +
      '1) Open https://elevenlabs.io/app/voice-lab → Voice Design → create & save a voice. ' +
      '2) Copy its voice_id into backend/.env as ELEVENLABS_DEFAULT_VOICE_ID. ' +
      '3) Prefer an API key with full access (voices_read) so we can auto-pick free voices.'
    );
  }

  /**
   * Keep text close to Voice Lab input. Only fix mixed-script spacing + Flash romanize.
   */
  formatForElevenLabs(
    text: string,
    language?: string,
    modelOverride?: string,
  ): string {
    let out = softenForNaturalSpeech(text || '');
    if (!out) return out;

    out = applyPlacePronunciation(out, language);

    out = out
      .replace(/([\u0900-\u097F])([A-Za-z0-9])/g, '$1 $2')
      .replace(/([A-Za-z0-9])([\u0900-\u097F])/g, '$1 $2')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const lang = (language || '').toLowerCase();
    const wantsHindi =
      lang.includes('hi') ||
      lang.includes('hinglish') ||
      lang.startsWith('mr') ||
      hasDevanagari(out);

    const model = modelOverride || this.getModel();
    const isMultilingual = model.includes('multilingual');
    const isEnglish = lang.startsWith('en') && !hasDevanagari(out);

    // Flash/Turbo only: romanize. Multilingual keeps Devanagari (natural Hindi).
    if (!isEnglish && wantsHindi && hasDevanagari(out) && !isMultilingual) {
      out = devanagariToRoman(out);
    }

    return out.slice(0, 2200);
  }

  /** Map app language → ElevenLabs language_code (Flash/Turbo only). */
  resolveLanguageCode(
    language?: string,
    romanized = false,
    modelOverride?: string,
  ): string | undefined {
    const model = modelOverride || this.getModel();
    // multilingual_v2 rejects language_code
    if (model.includes('multilingual_v2')) return undefined;
    const lang = (language || '').toLowerCase().trim();
    // Roman Hinglish / Hindi: enforce Hindi pronunciation when model supports it
    if (lang.startsWith('en') && !romanized) return 'en';
    if (romanized || lang === 'hinglish' || lang.startsWith('hi')) return 'hi';
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('mr')) return 'hi';
    if (lang.startsWith('gu')) return 'hi';
    if (lang.startsWith('ta')) return 'ta';
    if (lang.startsWith('te')) return 'te';
    if (lang.startsWith('kn')) return 'kn';
    if (lang.startsWith('bn')) return 'bn';
    if (lang.startsWith('pa')) return 'hi';
    return 'hi';
  }

  async textToSpeech(options: {
    text: string;
    speaker?: string;
    language?: string;
    pace?: number;
    skipSave?: boolean;
    /** ElevenLabs output_format — use mp3_16000_32 for Exotel phone playback */
    outputFormat?: string;
    /** Override model (e.g. eleven_flash_v2_5 for low-latency phone) */
    modelId?: string;
    /** 0–4 — higher = lower latency (ElevenLabs streaming optimize) */
    optimizeStreamingLatency?: number;
  }): Promise<{
    audioBase64: string;
    fileName: string;
    filePath: string;
    mimeType: string;
  }> {
    const raw = (options.text || '').trim();
    const wasDevanagari = hasDevanagari(raw);
    const modelId =
      options.modelId?.trim() ||
      this.config.get<string>('ELEVENLABS_MODEL')?.trim() ||
      'eleven_multilingual_v2';
    const text = this.formatForElevenLabs(raw, options.language, modelId);
    if (!text) throw new BadRequestException('Text is required for TTS');

    let voiceId =
      this.config.get<string>('ELEVENLABS_DEFAULT_VOICE_ID')?.trim() || '';
    const speaker = (options.speaker || '').trim();
    if (!voiceId && /^[a-zA-Z0-9]{20,}$/.test(speaker)) {
      voiceId = speaker;
    }
    if (!voiceId) {
      voiceId = this.resolveVoiceId(options.speaker);
    }
    if (!voiceId) {
      throw new BadRequestException(this.freePlanHelpMessage());
    }

    // Prefer multilingual for natural Hindi; Flash stays if explicitly set
    const languageCode = this.resolveLanguageCode(
      options.language,
      wasDevanagari,
      modelId,
    );
    // Match ElevenLabs Voice Lab defaults so preview/call sound like the website
    const pace = options.pace ?? 1.0;
    const speed = Math.min(1.2, Math.max(0.7, pace));
    const outputFormat = options.outputFormat || 'mp3_44100_128';
    const optimize =
      options.optimizeStreamingLatency != null
        ? Math.max(0, Math.min(4, options.optimizeStreamingLatency))
        : null;

    this.logger.log(
      `ElevenLabs TTS voice_id=${voiceId} model=${modelId} format=${outputFormat} lang=${languageCode || '-'} speed=${speed}`,
    );
    this.logger.debug(`ElevenLabs TTS text: ${text.slice(0, 120)}`);

    const doRequest = async (id: string) => {
      const qs = new URLSearchParams({
        output_format: outputFormat,
      });
      if (optimize != null) {
        qs.set('optimize_streaming_latency', String(optimize));
      }
      const url = `${this.baseUrl}/text-to-speech/${encodeURIComponent(id)}?${qs.toString()}`;
      // Omit voice_settings so ElevenLabs uses the Voice Lab saved defaults
      // (forced stability/style made the agent sound robotic vs the website).
      const body: Record<string, unknown> = {
        text,
        model_id: modelId,
      };
      // Only override speed when caller asks for non-default pace
      if (Math.abs(speed - 1) > 0.02) {
        body.voice_settings = {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
          speed,
        };
      }
      if (languageCode) {
        body.language_code = languageCode;
      }
      return fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.getApiKey(),
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify(body),
      });
    };

    let response: Response;
    try {
      response = await doRequest(voiceId);
    } catch (error) {
      this.logger.warn(
        `ElevenLabs network error: ${error instanceof Error ? error.message : error}`,
      );
      throw new ServiceUnavailableException('ElevenLabs TTS request failed');
    }

    // Library voice blocked on free → try owned free voice once
    if (response.status === 402) {
      this.logger.warn(
        `Voice ${voiceId} needs paid plan — trying free-plan owned voice…`,
      );
      this.freeVoiceIdCache = null;
      const freeId = await this.pickFreePlanVoiceId();
      if (freeId && freeId !== voiceId) {
        voiceId = freeId;
        try {
          response = await doRequest(voiceId);
        } catch (error) {
          throw new ServiceUnavailableException('ElevenLabs TTS request failed');
        }
      } else {
        throw new BadRequestException(this.freePlanHelpMessage());
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 402) {
        throw new BadRequestException(this.freePlanHelpMessage());
      }
      throw new BadRequestException(
        `ElevenLabs TTS failed (${response.status}): ${errText.slice(0, 300)}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      throw new BadRequestException('ElevenLabs TTS returned no audio');
    }

    const audioBase64 = buffer.toString('base64');
    const fileName = `tts-el-${randomUUID()}.mp3`;
    const filePath = path.join(this.uploadsDir, fileName);
    if (!options.skipSave) {
      fs.writeFileSync(filePath, buffer);
    }

    return {
      audioBase64,
      fileName,
      filePath,
      mimeType: 'audio/mpeg',
    };
  }

  /** Map app language (hi-IN) → ElevenLabs STT language_code (hi). */
  private sttLanguageCode(language?: string): string | undefined {
    const lang = (language || '').toLowerCase().trim();
    if (!lang) return undefined;
    if (lang.includes('hinglish') || lang.startsWith('hi')) return 'hi';
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('mr')) return 'mr';
    if (lang.startsWith('gu')) return 'gu';
    if (lang.startsWith('ta')) return 'ta';
    if (lang.startsWith('te')) return 'te';
    if (lang.startsWith('kn')) return 'kn';
    if (lang.startsWith('bn')) return 'bn';
    if (lang.startsWith('pa')) return 'pa';
    return lang.slice(0, 2) || undefined;
  }

  /**
   * Speech-to-text via ElevenLabs Scribe v2 (replaces Sarvam STT).
   */
  async speechToText(options: {
    filePath?: string;
    buffer?: Buffer;
    fileName?: string;
    language?: string;
  }): Promise<{ transcript: string; languageCode?: string | null }> {
    const apiKey = this.getApiKey();
    const form = new FormData();

    let fileName = options.fileName || 'audio.wav';
    let bytes: Uint8Array;
    if (options.filePath) {
      bytes = new Uint8Array(fs.readFileSync(options.filePath));
      fileName = path.basename(options.filePath);
    } else if (options.buffer) {
      bytes = new Uint8Array(options.buffer);
    } else {
      throw new BadRequestException('Audio file is required for STT');
    }

    const lower = fileName.toLowerCase();
    const mime = lower.endsWith('.mp3')
      ? 'audio/mpeg'
      : lower.endsWith('.webm')
        ? 'audio/webm'
        : lower.endsWith('.ogg')
          ? 'audio/ogg'
          : 'audio/wav';
    form.append(
      'file',
      new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
        type: mime,
      }),
      fileName,
    );
    form.append('model_id', 'scribe_v2');
    const lang = this.sttLanguageCode(options.language);
    if (lang) form.append('language_code', lang);

    const response = await fetch(`${this.baseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new BadRequestException(
        `ElevenLabs STT failed (${response.status}): ${errText.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      text?: string;
      transcript?: string;
      language_code?: string | null;
    };

    const transcript = (data.text || data.transcript || '').trim();
    this.logger.log(
      `ElevenLabs STT lang=${data.language_code || lang || '-'} chars=${transcript.length}`,
    );

    return {
      transcript,
      languageCode: data.language_code || lang || null,
    };
  }

  getAudioAbsolutePath(fileName: string) {
    const safe = path.basename(fileName);
    const full = path.join(this.uploadsDir, safe);
    if (!fs.existsSync(full)) {
      throw new BadRequestException('Audio file not found');
    }
    return full;
  }
}
