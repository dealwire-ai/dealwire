import { Test, TestingModule } from '@nestjs/testing';
import { DealDetectionService } from './deal-detection.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock OpenAI
const mockCreate = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

jest.mock('../underwriting/model-config', () => ({
  dealDetectionModelName: () => 'gpt-4.1-mini',
}));

describe('DealDetectionService', () => {
  let service: DealDetectionService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    mockCreate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealDetectionService,
        {
          provide: PrismaService,
          useValue: {
            screeningPreferences: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(DealDetectionService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return isDeal=true for a deal email', async () => {
    // Arrange
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              isDeal: true,
              confidence: 'high',
              reason: 'Broker blast with specific property details',
            }),
          },
        },
      ],
    });

    // Act
    const result = await service.isDealEmail(
      'OM Posted // $188MM NYC Office Loan Sale',
      'Premier Grand Central submarket location, 200,000 SF...',
      true,
    );

    // Assert
    expect(result.isDeal).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.reason).toBe('Broker blast with specific property details');
  });

  it('should return isDeal=false for a non-deal email', async () => {
    // Arrange
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              isDeal: false,
              confidence: 'high',
              reason: 'SaaS platform offering, not a property deal',
            }),
          },
        },
      ],
    });

    // Act
    const result = await service.isDealEmail(
      'Re: JK Equities & Raise Ai',
      'Our platform provides investor CRM and dashboards...',
      false,
    );

    // Assert
    expect(result.isDeal).toBe(false);
    expect(result.confidence).toBe('high');
    expect(result.reason).toBe('SaaS platform offering, not a property deal');
  });

  it('should return isDeal=false when alwaysSkip criteria matches', async () => {
    // Arrange
    (
      prismaService.screeningPreferences.findUnique as jest.Mock
    ).mockResolvedValue({
      alwaysSkip: 'retail properties',
    });

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              isDeal: false,
              confidence: 'high',
              reason: 'Matches alwaysSkip criteria: retail properties',
            }),
          },
        },
      ],
    });

    // Act
    const result = await service.isDealEmail(
      'Retail Strip Mall for Sale',
      'Class B retail center in suburban location...',
      true,
      'user-1',
      'org-123',
    );

    // Assert
    expect(result.isDeal).toBe(false);
    expect(result.reason).toContain('alwaysSkip');
    expect(prismaService.screeningPreferences.findUnique).toHaveBeenCalledWith({
      where: { organizationId: 'org-123' },
      select: { alwaysSkip: true },
    });
  });

  it('should return isDeal=false with low confidence when OpenAI returns no content', async () => {
    // Arrange
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    // Act
    const result = await service.isDealEmail(
      'Some subject',
      'Some body',
      false,
    );

    // Assert
    expect(result.isDeal).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.reason).toBe('No response');
  });

  it('should return isDeal=false when JSON parse fails', async () => {
    // Arrange
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not valid json {{{' } }],
    });

    // Act
    const result = await service.isDealEmail(
      'Some subject',
      'Some body',
      false,
    );

    // Assert
    expect(result.isDeal).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.reason).toBe('Detection failed, defaulting to skip');
  });

  it('should return isDeal=false when Zod validation fails', async () => {
    // Arrange - valid JSON but wrong shape (missing required fields)
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              isDeal: 'maybe',
              confidence: 'extremely-high',
              reason: 123,
            }),
          },
        },
      ],
    });

    // Act
    const result = await service.isDealEmail(
      'Some subject',
      'Some body',
      false,
    );

    // Assert
    expect(result.isDeal).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.reason).toBe('Parse failed, defaulting to skip');
  });

  it('should return isDeal=false when OpenAI throws an error', async () => {
    // Arrange
    mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

    // Act
    const result = await service.isDealEmail('Some subject', 'Some body', true);

    // Assert
    expect(result.isDeal).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.reason).toBe('Detection failed, defaulting to skip');
  });

  it('should load preferences when organizationId is provided', async () => {
    // Arrange
    (
      prismaService.screeningPreferences.findUnique as jest.Mock
    ).mockResolvedValue({
      alwaysSkip: 'ground leases',
    });

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              isDeal: true,
              confidence: 'high',
              reason: 'Multifamily offering',
            }),
          },
        },
      ],
    });

    // Act
    await service.isDealEmail(
      'Multifamily Offering',
      '50-unit apartment complex...',
      true,
      'user-1',
      'org-456',
    );

    // Assert
    expect(prismaService.screeningPreferences.findUnique).toHaveBeenCalledWith({
      where: { organizationId: 'org-456' },
      select: { alwaysSkip: true },
    });
  });

  it('should skip preferences gracefully when load fails', async () => {
    // Arrange
    (
      prismaService.screeningPreferences.findUnique as jest.Mock
    ).mockRejectedValue(new Error('Database connection failed'));

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              isDeal: true,
              confidence: 'high',
              reason: 'Property offering with details',
            }),
          },
        },
      ],
    });

    // Act
    const result = await service.isDealEmail(
      'Office Building for Sale',
      'Downtown Class A office...',
      true,
      'user-1',
      'org-789',
    );

    // Assert - should still succeed despite preferences load failure
    expect(result.isDeal).toBe(true);
    expect(result.confidence).toBe('high');
  });

  it('should not load preferences when organizationId is not provided', async () => {
    // Arrange
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              isDeal: false,
              confidence: 'high',
              reason: 'Not a deal',
            }),
          },
        },
      ],
    });

    // Act
    await service.isDealEmail('Subject', 'Body', false);

    // Assert
    expect(
      prismaService.screeningPreferences.findUnique,
    ).not.toHaveBeenCalled();
  });
});
