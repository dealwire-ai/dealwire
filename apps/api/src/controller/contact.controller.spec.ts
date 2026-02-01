import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { PrismaService } from '../service/prisma/prisma.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

describe('ContactController', () => {
  let controller: ContactController;
  let prisma: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };

  beforeEach(async () => {
    const mockFindMany = jest.fn();
    const mockCount = jest.fn();
    const mockFindUnique = jest.fn();
    prisma = { findMany: mockFindMany, count: mockCount, findUnique: mockFindUnique };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [
        {
          provide: PrismaService,
          useValue: { contact: prisma },
        },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ContactController);
  });

  describe('getContacts', () => {
    it('should return paginated contacts and call prisma with correct where', async () => {
      // Arrange
      prisma.findMany.mockResolvedValue([
        { id: 'c1', email: 'a@b.com', firstName: 'A', lastName: 'B' },
      ]);
      prisma.count.mockResolvedValue(1);

      // Act
      const result = await controller.getContacts(1, 20, 'org-1', undefined);

      // Assert
      expect(prisma.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deals: { some: { organizationId: 'org-1' } } },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(prisma.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deals: { some: { organizationId: 'org-1' } } },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should apply search filter when search is provided', async () => {
      // Arrange
      prisma.findMany.mockResolvedValue([]);
      prisma.count.mockResolvedValue(0);

      // Act
      await controller.getContacts(1, 20, undefined, 'john');

      // Assert
      expect(prisma.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: 'john', mode: 'insensitive' } },
              { firstName: { contains: 'john', mode: 'insensitive' } },
              { lastName: { contains: 'john', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('getContact', () => {
    it('should return contact when found', async () => {
      // Arrange
      const contact = { id: 'c1', email: 'a@b.com', firstName: 'A', lastName: 'B' };
      prisma.findUnique.mockResolvedValue(contact);

      // Act
      const result = await controller.getContact('c1');

      // Assert
      expect(prisma.findUnique).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(result).toEqual(contact);
    });

    it('should throw NOT_FOUND when contact does not exist', async () => {
      // Arrange
      prisma.findUnique.mockResolvedValue(null);

      // Act / Assert
      await expect(controller.getContact('nonexistent')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        message: 'Contact not found',
      });
    });
  });
});
