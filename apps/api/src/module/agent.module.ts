import { Module } from '@nestjs/common';
import { AnalyzerAgentService } from '../service/agent/analyzer-agent.service';
import { ChatController } from '../controller/chat.controller';
import { PrismaModule } from './prisma.module';
import { PreferencesModule } from './preferences.module';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [PrismaModule, PreferencesModule],
  controllers: [ChatController],
  providers: [AnalyzerAgentService, ClerkAuthGuard],
  exports: [AnalyzerAgentService],
})
export class AgentModule {}
