import { Module } from '@nestjs/common';
import { DealSummaryService } from '../service/ai/deal-summary.service';
import { DealDecisionService } from '../service/ai/deal-decision.service';
import { DealDetectionService } from '../service/ai/deal-detection.service';

@Module({
  providers: [DealSummaryService, DealDecisionService, DealDetectionService],
  exports: [DealSummaryService, DealDecisionService, DealDetectionService],
})
export class AIModule {}

