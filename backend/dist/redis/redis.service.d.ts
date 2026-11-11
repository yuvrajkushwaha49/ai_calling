import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private client;
    private isConnected;
    private connectionAttempted;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    connect(): Promise<boolean>;
    disconnect(): Promise<void>;
    isAvailable(): boolean;
    ping(): Promise<string | null>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
    del(...keys: string[]): Promise<boolean>;
    expire(key: string, seconds: number): Promise<boolean>;
    rpush(key: string, ...values: string[]): Promise<number | null>;
    lrange(key: string, start: number, stop: number): Promise<string[]>;
    ltrim(key: string, start: number, stop: number): Promise<boolean>;
    acquireLock(key: string, ttlMs?: number): Promise<string | null>;
    releaseLock(key: string, token: string): Promise<boolean>;
}
