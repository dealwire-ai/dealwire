import { Test, TestingModule } from '@nestjs/testing';
import { DataExtractionService } from './data-extraction.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock OpenAI
const mockCreate = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

describe('DataExtractionService', () => {
  let service: DataExtractionService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    mockCreate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataExtractionService,
        {
          provide: PrismaService,
          useValue: {
            deal: { update: jest.fn().mockResolvedValue({}) },
          },
        },
      ],
    }).compile();

    service = module.get(DataExtractionService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  it('should extract real estate data and persist to deal', async () => {
    // Arrange
    const dealId = 'deal-123';
    const extractedText =
      '200-unit multifamily in Dallas, TX. Asking $25M. 6.5% cap rate. 95% occupied.';

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              dealType: 'real_estate',
              extractedData: {
                askingPrice: 25000000,
                propertyType: 'multifamily',
                capRate: 0.065,
                occupancy: 0.95,
                units: 200,
                noi: null,
                squareFeet: null,
                yearBuilt: null,
                pricePerUnit: 125000,
                pricePerSqFt: null,
                description: '200-unit multifamily property in Dallas, TX',
              },
            }),
          },
        },
      ],
    });

    // Act
    await service.extract(dealId, extractedText);

    // Assert
    expect(prismaService.deal.update).toHaveBeenCalledWith({
      where: { id: 'deal-123' },
      data: {
        dealType: 'real_estate',
        extractedData: expect.objectContaining({
          askingPrice: 25000000,
          propertyType: 'multifamily',
          capRate: 0.065,
          occupancy: 0.95,
          units: 200,
        }),
      },
    });
  });

  it('should handle unknown deal types', async () => {
    // Arrange
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              dealType: 'unknown',
              extractedData: {},
            }),
          },
        },
      ],
    });

    // Act
    await service.extract('deal-456', 'some ambiguous text');

    // Assert
    expect(prismaService.deal.update).toHaveBeenCalledWith({
      where: { id: 'deal-456' },
      data: { dealType: 'unknown', extractedData: {} },
    });
  });

  it('should throw and record error metric on OpenAI failure', async () => {
    // Arrange
    mockCreate.mockRejectedValue(new Error('API rate limit'));

    // Act & Assert
    await expect(service.extract('deal-789', 'some text')).rejects.toThrow(
      'API rate limit',
    );
    expect(prismaService.deal.update).not.toHaveBeenCalled();
  });

  it('should throw on empty OpenAI response', async () => {
    // Arrange
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    // Act & Assert
    await expect(service.extract('deal-000', 'some text')).rejects.toThrow(
      'Empty response from OpenAI',
    );
  });
});
