import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElevenLabsService } from '../elevenlabs/elevenlabs.service';
import { applyPlacePronunciation } from '../elevenlabs/place-names';

/**
 * Voice layer — ElevenLabs only (TTS + STT). No Sarvam.
 */
@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private config: ConfigService,
    private elevenlabs: ElevenLabsService,
  ) {}

  private activeVoiceSettings: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
    useSpeakerBoost?: boolean;
  } = {
    stability: 0.38,
    similarityBoost: 0.80,
    style: 0.20,
    speed: 1.0,
    useSpeakerBoost: true,
  };

  setActiveVoiceSettings(settings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
    useSpeakerBoost?: boolean;
  }) {
    if (!settings) return;
    this.activeVoiceSettings = {
      ...this.activeVoiceSettings,
      ...settings,
    };
    this.logger.log(
      `VoiceService active voice settings updated: stability=${this.activeVoiceSettings.stability} similarity=${this.activeVoiceSettings.similarityBoost} style=${this.activeVoiceSettings.style} speed=${this.activeVoiceSettings.speed} speakerBoost=${this.activeVoiceSettings.useSpeakerBoost}`,
    );
  }

  getActiveVoiceSettings() {
    return this.activeVoiceSettings;
  }

  getTtsProvider(): 'elevenlabs' {
    if (!this.elevenlabs.isConfigured()) {
      throw new ServiceUnavailableException(
        'ELEVENLABS_API_KEY is not configured. Add it to backend/.env',
      );
    }
    return 'elevenlabs';
  }

  normalizeSpeaker(speaker?: string): string {
    return this.elevenlabs.normalizeSpeaker(speaker);
  }

  /** App language tags for CRM / UI. */
  normalizeAppLanguage(language?: string): string {
    const lang = (language || '').toLowerCase().trim();
    if (!lang) return 'hinglish';
    if (lang.includes('hinglish')) return 'hinglish';
    if (lang.startsWith('hi')) return 'hi-IN';
    if (lang.startsWith('en')) return 'en-IN';
    if (lang.startsWith('mr')) return 'mr-IN';
    if (lang.startsWith('gu')) return 'gu-IN';
    if (lang.startsWith('ta')) return 'ta-IN';
    if (lang.startsWith('te')) return 'te-IN';
    if (lang.startsWith('kn')) return 'kn-IN';
    if (lang.startsWith('bn')) return 'bn-IN';
    if (lang.startsWith('pa')) return 'pa-IN';
    return 'hinglish';
  }

  normalizeLanguage(language?: string) {
    return this.normalizeAppLanguage(language);
  }

  /**
   * Light cleanup only — heavy rewriting makes ElevenLabs sound robotic vs Voice Lab.
   */
  formatSpeechText(text: string, language?: string): string {
    let out = (text || '').trim();
    if (!out) return out;
    out = applyPlacePronunciation(out, language || 'hi-IN');
    out = out
      .replace(/\s*[|]{1,}\s*/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .replace(/([\u0900-\u097F])([A-Za-z0-9])/g, '$1 $2')
      .replace(/([A-Za-z0-9])([\u0900-\u097F])/g, '$1 $2')
      .trim();
    return out.slice(0, 2200);
  }

  async textToSpeech(options: {
    text: string;
    speaker?: string;
    language?: string;
    pace?: number;
    temperature?: number;
    skipSave?: boolean;
    outputFormat?: string;
    modelId?: string;
    optimizeStreamingLatency?: number;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  }) {
    this.getTtsProvider();
    const text = this.formatSpeechText(options.text, options.language);
    const rawVoiceId = (
      this.config.get<string>('ELEVENLABS_DEFAULT_VOICE_ID') || ''
    ).trim();
    const voiceId = /^[a-zA-Z0-9]{20,}$/.test(rawVoiceId) ? rawVoiceId : '';

    const active = this.activeVoiceSettings;
    const stability = options.stability ?? active?.stability ?? 0.38;
    const similarityBoost = options.similarityBoost ?? active?.similarityBoost ?? 0.80;
    const style = options.style ?? active?.style ?? 0.20;
    const useSpeakerBoost = options.useSpeakerBoost ?? active?.useSpeakerBoost ?? true;
    const pace = options.pace ?? active?.speed ?? 1.0;

    this.logger.log(
      `TTS via ElevenLabs voice_id=${voiceId || options.speaker || 'default'} lang=${options.language || '-'} format=${options.outputFormat || 'default'} stability=${stability} style=${style} speed=${pace}`,
    );
    return this.elevenlabs.textToSpeech({
      text,
      speaker: voiceId || options.speaker || 'custom',
      language: options.language,
      pace,
      skipSave: options.skipSave,
      outputFormat: options.outputFormat,
      modelId: options.modelId,
      optimizeStreamingLatency: options.optimizeStreamingLatency,
      stability,
      similarityBoost,
      style,
      useSpeakerBoost,
    });
  }

  async speechToText(options: {
    filePath?: string;
    buffer?: Buffer;
    fileName?: string;
    language?: string;
  }) {
    this.getTtsProvider();
    return this.elevenlabs.speechToText(options);
  }

  getAudioAbsolutePath(fileName: string) {
    return this.elevenlabs.getAudioAbsolutePath(fileName);
  }
}
