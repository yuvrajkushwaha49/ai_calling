"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisConfig = getRedisConfig;
exports.buildIoRedisOptions = buildIoRedisOptions;
function getRedisConfig() {
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const db = parseInt(process.env.REDIS_DB || '0', 10);
    const tls = process.env.REDIS_TLS === 'true';
    const password = process.env.REDIS_PASSWORD || undefined;
    const host = process.env.REDIS_HOST || '127.0.0.1';
    return {
        host,
        port: isNaN(port) ? 6379 : port,
        password: password && password.trim().length > 0 ? password : undefined,
        db: isNaN(db) ? 0 : db,
        tls,
    };
}
function buildIoRedisOptions(config) {
    const options = {
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        enableReadyCheck: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        retryStrategy: (times) => {
            const delay = Math.min(times * 200, 3000);
            return delay;
        },
        lazyConnect: true,
    };
    if (config.tls) {
        options.tls = {};
    }
    return options;
}
//# sourceMappingURL=redis.config.js.map