import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { applyPlacePronunciation } from '../elevenlabs/place-names';

export type SarvamLanguageCode =
  | 'bn-IN'
  | 'en-IN'
  | 'gu-IN'
  | 'hi-IN'
  | 'kn-IN'
  | 'ml-IN'
  | 'mr-IN'
  | 'od-IN'
  | 'pa-IN'
  | 'ta-IN'
  | 'te-IN';

@Injectable()
export class SarvamService {
  private readonly baseUrl = 'https://api.sarvam.ai';
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'audio');

  constructor(private config: ConfigService) {
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  private getApiKey() {
    const key = this.config.get<string>('SARVAM_API_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'SARVAM_API_KEY is not configured. Add it to backend/.env',
      );
    }
    return key;
  }

  normalizeLanguage(language?: string): SarvamLanguageCode {
    const map: Record<string, SarvamLanguageCode> = {
      'en-US': 'en-IN',
      'en-IN': 'en-IN',
      english: 'en-IN',
      'hi-IN': 'hi-IN',
      hindi: 'hi-IN',
      hinglish: 'hi-IN',
      'hi-Latn': 'hi-IN',
      'mr-IN': 'mr-IN',
      marathi: 'mr-IN',
      'bn-IN': 'bn-IN',
      'gu-IN': 'gu-IN',
      gujarati: 'gu-IN',
      'kn-IN': 'kn-IN',
      'ml-IN': 'ml-IN',
      'od-IN': 'od-IN',
      'pa-IN': 'pa-IN',
      'ta-IN': 'ta-IN',
      'te-IN': 'te-IN',
    };
    return map[(language || '').trim()] || map[(language || '').trim().toLowerCase()] || 'en-IN';
  }

  /** App-level language codes we store in AI settings (includes Hinglish). */
  normalizeAppLanguage(language?: string): string {
    const value = (language || 'en-IN').trim();
    const allowed = new Set(['en-IN', 'hi-IN', 'hinglish', 'mr-IN', 'gu-IN']);
    if (allowed.has(value)) return value;
    const aliases: Record<string, string> = {
      'en-US': 'en-IN',
      english: 'en-IN',
      hindi: 'hi-IN',
      'hi-Latn': 'hinglish',
      marathi: 'mr-IN',
      gujarati: 'gu-IN',
      'bn-IN': 'en-IN',
      'ta-IN': 'en-IN',
      'te-IN': 'en-IN',
      'kn-IN': 'en-IN',
      'ml-IN': 'en-IN',
      'pa-IN': 'en-IN',
      'od-IN': 'en-IN',
    };
    return aliases[value] || aliases[value.toLowerCase()] || 'en-IN';
  }

  normalizeSpeaker(speaker?: string): string {
    const value = (speaker || 'shubh').trim().toLowerCase();
    const valid = new Set([
      'shubh',
      'aditya',
      'ritu',
      'priya',
      'neha',
      'rahul',
      'pooja',
      'rohan',
      'simran',
      'kavya',
      'amit',
      'dev',
      'ishita',
      'shreya',
      'ratan',
      'varun',
      'manan',
      'sumit',
      'roopa',
      'kabir',
      'aayan',
      'ashutosh',
      'advait',
      'anand',
      'tanya',
      'tarun',
      'sunny',
      'mani',
      'gokul',
      'vijay',
      'shruti',
      'suhani',
      'mohit',
      'kavitha',
      'rehan',
      'soham',
      'rupali',
      'anushka',
      'abhilash',
      'manisha',
      'vidya',
      'arya',
      'karun',
      'hitesh',
    ]);

    // Map legacy OpenAI-style names saved in old settings
    const legacy: Record<string, string> = {
      alloy: 'shubh',
      echo: 'aditya',
      fable: 'ritu',
      onyx: 'rahul',
      nova: 'priya',
      shimmer: 'simran',
    };

    if (legacy[value]) return legacy[value];
    if (valid.has(value)) return value;
    return 'shubh';
  }

  /**
   * Format reply text the way Sarvam Bulbul expects for natural Indian speech.
   * - Prefer Devanagari for Hindi words (caller should already do this)
   * - Light pause punctuation; comma-separate long numbers
   */
  formatSpeechText(text: string, language?: string): string {
    let out = (text || '').trim();
    if (!out) return out;
    // Collapse multi-ellipsis to a single Sarvam-friendly hesitation
    out = out.replace(/\.{3,}/g, '…');
    // Numbers > 4 digits: 500000 → 5,00,000-ish help via western thousands commas
    out = out.replace(/\b(\d{5,})\b/g, (n) =>
      Number(n).toLocaleString('en-IN'),
    );
    // Soften robotic English openers that hurt Indian TTS feel
    out = applyPlacePronunciation(out, language || 'hi-IN');
    out = out
      .replace(/\bGot it[,.]?\s*/gi, '')
      .replace(/\bI understand[,.]?\s*/gi, '')
      .replace(/\bNoted[,.]?\s*/gi, '')
      .replace(/\bPerfect[,!]?\s*/gi, 'बढ़िया, ')
      // Never speak वाह / wah / bhai or the stock budget opener
      .replace(/\bवाह[!?,.]?\s*/g, '')
      .replace(/\bwah[!?,.]?\s*/gi, '')
      .replace(/\bbhai\b/gi, '')
      .replace(/भाई\s*/g, '')
      .replace(/सही विकल्प के लिए आपका बजट कितना है\??/gi, '')
      .replace(/सही options के लिए आपका budget कितना है[^.?]*/gi, '')
      .replace(/गलत time तो नहीं पकड़ा\?*/gi, '')
      .replace(/\?{2,}/g, '?')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return out.slice(0, 2500);
  }

  async textToSpeech(options: {
    text: string;
    speaker?: string;
    language?: string;
    pace?: number;
    temperature?: number;
    /** Demo turns only need base64 — skip disk write for speed */
    skipSave?: boolean;
  }): Promise<{ audioBase64: string; fileName: string; filePath: string }> {
    const text = this.formatSpeechText(options.text || '', options.language);
    if (!text) throw new BadRequestException('Text is required for TTS');

    const language_code = this.normalizeLanguage(options.language);
    const speaker = this.normalizeSpeaker(options.speaker);
    // Natural phone pace; lower temperature = calmer, less theatrical
    const pace = options.pace ?? 1.0;
    const temperature = options.temperature ?? 0.35;

    const response = await fetch(`${this.baseUrl}/text-to-speech`, {
      method: 'POST',
      headers: {
        'api-subscription-key': this.getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        target_language_code: language_code,
        language_code,
        speaker,
        model: 'bulbul:v3',
        pace,
        temperature,
        speech_sample_rate: 16000,
        output_audio_codec: 'wav',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new BadRequestException(
        `Sarvam TTS failed (${response.status}): ${errText.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      audios?: string[];
      request_id?: string;
    };
    const audioBase64 = data.audios?.[0];
    if (!audioBase64) {
      throw new BadRequestException('Sarvam TTS returned no audio');
    }

    const fileName = `tts-${randomUUID()}.wav`;
    const filePath = path.join(this.uploadsDir, fileName);
    if (!options.skipSave) {
      fs.writeFileSync(filePath, Buffer.from(audioBase64, 'base64'));
    }

    return { audioBase64, fileName, filePath };
  }

  async speechToText(options: {
    filePath?: string;
    buffer?: Buffer;
    fileName?: string;
    language?: string;
  }): Promise<{ transcript: string; languageCode?: string | null }> {
    const apiKey = this.getApiKey();
    const form = new FormData();

    if (options.filePath) {
      const bytes = new Uint8Array(fs.readFileSync(options.filePath));
      const blob = new Blob([bytes], { type: 'audio/wav' });
      form.append('file', blob, path.basename(options.filePath));
    } else if (options.buffer) {
      const bytes = new Uint8Array(options.buffer);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      form.append('file', blob, options.fileName || 'recording.wav');
    } else {
      throw new BadRequestException('Audio file is required for STT');
    }

    form.append('model', 'saaras:v3');
    form.append('mode', 'transcribe');
    const language = this.normalizeLanguage(options.language);
    form.append('language_code', language);

    const response = await fetch(`${this.baseUrl}/speech-to-text`, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new BadRequestException(
        `Sarvam STT failed (${response.status}): ${errText.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      transcript?: string;
      language_code?: string | null;
    };

    return {
      transcript: data.transcript || '',
      languageCode: data.language_code,
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
