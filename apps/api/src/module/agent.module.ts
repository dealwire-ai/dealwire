import { Module } from '@nestjs/common';
import { AnalyzerAgentService } from '../service/agent/analyzer-agent.service';
import { PrismaModule } from './prisma.module';
import { ScreeningPreferencesService } from '../service/preferences/screening-preferences.service';
import { BrokerIntelligenceService } from '../service/deal/broker-intelligence.service';

@Module({
  imports: [PrismaModule],
  providers: [AnalyzerAgentService, ScreeningPreferencesService, BrokerIntelligenceService],
  exports: [AnalyzerAgentService, BrokerIntelligenceService],
})
export class AgentModule {}
