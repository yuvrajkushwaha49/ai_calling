export declare function asNodeBuffer(data: Buffer | Uint8Array): Buffer;
export declare function boostPcm16(pcm: Buffer, gain: number): Buffer;
export declare function pcmEnergy(buf: Buffer): number;
export declare function pcm16ToWav(pcm: Buffer, sampleRate: number): Buffer;
export declare function truncateForPhone(text: string, max?: number): string;
export declare function pcm16ToMulaw(pcm: Buffer): Buffer;
export declare function mulawToLinear(mulawByte: number): number;
export declare function mulawToPcm16(mulaw: Buffer): Buffer;
export declare function downsamplePcm16(pcm: Buffer, fromRate: number, toRate: number): Buffer;
