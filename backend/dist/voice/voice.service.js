"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var VoiceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const elevenlabs_service_1 = require("../elevenlabs/elevenlabs.service");
const place_names_1 = require("../elevenlabs/place-names");
let VoiceService = VoiceService_1 = class VoiceService {
    config;
    elevenlabs;
    logger = new common_1.Logger(VoiceService_1.name);
    constructor(config, elevenlabs) {
        this.config = config;
        this.elevenlabs = elevenlabs;
    }
    getTtsProvider() {
        if (!this.elevenlabs.isConfigured()) {
            throw new common_1.ServiceUnavailableException('ELEVENLABS_API_KEY is not configured. Add it to backend/.env');
        }
        return 'elevenlabs';
    }
    normalizeSpeaker(speaker) {
        return this.elevenlabs.normalizeSpeaker(speaker);
    }
    normalizeAppLanguage(language) {
        const lang = (language || '').toLowerCase().trim();
        if (!lang)
            return 'hi-IN';
        if (lang.includes('hinglish'))
            return 'hi-IN';
        if (lang.startsWith('hi'))
            return 'hi-IN';
        if (lang.startsWith('en'))
            return 'en-IN';
        if (lang.startsWith('mr'))
            return 'mr-IN';
        if (lang.startsWith('gu'))
            return 'gu-IN';
        if (lang.startsWith('ta'))
            return 'ta-IN';
        if (lang.startsWith('te'))
            return 'te-IN';
        if (lang.startsWith('kn'))
            return 'kn-IN';
        if (lang.startsWith('bn'))
            return 'bn-IN';
        if (lang.startsWith('pa'))
            return 'pa-IN';
        return 'hi-IN';
    }
    normalizeLanguage(language) {
        return this.normalizeAppLanguage(language);
    }
    formatSpeechText(text, language) {
        let out = (text || '').trim();
        if (!out)
            return out;
        out = (0, place_names_1.applyPlacePronunciation)(out, language || 'hi-IN');
        out = out
            .replace(/\s*[|]{1,}\s*/g, ', ')
            .replace(/\s{2,}/g, ' ')
            .replace(/([\u0900-\u097F])([A-Za-z0-9])/g, '$1 $2')
            .replace(/([A-Za-z0-9])([\u0900-\u097F])/g, '$1 $2')
            .trim();
        return out.slice(0, 2200);
    }
    async textToSpeech(options) {
        this.getTtsProvider();
        const text = this.formatSpeechText(options.text, options.language);
        const voiceId = (this.config.get('ELEVENLABS_DEFAULT_VOICE_ID') || '').trim();
        this.logger.log(`TTS via ElevenLabs voice_id=${voiceId || options.speaker || 'default'} lang=${options.language || '-'} format=${options.outputFormat || 'default'}`);
        return this.elevenlabs.textToSpeech({
            text,
            speaker: voiceId || options.speaker || 'custom',
            language: options.language,
            pace: options.pace ?? 1.0,
            skipSave: options.skipSave,
            outputFormat: options.outputFormat,
            modelId: options.modelId,
            optimizeStreamingLatency: options.optimizeStreamingLatency,
        });
    }
    async speechToText(options) {
        this.getTtsProvider();
        return this.elevenlabs.speechToText(options);
    }
    getAudioAbsolutePath(fileName) {
        return this.elevenlabs.getAudioAbsolutePath(fileName);
    }
};
exports.VoiceService = VoiceService;
exports.VoiceService = VoiceService = VoiceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        elevenlabs_service_1.ElevenLabsService])
], VoiceService);
//# sourceMappingURL=voice.service.js.map