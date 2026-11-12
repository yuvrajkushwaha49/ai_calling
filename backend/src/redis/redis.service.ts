import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis, { Redis as RedisClient } from 'ioredis';
import { randomUUID } from 'crypto';
import { buildIoRedisOptions, getRedisConfig } from './redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClient | null = null;
  private isConnected = false;
  private connectionAttempted = false;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect to Redis with non-blocking graceful fallback.
   */
  async connect(): Promise<boolean> {
    if (this.client && this.isConnected) {
      return true;
    }

    try {
      const config = getRedisConfig();
      const options = buildIoRedisOptions(config);

      this.client = new Redis(options);
      this.connectionAttempted = true;

      this.client.on('connect', () => {
        this.logger.log(`[Redis] Connecting to ${config.host}:${config.port} (db: ${config.db})`);
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.logger.log(`[Redis] Connection ready at ${config.host}:${config.port}`);
      });

      this.client.on('error', (err: Error) => {
        this.isConnected = false;
        // Log as warning rather than error so unhandled rejections do not trigger process crash
        this.logger.warn(`[Redis] Connection issue: ${err.message}. Fallback mode active.`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.debug('[Redis] Connection closed');
      });

      this.client.on('reconnecting', (delay: number) => {
        this.isConnected = false;
        this.logger.debug(`[Redis] Reconnecting in ${delay}ms...`);
      });

      // Attempt initial connect with short timeout
      await this.client.connect().catch((err: Error) => {
        this.isConnected = false;
        this.logger.warn(
          `[Redis] Initial connect failed: ${err.message}. Operating in safe Database-Fallback mode.`,
        );
      });

      return this.isConnected;
    } catch (err) {
      this.isConnected = false;
      this.logger.warn(
        `[Redis] Initialization error: ${err instanceof Error ? err.message : err}. Operating in DB Fallback mode.`,
      );
      return false;
    }
  }

  /**
   * Disconnect safely.
   */
  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      this.client.removeAllListeners();
      await this.client.quit().catch(() => this.client?.disconnect());
      this.isConnected = false;
      this.client = null;
      this.logger.log('[Redis] Disconnected successfully');
    } catch (err) {
      this.logger.warn(`[Redis] Disconnect warning: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Health check / availability check.
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null && this.client.status === 'ready';
  }

  /**
   * Ping Redis server.
   */
  async ping(): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.ping();
    } catch {
      return null;
    }
  }

  /**
   * Get value by key.
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.get(key);
    } catch (err) {
      this.logger.warn(`[Redis] get(${key}) failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /**
   * Set key with optional TTL in seconds.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client!.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client!.set(key, value);
      }
      return true;
    } catch (err) {
      this.logger.warn(`[Redis] set(${key}) failed: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  /**
   * Delete one or more keys.
   */
  async del(...keys: string[]): Promise<boolean> {
    if (!this.isAvailable() || keys.length === 0) return false;
    try {
      await this.client!.del(...keys);
      return true;
    } catch (err) {
      this.logger.warn(`[Redis] del(${keys.join(',')}) failed: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  /**
   * Set key expiration in seconds.
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const res = await this.client!.expire(key, seconds);
      return res === 1;
    } catch (err) {
      this.logger.warn(`[Redis] expire(${key}) failed: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  /**
   * Push elements to the tail (right) of a list.
   */
  async rpush(key: string, ...values: string[]): Promise<number | null> {
    if (!this.isAvailable() || values.length === 0) return null;
    try {
      return await this.client!.rpush(key, ...values);
    } catch (err) {
      this.logger.warn(`[Redis] rpush(${key}) failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  /**
   * Get list elements by range.
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.isAvailable()) return [];
    try {
      return await this.client!.lrange(key, start, stop);
    } catch (err) {
      this.logger.warn(`[Redis] lrange(${key}) failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  /**
   * Trim list to specified range.
   */
  async ltrim(key: string, start: number, stop: number): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.client!.ltrim(key, start, stop);
      return true;
    } catch (err) {
      this.logger.warn(`[Redis] ltrim(${key}) failed: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  /**
   * Acquire a distributed lock with TTL in milliseconds.
   * Uses atomic SET key token NX PX ttlMs.
   * Returns a unique release token if acquired, or null if locked.
   */
  async acquireLock(key: string, ttlMs = 5000): Promise<string | null> {
    if (!this.isAvailable()) {
      // In fallback mode, grant lock locally so operations proceed
      return `local_token_${Date.now()}`;
    }
    const token = randomUUID();
    try {
      const result = await this.client!.set(key, token, 'PX', ttlMs, 'NX');
      return result === 'OK' ? token : null;
    } catch (err) {
      this.logger.warn(`[Redis] acquireLock(${key}) failed: ${err instanceof Error ? err.message : err}`);
      return `fallback_token_${Date.now()}`;
    }
  }

  /**
   * Release a distributed lock safely using a Lua script to ensure
   * only the token owner can release it.
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
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
      const result = await this.client!.eval(luaScript, 1, key, token);
      return result === 1;
    } catch (err) {
      this.logger.warn(`[Redis] releaseLock(${key}) failed: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }
}

