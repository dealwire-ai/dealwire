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
      if (config.requireAuth) {
        throw new UnauthorizedException('Missing or invalid authorization');
      }
      return true;
    }

    try {
      const result = await verifyToken(token, {
        secretKey: config.clerkSecretKey,
      });
      const clerkUserId = (result.data as { sub?: string })?.sub;
      if (!clerkUserId) {
        if (config.requireAuth) {
          throw new UnauthorizedException('Invalid token');
        }
        return true;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: clerkUserId },
        select: { id: true, organizationId: true },
      });

      request.auth = {
        userId: clerkUserId,
        organizationId: user?.organizationId ?? null,
      };
      return true;
    } catch {
      if (config.requireAuth) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      return true;
    }
  }
}
