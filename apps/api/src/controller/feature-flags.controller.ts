import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../service/prisma/prisma.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { AuthUser } from '../decorator/auth-user.decorator';
import { resolveFeatureFlags } from '../util/feature-flags';

@Controller('feature-flags')
@UseGuards(ClerkAuthGuard)
export class FeatureFlagsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getFeatureFlags(
    @AuthUser('organizationId') organizationId: string | null,
  ) {
    if (!organizationId) {
      throw new HttpException(
        'User not in organization',
        HttpStatus.FORBIDDEN,
      );
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { featureFlags: true },
    });

    return resolveFeatureFlags(org?.featureFlags);
  }
}
