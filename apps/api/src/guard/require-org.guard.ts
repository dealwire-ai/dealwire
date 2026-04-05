import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Guard that requires `request.auth.organizationId` to be present.
 * Must run AFTER ClerkAuthGuard so that `request.auth` is populated.
 *
 * Usage: @UseGuards(ClerkAuthGuard, RequireOrgGuard)
 */
@Injectable()
export class RequireOrgGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.auth?.organizationId) {
      throw new HttpException(
        'User not in organization. Please ensure: 1) Your user exists in the database (synced via Clerk webhook), and 2) You are added to an organization in Clerk.',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
