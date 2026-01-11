import { Injectable } from '@nestjs/common';
import { metrics, Counter, Histogram } from '@opentelemetry/api';

@Injectable()
export class MetricsService {
  private readonly meter = metrics.getMeter('analyzer-api', '1.0.0');

  // Deal metrics
  private readonly dealsProcessed = this.meter.createCounter('deals_processed_total', {
    description: 'Total number of deals processed',
    unit: '1',
  });

  private readonly dealsSkipped = this.meter.createCounter('deals_skipped_total', {
    description: 'Total number of deals skipped (not a deal)',
    unit: '1',
  });

  // AI metrics
  private readonly aiCalls = this.meter.createCounter('ai_calls_total', {
    description: 'Total number of AI API calls',
    unit: '1',
  });

  private readonly aiCallDuration = this.meter.createHistogram('ai_call_duration_seconds', {
    description: 'Duration of AI API calls in seconds',
    unit: 's',
  });

  // Email processing metrics
  private readonly emailsReceived = this.meter.createCounter('emails_received_total', {
    description: 'Total emails received via webhooks',
    unit: '1',
  });

  // Error tracking
  private readonly processingErrors = this.meter.createCounter('deal_processing_errors_total', {
    description: 'Total deal processing errors',
    unit: '1',
  });

  recordDealProcessed(decision: 'yes' | 'no', source: string) {
    this.dealsProcessed.add(1, { decision, source });
  }

  recordDealSkipped(reason: string) {
    this.dealsSkipped.add(1, { reason });
  }

  recordAICall(
    service: 'detection' | 'summary' | 'decision',
    model: string,
    durationSeconds: number,
    status: 'success' | 'error',
  ) {
    this.aiCalls.add(1, { service, model, status });
    this.aiCallDuration.record(durationSeconds, { service, model });
  }

  recordEmailReceived(source: 'microsoft' | 'resend') {
    this.emailsReceived.add(1, { source });
  }

  recordProcessingError(errorType: string, stage: string) {
    this.processingErrors.add(1, { error_type: errorType, stage });
  }
}
