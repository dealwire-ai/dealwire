import { Test, TestingModule } from '@nestjs/testing';
import { MicrosoftWebhookService } from './microsoft-webhook.service';
import { MicrosoftGraphService } from './microsoft-graph.service';
import { MicrosoftSubscriptionService } from './microsoft-subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { SQSService } from '../sqs/sqs.service';
import { S3Service } from '../s3/s3.service';
import { MetricsService } from '../metrics/metrics.service';
import { DealDetectionService } from '../deal/deal-detection.service';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';

describe('MicrosoftWebhookService', () => {
  let service: MicrosoftWebhookService;
  let dealDetectionService: jest.Mocked<DealDetectionService>;
  let s3Service: jest.Mocked<S3Service>;
  let sqsService: jest.Mocked<SQSService>;
  let metricsService: jest.Mocked<MetricsService>;
  let microsoftGraphService: jest.Mocked<MicrosoftGraphService>;
  let subscriptionService: jest.Mocked<MicrosoftSubscriptionService>;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MicrosoftWebhookService,
        {
          provide: MicrosoftGraphService,
          useValue: {
            getMicrosoftOAuthTokenFromClerk: jest
              .fn()
              .mockResolvedValue('access-token'),
            toNormalizedEvent: jest.fn(),
            getAttachmentContent: jest.fn(),
          },
        },
        {
          provide: MicrosoftSubscriptionService,
          useValue: {
            getUserBySubscriptionId: jest.fn().mockResolvedValue('user123'),
            resolveMonitoredInboxEmailsForOrganization: jest
              .fn()
              .mockResolvedValue([]),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue({
                email: 'user@example.com',
                organizationId: 'org123',
              }),
            },
          },
        },
        {
          provide: SQSService,
          useValue: {
            enqueueNormalizedEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: S3Service,
          useValue: {
            uploadDealAttachment: jest.fn().mockResolvedValue('s3-key'),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordEmailReceived: jest.fn(),
            recordDealSkipped: jest.fn(),
            recordMicrosoftWebhookRequest: jest.fn(),
            recordRestApiCallDuration: jest.fn(),
          },
        },
        {
          provide: DealDetectionService,
          useValue: {
            isDealEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MicrosoftWebhookService>(MicrosoftWebhookService);
    dealDetectionService = module.get(DealDetectionService);
    s3Service = module.get(S3Service);
    sqsService = module.get(SQSService);
    metricsService = module.get(MetricsService);
    microsoftGraphService = module.get(MicrosoftGraphService);
    subscriptionService = module.get(MicrosoftSubscriptionService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should skip S3 upload if deal detection returns false', async () => {
    // Arrange
    const emailEvent: NormalizedEmailEvent = {
      source: 'microsoft',
      messageId: 'msg123',
      userId: 'user123',
      from: 'broker@example.com',
      to: ['user@example.com'],
      subject: 'Not a deal',
      bodyText: 'Just a regular email',
      attachments: [
        {
          filename: 'attachment.pdf',
          contentType: 'application/pdf',
          size: 1024,
          contentId: 'att123',
        },
      ],
      receivedAt: new Date(),
    };

    const notification = {
      subscriptionId: 'sub123',
      changeType: 'created',
      resource: 'messages',
      resourceData: {
        id: 'msg123',
        '@odata.type': '#Microsoft.Graph.Message',
        '@odata.id':
          'https://graph.microsoft.com/v1.0/users/user123/messages/msg123',
        '@odata.etag': 'W/"etag123"',
      },
      clientState: 'secret',
      tenantId: 'tenant123',
    };

    (microsoftGraphService.toNormalizedEvent as jest.Mock).mockResolvedValue(
      emailEvent,
    );
    (dealDetectionService.isDealEmail as jest.Mock).mockResolvedValue({
      isDeal: false,
      confidence: 'high',
      reason: 'Not a deal email',
    });

    // Act
    await service['processEmailNotification'](notification);

    // Assert
    expect(dealDetectionService.isDealEmail).toHaveBeenCalledWith(
      'Not a deal',
      'Just a regular email',
      true,
      'user123',
      'org123',
    );
    expect(s3Service.uploadDealAttachment).not.toHaveBeenCalled();
    expect(sqsService.enqueueNormalizedEmail).not.toHaveBeenCalled();
    expect(metricsService.recordDealSkipped).toHaveBeenCalledWith(
      'Not a deal email',
    );
  });

  it('should upload to S3 and enqueue if deal detection returns true', async () => {
    // Arrange
    const emailEvent: NormalizedEmailEvent = {
      source: 'microsoft',
      messageId: 'msg123',
      userId: 'user123',
      from: 'broker@example.com',
      to: ['user@example.com'],
      subject: 'Deal Opportunity',
      bodyText: 'Check out this property',
      attachments: [
        {
          filename: 'om.pdf',
          contentType: 'application/pdf',
          size: 2048,
          contentId: 'att123',
        },
      ],
      receivedAt: new Date(),
    };

    const notification = {
      subscriptionId: 'sub123',
      changeType: 'created',
      resource: 'messages',
      resourceData: {
        id: 'msg123',
        '@odata.type': '#Microsoft.Graph.Message',
        '@odata.id':
          'https://graph.microsoft.com/v1.0/users/user123/messages/msg123',
        '@odata.etag': 'W/"etag123"',
      },
      clientState: 'secret',
      tenantId: 'tenant123',
    };

    (microsoftGraphService.toNormalizedEvent as jest.Mock).mockResolvedValue(
      emailEvent,
    );
    (dealDetectionService.isDealEmail as jest.Mock).mockResolvedValue({
      isDeal: true,
      confidence: 'high',
      reason: 'Contains deal offering',
    });
    (microsoftGraphService.getAttachmentContent as jest.Mock).mockResolvedValue(
      Buffer.from('pdf content'),
    );

    // Act
    await service['processEmailNotification'](notification);

    // Assert
    expect(dealDetectionService.isDealEmail).toHaveBeenCalledWith(
      'Deal Opportunity',
      'Check out this property',
      true,
      'user123',
      'org123',
    );
    expect(s3Service.uploadDealAttachment).toHaveBeenCalled();
    expect(sqsService.enqueueNormalizedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        event: emailEvent,
        detection: {
          isDeal: true,
          confidence: 'high',
          reason: 'Contains deal offering',
        },
      }),
    );
  });
});
