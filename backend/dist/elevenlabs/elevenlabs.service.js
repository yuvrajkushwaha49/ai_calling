"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ElevenLabsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElevenLabsService = exports.ELEVENLABS_VOICES = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const hindi_romanize_1 = require("./hindi-romanize");
const place_names_1 = require("./place-names");
exports.ELEVENLABS_VOICES = {
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
let ElevenLabsService = ElevenLabsService_1 = class ElevenLabsService {
    config;
    logger = new common_1.Logger(ElevenLabsService_1.name);
    baseUrl = 'https://api.elevenlabs.io/v1';
    uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
    freeVoiceIdCache = null;
    constructor(config) {
        this.config = config;
        fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    isConfigured() {
        return Boolean(this.config.get('ELEVENLABS_API_KEY')?.trim());
    }
    getApiKey() {
        const key = this.config.get('ELEVENLABS_API_KEY')?.trim();
        if (!key) {
            throw new common_1.ServiceUnavailableException('ELEVENLABS_API_KEY is not configured. Add it to backend/.env');
        }
        return key;
    }
    getModel() {
        return (this.config.get('ELEVENLABS_MODEL')?.trim() ||
            'eleven_multilingual_v2');
    }
    normalizeSpeaker(speaker) {
        const envDefault = this.config.get('ELEVENLABS_DEFAULT_VOICE_ID')?.trim();
        const value = (speaker || '').trim() || envDefault || 'darian';
        const lower = value.toLowerCase();
        if (exports.ELEVENLABS_VOICES[lower])
            return lower;
        if (/^[a-zA-Z0-9]{20,}$/.test(value))
            return value;
        const legacy = {
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
    resolveVoiceId(speaker) {
        const envDefault = this.config.get('ELEVENLABS_DEFAULT_VOICE_ID')?.trim();
        if (envDefault && /^[a-zA-Z0-9]{20,}$/.test(envDefault)) {
            return envDefault;
        }
        if (this.freeVoiceIdCache)
            return this.freeVoiceIdCache;
        const normalized = this.normalizeSpeaker(speaker);
        const mapped = exports.ELEVENLABS_VOICES[normalized]?.id;
        if (mapped)
            return mapped;
        if (/^[a-zA-Z0-9]{20,}$/.test(normalized))
            return normalized;
        return exports.ELEVENLABS_VOICES.custom.id || exports.ELEVENLABS_VOICES.darian.id;
    }
    async pickFreePlanVoiceId() {
        if (this.freeVoiceIdCache)
            return this.freeVoiceIdCache;
        const envDefault = this.config.get('ELEVENLABS_DEFAULT_VOICE_ID')?.trim();
        if (envDefault && /^[a-zA-Z0-9]{20,}$/.test(envDefault)) {
            this.freeVoiceIdCache = envDefault;
            return envDefault;
        }
        let response;
        try {
            response = await fetch(`${this.baseUrl}/voices`, {
                headers: { 'xi-api-key': this.getApiKey() },
            });
        }
        catch (error) {
            this.logger.warn(`ElevenLabs voices list failed: ${error instanceof Error ? error.message : error}`);
            return null;
        }
        if (!response.ok) {
            const errText = await response.text();
            this.logger.warn(`Cannot list ElevenLabs voices (${response.status}): ${errText.slice(0, 200)}. Create an API key with voices_read, or set ELEVENLABS_DEFAULT_VOICE_ID to a Voice Design voice from My Voices.`);
            return null;
        }
        const data = (await response.json());
        const voices = data.voices || [];
        const preferred = voices.find((v) => /^(generated|cloned)$/i.test(v.category || ''));
        const anyOwned = preferred || voices.find((v) => v.voice_id);
        if (anyOwned?.voice_id) {
            this.freeVoiceIdCache = anyOwned.voice_id;
            this.logger.log(`Using free-plan ElevenLabs voice: ${anyOwned.name || anyOwned.voice_id} (${anyOwned.category || 'unknown'})`);
            return anyOwned.voice_id;
        }
        return null;
    }
    voiceGender(speaker) {
        const normalized = this.normalizeSpeaker(speaker);
        return exports.ELEVENLABS_VOICES[normalized]?.gender || 'female';
    }
    listVoices() {
        return Object.entries(exports.ELEVENLABS_VOICES).map(([value, meta]) => ({
            value,
            label: meta.label,
            gender: meta.gender,
            voiceId: meta.id,
        }));
    }
    freePlanHelpMessage() {
        return ('ElevenLabs free plan cannot use Voice Library voices via API. ' +
            '1) Open https://elevenlabs.io/app/voice-lab → Voice Design → create & save a voice. ' +
            '2) Copy its voice_id into backend/.env as ELEVENLABS_DEFAULT_VOICE_ID. ' +
            '3) Prefer an API key with full access (voices_read) so we can auto-pick free voices.');
    }
    formatForElevenLabs(text, language, modelOverride) {
        let out = (0, hindi_romanize_1.softenForNaturalSpeech)(text || '');
        if (!out)
            return out;
        out = (0, place_names_1.applyPlacePronunciation)(out, language);
        out = out
            .replace(/([\u0900-\u097F])([A-Za-z0-9])/g, '$1 $2')
            .replace(/([A-Za-z0-9])([\u0900-\u097F])/g, '$1 $2')
            .replace(/\s{2,}/g, ' ')
            .trim();
        const lang = (language || '').toLowerCase();
        const wantsHindi = lang.includes('hi') ||
            lang.includes('hinglish') ||
            lang.startsWith('mr') ||
            (0, hindi_romanize_1.hasDevanagari)(out);
        const model = modelOverride || this.getModel();
        const isMultilingual = model.includes('multilingual');
        const isEnglish = lang.startsWith('en') && !(0, hindi_romanize_1.hasDevanagari)(out);
        if (!isEnglish && wantsHindi && (0, hindi_romanize_1.hasDevanagari)(out) && !isMultilingual) {
            out = (0, hindi_romanize_1.devanagariToRoman)(out);
        }
        return out.slice(0, 2200);
    }
    resolveLanguageCode(language, romanized = false, modelOverride) {
        const model = modelOverride || this.getModel();
        if (model.includes('multilingual_v2'))
            return undefined;
        const lang = (language || '').toLowerCase().trim();
        if (lang.startsWith('en') && !romanized)
            return 'en';
        if (romanized || lang === 'hinglish' || lang.startsWith('hi'))
            return 'hi';
        if (lang.startsWith('en'))
            return 'en';
        if (lang.startsWith('mr'))
            return 'hi';
        if (lang.startsWith('gu'))
            return 'hi';
        if (lang.startsWith('ta'))
            return 'ta';
        if (lang.startsWith('te'))
            return 'te';
        if (lang.startsWith('kn'))
            return 'kn';
        if (lang.startsWith('bn'))
            return 'bn';
        if (lang.startsWith('pa'))
            return 'hi';
        return 'hi';
    }
    async textToSpeech(options) {
        const raw = (options.text || '').trim();
        const wasDevanagari = (0, hindi_romanize_1.hasDevanagari)(raw);
        const modelId = options.modelId?.trim() ||
            this.config.get('ELEVENLABS_MODEL')?.trim() ||
            'eleven_multilingual_v2';
        const text = this.formatForElevenLabs(raw, options.language, modelId);
        if (!text)
            throw new common_1.BadRequestException('Text is required for TTS');
        let voiceId = '';
        const envVoice = this.config.get('ELEVENLABS_DEFAULT_VOICE_ID')?.trim();
        if (envVoice && /^[a-zA-Z0-9]{20,}$/.test(envVoice)) {
            voiceId = envVoice;
        }
        const speaker = (options.speaker || '').trim();
        if (!voiceId && /^[a-zA-Z0-9]{20,}$/.test(speaker)) {
            voiceId = speaker;
        }
        if (!voiceId) {
            voiceId = this.resolveVoiceId(options.speaker);
        }
        if (!voiceId) {
            throw new common_1.BadRequestException(this.freePlanHelpMessage());
        }
        const languageCode = this.resolveLanguageCode(options.language, wasDevanagari, modelId);
        const pace = options.pace ?? 1.0;
        const speed = Math.min(1.2, Math.max(0.7, pace));
        const outputFormat = options.outputFormat || 'mp3_44100_128';
        const optimize = options.optimizeStreamingLatency != null
            ? Math.max(0, Math.min(4, options.optimizeStreamingLatency))
            : null;
        this.logger.log(`ElevenLabs TTS voice_id=${voiceId} model=${modelId} format=${outputFormat} lang=${languageCode || '-'} speed=${speed}`);
        this.logger.debug(`ElevenLabs TTS text: ${text.slice(0, 120)}`);
        const doRequest = async (id) => {
            const qs = new URLSearchParams({
                output_format: outputFormat,
            });
            if (optimize != null) {
                qs.set('optimize_streaming_latency', String(optimize));
            }
            const url = `${this.baseUrl}/text-to-speech/${encodeURIComponent(id)}?${qs.toString()}`;
            const body = {
                text,
                model_id: modelId,
            };
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
        let response;
        try {
            response = await doRequest(voiceId);
        }
        catch (error) {
            this.logger.warn(`ElevenLabs network error: ${error instanceof Error ? error.message : error}`);
            throw new common_1.ServiceUnavailableException('ElevenLabs TTS request failed');
        }
        if (response.status === 402) {
            this.logger.warn(`Voice ${voiceId} needs paid plan — trying free-plan owned voice…`);
            this.freeVoiceIdCache = null;
            const freeId = await this.pickFreePlanVoiceId();
            if (freeId && freeId !== voiceId) {
                voiceId = freeId;
                try {
                    response = await doRequest(voiceId);
                }
                catch (error) {
                    throw new common_1.ServiceUnavailableException('ElevenLabs TTS request failed');
                }
            }
            else {
                throw new common_1.BadRequestException(this.freePlanHelpMessage());
            }
        }
        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 402) {
                throw new common_1.BadRequestException(this.freePlanHelpMessage());
            }
            throw new common_1.BadRequestException(`ElevenLabs TTS failed (${response.status}): ${errText.slice(0, 300)}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length) {
            throw new common_1.BadRequestException('ElevenLabs TTS returned no audio');
        }
        const audioBase64 = buffer.toString('base64');
        const fileName = `tts-el-${(0, crypto_1.randomUUID)()}.mp3`;
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
    sttLanguageCode(language) {
        const lang = (language || '').toLowerCase().trim();
        if (!lang)
            return undefined;
        if (lang.includes('hinglish') || lang.startsWith('hi'))
            return 'hi';
        if (lang.startsWith('en'))
            return 'en';
        if (lang.startsWith('mr'))
            return 'mr';
        if (lang.startsWith('gu'))
            return 'gu';
        if (lang.startsWith('ta'))
            return 'ta';
        if (lang.startsWith('te'))
            return 'te';
        if (lang.startsWith('kn'))
            return 'kn';
        if (lang.startsWith('bn'))
            return 'bn';
        if (lang.startsWith('pa'))
            return 'pa';
        return lang.slice(0, 2) || undefined;
    }
    async speechToText(options) {
        const apiKey = this.getApiKey();
        const form = new FormData();
        let fileName = options.fileName || 'audio.wav';
        let bytes;
        if (options.filePath) {
            bytes = new Uint8Array(fs.readFileSync(options.filePath));
            fileName = path.basename(options.filePath);
        }
        else if (options.buffer) {
            bytes = new Uint8Array(options.buffer);
        }
        else {
            throw new common_1.BadRequestException('Audio file is required for STT');
        }
        const lower = fileName.toLowerCase();
        const mime = lower.endsWith('.mp3')
            ? 'audio/mpeg'
            : lower.endsWith('.webm')
                ? 'audio/webm'
                : lower.endsWith('.ogg')
                    ? 'audio/ogg'
                    : 'audio/wav';
        form.append('file', new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
            type: mime,
        }), fileName);
        form.append('model_id', 'scribe_v2');
        const lang = this.sttLanguageCode(options.language);
        if (lang)
            form.append('language_code', lang);
        const response = await fetch(`${this.baseUrl}/speech-to-text`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
            },
            body: form,
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new common_1.BadRequestException(`ElevenLabs STT failed (${response.status}): ${errText.slice(0, 300)}`);
        }
        const data = (await response.json());
        const transcript = (data.text || data.transcript || '').trim();
        this.logger.log(`ElevenLabs STT lang=${data.language_code || lang || '-'} chars=${transcript.length}`);
        return {
            transcript,
            languageCode: data.language_code || lang || null,
        };
    }
    getAudioAbsolutePath(fileName) {
        const safe = path.basename(fileName);
        const full = path.join(this.uploadsDir, safe);
        if (!fs.existsSync(full)) {
            throw new common_1.BadRequestException('Audio file not found');
        }
        return full;
    }
};
exports.ElevenLabsService = ElevenLabsService;
exports.ElevenLabsService = ElevenLabsService = ElevenLabsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ElevenLabsService);
//# sourceMappingURL=elevenlabs.service.js.map