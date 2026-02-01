import { Test, TestingModule } from '@nestjs/testing';
import { ContactNormalizationService } from './contact-normalization.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ContactNormalizationService', () => {
  let service: ContactNormalizationService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactNormalizationService,
        {
          provide: PrismaService,
          useValue: {
            contact: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ContactNormalizationService>(ContactNormalizationService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeEmail', () => {
    it('should lowercase and trim email', () => {
      expect(service.normalizeEmail('  John@Example.COM  ')).toBe('john@example.com');
    });
  });

  describe('findOrCreateContact', () => {
    it('should create contact with firstName and lastName when display name looks like a person', async () => {
      // Arrange
      (prismaService.contact.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.contact.create as jest.Mock).mockResolvedValue({
        id: 'contact123',
      });

      // Act
      const result = await service.findOrCreateContact(
        'john.smith@broker.com',
        'John Smith',
      );

      // Assert
      expect(result).toBe('contact123');
      expect(prismaService.contact.create).toHaveBeenCalledWith({
        data: {
          email: 'john.smith@broker.com',
          firstName: 'John',
          lastName: 'Smith',
        },
        select: { id: true },
      });
    });

    it('should create contact without name when display name is company/noreply', async () => {
      // Arrange
      (prismaService.contact.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.contact.create as jest.Mock).mockResolvedValue({
        id: 'contact456',
      });

      // Act
      const result = await service.findOrCreateContact(
        'noreply@company.com',
        'noreply',
      );

      // Assert
      expect(result).toBe('contact456');
      expect(prismaService.contact.create).toHaveBeenCalledWith({
        data: {
          email: 'noreply@company.com',
        },
        select: { id: true },
      });
    });

    it('should parse "Last, First" and set firstName/lastName correctly', async () => {
      // Arrange
      (prismaService.contact.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.contact.create as jest.Mock).mockResolvedValue({
        id: 'contact789',
      });

      // Act
      await service.findOrCreateContact('jane@example.com', 'Doe, Jane');

      // Assert
      expect(prismaService.contact.create).toHaveBeenCalledWith({
        data: {
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
        },
        select: { id: true },
      });
    });

    it('should update existing contact with no name when display name is person-like', async () => {
      // Arrange
      (prismaService.contact.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        firstName: null,
        lastName: null,
      });
      (prismaService.contact.update as jest.Mock).mockResolvedValue({
        id: 'existing-id',
      });

      // Act
      const result = await service.findOrCreateContact(
        'broker@example.com',
        'Jane Doe',
      );

      // Assert
      expect(result).toBe('existing-id');
      expect(prismaService.contact.update).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        data: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
      });
    });

    it('should not update existing contact that already has a name', async () => {
      // Arrange
      (prismaService.contact.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        firstName: 'Existing',
        lastName: 'Name',
      });

      // Act
      const result = await service.findOrCreateContact(
        'broker@example.com',
        'Jane Doe',
      );

      // Assert
      expect(result).toBe('existing-id');
      expect(prismaService.contact.update).not.toHaveBeenCalled();
    });

    it('should create contact with only email when no display name', async () => {
      // Arrange
      (prismaService.contact.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.contact.create as jest.Mock).mockResolvedValue({
        id: 'contact-no-name',
      });

      // Act
      await service.findOrCreateContact('broker@example.com');

      // Assert
      expect(prismaService.contact.create).toHaveBeenCalledWith({
        data: { email: 'broker@example.com' },
        select: { id: true },
      });
    });

    it('should return null for empty email', async () => {
      const result = await service.findOrCreateContact('  ', 'John Smith');
      expect(result).toBeNull();
      expect(prismaService.contact.create).not.toHaveBeenCalled();
    });
  });
});
