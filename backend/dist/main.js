"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const express_1 = require("express");
const ws_1 = require("ws");
const app_module_1 = require("./app.module");
const twilio_stream_service_1 = require("./calls/twilio-stream.service");
const exotel_stream_service_1 = require("./calls/exotel-stream.service");
const mcube_stream_service_1 = require("./calls/mcube-stream.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, express_1.json)({ limit: '15mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '15mb' }));
    app.setGlobalPrefix('api');
    const allowedOrigins = (process.env.CORS_ORIGINS ||
        'http://localhost:3000,http://127.0.0.1:3000')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    const port = process.env.PORT ?? 4000;
    await app.listen(port);
    const server = app.getHttpServer();
    const twilioStream = app.get(twilio_stream_service_1.TwilioStreamService);
    const exotelStream = app.get(exotel_stream_service_1.ExotelStreamService);
    const mcubeStream = app.get(mcube_stream_service_1.McubeStreamService);
    const wss = new ws_1.WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const pathname = url.pathname;
        if (pathname.includes('/bid/websocket') ||
            pathname.includes('/api/calls/mcube-media')) {
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
        if (pathname.includes('/api/calls/twilio-media')) {
            wss.handleUpgrade(req, socket, head, (ws) => {
                const callId = url.searchParams.get('callId') || undefined;
                twilioStream.attachClient(ws, callId);
            });
            return;
        }
        if (pathname.includes('/api/calls/exotel-media')) {
            wss.handleUpgrade(req, socket, head, (ws) => {
                const callId = url.searchParams.get('callId') || undefined;
                exotelStream.attachClient(ws, callId);
            });
            return;
        }
    });
    console.log(`🚀 API running on http://localhost:${port}/api`);
    console.log(`🎙️  Twilio WS: ws://localhost:${port}/api/calls/twilio-media`);
    console.log(`🎙️  Exotel WS: ws://localhost:${port}/api/calls/exotel-media`);
    console.log(`🎙️  MCube WS:  ws://localhost:${port}/bid/websocket/{callId}`);
}
bootstrap();
//# sourceMappingURL=main.js.map