"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalLatencyTracker = exports.LatencyTracker = void 0;
class LatencyTracker {
    samples = [];
    maxSamples = 500;
    recordTurn(sample) {
        this.samples.push({ ...sample, timestamp: Date.now() });
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }
    getPercentiles() {
        const calc = (arr) => {
            if (!arr.length)
                return { p50: 0, p95: 0, p99: 0 };
            const sorted = [...arr].sort((a, b) => a - b);
            const p = (pct) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))];
            return { p50: p(0.5), p95: p(0.95), p99: p(0.99) };
        };
        return {
            count: this.samples.length,
            turnTotal: calc(this.samples.map((s) => s.turnTotalMs)),
            stt: calc(this.samples.map((s) => s.sttMs)),
            llmFirstSentence: calc(this.samples.map((s) => s.llmFirstSentenceMs).filter((v) => v !== null)),
        };
    }
    reset() {
        this.samples.length = 0;
    }
}
exports.LatencyTracker = LatencyTracker;
exports.globalLatencyTracker = new LatencyTracker();
//# sourceMappingURL=latency-tracker.js.map