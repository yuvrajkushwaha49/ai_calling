import { Module, forwardRef } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CallsModule } from '../calls/calls.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [forwardRef(() => CallsModule), AiModule],
  providers: [CampaignsService],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
