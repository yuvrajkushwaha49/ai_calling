import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CampaignStatus, UserRole } from '@prisma/client';
import { IsArray, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { CampaignsService } from './campaigns.service';
import { Roles } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateCampaignDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsArray()
  leadIds?: string[];

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  maxRetries?: number;

  @IsOptional()
  @IsNumber()
  retryDelayMins?: number;

  @IsOptional()
  @IsObject()
  filterJson?: Record<string, unknown>;
}

@Controller('campaigns')
export class CampaignsController {
  constructor(private campaigns: CampaignsService) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.campaigns.get(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT)
  create(
    @Body() dto: CreateCampaignDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.campaigns.create({ ...dto, actorId: userId });
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  setStatus(
    @Param('id') id: string,
    @Body('status') status: CampaignStatus,
    @CurrentUser('sub') userId: string,
  ) {
    return this.campaigns.setStatus(id, status, userId);
  }

  @Post('process-due')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  processDue() {
    return this.campaigns.processDue();
  }
}
