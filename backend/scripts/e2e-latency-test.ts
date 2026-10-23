import 'dotenv/config';

const BASE = 'http://127.0.0.1:4000/api';

async function json(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

function snip(s: string, n = 90) {
  const t = String(s || '');
  return t.length > n ? t.slice(0, n) : t;
}

async function main() {
  const login = await json('POST', '/auth/login', undefined, {
    email: 'admin@realestatecrm.com',
    password: 'password123',
  });
  const token = login.accessToken || login.token;
  if (!token) throw new Error('no token');

  const leadsRaw = await json('GET', '/leads', token);
  const leads = Array.isArray(leadsRaw)
    ? leadsRaw
    : leadsRaw.items || leadsRaw.data || [];
  const lead = leads[0];
  if (!lead?.id) throw new Error('no lead');
  console.log(`LEAD=${lead.name} ${lead.id}`);

  async function startCall() {
    const c = await json('POST', '/calls/outbound', token, {
      leadId: lead.id,
      browserDemo: true,
    });
    const id = c.id || c.callId;
    if (!id) throw new Error('no call id');
    return id as string;
  }

  async function turn(callId: string, message: string) {
    const t0 = Date.now();
    const r = await json('POST', '/calls/demo-turn', token, { callId, message });
    const ms = Date.now() - t0;
    const reply = String(r.replyText || r.reply || '');
    const row = {
      user: message,
      ms,
      usedLlm: Boolean(r.usedLlm),
      outcome: String(r.outcome || ''),
      reply: snip(reply),
    };
    console.log(
      `${row.user.padEnd(22)} ${String(row.ms).padStart(5)}ms llm=${String(row.usedLlm).padEnd(5)} ${row.outcome.padEnd(22)} ${row.reply}`,
    );
    return row;
  }

  const results: Array<Awaited<ReturnType<typeof turn>>> = [];
  const c1 = await startCall();
  console.log(`CALL1=${c1}`);
  results.push(await turn(c1, 'NHI'));
  results.push(await turn(c1, 'BILKUL'));
  const c2 = await startCall();
  console.log(`CALL2=${c2}`);
  results.push(await turn(c2, 'YES'));
  results.push(await turn(c2, '2 bhk'));
  results.push(await turn(c2, 'baad me call karna'));

  const ms = results.map((r) => r.ms);
  const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
  console.log(
    `SUMMARY n=${results.length} min=${Math.min(...ms)} avg=${Math.round(avg)} max=${Math.max(...ms)}`,
  );

  const bilkul = results.find((r) => r.user === 'BILKUL');
  if (bilkul && /whatsapp|configuration|bedroom/i.test(bilkul.reply)) {
    console.log('FAIL BILKUL');
  } else if (bilkul && /shukriya|theek|connect|need|शुक्रिया/i.test(bilkul.reply)) {
    console.log('PASS BILKUL close_ack');
  } else {
    console.log(`CHECK BILKUL: ${bilkul?.reply}`);
  }

  const nhi = results.find((r) => r.user === 'NHI');
  if (nhi && nhi.ms < 3500) console.log('PASS NHI latency ok');
  else console.log(`WARN NHI slow ${nhi?.ms}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
