import { Module } from '@nestjs/common';
import { DealSummaryService } from '../service/deal/deal-summary.service';
import { DealDecisionService } from '../service/deal/deal-decision.service';
import { DealDetectionService } from '../service/deal/deal-detection.service';

@Module({
  providers: [DealSummaryService, DealDecisionService, DealDetectionService],
  exports: [DealSummaryService, DealDecisionService, DealDetectionService],
})
export class AIModule {}

