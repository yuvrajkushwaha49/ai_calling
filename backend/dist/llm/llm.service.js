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
var LlmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let LlmService = LlmService_1 = class LlmService {
    config;
    logger = new common_1.Logger(LlmService_1.name);
    constructor(config) {
        this.config = config;
    }
    getProvider() {
        const forced = (this.config.get('LLM_PROVIDER') || '')
            .trim()
            .toLowerCase();
        if (forced === 'gemini' || forced === 'openai')
            return forced;
        if (this.getGeminiKey())
            return 'gemini';
        if (this.getOpenAiKey())
            return 'openai';
        return 'gemini';
    }
    isConfigured() {
        return this.getProvider() === 'gemini'
            ? Boolean(this.getGeminiKey())
            : Boolean(this.getOpenAiKey());
    }
    getGeminiKey() {
        let raw = (this.config.get('GEMINI_API_KEY')?.trim() ||
            this.config.get('GOOGLE_API_KEY')?.trim() ||
            '');
        raw = raw.split(/\s+#/)[0].trim();
        return raw.replace(/^["'\s]+|["'\s;]+$/g, '').trim();
    }
    getOpenAiKey() {
        let raw = (this.config.get('OPENAI_API_KEY')?.trim() ||
            this.config.get('LLM_API_KEY')?.trim() ||
            '');
        raw = raw.split(/\s+#/)[0].trim();
        return raw.replace(/^["'\s]+|["'\s;]+$/g, '').trim();
    }
    getOpenAiBaseUrl() {
        return (this.config.get('LLM_BASE_URL')?.trim() ||
            'https://api.openai.com/v1');
    }
    getDefaultModel() {
        const configured = this.config.get('LLM_MODEL')?.trim();
        if (configured)
            return configured;
        return this.getProvider() === 'gemini'
            ? 'gemini-flash-lite-latest'
            : 'gpt-4o-mini';
    }
    getEmbedModel() {
        return (this.config.get('LLM_EMBED_MODEL')?.trim() ||
            (this.getProvider() === 'gemini'
                ? 'gemini-embedding-001'
                : 'text-embedding-3-small'));
    }
    getStatus() {
        const provider = this.getProvider();
        return {
            configured: this.isConfigured(),
            provider,
            defaultModel: this.getDefaultModel(),
            baseUrl: provider === 'gemini'
                ? 'https://generativelanguage.googleapis.com/v1beta'
                : this.getOpenAiBaseUrl(),
        };
    }
    async chat(messages, options) {
        if (!this.isConfigured()) {
            this.logger.warn('No LLM API key configured — using scripted replies. Set GEMINI_API_KEY or OPENAI_API_KEY in backend/.env');
            return null;
        }
        const model = this.resolveChatModel(options?.model);
        const timeoutMs = options?.timeoutMs;
        const run = this.getProvider() === 'gemini'
            ? () => this.chatGemini(messages, model, options)
            : () => this.chatOpenAi(messages, model, options);
        if (!timeoutMs || timeoutMs <= 0) {
            return run();
        }
        let timer;
        try {
            return await Promise.race([
                run(),
                new Promise((resolve) => {
                    timer = setTimeout(() => {
                        this.logger.warn(`LLM timed out after ${timeoutMs}ms — scripted fallback`);
                        resolve(null);
                    }, timeoutMs);
                }),
            ]);
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    async *chatStream(messages, options) {
        if (!this.isConfigured())
            return;
        const model = this.resolveChatModel(options?.model);
        if (this.getProvider() === 'gemini') {
            const candidates = [
                'gemini-flash-lite-latest',
                'gemini-3.5-flash',
                'gemini-3.6-flash',
                'gemini-flash-latest',
                model,
            ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);
            for (const m of candidates) {
                let yielded = false;
                for await (const chunk of this.streamGemini(messages, m, options)) {
                    yielded = true;
                    yield chunk;
                }
                if (yielded)
                    return;
                this.logger.warn(`Gemini stream via ${m} had no tokens, trying fallback...`);
            }
            return;
        }
        yield* this.streamOpenAi(messages, model, options);
    }
    buildGeminiBody(messages, model, options) {
        const systemParts = messages
            .filter((m) => m.role === 'system')
            .map((m) => m.content)
            .filter(Boolean);
        const contents = messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
        const merged = [];
        for (const turn of contents) {
            const last = merged[merged.length - 1];
            if (last && last.role === turn.role) {
                last.parts[0].text += `\n\n${turn.parts[0].text}`;
            }
            else {
                merged.push({
                    role: turn.role,
                    parts: [{ text: turn.parts[0].text }],
                });
            }
        }
        if (merged.length && merged[0].role !== 'user') {
            merged.unshift({ role: 'user', parts: [{ text: 'Continue.' }] });
        }
        const generationConfig = {
            maxOutputTokens: options?.maxOutputTokens ?? (options?.json ? 400 : 120),
            ...(options?.json ? { responseMimeType: 'application/json' } : {}),
            temperature: options?.temperature ?? 0.4,
        };
        const body = {
            contents: merged,
            generationConfig,
        };
        if (systemParts.length) {
            body.systemInstruction = {
                parts: [{ text: systemParts.join('\n\n') }],
            };
        }
        return body;
    }
    async *streamGemini(messages, model, options) {
        const apiKey = this.getGeminiKey();
        const body = this.buildGeminiBody(messages, model, options);
        const legacyQueryKey = apiKey.startsWith('AIza')
            ? `&key=${encodeURIComponent(apiKey)}`
            : '';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse${legacyQueryKey}`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify(body),
                signal: options?.timeoutMs
                    ? AbortSignal.timeout(Math.max(800, options.timeoutMs))
                    : undefined,
            });
            if (!res.ok || !res.body) {
                const errText = res.ok ? 'no body' : await res.text();
                const maskedKey = apiKey
                    ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)} (len ${apiKey.length})`
                    : 'EMPTY';
                this.logger.warn(`Gemini stream (${model}) failed: ${res.status} [key: ${maskedKey}] ${String(errText).slice(0, 400)}`);
                return;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n');
                buffer = parts.pop() || '';
                for (const line of parts) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:'))
                        continue;
                    const payload = trimmed.slice(5).trim();
                    if (!payload || payload === '[DONE]')
                        continue;
                    try {
                        const json = JSON.parse(payload);
                        const text = (json.candidates?.[0]?.content?.parts || [])
                            .map((p) => p.text || '')
                            .join('');
                        if (text)
                            yield text;
                    }
                    catch {
                    }
                }
            }
        }
        catch (error) {
            this.logger.warn(`Gemini stream error: ${error instanceof Error ? error.message : error}`);
        }
    }
    async *streamOpenAi(messages, model, options) {
        const apiKey = this.getOpenAiKey();
        try {
            const res = await fetch(`${this.getOpenAiBaseUrl()}/chat/completions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: options?.temperature ?? 0.4,
                    max_tokens: options?.maxOutputTokens ?? 120,
                    stream: true,
                }),
                signal: options?.timeoutMs
                    ? AbortSignal.timeout(Math.max(800, options.timeoutMs))
                    : undefined,
            });
            if (!res.ok || !res.body) {
                const errText = res.ok ? 'no body' : await res.text();
                this.logger.warn(`ChatGPT stream (${model}) failed: ${res.status} ${String(errText).slice(0, 300)}`);
                return;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n');
                buffer = parts.pop() || '';
                for (const line of parts) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:'))
                        continue;
                    const payload = trimmed.slice(5).trim();
                    if (!payload || payload === '[DONE]')
                        continue;
                    try {
                        const json = JSON.parse(payload);
                        const delta = json.choices?.[0]?.delta?.content;
                        if (delta)
                            yield delta;
                    }
                    catch {
                    }
                }
            }
        }
        catch (error) {
            this.logger.warn(`ChatGPT stream error: ${error instanceof Error ? error.message : error}`);
        }
    }
    resolveChatModel(requested) {
        let model = (requested || this.getDefaultModel()).trim();
        if (this.getProvider() === 'gemini') {
            if (model.startsWith('gpt-') || model.startsWith('o4-')) {
                return 'gemini-flash-lite-latest';
            }
            if (model === 'gemini-2.5-flash-lite' ||
                model === 'gemini-3.5-flash-lite' ||
                model === 'gemini-2.5-flash' ||
                model === 'gemini-2.0-flash' ||
                model === 'gemini-3.8-flash' ||
                model === 'gemini-3.7-flash') {
                return 'gemini-flash-lite-latest';
            }
        }
        return model;
    }
    async chatGemini(messages, model, options) {
        const primary = await this.chatGeminiOnce(messages, model, options);
        if (primary)
            return primary;
        if (options?.lowLatency) {
            for (const alt of [
                'gemini-flash-lite-latest',
                'gemini-3.5-flash',
                'gemini-3.6-flash',
            ]) {
                if (alt === model)
                    continue;
                const hit = await this.chatGeminiOnce(messages, alt, {
                    ...options,
                    timeoutMs: Math.min(options.timeoutMs || 2500, 2000),
                });
                if (hit) {
                    this.logger.log(`Gemini fallback hit via ${alt}`);
                    return hit;
                }
            }
        }
        return null;
    }
    async chatGeminiOnce(messages, model, options) {
        const apiKey = this.getGeminiKey();
        const body = this.buildGeminiBody(messages, model, options);
        const legacyQueryKey = apiKey.startsWith('AIza')
            ? `?key=${encodeURIComponent(apiKey)}`
            : '';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent${legacyQueryKey}`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify(body),
                signal: options?.timeoutMs
                    ? AbortSignal.timeout(Math.max(500, options.timeoutMs))
                    : undefined,
            });
            if (!res.ok) {
                const errText = await res.text();
                const maskedKey = apiKey
                    ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)} (len ${apiKey.length})`
                    : 'EMPTY';
                this.logger.warn(`Gemini (${model}) failed: ${res.status} [key: ${maskedKey}] ${errText.slice(0, 400)}`);
                return null;
            }
            const data = (await res.json());
            const parts = data.candidates?.[0]?.content?.parts || [];
            const text = parts
                .map((p) => p.text || '')
                .filter(Boolean)
                .join('')
                .trim();
            return text || null;
        }
        catch (error) {
            this.logger.warn(`Gemini error (${model}): ${error instanceof Error ? error.message : error}`);
            return null;
        }
    }
    async chatOpenAi(messages, model, options) {
        const apiKey = this.getOpenAiKey();
        const body = {
            model,
            messages,
            temperature: options?.temperature ?? 0.4,
            max_tokens: options?.maxOutputTokens ?? (options?.json ? 400 : 120),
        };
        if (options?.json) {
            body.response_format = { type: 'json_object' };
        }
        try {
            const res = await fetch(`${this.getOpenAiBaseUrl()}/chat/completions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const errText = await res.text();
                this.logger.warn(`ChatGPT (${model}) failed: ${res.status} ${errText.slice(0, 300)}`);
                return null;
            }
            const data = (await res.json());
            return data.choices?.[0]?.message?.content?.trim() || null;
        }
        catch (error) {
            this.logger.warn(`ChatGPT error: ${error instanceof Error ? error.message : error}`);
            return null;
        }
    }
    async embed(texts) {
        if (texts.length === 0)
            return null;
        if (this.getProvider() === 'gemini' && this.getGeminiKey()) {
            return this.embedGemini(texts);
        }
        if (this.getOpenAiKey()) {
            return this.embedOpenAi(texts);
        }
        return null;
    }
    async embedGemini(texts) {
        const apiKey = this.getGeminiKey();
        const configured = this.getEmbedModel();
        const model = configured.includes('embedding') || configured.includes('embed')
            ? configured
            : 'gemini-embedding-001';
        const out = [];
        const legacyQueryKey = apiKey.startsWith('AIza')
            ? `?key=${encodeURIComponent(apiKey)}`
            : '';
        try {
            for (const text of texts) {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent${legacyQueryKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey,
                    },
                    body: JSON.stringify({
                        model: `models/${model}`,
                        content: { parts: [{ text: text.slice(0, 8000) }] },
                    }),
                });
                if (!res.ok) {
                    const errText = await res.text();
                    this.logger.warn(`Gemini embed failed: ${res.status} ${errText.slice(0, 200)}`);
                    return null;
                }
                const data = (await res.json());
                if (!data.embedding?.values?.length)
                    return null;
                out.push(data.embedding.values);
            }
            return out;
        }
        catch (error) {
            this.logger.warn(`Gemini embed error: ${error instanceof Error ? error.message : error}`);
            return null;
        }
    }
    async embedOpenAi(texts) {
        const apiKey = this.getOpenAiKey();
        try {
            const res = await fetch(`${this.getOpenAiBaseUrl()}/embeddings`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.getEmbedModel(),
                    input: texts,
                }),
            });
            if (!res.ok) {
                const errText = await res.text();
                this.logger.warn(`Embed failed: ${res.status} ${errText.slice(0, 200)}`);
                return null;
            }
            const data = (await res.json());
            const rows = data.data || [];
            rows.sort((a, b) => a.index - b.index);
            return rows.map((r) => r.embedding);
        }
        catch (error) {
            this.logger.warn(`Embed error: ${error instanceof Error ? error.message : error}`);
            return null;
        }
    }
    localEmbed(text, dims = 256) {
        const vec = new Array(dims).fill(0);
        const tokens = text
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter(Boolean);
        for (const token of tokens) {
            let hash = 0;
            for (let i = 0; i < token.length; i++) {
                hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
            }
            const idx = hash % dims;
            vec[idx] += 1;
        }
        const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
        return vec.map((v) => v / norm);
    }
    cosine(a, b) {
        const n = Math.min(a.length, b.length);
        let dot = 0;
        let na = 0;
        let nb = 0;
        for (let i = 0; i < n; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        const denom = Math.sqrt(na) * Math.sqrt(nb);
        return denom ? dot / denom : 0;
    }
};
exports.LlmService = LlmService;
exports.LlmService = LlmService = LlmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LlmService);
//# sourceMappingURL=llm.service.js.map