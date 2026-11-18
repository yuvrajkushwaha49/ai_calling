import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
} from 'class-validator';

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  agentName?: string;

  @IsOptional()
  @IsString()
  agentVoice?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  llmModel?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeBase?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
    useSpeakerBoost?: boolean;
  };

  @IsOptional()
  voiceStability?: number;

  @IsOptional()
  voiceSimilarity?: number;

  @IsOptional()
  voiceStyle?: number;

  @IsOptional()
  voiceSpeed?: number;

  @IsOptional()
  voiceSpeakerBoost?: boolean;
}
