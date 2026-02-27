import { Module } from '@nestjs/common';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { DealDigestService } from '../service/deal/deal-digest.service';
import { PrismaModule } from './prisma.module';
import { EmailServicesModule } from './email.module';
import { MicrosoftModule } from './microsoft.module';
import { S3Module } from './s3.module';
import { PreferencesModule } from './preferences.module';

@Module({
  imports: [PrismaModule, EmailServicesModule, MicrosoftModule, S3Module, ScheduleModule, PreferencesModule],
  providers: [DealDigestService, SchedulerRegistry],
  exports: [DealDigestService],
})
export class DealDigestModule {}
