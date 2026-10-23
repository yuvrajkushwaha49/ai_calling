/**
 * One-time helper: get Google Calendar OAuth refresh token.
 *
 * Setup:
 * 1. Google Cloud Console → enable Calendar API
 * 2. Create OAuth client (Desktop app) → copy Client ID + Secret into .env
 * 3. Run: npx ts-node scripts/google-calendar-auth.ts
 * 4. Open the printed URL, approve, paste the code back here
 * 5. Copy refresh_token into GOOGLE_CALENDAR_REFRESH_TOKEN in .env
 */
import * as http from 'http';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnv();
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.error(
      'Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in backend/.env first.',
    );
    process.exit(1);
  }

  const redirectUri = 'http://localhost:53682/oauth2callback';
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  });

  console.log('\nOpen this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nWaiting for Google redirect on', redirectUri, '...\n');

  const code: string = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://localhost:53682');
        const c = url.searchParams.get('code');
        if (!c) {
          res.writeHead(400);
          res.end('Missing code');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<h2>Google Calendar connected.</h2><p>You can close this tab and return to the terminal.</p>',
        );
        server.close();
        resolve(c);
      } catch (e) {
        reject(e);
      }
    });
    server.listen(53682);
  });

  const { tokens } = await oauth2.getToken(code);
  console.log('\nAdd this to backend/.env:\n');
  console.log(`GOOGLE_CALENDAR_REFRESH_TOKEN="${tokens.refresh_token || ''}"`);
  if (!tokens.refresh_token) {
    console.log(
      '\n(No refresh_token returned — revoke app access at https://myaccount.google.com/permissions and retry with prompt=consent.)',
    );
  }
  console.log(`GOOGLE_CALENDAR_ID="primary"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
