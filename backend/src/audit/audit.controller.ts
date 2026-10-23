import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/auth.decorators';
import { UserRole } from '@prisma/client';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  list(@Query('limit') limit?: string) {
    return this.audit.findRecent(Number(limit) || 100);
  }
}
