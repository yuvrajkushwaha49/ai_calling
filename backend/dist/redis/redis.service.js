"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
const crypto_1 = require("crypto");
const redis_config_1 = require("./redis.config");
let RedisService = RedisService_1 = class RedisService {
    logger = new common_1.Logger(RedisService_1.name);
    client = null;
    isConnected = false;
    connectionAttempted = false;
    async onModuleInit() {
        await this.connect();
    }
    async onModuleDestroy() {
        await this.disconnect();
    }
    async connect() {
        if (this.client && this.isConnected) {
            return true;
        }
        try {
            const config = (0, redis_config_1.getRedisConfig)();
            const options = (0, redis_config_1.buildIoRedisOptions)(config);
            this.client = new ioredis_1.default(options);
            this.connectionAttempted = true;
            this.client.on('connect', () => {
                this.logger.log(`[Redis] Connecting to ${config.host}:${config.port} (db: ${config.db})`);
            });
            this.client.on('ready', () => {
                this.isConnected = true;
                this.logger.log(`[Redis] Connection ready at ${config.host}:${config.port}`);
            });
            this.client.on('error', (err) => {
                this.isConnected = false;
                this.logger.warn(`[Redis] Connection issue: ${err.message}. Fallback mode active.`);
            });
            this.client.on('close', () => {
                this.isConnected = false;
                this.logger.debug('[Redis] Connection closed');
            });
            this.client.on('reconnecting', (delay) => {
                this.isConnected = false;
                this.logger.debug(`[Redis] Reconnecting in ${delay}ms...`);
            });
            await this.client.connect().catch((err) => {
                this.isConnected = false;
                this.logger.warn(`[Redis] Initial connect failed: ${err.message}. Operating in safe Database-Fallback mode.`);
            });
            return this.isConnected;
        }
        catch (err) {
            this.isConnected = false;
            this.logger.warn(`[Redis] Initialization error: ${err instanceof Error ? err.message : err}. Operating in DB Fallback mode.`);
            return false;
        }
    }
    async disconnect() {
        if (!this.client)
            return;
        try {
            this.client.removeAllListeners();
            await this.client.quit().catch(() => this.client?.disconnect());
            this.isConnected = false;
            this.client = null;
            this.logger.log('[Redis] Disconnected successfully');
        }
        catch (err) {
            this.logger.warn(`[Redis] Disconnect warning: ${err instanceof Error ? err.message : err}`);
        }
    }
    isAvailable() {
        return this.isConnected && this.client !== null && this.client.status === 'ready';
    }
    async ping() {
        if (!this.isAvailable())
            return null;
        try {
            return await this.client.ping();
        }
        catch {
            return null;
        }
    }
    async get(key) {
        if (!this.isAvailable())
            return null;
        try {
            return await this.client.get(key);
        }
        catch (err) {
            this.logger.warn(`[Redis] get(${key}) failed: ${err instanceof Error ? err.message : err}`);
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        if (!this.isAvailable())
            return false;
        try {
            if (ttlSeconds && ttlSeconds > 0) {
                await this.client.set(key, value, 'EX', ttlSeconds);
            }
            else {
                await this.client.set(key, value);
            }
            return true;
        }
        catch (err) {
            this.logger.warn(`[Redis] set(${key}) failed: ${err instanceof Error ? err.message : err}`);
            return false;
        }
    }
    async del(...keys) {
        if (!this.isAvailable() || keys.length === 0)
            return false;
        try {
            await this.client.del(...keys);
            return true;
        }
        catch (err) {
            this.logger.warn(`[Redis] del(${keys.join(',')}) failed: ${err instanceof Error ? err.message : err}`);
            return false;
        }
    }
    async expire(key, seconds) {
        if (!this.isAvailable())
            return false;
        try {
            const res = await this.client.expire(key, seconds);
            return res === 1;
        }
        catch (err) {
            this.logger.warn(`[Redis] expire(${key}) failed: ${err instanceof Error ? err.message : err}`);
            return false;
        }
    }
    async rpush(key, ...values) {
        if (!this.isAvailable() || values.length === 0)
            return null;
        try {
            return await this.client.rpush(key, ...values);
        }
        catch (err) {
            this.logger.warn(`[Redis] rpush(${key}) failed: ${err instanceof Error ? err.message : err}`);
            return null;
        }
    }
    async lrange(key, start, stop) {
        if (!this.isAvailable())
            return [];
        try {
            return await this.client.lrange(key, start, stop);
        }
        catch (err) {
            this.logger.warn(`[Redis] lrange(${key}) failed: ${err instanceof Error ? err.message : err}`);
            return [];
        }
    }
    async ltrim(key, start, stop) {
        if (!this.isAvailable())
            return false;
        try {
            await this.client.ltrim(key, start, stop);
            return true;
        }
        catch (err) {
            this.logger.warn(`[Redis] ltrim(${key}) failed: ${err instanceof Error ? err.message : err}`);
            return false;
        }
    }
    async acquireLock(key, ttlMs = 5000) {
        if (!this.isAvailable()) {
            return `local_token_${Date.now()}`;
        }
        const token = (0, crypto_1.randomUUID)();
        try {
            const result = await this.client.set(key, token, 'PX', ttlMs, 'NX');
            return result === 'OK' ? token : null;
        }
        catch (err) {
            this.logger.warn(`[Redis] acquireLock(${key}) failed: ${err instanceof Error ? err.message : err}`);
            return `fallback_token_${Date.now()}`;
        }
    }
    async releaseLock(key, token) {
        if (!this.isAvailable() || token.startsWith('local_') || token.startsWith('fallback_')) {
            return true;
        }
        const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
        try {
            const result = await this.client.eval(luaScript, 1, key, token);
            return result === 1;
        }
        catch (err) {
            this.logger.warn(`[Redis] releaseLock(${key}) failed: ${err instanceof Error ? err.message : err}`);
            return false;
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)()
], RedisService);
//# sourceMappingURL=redis.service.js.map