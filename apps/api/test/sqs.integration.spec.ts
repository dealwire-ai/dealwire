/**
 * Integration tests for SQS using LocalStack
 * 
 * Prerequisites:
 * 1. Start LocalStack: docker compose -f docker-compose.test.yml up -d
 * 2. Wait for LocalStack to be healthy
 * 3. Set AWS_ENDPOINT_URL=http://localhost:4566 (for AWS SDK v3)
 * 
 * Run: AWS_ENDPOINT_URL=http://localhost:4566 pnpm test:integration
 * 
 * Note: The @ssut/nestjs-sqs library uses AWS SDK default credential chain,
 * so we configure LocalStack via AWS_ENDPOINT_URL environment variable.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SqsModule } from '@ssut/nestjs-sqs';
import { SQSService } from '../src/service/sqs/sqs.service';
import { SQSClient, ReceiveMessageCommand, PurgeQueueCommand } from '@aws-sdk/client-sqs';
import { setupLocalStackQueue, getLocalStackConfig } from './setup-localstack';

describe('SQS Integration Tests (LocalStack)', () => {
  let sqsService: SQSService;
  let queueUrl: string;
  let sqsClient: SQSClient;

  beforeAll(async () => {
    // Skip if LocalStack not available
    if (!process.env.AWS_ENDPOINT_URL) {
      console.log('⚠️  Skipping LocalStack tests - set AWS_ENDPOINT_URL=http://localhost:4566');
      return;
    }

    // Setup LocalStack queue
    queueUrl = await setupLocalStackQueue();

    sqsClient = new SQSClient(getLocalStackConfig());

    // Create test module with LocalStack config
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        SqsModule.register({
          consumers: [],
          producers: [
            {
              name: 'normalized-email',
              queueUrl,
              region: 'us-east-1',
            },
          ],
        }),
      ],
      providers: [SQSService],
    }).compile();

    sqsService = module.get<SQSService>(SQSService);
  });

  beforeEach(async () => {
    // Purge queue before each test
    try {
      await sqsClient.send(
        new PurgeQueueCommand({
          QueueUrl: queueUrl,
        }),
      );
    } catch (error) {
      // Ignore if queue doesn't support purge or doesn't exist
    }
  });

  it('should send message to LocalStack SQS queue', async () => {
    if (!process.env.AWS_ENDPOINT_URL) {
      console.log('⚠️  Skipping - LocalStack not configured');
      return;
    }
    const messageBody = {
      event: {
        source: 'microsoft' as const,
        messageId: 'test-integration-123',
        from: 'test@example.com',
        to: ['user@example.com'],
        subject: 'Integration Test',
        attachments: [],
        receivedAt: new Date(),
      },
      accessToken: 'test-access-token',
      inboxOwnerEmail: 'user@example.com',
      receivedByUserId: 'test-user-id',
      organizationId: null,
      dealId: 'test-deal-id',
    };

    await sqsService.enqueueNormalizedEmail(messageBody);

    // Wait a bit for message to be available
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify message was received
    const response = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
      }),
    );

    expect(response.Messages).toBeDefined();
    expect(response.Messages?.length).toBeGreaterThan(0);

    const receivedBody = JSON.parse(response.Messages![0].Body || '{}');
    expect(receivedBody.body.event.messageId).toBe('test-integration-123');
  }, 10000);
});
