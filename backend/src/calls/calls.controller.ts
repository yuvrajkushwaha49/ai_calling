import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Req,
  Header,
  All,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { CallsService } from './calls.service';
import { CreateCallDto, UpdateCallDto } from './dto/call.dto';
import { Public } from '../common/decorators/auth.decorators';
import { VoiceService } from '../voice/voice.service';
import { ExotelService } from './exotel.service';
import { ExotelStreamService } from './exotel-stream.service';
import { TwilioService } from './twilio.service';
import { McubeService } from './mcube.service';
import * as fs from 'fs';

@Controller('calls')
export class CallsController {
  constructor(
    private callsService: CallsService,
    private voice: VoiceService,
    private exotel: ExotelService,
    private exotelStream: ExotelStreamService,
    private twilio: TwilioService,
    private mcube: McubeService,
  ) {}

  @Get()
  findAll() {
    return this.callsService.findAll();
  }

  @Public()
  @Get('twilio-status')
  getTwilioConfigStatus() {
    return this.twilio.getStatus();
  }

  @Public()
  @Get('exotel-status')
  getExotelConfigStatus() {
    return this.exotel.getStatus();
  }

  @Public()
  @Get('mcube-status')
  getMcubeConfigStatus() {
    return this.mcube.getStatus();
  }

  @Post('outbound')
  startOutbound(
    @Body()
    body: {
      leadId: string;
      browserDemo?: boolean;
      provider?: 'twilio' | 'exotel' | 'mcube' | 'browser-demo';
    },
  ) {
    return this.callsService.startOutboundCall(body.leadId, {
      browserDemo: body.browserDemo,
      provider: body.provider,
    });
  }

  @Post('demo-turn')
  demoTurn(
    @Body()
    body: {
      callId: string;
      message?: string;
      audioBase64?: string;
      fileName?: string;
    },
  ) {
    return this.callsService.demoTurn(body);
  }

  /** SSE: stream LLM text + speak each sentence as soon as it is ready */
  @Post('demo-turn-stream')
  async demoTurnStream(
    @Body()
    body: {
      callId: string;
      message?: string;
      audioBase64?: string;
      fileName?: string;
    },
    @Res() res: Response,
  ) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as { flushHeaders?: () => void }).flushHeaders === 'function') {
      (res as { flushHeaders: () => void }).flushHeaders();
    }

    const write = (event: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      const flushable = res as { flush?: () => void };
      if (typeof flushable.flush === 'function') flushable.flush();
    };

    try {
      await this.callsService.demoTurn(body, write);
    } catch (err) {
      write({
        type: 'error',
        message: err instanceof Error ? err.message : 'Stream failed',
      });
    } finally {
      res.end();
    }
  }

  @Post(':id/end')
  endDemo(@Param('id') id: string) {
    return this.callsService.endDemo(id);
  }

  @Public()
  @Get('audio/:fileName')
  streamAudio(@Param('fileName') fileName: string, @Res() res: Response) {
    const filePath = this.voice.getAudioAbsolutePath(fileName);
    const lower = fileName.toLowerCase();
    const type = lower.endsWith('.mp3')
      ? 'audio/mpeg'
      : lower.endsWith('.wav')
        ? 'audio/wav'
        : lower.endsWith('.ogg')
          ? 'audio/ogg'
          : 'application/octet-stream';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(fs.readFileSync(filePath));
  }

  /**
   * Exotel Greeting applet "URL" / "Read text like a robot" mode.
   * MUST respond with Content-Type: text/plain (exactly — no charset).
   * Body = either spoken text (Exotel TTS) OR a single audio file URL on one line.
   */
  @Public()
  @All('webhooks/exotel/greeting')
  async exotelGreeting(
    @Query('callId') callId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Exotel docs: Content-Type must be exactly "text/plain"
    res.setHeader('Content-Type', 'text/plain');
    if (req.method === 'HEAD') {
      res.status(200).end();
      return;
    }
    const body = (req.body || {}) as Record<string, string>;
    const query = (req.query || {}) as Record<string, string>;
    const id =
      callId ||
      body.CustomField ||
      query.CustomField ||
      body.customField ||
      query.customField ||
      '';
    const payload = await this.callsService.getExotelGreetingPayload(id, {
      ...query,
      ...body,
    });
    const value = String(payload.value || '').trim();
    res.status(200).send(value);
  }

  @Public()
  @All('webhooks/exotel/voicebot')
  exotelVoicebotResolve(@Req() req: Request, @Res() res: Response) {
    const query = (req.query || {}) as Record<string, string>;
    const body = (req.body || {}) as Record<string, string>;
    const payload = this.exotelStream.resolveVoicebotWsUrl({
      ...query,
      ...body,
    });
    res.status(200).json(payload);
  }

  @Public()
  @All('webhooks/exotel/passthru')
  async exotelPassthru(@Req() req: Request) {
    const body = (req.body || {}) as Record<string, string>;
    const query = (req.query || {}) as Record<string, string>;
    return this.callsService.handleExotelPassthru({ ...query, ...body });
  }

  @Public()
  @All('webhooks/exotel/status')
  async exotelStatusWebhook(
    @Query('callId') callId: string | undefined,
    @Req() req: Request,
  ) {
    const body = (req.body || {}) as Record<string, string>;
    const query = (req.query || {}) as Record<string, string>;
    const merged = { ...query, ...body };
    const id =
      callId ||
      merged.CustomField ||
      merged.customField ||
      '';
    return this.callsService.handleExotelStatusWebhook(id, merged);
  }

  @Public()
  @All('webhooks/twilio/voice')
  async twilioVoice(
    @Query('callId') callId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const body = (req.body || {}) as Record<string, string>;
    const query = (req.query || {}) as Record<string, string>;
    const id = callId || body.callId || query.callId || '';
    const twiml = await this.callsService.getTwilioVoiceTwiml(id, {
      ...query,
      ...body,
    });
    res.status(200);
    res.setHeader('Content-Type', 'text/xml');
    res.send(twiml);
  }

  @Public()
  @All('webhooks/twilio/status')
  async twilioStatusWebhook(
    @Query('callId') callId: string | undefined,
    @Req() req: Request,
  ) {
    const body = (req.body || {}) as Record<string, string>;
    const query = (req.query || {}) as Record<string, string>;
    const merged = { ...query, ...body };
    const id = callId || merged.callId || '';
    return this.callsService.handleTwilioStatusWebhook(id, merged);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.callsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCallDto) {
    return this.callsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCallDto) {
    return this.callsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.callsService.remove(id);
  }
}
