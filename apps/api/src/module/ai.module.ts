import { Module } from '@nestjs/common';
import { DealSummaryService } from '../service/deal/deal-summary.service';
import { InitialScreeningService } from '../service/deal/initial-screening.service';
import { DealDetectionService } from '../service/deal/deal-detection.service';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DealSummaryService, InitialScreeningService, DealDetectionService],
  exports: [DealSummaryService, InitialScreeningService, DealDetectionService],
})
export class AIModule {}

