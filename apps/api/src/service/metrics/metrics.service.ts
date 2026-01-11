import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Registry, Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private registry: Registry | null = null;
  private enabled = false;

  // Metrics
  private dealsProcessed: Counter<string> | null = null;
  private dealsSkipped: Counter<string> | null = null;
  private aiCalls: Counter<string> | null = null;
  private aiCallDuration: Histogram<string> | null = null;
  private emailsReceived: Counter<string> | null = null;
  private processingErrors: Counter<string> | null = null;

  onModuleInit() {
    try {
      this.initialize();
      this.enabled = true;
      this.logger.log('📊 Metrics enabled');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`⚠️  Failed to initialize metrics: ${msg}. Continuing without metrics...`);
      this.enabled = false;
    }
  }

  private initialize() {
    this.registry = new Registry();

    // Deal metrics
    this.dealsProcessed = new Counter({
      name: 'deals_processed_total',
      help: 'Total number of deals processed',
      labelNames: ['decision', 'source'],
      registers: [this.registry],
    });

    this.dealsSkipped = new Counter({
      name: 'deals_skipped_total',
      help: 'Total number of deals skipped (not a deal)',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    // AI metrics
    this.aiCalls = new Counter({
      name: 'ai_calls_total',
      help: 'Total number of AI API calls',
      labelNames: ['service', 'model', 'status'],
      registers: [this.registry],
    });

    this.aiCallDuration = new Histogram({
      name: 'ai_call_duration_seconds',
      help: 'Duration of AI API calls in seconds',
      labelNames: ['service', 'model'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    // Email metrics
    this.emailsReceived = new Counter({
      name: 'emails_received_total',
      help: 'Total emails received via webhooks',
      labelNames: ['source'],
      registers: [this.registry],
    });

    // Error metrics
    this.processingErrors = new Counter({
      name: 'deal_processing_errors_total',
      help: 'Total deal processing errors',
      labelNames: ['error_type', 'stage'],
      registers: [this.registry],
    });
  }

  recordDealProcessed(decision: 'yes' | 'no', source: string) {
    if (this.enabled && this.dealsProcessed) {
      this.dealsProcessed.inc({ decision, source });
    }
  }

  recordDealSkipped(reason: string) {
    if (this.enabled && this.dealsSkipped) {
      this.dealsSkipped.inc({ reason });
    }
  }

  recordAICall(
    service: 'detection' | 'summary' | 'decision',
    model: string,
    durationSeconds: number,
    status: 'success' | 'error',
  ) {
    if (this.enabled && this.aiCalls && this.aiCallDuration) {
      this.aiCalls.inc({ service, model, status });
      this.aiCallDuration.observe({ service, model }, durationSeconds);
    }
  }

  recordEmailReceived(source: 'microsoft' | 'resend') {
    if (this.enabled && this.emailsReceived) {
      this.emailsReceived.inc({ source });
    }
  }

  recordProcessingError(errorType: string, stage: string) {
    if (this.enabled && this.processingErrors) {
      this.processingErrors.inc({ error_type: errorType, stage });
    }
  }

  async getMetrics(): Promise<string> {
    if (!this.enabled || !this.registry) {
      return '# Metrics disabled\n';
    }
    return this.registry.metrics();
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
