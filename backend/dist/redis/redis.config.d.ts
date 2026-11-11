import { RedisOptions } from 'ioredis';
export interface RedisConfigOptions {
    host: string;
    port: number;
    password?: string;
    db: number;
    tls?: boolean;
}
export declare function getRedisConfig(): RedisConfigOptions;
export declare function buildIoRedisOptions(config: RedisConfigOptions): RedisOptions;
