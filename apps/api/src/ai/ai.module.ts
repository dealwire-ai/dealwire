import { Module } from '@nestjs/common';
import { DealSummaryService } from './deal-summary.service';
import { DealDecisionService } from './deal-decision.service';

@Module({
  providers: [DealSummaryService, DealDecisionService],
  exports: [DealSummaryService, DealDecisionService],
})
export class AIModule {}
