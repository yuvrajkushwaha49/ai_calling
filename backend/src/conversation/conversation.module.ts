import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
