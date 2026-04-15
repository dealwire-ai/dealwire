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

  it('should pass skipCriteria to LLM prompt when configured', async () => {
    // Arrange
    (
      prismaService.screeningPreferences.findUnique as jest.Mock
    ).mockResolvedValue({
      skipCriteria: 'retail deals, deals under 40 units',
      knownProperties: null,
    });

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              isDeal: false,
              confidence: 'high',
              reason: 'Matches skip criteria: retail deals',
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
    expect(result.reason).toContain('skip criteria');
    // Verify the LLM was called (skipCriteria is LLM-interpreted, not deterministic)
    expect(mockCreate).toHaveBeenCalled();
    const systemPrompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(systemPrompt).toContain('retail deals, deals under 40 units');
  });

  it('knownProperties: matches property name in body and skips LLM call', async () => {
    (
      prismaService.screeningPreferences.findUnique as jest.Mock
    ).mockResolvedValue({
      skipCriteria: null,
      knownProperties: '1006 S Michigan',
    });

    const result = await service.isDealEmail(
      'Re: Commission - 1006',
      'Listing agreement for 1006 S Michigan Avenue, asking $8.5MM...',
      true,
      'user-1',
      'org-jk',
    );

    expect(result.isDeal).toBe(false);
    expect(result.confidence).toBe('high');
    expect(result.reason).toBe('Matches known property: "1006 S Michigan"');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('knownProperties: handles S/South abbreviation variations', async () => {
    (
      prismaService.screeningPreferences.findUnique as jest.Mock
    ).mockResolvedValue({
      skipCriteria: null,
      knownProperties: '1006 S Michigan',
    });

    const result = await service.isDealEmail(
      'New listing at 1006 South Michigan',
      'Property details...',
      true,
      'user-1',
      'org-jk',
    );

    expect(result.isDeal).toBe(false);
    expect(result.reason).toContain('1006 S Michigan');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('knownProperties: matches property in subject only', async () => {
    (
      prismaService.screeningPreferences.findUnique as jest.Mock
    ).mockResolvedValue({
      skipCriteria: null,
      knownProperties: 'Bryant Plaza in Roslyn',
    });

    const result = await service.isDealEmail(
      'Update on Bryant Plaza in Roslyn',
      'Unrelated body content here.',
      false,
      'user-1',
      'org-jk',
    );

    expect(result.isDeal).toBe(false);
    expect(result.reason).toContain('Bryant Plaza in Roslyn');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('knownProperties: matches second property in multi-line list', async () => {
    (
      prismaService.screeningPreferences.findUnique as jest.Mock
    ).mockResolvedValue({
      skipCriteria: null,
      knownProperties: '1006 S Michigan\n200 Main Street',
    });

    const result = await service.isDealEmail(
      'New listing',
      'Property at 200 Main Street is now available...',
      false,
      'user-1',
      'org-jk',
    );

    expect(result.isDeal).toBe(false);
    expect(result.reason).toBe('Matches known property: "200 Main Street"');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('knownProperties: strips markdown bullet prefixes', async () => {
    (
      prismaService.screeningPreferences.findUnique as jest.Mock
    ).mockResolvedValue({
      skipCriteria: null,
      knownProperties: '- Vesta Lofts\n- RKO Theatre',
    });

    const result = await service.isDealEmail(
      'Google Alert - Vesta Lofts',
      'News about Vesta Lofts in Chicago...',
      false,
      'user-1',
      'org-jk',
    );

    expect(result.isDeal).toBe(false);
    expect(result.reason).toContain('Vesta Lofts');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('knownProperties: short entries (<4 chars) are filtered out', async () => {
    (
      prismaService.screeningPreferences.findUnique as jest.Mock
    ).mockResolvedValue({
      skipCriteria: null,
      knownProperties: 'abc',
    });

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              isDeal: true,
              confidence: 'high',
              reason: 'Deal email',
            }),
          },
        },
      ],
    });

    const result = await service.isDealEmail(
      'Subject mentions abc',
      'Body also mentions abc.',
      false,
      'user-1',
      'org-jk',
    );

    expect(mockCreate).toHaveBeenCalled();
    expect(result.isDeal).toBe(true);
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
      skipCriteria: 'ground leases',
      knownProperties: null,
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
      select: { skipCriteria: true, knownProperties: true },
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
