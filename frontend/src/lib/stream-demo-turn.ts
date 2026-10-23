const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export type DemoStreamEvent =
  | { type: 'user'; text: string }
  | { type: 'text'; delta: string }
  | {
      type: 'sentence';
      index: number;
      text: string;
      audioBase64: string;
      mimeType: string;
    }
  | {
      type: 'done';
      callId: string;
      userMessage: string;
      replyText: string;
      outcome?: string;
      audioBase64?: string;
      mimeType?: string;
      transcript?: string;
      interestScore?: number;
      duration?: number;
      qualification?: Record<string, unknown>;
      usedLlm?: boolean;
      streamed?: boolean;
    }
  | { type: 'error'; message: string };

/**
 * Streamed demo turn: plays agent voice sentence-by-sentence as LLM produces text.
 */
export async function streamDemoTurn(
  token: string,
  data: {
    callId: string;
    message?: string;
    audioBase64?: string;
    fileName?: string;
  },
  handlers: {
    onEvent: (event: DemoStreamEvent) => void | Promise<void>;
  },
): Promise<Extract<DemoStreamEvent, { type: 'done' }>> {
  const response = await fetch(`${API_URL}/calls/demo-turn-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({ message: 'Stream failed' }));
    throw new Error(
      Array.isArray(err?.message)
        ? err.message.join(', ')
        : err?.message || `Stream failed (${response.status})`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload: Extract<DemoStreamEvent, { type: 'done' }> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    for (const chunk of chunks) {
      const line = chunk
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let event: DemoStreamEvent;
      try {
        event = JSON.parse(raw) as DemoStreamEvent;
      } catch {
        continue;
      }
      await handlers.onEvent(event);
      if (event.type === 'done') donePayload = event;
      if (event.type === 'error') {
        throw new Error(event.message || 'Stream error');
      }
    }
  }

  if (!donePayload) {
    throw new Error('Stream ended without a reply');
  }
  return donePayload;
}
