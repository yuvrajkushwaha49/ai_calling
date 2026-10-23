/** Probe local + PUBLIC_BASE_URL reachability (no secrets printed). */
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1].trim()] = v;
  }
  return out;
}

function get(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 8000 }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () =>
        resolve({ ok: true, status: res.statusCode, body: d.slice(0, 180) }),
      );
    });
    req.on('error', (e) => resolve({ ok: false, err: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, err: 'timeout' });
    });
  });
}

(async () => {
  const env = loadEnv();
  const base = (env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  console.log('APP_ID', env.EXOTEL_APP_ID || '(empty)');
  console.log('PUBLIC_BASE_URL', base || '(empty)');
  console.log('local', await get('http://127.0.0.1:4000/api/calls/exotel-status'));
  if (base) {
    console.log(
      'public_status',
      await get(`${base}/api/calls/exotel-status`),
    );
    console.log(
      'public_greeting',
      await get(`${base}/api/calls/webhooks/exotel/greeting?callId=probe`),
    );
    console.log(
      'public_voicebot',
      await get(`${base}/api/calls/webhooks/exotel/voicebot?callId=probe`),
    );
  }
})();
