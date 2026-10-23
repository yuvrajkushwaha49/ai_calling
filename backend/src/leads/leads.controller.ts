import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  CreateLeadNoteDto,
  LeadQueryDto,
} from './dto/lead.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('leads')
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Get()
  findAll(@Query() query: LeadQueryDto) {
    return this.leadsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Post('bulk')
  createBulk(@Body() body: { leads: CreateLeadDto[] }) {
    return this.leadsService.createBulk(body.leads || []);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id);
  }

  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateLeadNoteDto,
  ) {
    return this.leadsService.addNote(id, userId, dto);
  }
}
