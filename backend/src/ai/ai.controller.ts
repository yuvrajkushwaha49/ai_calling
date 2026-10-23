import { Controller, Get, Patch, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { UpdateAiSettingsDto } from './dto/ai-settings.dto';

@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Get('settings')
  getSettings() {
    return this.aiService.getSettings();
  }

  @Get('playbook')
  getPlaybook() {
    return this.aiService.getPlaybookSummary();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateAiSettingsDto) {
    return this.aiService.updateSettings(dto);
  }

  @Post('knowledge-base')
  uploadKnowledgeBase(@Body() body: { files: string[] }) {
    return this.aiService.uploadKnowledgeBase(body.files);
  }

  @Post('preview-voice')
  previewVoice(
    @Body()
    body: {
      text?: string;
      speaker?: string;
      language?: string;
    },
  ) {
    return this.aiService.previewVoice(body);
  }
}
