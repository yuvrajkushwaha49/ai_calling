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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SarvamService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const place_names_1 = require("../elevenlabs/place-names");
let SarvamService = class SarvamService {
    config;
    baseUrl = 'https://api.sarvam.ai';
    uploadsDir = path.join(process.cwd(), 'uploads', 'audio');
    constructor(config) {
        this.config = config;
        fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    getApiKey() {
        const key = this.config.get('SARVAM_API_KEY')?.trim();
        if (!key) {
            throw new common_1.ServiceUnavailableException('SARVAM_API_KEY is not configured. Add it to backend/.env');
        }
        return key;
    }
    normalizeLanguage(language) {
        const map = {
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
    normalizeAppLanguage(language) {
        const value = (language || 'en-IN').trim();
        const allowed = new Set(['en-IN', 'hi-IN', 'hinglish', 'mr-IN', 'gu-IN']);
        if (allowed.has(value))
            return value;
        const aliases = {
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
    normalizeSpeaker(speaker) {
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
        const legacy = {
            alloy: 'shubh',
            echo: 'aditya',
            fable: 'ritu',
            onyx: 'rahul',
            nova: 'priya',
            shimmer: 'simran',
        };
        if (legacy[value])
            return legacy[value];
        if (valid.has(value))
            return value;
        return 'shubh';
    }
    formatSpeechText(text, language) {
        let out = (text || '').trim();
        if (!out)
            return out;
        out = out.replace(/\.{3,}/g, '…');
        out = out.replace(/\b(\d{5,})\b/g, (n) => Number(n).toLocaleString('en-IN'));
        out = (0, place_names_1.applyPlacePronunciation)(out, language || 'hi-IN');
        out = out
            .replace(/\bGot it[,.]?\s*/gi, '')
            .replace(/\bI understand[,.]?\s*/gi, '')
            .replace(/\bNoted[,.]?\s*/gi, '')
            .replace(/\bPerfect[,!]?\s*/gi, 'बढ़िया, ')
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
    async textToSpeech(options) {
        const text = this.formatSpeechText(options.text || '', options.language);
        if (!text)
            throw new common_1.BadRequestException('Text is required for TTS');
        const language_code = this.normalizeLanguage(options.language);
        const speaker = this.normalizeSpeaker(options.speaker);
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
            throw new common_1.BadRequestException(`Sarvam TTS failed (${response.status}): ${errText.slice(0, 300)}`);
        }
        const data = (await response.json());
        const audioBase64 = data.audios?.[0];
        if (!audioBase64) {
            throw new common_1.BadRequestException('Sarvam TTS returned no audio');
        }
        const fileName = `tts-${(0, crypto_1.randomUUID)()}.wav`;
        const filePath = path.join(this.uploadsDir, fileName);
        if (!options.skipSave) {
            fs.writeFileSync(filePath, Buffer.from(audioBase64, 'base64'));
        }
        return { audioBase64, fileName, filePath };
    }
    async speechToText(options) {
        const apiKey = this.getApiKey();
        const form = new FormData();
        if (options.filePath) {
            const bytes = new Uint8Array(fs.readFileSync(options.filePath));
            const blob = new Blob([bytes], { type: 'audio/wav' });
            form.append('file', blob, path.basename(options.filePath));
        }
        else if (options.buffer) {
            const bytes = new Uint8Array(options.buffer);
            const blob = new Blob([bytes], { type: 'audio/wav' });
            form.append('file', blob, options.fileName || 'recording.wav');
        }
        else {
            throw new common_1.BadRequestException('Audio file is required for STT');
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
            throw new common_1.BadRequestException(`Sarvam STT failed (${response.status}): ${errText.slice(0, 300)}`);
        }
        const data = (await response.json());
        return {
            transcript: data.transcript || '',
            languageCode: data.language_code,
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
exports.SarvamService = SarvamService;
exports.SarvamService = SarvamService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SarvamService);
//# sourceMappingURL=sarvam.service.js.map