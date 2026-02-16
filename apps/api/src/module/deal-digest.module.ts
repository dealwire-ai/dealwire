import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DealDigestService } from '../service/deal/deal-digest.service';
import { BrokerIntelligenceService } from '../service/deal/broker-intelligence.service';
import { PrismaModule } from './prisma.module';
import { EmailModule } from './email.module';
import { MicrosoftModule } from './microsoft.module';
import { S3Module } from './s3.module';

@Module({
  imports: [PrismaModule, EmailModule, MicrosoftModule, S3Module, ScheduleModule.forRoot()],
  providers: [DealDigestService, BrokerIntelligenceService],
  exports: [DealDigestService],
})
export class DealDigestModule {}
