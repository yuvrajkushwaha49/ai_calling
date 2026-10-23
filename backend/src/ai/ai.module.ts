import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { VoiceModule } from '../voice/voice.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [VoiceModule, LlmModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
