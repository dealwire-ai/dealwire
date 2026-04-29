import { Global, Module, OnModuleInit } from '@nestjs/common';
import { MetricsService } from '../service/metrics/metrics.service';
import { __setLlmMetricsSingleton } from '../service/llm/tracked-llm';
import { ModelGatewayService } from '../service/llm/model-gateway.service';

/**
 * Wires the global `MetricsService` into the `tracked-llm` module-level
 * singleton so LLM call sites can record observability data without needing
 * Nest DI. Must be imported as a `@Global()` module so `onModuleInit` fires
 * before any LLM calls happen during normal app operation.
 *
 * Also exports `ModelGatewayService` — the single chokepoint every workflow
 * LLM call goes through.
 */
@Global()
@Module({
  providers: [ModelGatewayService],
  exports: [ModelGatewayService],
})
export class LlmObservabilityModule implements OnModuleInit {
  constructor(private readonly metricsService: MetricsService) {}

  onModuleInit() {
    __setLlmMetricsSingleton(this.metricsService);
  }
}
