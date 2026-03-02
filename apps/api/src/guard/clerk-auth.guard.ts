import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const config = clerkConfig();

    const bearer =
      request.headers.authorization?.startsWith('Bearer ') &&
      request.headers.authorization.slice(7);
    const token = bearer || undefined;

    if (!token) {
      this.logger.log('No token provided');
      if (config.requireAuth) {
        throw new UnauthorizedException('Missing or invalid authorization');
      }
      return true;
    }

    try {
      const result = await verifyToken(token, {
        secretKey: config.clerkSecretKey,
      });
      
      this.logger.debug(`Token verified, subject: ${result.sub}`);

      const clerkUserId = result.sub || (result.data as any)?.sub;

      this.logger.log(`Extracted user ID: ${clerkUserId}`);

      if (!clerkUserId) {
        this.logger.warn(`No user ID in token`);
        if (config.requireAuth) {
          throw new UnauthorizedException('Invalid token');
        }
        return true;
      }

      // Prefer org_id from the JWT — this is what the Clerk org switcher sets.
      // Fall back to the DB-stored organizationId for users without multi-org support.
      const orgIdFromToken = (result as any).org_id ?? null;

      const user = await this.prisma.user.findUnique({
        where: { id: clerkUserId },
        select: { id: true, organizationId: true, email: true },
      });

      const organizationId = orgIdFromToken ?? user?.organizationId ?? null;

      this.logger.log(`User lookup: found=${!!user}, userId=${user?.id}, organizationId=${organizationId} (source: ${orgIdFromToken ? 'jwt' : 'db'})`);

      if (!user) {
        this.logger.warn(`User not found in database - needs sync via Clerk webhook`);
      } else if (!organizationId) {
        this.logger.warn(`User found but has no organizationId - needs org assignment in Clerk`);
      }

      request.auth = {
        userId: clerkUserId,
        organizationId,
      };
      return true;
    } catch (error) {
      this.logger.warn(`Token verification failed: ${error instanceof Error ? error.message : error}`);
      if (config.requireAuth) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      return true;
    }
  }
}
