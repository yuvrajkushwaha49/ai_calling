import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { AppModule } from './app.module';
import { TwilioStreamService } from './calls/twilio-stream.service';
import { ExotelStreamService } from './calls/exotel-stream.service';
import { McubeStreamService } from './calls/mcube-stream.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));

  app.setGlobalPrefix('api');
  const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    'http://localhost:3000,http://127.0.0.1:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  const server = app.getHttpServer();
  const twilioStream = app.get(TwilioStreamService);
  const exotelStream = app.get(ExotelStreamService);
  const mcubeStream = app.get(McubeStreamService);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket: any, head: Buffer) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;

    // 1. MCube: /bid/websocket/{callId} or /api/calls/mcube-media
    if (
      pathname.includes('/bid/websocket') ||
      pathname.includes('/api/calls/mcube-media')
    ) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        const match = pathname.match(/\/bid\/websocket\/([^/?#]+)/i);
        const callId = match
          ? decodeURIComponent(match[1])
          : url.searchParams.get('callId') || undefined;
        const queryParams = Object.fromEntries(url.searchParams.entries());
        mcubeStream.attachClient(ws, callId, queryParams);
      });
      return;
    }

    // 2. Twilio Media WS: /api/calls/twilio-media
    if (pathname.includes('/api/calls/twilio-media')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        const callId = url.searchParams.get('callId') || undefined;
        twilioStream.attachClient(ws, callId);
      });
      return;
    }

    // 3. Exotel Media WS: /api/calls/exotel-media
    if (pathname.includes('/api/calls/exotel-media')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        const callId = url.searchParams.get('callId') || undefined;
        exotelStream.attachClient(ws, callId);
      });
      return;
    }
  });

  console.log(`🚀 API running on http://localhost:${port}/api`);
  console.log(
    `🎙️  Twilio WS: ws://localhost:${port}/api/calls/twilio-media`,
  );
  console.log(
    `🎙️  Exotel WS: ws://localhost:${port}/api/calls/exotel-media`,
  );
  console.log(
    `🎙️  MCube WS:  ws://localhost:${port}/bid/websocket/{callId}`,
  );
}
bootstrap();
