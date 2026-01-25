import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DealDigestService } from '../service/deal/deal-digest.service';
import { PrismaModule } from './prisma.module';
import { EmailModule } from './email.module';
import { MicrosoftModule } from './microsoft.module';

@Module({
  imports: [PrismaModule, EmailModule, MicrosoftModule, ScheduleModule.forRoot()],
  providers: [DealDigestService],
  exports: [DealDigestService],
})
export class DealDigestModule {}
