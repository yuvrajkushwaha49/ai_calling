import { RedisOptions } from 'ioredis';

export interface RedisConfigOptions {
  host: string;
  port: number;
  password?: string;
  db: number;
  tls?: boolean;
}

export function getRedisConfig(): RedisConfigOptions {
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

export function buildIoRedisOptions(config: RedisConfigOptions): RedisOptions {
  const options: RedisOptions = {
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: (times: number) => {
      // Exponential backoff with 3 second cap
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

