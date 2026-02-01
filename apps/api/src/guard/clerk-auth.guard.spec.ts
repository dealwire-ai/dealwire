import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { PrismaService } from '../service/prisma/prisma.service';
import * as clerkBackend from '@clerk/backend';

jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
}));

describe('ClerkAuthGuard', () => {
  let guard: ClerkAuthGuard;
  let prisma: jest.Mocked<Pick<PrismaService, 'user'>>;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...originalEnv };
    const mockUserFindUnique = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkAuthGuard,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: mockUserFindUnique },
          },
        },
      ],
    }).compile();

    guard = module.get(ClerkAuthGuard);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockContext = (authorization?: string): ExecutionContext => {
    const request = { headers: { authorization } };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  describe('when requireAuth is false (local)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should allow request without token', async () => {
      // Act
      const result = await guard.canActivate(createMockContext());

      // Assert
      expect(result).toBe(true);
    });

    it('should allow request with invalid token without throwing', async () => {
      (clerkBackend.verifyToken as jest.Mock).mockRejectedValue(new Error('Invalid'));

      // Act
      const result = await guard.canActivate(
        createMockContext('Bearer invalid-token'),
      );

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('when requireAuth is true (production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should throw when token is missing', async () => {
      // Act / Assert
      await expect(guard.canActivate(createMockContext())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when token is invalid', async () => {
      (clerkBackend.verifyToken as jest.Mock).mockRejectedValue(new Error('Invalid'));

      // Act / Assert
      await expect(
        guard.canActivate(createMockContext('Bearer bad-token')),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should set req.auth when token is valid', async () => {
      (clerkBackend.verifyToken as jest.Mock).mockResolvedValue({
        data: { sub: 'user_clerk_123' },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_clerk_123',
        organizationId: 'org_456',
      });

      const request = { headers: { authorization: 'Bearer valid-token' } };
      const context = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(request).toHaveProperty('auth', {
        userId: 'user_clerk_123',
        organizationId: 'org_456',
      });
    });
  });
});
