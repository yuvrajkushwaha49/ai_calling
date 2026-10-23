import { Module } from '@nestjs/common';
import { ElevenLabsModule } from '../elevenlabs/elevenlabs.module';
import { VoiceService } from './voice.service';

@Module({
  imports: [ElevenLabsModule],
  providers: [VoiceService],
  exports: [VoiceService, ElevenLabsModule],
})
export class VoiceModule {}
