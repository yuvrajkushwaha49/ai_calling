import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FeedbackRating, FeedbackStatus, UserRole } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { FeedbackService } from './feedback.service';
import { Roles } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateFeedbackDto {
  @IsString()
  callId!: string;

  @IsEnum(FeedbackRating)
  rating!: FeedbackRating;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  correctedSummary?: string;

  @IsOptional()
  @IsString()
  correctedReply?: string;

  @IsOptional()
  @IsObject()
  correctedFactsJson?: Record<string, unknown>;
}

@Controller('feedback')
export class FeedbackController {
  constructor(private feedback: FeedbackService) {}

  @Get()
  list(@Query('status') status?: FeedbackStatus) {
    return this.feedback.list(status);
  }

  @Get('analytics')
  analytics() {
    return this.feedback.analytics();
  }

  @Post()
  create(
    @Body() dto: CreateFeedbackDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.feedback.create({ ...dto, actorId: userId });
  }

  @Patch(':id/moderate')
  @Roles(UserRole.ADMIN)
  moderate(
    @Param('id') id: string,
    @Body('status') status: FeedbackStatus,
    @CurrentUser() user: { sub: string; role: string },
  ) {
    return this.feedback.moderate(id, status, user.sub, user.role);
  }
}
