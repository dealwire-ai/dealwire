import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Registry, Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private registry: Registry | null = null;
  private enabled = false;

  // Deal metrics
  private dealsProcessed: Counter<string> | null = null;
  private dealsSkipped: Counter<string> | null = null;
  private dealProcessingDuration: Histogram<string> | null = null;

  // AI metrics
  private aiCalls: Counter<string> | null = null;
  private aiCallDuration: Histogram<string> | null = null;

  // Email metrics
  private emailsReceived: Counter<string> | null = null;
  private processingErrors: Counter<string> | null = null;

  // SQS metrics
  private sqsMessagesSent: Counter<string> | null = null;
  private sqsMessagesReceived: Counter<string> | null = null;
  private sqsErrors: Counter<string> | null = null;

  // S3 metrics
  private s3Uploads: Counter<string> | null = null;
  private s3UploadBytes: Counter<string> | null = null;
  private s3Downloads: Counter<string> | null = null;
  private s3Errors: Counter<string> | null = null;

  // Email event metrics
  private emailEvents: Counter<string> | null = null;
  private folderMoves: Counter<string> | null = null;

  // Webhook metrics
  private microsoftWebhookRequests: Counter<string> | null = null;

  // REST API metrics
  private restApiCallDuration: Histogram<string> | null = null;

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
      labelNames: ['initial_screening', 'source', 'organization_id', 'inbox_owner_email'],
      registers: [this.registry],
    });

    this.dealsSkipped = new Counter({
      name: 'deals_skipped_total',
      help: 'Total number of deals skipped (not a deal)',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.dealProcessingDuration = new Histogram({
      name: 'deal_processing_duration_seconds',
      help: 'End-to-end duration of deal processing in seconds',
      labelNames: ['initial_screening', 'source'],
      buckets: [1, 5, 10, 30, 60, 120, 300],
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

    // SQS metrics
    this.sqsMessagesSent = new Counter({
      name: 'sqs_messages_sent_total',
      help: 'Total messages sent to SQS',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    this.sqsMessagesReceived = new Counter({
      name: 'sqs_messages_received_total',
      help: 'Total messages received from SQS',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    this.sqsErrors = new Counter({
      name: 'sqs_errors_total',
      help: 'Total SQS operation errors',
      labelNames: ['queue', 'operation'],
      registers: [this.registry],
    });

    // S3 metrics
    this.s3Uploads = new Counter({
      name: 's3_uploads_total',
      help: 'Total S3 upload operations',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.s3UploadBytes = new Counter({
      name: 's3_upload_bytes_total',
      help: 'Total bytes uploaded to S3',
      registers: [this.registry],
    });

    this.s3Downloads = new Counter({
      name: 's3_downloads_total',
      help: 'Total S3 download operations',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.s3Errors = new Counter({
      name: 's3_errors_total',
      help: 'Total S3 operation errors',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    // Email event metrics
    this.emailEvents = new Counter({
      name: 'email_events_total',
      help: 'Total email processing events',
      labelNames: ['is_deal', 'initial_screening', 'has_error'],
      registers: [this.registry],
    });

    this.folderMoves = new Counter({
      name: 'folder_moves_total',
      help: 'Total folder moves',
      labelNames: ['folder_name'],
      registers: [this.registry],
    });

    // Webhook metrics
    this.microsoftWebhookRequests = new Counter({
      name: 'microsoft_webhook_requests_total',
      help: 'Total Microsoft webhook requests',
      labelNames: ['user_email', 'status'],
      registers: [this.registry],
    });

    // REST API call duration metric
    this.restApiCallDuration = new Histogram({
      name: 'rest_api_call_duration_seconds',
      help: 'Duration of REST API calls in seconds',
      labelNames: ['service', 'method', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });
  }

  recordDealProcessed(
    decision: 'yes' | 'no',
    source: string,
    organizationId: string,
    inboxOwnerEmail?: string,
  ) {
    if (this.enabled && this.dealsProcessed) {
      this.dealsProcessed.inc({
        initial_screening: decision,
        source,
        organization_id: organizationId,
        inbox_owner_email: inboxOwnerEmail || 'unknown',
      });
    }
  }

  recordDealSkipped(reason: string) {
    if (this.enabled && this.dealsSkipped) {
      this.dealsSkipped.inc({ reason });
    }
  }

  recordAICall(
    service: 'detection' | 'summary' | 'initial-screening' | 'image-ocr' | 'data-extraction',
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

  recordDealProcessingDuration(
    durationSeconds: number,
    decision: 'yes' | 'no',
    source: string,
  ) {
    if (this.enabled && this.dealProcessingDuration) {
      this.dealProcessingDuration.observe({ initial_screening: decision, source }, durationSeconds);
    }
  }

  // SQS metrics
  recordSqsMessageSent(queue: string, status: 'success' | 'error') {
    if (this.enabled && this.sqsMessagesSent) {
      this.sqsMessagesSent.inc({ queue, status });
    }
  }

  recordSqsMessageReceived(queue: string, status: 'success' | 'error') {
    if (this.enabled && this.sqsMessagesReceived) {
      this.sqsMessagesReceived.inc({ queue, status });
    }
  }

  recordSqsError(queue: string, operation: 'send' | 'receive') {
    if (this.enabled && this.sqsErrors) {
      this.sqsErrors.inc({ queue, operation });
    }
  }

  // S3 metrics
  recordS3Upload(status: 'success' | 'error', bytes?: number) {
    if (this.enabled && this.s3Uploads) {
      this.s3Uploads.inc({ status });
      if (status === 'success' && bytes && this.s3UploadBytes) {
        this.s3UploadBytes.inc(bytes);
      }
    }
  }

  recordS3Download(status: 'success' | 'error') {
    if (this.enabled && this.s3Downloads) {
      this.s3Downloads.inc({ status });
    }
  }

  recordS3Error(operation: 'upload' | 'download') {
    if (this.enabled && this.s3Errors) {
      this.s3Errors.inc({ operation });
    }
  }

  // Email event metrics
  recordEmailEvent(isDeal: boolean, decision: 'yes' | 'no' | null, hasError: boolean) {
    if (this.enabled && this.emailEvents) {
      this.emailEvents.inc({
        is_deal: isDeal ? 'true' : 'false',
        initial_screening: decision || 'none',
        has_error: hasError ? 'true' : 'false',
      });
    }
  }

  recordFolderMove(folderName: string) {
    if (this.enabled && this.folderMoves) {
      this.folderMoves.inc({ folder_name: folderName });
    }
  }

  // Webhook metrics
  recordMicrosoftWebhookRequest(userEmail: string, status: 'success' | 'error') {
    if (this.enabled && this.microsoftWebhookRequests) {
      this.microsoftWebhookRequests.inc({ user_email: userEmail, status });
    }
  }

  recordRestApiCallDuration(
    service: string,
    method: string,
    status: 'success' | 'error',
    durationSeconds: number,
  ) {
    if (this.enabled && this.restApiCallDuration) {
      this.restApiCallDuration.observe({ service, method, status }, durationSeconds);
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
