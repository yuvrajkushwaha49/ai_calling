import { Global, Module } from '@nestjs/common';
import { CustomerMemoryService } from './customer-memory.service';
import { FactExtractorService } from './fact-extractor.service';
import { QuestionValidatorService } from './question-validator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    CustomerMemoryService,
    FactExtractorService,
    QuestionValidatorService,
  ],
  exports: [
    CustomerMemoryService,
    FactExtractorService,
    QuestionValidatorService,
  ],
})
export class MemoryModule {}
