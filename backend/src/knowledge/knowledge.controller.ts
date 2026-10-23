import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeSourceType, UserRole } from '@prisma/client';
import { IsOptional, IsString, IsUrl } from 'class-validator';
import { KnowledgeService } from './knowledge.service';
import { Roles } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class AddWebsiteDto {
  @IsString()
  projectId!: string;

  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  title?: string;
}

class AddTextDto {
  @IsString()
  projectId!: string;

  @IsString()
  title!: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  sourceType?: KnowledgeSourceType;
}

@Controller('knowledge')
export class KnowledgeController {
  constructor(private knowledge: KnowledgeService) {}

  @Get('project/:projectId')
  list(@Param('projectId') projectId: string) {
    return this.knowledge.listByProject(projectId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.knowledge.getSource(id);
  }

  @Post('website')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT)
  addWebsite(
    @Body() dto: AddWebsiteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.knowledge.addWebsite({ ...dto, actorId: userId });
  }

  @Post('text')
  addText(@Body() dto: AddTextDto, @CurrentUser('sub') userId: string) {
    return this.knowledge.addTextDocument({ ...dto, actorId: userId });
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectId') projectId: string,
    @Body('title') title: string | undefined,
    @Body('sourceType') sourceType: KnowledgeSourceType | undefined,
    @CurrentUser('sub') userId: string,
  ) {
    return this.knowledge.uploadFile({
      projectId,
      file,
      title,
      sourceType,
      actorId: userId,
    });
  }

  @Post(':id/reprocess')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  reprocess(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.knowledge.reprocess(id, userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.knowledge.remove(id, userId);
  }
}
