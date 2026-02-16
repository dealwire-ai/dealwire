import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DealDigestService } from '../service/deal/deal-digest.service';
import { BrokerIntelligenceService } from '../service/deal/broker-intelligence.service';
import { PrismaModule } from './prisma.module';
import { EmailModule } from './email.module';
import { MicrosoftModule } from './microsoft.module';

@Module({
  imports: [PrismaModule, EmailModule, MicrosoftModule, ScheduleModule.forRoot()],
  providers: [DealDigestService, BrokerIntelligenceService],
  exports: [DealDigestService],
})
export class DealDigestModule {}
