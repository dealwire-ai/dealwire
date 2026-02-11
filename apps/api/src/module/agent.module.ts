import { Module } from '@nestjs/common';
import { AnalyzerAgentService } from '../service/agent/analyzer-agent.service';
import { PrismaModule } from './prisma.module';
import { ScreeningPreferencesService } from '../service/preferences/screening-preferences.service';

@Module({
  imports: [PrismaModule],
  providers: [AnalyzerAgentService, ScreeningPreferencesService],
  exports: [AnalyzerAgentService],
})
export class AgentModule {}
