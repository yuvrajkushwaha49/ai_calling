export interface LatencySample {
    sttMs: number;
    llmFirstTokenMs: number | null;
    llmFirstSentenceMs: number | null;
    ttsFirstByteMs: number | null;
    turnTotalMs: number;
    timestamp: number;
}
export interface PercentileStats {
    p50: number;
    p95: number;
    p99: number;
}
export declare class LatencyTracker {
    private readonly samples;
    private readonly maxSamples;
    recordTurn(sample: Omit<LatencySample, 'timestamp'>): void;
    getPercentiles(): {
        count: number;
        turnTotal: PercentileStats;
        stt: PercentileStats;
        llmFirstSentence: PercentileStats;
    };
    reset(): void;
}
export declare const globalLatencyTracker: LatencyTracker;
