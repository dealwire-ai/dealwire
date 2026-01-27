import { Module } from '@nestjs/common';
import { DealSummaryService } from '../service/deal/deal-summary.service';
import { InitialScreeningService } from '../service/deal/initial-screening.service';
import { DealDetectionService } from '../service/deal/deal-detection.service';
import { AddressNormalizationService } from '../service/deal/address-normalization.service';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    DealSummaryService,
    InitialScreeningService,
    DealDetectionService,
    AddressNormalizationService,
  ],
  exports: [
    DealSummaryService,
    InitialScreeningService,
    DealDetectionService,
    AddressNormalizationService,
  ],
})
export class AIModule {}

