/**
 * Quick Exotel env check (no secrets printed in full).
 * Usage: node scripts/check-exotel.js
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Missing backend/.env');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[m[1].trim()] = val;
  }
}

function mask(v) {
  if (!v) return '(empty)';
  if (v.length <= 8) return '****';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

async function main() {
  loadEnv();
  const sid = process.env.EXOTEL_SID?.trim();
  const key = process.env.EXOTEL_API_KEY?.trim();
  const token = process.env.EXOTEL_API_TOKEN?.trim();
  const from = process.env.EXOTEL_VIRTUAL_NUMBER?.trim();
  const appId = process.env.EXOTEL_APP_ID?.trim();
  const region = (process.env.EXOTEL_REGION || 'mumbai').toLowerCase();
  const host =
    region === 'singapore' || region === 'sg'
      ? 'api.exotel.com'
      : 'api.in.exotel.com';
  const base = (process.env.PUBLIC_BASE_URL || 'http://localhost:4000').replace(
    /\/$/,
    '',
  );

  console.log('EXOTEL_SID            =', mask(sid));
  console.log('EXOTEL_API_KEY        =', mask(key));
  console.log('EXOTEL_API_TOKEN      =', mask(token));
  console.log('EXOTEL_VIRTUAL_NUMBER =', from || '(empty)');
  console.log('EXOTEL_APP_ID         =', appId || '(empty)');
  console.log('EXOTEL_REGION         =', region, `→ ${host}`);
  console.log('PUBLIC_BASE_URL       =', base);

  if (!sid || !key || !token || !from || !appId) {
    console.error(
      '\nFAIL: fill EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_VIRTUAL_NUMBER, EXOTEL_APP_ID in .env',
    );
    process.exit(1);
  }

  const local = /localhost|127\.0\.0\.1/i.test(base);
  if (local) {
    console.warn(
      '\nWARN: PUBLIC_BASE_URL is local. Exotel StatusCallback cannot reach it.',
    );
    console.warn('  → npx cloudflared tunnel --url http://127.0.0.1:4000');
    console.warn('  → set PUBLIC_BASE_URL=https://YOUR_TUNNEL');
    console.warn('  → restart backend');
  }

  const auth = Buffer.from(`${key}:${token}`).toString('base64');
  const url = `https://${host}/v1/Accounts/${encodeURIComponent(sid)}.json`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('\nFAIL auth:', res.status, text.slice(0, 300));
      process.exit(1);
    }
    console.log('\nOK Exotel account reachable');
    console.log(
      'Flow URL =',
      `http://my.exotel.com/${sid}/exoml/start_voice/${appId}`,
    );
    console.log('StatusCallback =', `${base}/api/calls/webhooks/exotel/status?callId=…`);
    console.log('Greeting URL  =', `${base}/api/calls/webhooks/exotel/greeting`);
    console.log('Voicebot URL  =', `${base}/api/calls/webhooks/exotel/voicebot`);
    console.log(
      '\nApp Bazaar flow tip: Greeting (URL → greeting) → Voicebot (URL → voicebot, sample-rate 16000) → Hangup',
    );
    if (!local) {
      console.log('\nReady: use “Call phone (Exotel)” on a lead with a valid mobile.');
    }
  } catch (e) {
    console.error('\nFAIL auth:', e.message || e);
    process.exit(1);
  }
}

main();
