import { Module } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { ExotelService } from './exotel.service';
import { ExotelStreamService } from './exotel-stream.service';
import { TwilioService } from './twilio.service';
import { TwilioStreamService } from './twilio-stream.service';
import { McubeService } from './mcube.service';
import { McubeStreamService } from './mcube-stream.service';
import { AiModule } from '../ai/ai.module';
import { VoiceModule } from '../voice/voice.module';
import { ConversationModule } from '../conversation/conversation.module';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [
    AiModule,
    VoiceModule,
    ConversationModule,
    AppointmentsModule,
  ],
  controllers: [CallsController],
  providers: [
    CallsService,
    TwilioService,
    TwilioStreamService,
    ExotelService,
    ExotelStreamService,
    McubeService,
    McubeStreamService,
  ],
  exports: [
    CallsService,
    TwilioService,
    TwilioStreamService,
    ExotelService,
    ExotelStreamService,
    McubeService,
    McubeStreamService,
  ],
})
export class CallsModule {}
