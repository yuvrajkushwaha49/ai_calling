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

export class LatencyTracker {
  private readonly samples: LatencySample[] = [];
  private readonly maxSamples = 500;

  recordTurn(sample: Omit<LatencySample, 'timestamp'>) {
    this.samples.push({ ...sample, timestamp: Date.now() });
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  getPercentiles(): {
    count: number;
    turnTotal: PercentileStats;
    stt: PercentileStats;
    llmFirstSentence: PercentileStats;
  } {
    const calc = (arr: number[]): PercentileStats => {
      if (!arr.length) return { p50: 0, p95: 0, p99: 0 };
      const sorted = [...arr].sort((a, b) => a - b);
      const p = (pct: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))];
      return { p50: p(0.5), p95: p(0.95), p99: p(0.99) };
    };

    return {
      count: this.samples.length,
      turnTotal: calc(this.samples.map((s) => s.turnTotalMs)),
      stt: calc(this.samples.map((s) => s.sttMs)),
      llmFirstSentence: calc(
        this.samples.map((s) => s.llmFirstSentenceMs).filter((v): v is number => v !== null),
      ),
    };
  }

  reset() {
    this.samples.length = 0;
  }
}

export const globalLatencyTracker = new LatencyTracker();

