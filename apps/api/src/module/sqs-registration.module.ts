import { Module } from '@nestjs/common';
import { SqsModule, SqsService } from '@ssut/nestjs-sqs';
import { sqsConfig } from '../config/sqs.config';

// Only enable SQS in production or when explicitly configured
const enableSqs = process.env.ENABLE_SQS === 'true' || process.env.NODE_ENV === 'production';

/**
 * Central SQS registration module.
 * All queue consumers and producers are registered here — not inside
 * feature modules. Import this once in AppModule.
 */
const sqsImports = enableSqs
  ? [
      SqsModule.register({
        consumers: [
          {
            name: 'normalized-email',
            queueUrl: sqsConfig().normalizedEmailQueueUrl,
            region: sqsConfig().region,
            waitTimeSeconds: 20,
            visibilityTimeout: 300, // 5 min — email pipeline
          },
          {
            name: 'underwriting',
            queueUrl: sqsConfig().underwritingQueueUrl,
            region: sqsConfig().region,
            waitTimeSeconds: 20,
            visibilityTimeout: 600, // 10 min — underwriting pipeline runs longer
          },
        ],
        producers: [
          {
            name: 'normalized-email',
            queueUrl: sqsConfig().normalizedEmailQueueUrl,
            region: sqsConfig().region,
          },
          {
            name: 'underwriting',
            queueUrl: sqsConfig().underwritingQueueUrl,
            region: sqsConfig().region,
          },
        ],
      }),
    ]
  : [];

@Module({
  imports: [...sqsImports],
  providers: [
    ...(enableSqs ? [] : [{ provide: SqsService, useValue: null }]),
  ],
  exports: enableSqs ? [SqsModule] : [SqsService],
})
export class SqsRegistrationModule {}
