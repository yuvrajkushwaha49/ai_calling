import 'dotenv/config';
import {
  resolveContextualShortReply,
  buildFollowUpReply,
  detectIntent,
  lastAgentWasSoftClose,
} from '../src/calls/call-scripts';
import { LlmService } from '../src/llm/llm.service';
import { ConfigService } from '@nestjs/config';

const cases: Array<{ name: string; user: string; prior: string }> = [
  {
    name: 'NHI after opener',
    user: 'NHI',
    prior: 'Agent: Namaste Sajan ji, do minute baat kr sakte hain kya?',
  },
  {
    name: 'BILKUL after soft-close',
    user: 'BILKUL',
    prior:
      'Agent: Koi baat nahi sir, agar future me aap dekho toh phir hum connect kar sakte hain.',
  },
  {
    name: 'YES after opener',
    user: 'YES',
    prior: 'Agent: do minute baat kr sakte hain kya?',
  },
  {
    name: '2 bhk',
    user: '2 bhk',
    prior: 'Agent: configuration kaunsi soch rahe ho?',
  },
  {
    name: 'baad me call',
    user: 'baad me call karna',
    prior: 'Agent: ghar dekhna chaloo hai kya?',
  },
  {
    name: 'price ask',
    user: 'kitna price hai',
    prior: 'Agent: 2 BHK ready side match ho sakta hai.',
  },
  {
    name: 'open chit-chat',
    user: 'mujhe options chahiye ready to move',
    prior: 'Agent: ghar dekhna chaloo hai kya?',
  },
];

console.log('=== SCRIPT / INTENT UNIT TESTS ===');
for (const c of cases) {
  const t0 = Date.now();
  const ctx = resolveContextualShortReply({
    userMessage: c.user,
    priorTranscript: c.prior,
  });
  const intent = detectIntent(c.user);
  const reply = buildFollowUpReply({
    transcript: c.user,
    leadName: 'Sajan',
    language: 'hinglish',
    priorTranscript: c.prior,
    agentVoice: 'neha',
  });
  const ms = Date.now() - t0;
  const agentOnly = c.prior.replace(/^Agent:\s*/i, '');
  const badWa =
    /whatsapp/i.test(reply.text) && lastAgentWasSoftClose(agentOnly);
  console.log(
    JSON.stringify({
      case: c.name,
      ms,
      ctx: ctx?.kind || null,
      intent: {
        ni: intent.notInterested,
        cb: intent.callback,
        pos: intent.positive,
        bhk: intent.statingBhk,
        price: intent.askingPrice,
      },
      outcome: reply.outcome,
      reply: reply.text.slice(0, 110),
      badWhatsAppAfterSoftClose: badWa,
    }),
  );
}

console.log('\n=== GEMINI LIVE PING (2.5s cap) ===');
const cfg = {
  get: (k: string, d?: string) => process.env[k] ?? d,
} as unknown as ConfigService;
const llm = new LlmService(cfg);
console.log('llmStatus', JSON.stringify(llm.getStatus()));
const t1 = Date.now();
llm
  .chat(
    [
      {
        role: 'system',
        content: 'Reply in one short Hinglish sentence max 12 words.',
      },
      {
        role: 'user',
        content: 'Customer said: haan dekh raha hoon. Reply:',
      },
    ],
    {
      model: 'gemini-flash-lite-latest',
      maxOutputTokens: 40,
      timeoutMs: 2500,
      lowLatency: true,
      temperature: 0.4,
    },
  )
  .then((out) => {
    console.log(
      JSON.stringify({
        ms: Date.now() - t1,
        hit: Boolean(out),
        out: (out || '').slice(0, 140),
      }),
    );
  })
  .catch((err) => {
    console.log(
      JSON.stringify({
        ms: Date.now() - t1,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });
