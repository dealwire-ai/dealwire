import { Module } from '@nestjs/common';
import { DealwireAgentService } from '../service/agent/dealwire-agent.service';
import { DemoAnalystService } from '../service/agent/demo-analyst.service';
import { ChatController } from '../controller/chat.controller';
import { DemoChatController } from '../controller/demo-chat.controller';
import { PrismaModule } from './prisma.module';
import { PreferencesModule } from './preferences.module';
import { PublicDataModule } from './public-data.module';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [PrismaModule, PreferencesModule, PublicDataModule],
  controllers: [ChatController, DemoChatController],
  providers: [DealwireAgentService, DemoAnalystService, ClerkAuthGuard],
  exports: [DealwireAgentService],
})
export class AgentModule {}
