import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { verifyToken } from '@clerk/backend';
import { clerkConfig } from '../config/clerk.config';
import { PrismaService } from '../service/prisma/prisma.service';

export interface AuthPayload {
  userId: string;
  organizationId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const config = clerkConfig();

    const bearer =
      request.headers.authorization?.startsWith('Bearer ') &&
      request.headers.authorization.slice(7);
    const token = bearer || undefined;

    if (!token) {
      console.log('[ClerkAuthGuard] No token provided');
      if (config.requireAuth) {
        throw new UnauthorizedException('Missing or invalid authorization');
      }
      return true;
    }

    try {
      const result = await verifyToken(token, {
        secretKey: config.clerkSecretKey,
      });
      
      console.log('[ClerkAuthGuard] Token verification result:', JSON.stringify(result, null, 2));
      
      const clerkUserId = result.sub || (result.data as any)?.sub;
      
      console.log('[ClerkAuthGuard] Extracted user ID:', clerkUserId);
      
      if (!clerkUserId) {
        console.log('[ClerkAuthGuard] No user ID in token. Full result:', result);
        if (config.requireAuth) {
          throw new UnauthorizedException('Invalid token');
        }
        return true;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: clerkUserId },
        select: { id: true, organizationId: true, email: true },
      });

      console.log('[ClerkAuthGuard] User lookup result:', {
        found: !!user,
        userId: user?.id,
        organizationId: user?.organizationId,
        email: user?.email,
      });

      if (!user) {
        console.log('[ClerkAuthGuard] ⚠️ User not found in database. User needs to be synced via Clerk webhook.');
      } else if (!user.organizationId) {
        console.log('[ClerkAuthGuard] ⚠️ User found but has no organizationId. User needs to be added to an organization in Clerk.');
      }

      request.auth = {
        userId: clerkUserId,
        organizationId: user?.organizationId ?? null,
      };
      return true;
    } catch (error) {
      console.log('[ClerkAuthGuard] Token verification failed:', error instanceof Error ? error.message : error);
      if (config.requireAuth) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      return true;
    }
  }
}
