import { Module } from '@nestjs/common';
import { DealSummaryService } from '../service/ai/deal-summary.service';
import { DealDecisionService } from '../service/ai/deal-decision.service';

@Module({
  providers: [DealSummaryService, DealDecisionService],
  exports: [DealSummaryService, DealDecisionService],
})
export class AIModule {}

