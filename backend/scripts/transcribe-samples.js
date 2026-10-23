/**
 * Transcribe sample call recordings with ElevenLabs Scribe.
 * Usage: node scripts/transcribe-samples.js
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
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
    process.env[m[1].trim()] = v;
  }
}

async function transcribe(filePath) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY missing');
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append(
    'file',
    new Blob([buf], { type: 'audio/mp4' }),
    path.basename(filePath),
  );
  form.append('model_id', 'scribe_v2');
  form.append('language_code', 'hi');
  form.append('diarize', 'true');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

(async () => {
  loadEnv();
  const files = [
    String.raw`c:\Users\WORKIANS\Downloads\WhatsApp Audio 2026-08-31 at 2.29.46 PM (2).mp4`,
    String.raw`c:\Users\WORKIANS\Downloads\WhatsApp Audio 2026-08-31 at 2.29.46 PM (3).mp4`,
  ];
  for (const f of files) {
    console.log('\n====', path.basename(f), '====');
    const data = await transcribe(f);
    console.log('lang:', data.language_code || '-');
    console.log('text:\n', data.text || data.transcript || '');
    if (Array.isArray(data.words) && data.words.length) {
      // group rough speaker turns if speaker_id present
      let cur = null;
      let buf = '';
      const turns = [];
      for (const w of data.words) {
        const sp = w.speaker_id || w.speaker || 'spk';
        if (cur !== sp) {
          if (buf.trim()) turns.push(`${cur}: ${buf.trim()}`);
          cur = sp;
          buf = w.text || '';
        } else {
          buf += w.text || '';
        }
      }
      if (buf.trim()) turns.push(`${cur}: ${buf.trim()}`);
      if (turns.length) {
        console.log('\n--- diarized ---');
        console.log(turns.join('\n'));
      }
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
