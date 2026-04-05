import { Test, TestingModule } from '@nestjs/testing';
import { ScreeningBucket } from '@prisma/client';
import { InitialScreeningService } from './initial-screening.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddressNormalizationService } from './address-normalization.service';
import { ContactNormalizationService } from './contact-normalization.service';

// Mock OpenAI before importing the service so the constructor uses our mock
const mockCreate = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

// Mock ai.config to avoid requiring OPENAI_API_KEY env var
jest.mock('../../config/ai.config', () => ({
  aiConfig: () => ({
    openaiApiKey: 'test-key',
    openaiTemperature: 0,
  }),
}));

jest.mock('../underwriting/model-config', () => ({
  dealScreeningModelName: () => 'gpt-4.1',
}));

const makeBucket = (
  overrides: Partial<ScreeningBucket> = {},
): ScreeningBucket => ({
  id: 'bucket-1',
  name: 'Interested',
  description: 'Meets all criteria',
  rank: 1,
  isPass: true,
  action: 'REPLY_TO_SELF',
  folderName: null,
  generateSummary: true,
  color: null,
  organizationId: 'org-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buckets: ScreeningBucket[] = [
  makeBucket({ id: 'bucket-yes', name: 'Interested', rank: 1, isPass: true }),
  makeBucket({
    id: 'bucket-maybe',
    name: 'Maybe',
    rank: 2,
    isPass: true,
    description: 'Possibly meets criteria',
  }),
  makeBucket({
    id: 'bucket-no',
    name: 'Pass',
    rank: 3,
    isPass: false,
    action: 'MOVE_TO_FOLDER',
    folderName: 'Passed Deals',
    generateSummary: false,
    description: 'Does not meet criteria',
  }),
];

describe('InitialScreeningService', () => {
  let service: InitialScreeningService;
  let prismaService: jest.Mocked<PrismaService>;
  let metricsService: jest.Mocked<MetricsService>;
  let addressNormalizationService: jest.Mocked<AddressNormalizationService>;
  let contactNormalizationService: jest.Mocked<ContactNormalizationService>;

  beforeEach(async () => {
    mockCreate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitialScreeningService,
        {
          provide: MetricsService,
          useValue: {
            recordAICall: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            initialScreening: {
              upsert: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: AddressNormalizationService,
          useValue: {
            findOrCreateAsset: jest.fn().mockResolvedValue('asset-123'),
          },
        },
        {
          provide: ContactNormalizationService,
          useValue: {
            findOrCreateContact: jest.fn().mockResolvedValue('contact-123'),
          },
        },
      ],
    }).compile();

    service = module.get<InitialScreeningService>(InitialScreeningService);
    prismaService = module.get(PrismaService);
    metricsService = module.get(MetricsService);
    addressNormalizationService = module.get(AddressNormalizationService);
    contactNormalizationService = module.get(ContactNormalizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /** Helper to set a successful OpenAI response */
  function mockOpenAIResponse(payload: Record<string, unknown>) {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });
  }

  it('should classify deal into the correct bucket and persist the result', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Interested',
      reason: 'Meets all geographic and size criteria',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
      },
    });

    // Act
    const result = await service.screen(
      'deal-1',
      'Great multifamily property in NYC',
      buckets,
      'broker@example.com',
      'Jane Broker',
    );

    // Assert
    expect(result.decision).toBe('yes');
    expect(result.reason).toBe('Meets all geographic and size criteria');
    expect(result.bucketId).toBe('bucket-yes');
    expect(result.bucketName).toBe('Interested');
    expect(result.assetId).toBe('asset-123');
    expect(result.contactId).toBe('contact-123');

    expect(prismaService.initialScreening.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dealId: 'deal-1' },
        create: expect.objectContaining({
          dealId: 'deal-1',
          decision: 'YES',
          reason: 'Meets all geographic and size criteria',
          screeningBucketId: 'bucket-yes',
        }),
      }),
    );
    expect(metricsService.recordAICall).toHaveBeenCalledWith(
      'initial-screening',
      'gpt-4.1',
      expect.any(Number),
      'success',
    );
  });

  it('should fall back to last-ranked bucket when AI returns unrecognized bucket name', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Nonexistent Bucket',
      reason: 'Some reason',
      address: null,
    });

    // Act
    const result = await service.screen('deal-2', 'some text', buckets);

    // Assert - falls back to last bucket ("Pass", isPass=false)
    expect(result.decision).toBe('no');
    expect(result.bucketId).toBe('bucket-no');
    expect(result.bucketName).toBe('Pass');
  });

  it('should handle address normalization failure gracefully and continue without asset', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Interested',
      reason: 'Good deal',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
      },
    });
    addressNormalizationService.findOrCreateAsset.mockRejectedValue(
      new Error('Database connection error'),
    );

    // Act
    const result = await service.screen('deal-3', 'some text', buckets);

    // Assert
    expect(result.decision).toBe('yes');
    expect(result.assetId).toBeNull();
    expect(addressNormalizationService.findOrCreateAsset).toHaveBeenCalled();
    // Should still persist to DB
    expect(prismaService.initialScreening.upsert).toHaveBeenCalled();
  });

  it('should handle contact normalization failure gracefully and continue without contact', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Interested',
      reason: 'Good deal',
      address: null,
    });
    contactNormalizationService.findOrCreateContact.mockRejectedValue(
      new Error('Contact lookup failed'),
    );

    // Act
    const result = await service.screen(
      'deal-4',
      'some text',
      buckets,
      'broker@example.com',
      'Jane Broker',
    );

    // Assert
    expect(result.decision).toBe('yes');
    expect(result.contactId).toBeNull();
    expect(
      contactNormalizationService.findOrCreateContact,
    ).toHaveBeenCalledWith('broker@example.com', 'Jane Broker');
    expect(prismaService.initialScreening.upsert).toHaveBeenCalled();
  });

  it('should derive yes decision from bucket with isPass=true', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Maybe',
      reason: 'Possibly meets criteria',
      address: null,
    });

    // Act
    const result = await service.screen('deal-5', 'some text', buckets);

    // Assert
    expect(result.decision).toBe('yes');
    expect(result.bucketId).toBe('bucket-maybe');
  });

  it('should derive no decision from bucket with isPass=false', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Pass',
      reason: 'Wrong geography',
      address: null,
    });

    // Act
    const result = await service.screen('deal-6', 'some text', buckets);

    // Assert
    expect(result.decision).toBe('no');
    expect(result.bucketId).toBe('bucket-no');
  });

  it('should throw on empty OpenAI response', async () => {
    // Arrange
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    // Act & Assert
    await expect(
      service.screen('deal-7', 'some text', buckets),
    ).rejects.toThrow(
      'Failed to perform initial screening: Empty response from OpenAI',
    );

    expect(metricsService.recordAICall).toHaveBeenCalledWith(
      'initial-screening',
      'gpt-4.1',
      expect.any(Number),
      'error',
    );
  });

  it('should throw on OpenAI error and record error metric', async () => {
    // Arrange
    mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

    // Act & Assert
    await expect(
      service.screen('deal-8', 'some text', buckets),
    ).rejects.toThrow(
      'Failed to perform initial screening: Rate limit exceeded',
    );

    expect(metricsService.recordAICall).toHaveBeenCalledWith(
      'initial-screening',
      'gpt-4.1',
      expect.any(Number),
      'error',
    );
  });

  it('should include structured data instructions in prompt when structuredData is provided', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Interested',
      reason: 'Good deal',
      address: null,
    });

    const structuredData = {
      askingPrice: 5000000,
      propertyType: 'multifamily',
      units: 50,
    };

    // Act
    await service.screen(
      'deal-9',
      'some text',
      buckets,
      undefined,
      undefined,
      structuredData,
    );

    // Assert - check the system prompt includes structured data instructions
    const callArgs = mockCreate.mock.calls[0][0];
    const systemPrompt: string = callArgs.messages[0].content;
    expect(systemPrompt).toContain('PRE-EXTRACTED STRUCTURED DATA');
    expect(systemPrompt).toContain('Use these values as the PRIMARY source');

    // Check user message includes the structured data values
    const userMessage: string = callArgs.messages[1].content;
    expect(userMessage).toContain('askingPrice: 5000000');
    expect(userMessage).toContain('propertyType: multifamily');
    expect(userMessage).toContain('units: 50');
  });

  it('should not include structured data instructions when structuredData is not provided', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Interested',
      reason: 'Good deal',
      address: null,
    });

    // Act
    await service.screen('deal-10', 'some text', buckets);

    // Assert
    const callArgs = mockCreate.mock.calls[0][0];
    const systemPrompt: string = callArgs.messages[0].content;
    expect(systemPrompt).not.toContain('PRE-EXTRACTED STRUCTURED DATA');
    expect(systemPrompt).toContain('OCR formatting issues');
  });

  it('should match bucket names case-insensitively', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'iNtErEsTeD',
      reason: 'Good deal',
      address: null,
    });

    // Act
    const result = await service.screen('deal-11', 'some text', buckets);

    // Assert
    expect(result.bucketId).toBe('bucket-yes');
    expect(result.bucketName).toBe('Interested');
    expect(result.decision).toBe('yes');
  });

  it('should not call contact normalization when senderEmail is not provided', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Interested',
      reason: 'Good deal',
      address: null,
    });

    // Act
    const result = await service.screen('deal-12', 'some text', buckets);

    // Assert
    expect(result.contactId).toBeNull();
    expect(
      contactNormalizationService.findOrCreateContact,
    ).not.toHaveBeenCalled();
  });

  it('should include address disambiguation instructions to reject brokerage/signature addresses', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Interested',
      reason: 'Good deal',
      address: null,
    });

    // Act
    await service.screen('deal-addr', 'some text', buckets);

    // Assert - verify the prompt contains critical address disambiguation guidance
    const callArgs = mockCreate.mock.calls[0][0];
    const systemPrompt: string = callArgs.messages[0].content;
    expect(systemPrompt).toContain('Do NOT extract addresses from');
    expect(systemPrompt).toContain('Email signatures');
    expect(systemPrompt).toContain('Brokerage/company office addresses');
    expect(systemPrompt).toContain('SENDER addresses, not property addresses');
    expect(systemPrompt).toContain('set address to null');
  });

  it('should not call address normalization when AI returns null address', async () => {
    // Arrange
    mockOpenAIResponse({
      bucket: 'Interested',
      reason: 'Good deal',
      address: null,
    });

    // Act
    const result = await service.screen('deal-13', 'some text', buckets);

    // Assert
    expect(result.assetId).toBeNull();
    expect(
      addressNormalizationService.findOrCreateAsset,
    ).not.toHaveBeenCalled();
  });
});
