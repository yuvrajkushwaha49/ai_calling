/**
 * MCube WebSocket Integration Simulator
 * Tests connecting to ws://localhost:4000/bid/websocket/{callId}
 * and sending 'start', 'media', receiving 'playAudio' + 'checkpoint',
 * sending 'playedStream', and testing 'terminate'.
 */
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Auto-detect PORT from backend/.env if available
let detectedPort = process.env.PORT || '4002';
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^PORT\s*=\s*(\d+)/m);
    if (match) detectedPort = match[1];
  }
} catch {
  // fallback
}

const callId = process.argv[2] || 'cmv0ig07c000hu2ms6h1ylw42';
const port = detectedPort;
const wsUrl = `ws://localhost:${port}/bid/websocket/${callId}`;

console.log(`[Simulator] Connecting to MCube WebSocket: ${wsUrl}`);
const ws = new WebSocket(wsUrl);

const streamId = `mcube_stream_${Date.now()}`;

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');

  // 1. Send 'start' event
  const startMsg = {
    event: 'start',
    start: {
      callId: callId,
      streamId: streamId,
      tracks: ['inbound', 'outbound'],
      mediaFormat: {
        encoding: 'audio/x-mulaw',
        sampleRate: 8000,
      },
    },
  };
  console.log('[Simulator] Sending "start" event:', JSON.stringify(startMsg, null, 2));
  ws.send(JSON.stringify(startMsg));

  // 2. Simulate caller speaking audio chunks
  setTimeout(() => {
    console.log('[Simulator] Sending simulated caller voice audio chunks...');
    // Create 1 second of 8kHz silence/tone in mulaw
    const fakeChunk = Buffer.alloc(160, 0xff); // 20ms frame
    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              streamId: streamId,
              event: 'media',
              media: {
                track: 'inbound',
                timestamp: String(Date.now()),
                payload: fakeChunk.toString('base64'),
              },
            }),
          );
        }
      }, i * 20);
    }
  }, 1000);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log(`\n📩 [Received from Bot Server]: event="${msg.event}"`);
    console.log(JSON.stringify(msg, null, 2));

    if (msg.event === 'checkpoint') {
      console.log(`\n[Simulator] Checkpoint acknowledged for audio segment: ${msg.name}`);
      // Simulate that caller finished hearing the audio
      setTimeout(() => {
        console.log(`[Simulator] Sending "playedStream" event for: ${msg.name}`);
        ws.send(
          JSON.stringify({
            event: 'playedStream',
            streamId: streamId,
            name: msg.name,
          }),
        );
      }, 500);
    }

    if (msg.event === 'clearAudio') {
      console.log('⚡ [Simulator] Caller barge-in successful: clearAudio received!');
    }

    if (msg.event === 'terminate') {
      console.log('🛑 [Simulator] Call terminated by Bot');
      ws.close();
    }
  } catch (err) {
    console.log('[Simulator] Raw message:', data.toString());
  }
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
});
