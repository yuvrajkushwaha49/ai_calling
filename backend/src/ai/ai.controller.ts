import { Controller, Get, Patch, Post, Body, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { UpdateAiSettingsDto } from './dto/ai-settings.dto';

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private aiService: AiService) {}

  @Get('settings')
  async getSettings() {
    const s = await this.aiService.getSettings();
    this.logger.log(`GET /ai/settings returning language=${s.language} voice=${s.agentVoice}`);
    return s;
  }

  @Get('playbook')
  getPlaybook() {
    return this.aiService.getPlaybookSummary();
  }

  @Patch('settings')
  async updateSettings(@Body() dto: UpdateAiSettingsDto) {
    this.logger.log(`PATCH /ai/settings received language=${dto.language} voice=${dto.agentVoice}`);
    const res = await this.aiService.updateSettings(dto);
    this.logger.log(`PATCH /ai/settings saved successfully, language=${res.language}`);
    return res;
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
