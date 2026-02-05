import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../service/prisma/prisma.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { AuthUser } from '../decorator/auth-user.decorator';

@Controller('assets')
@UseGuards(ClerkAuthGuard)
export class AssetController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getAssets(
    @AuthUser('organizationId') organizationId: string | null,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    if (!organizationId) {
      throw new HttpException(
        'User not in organization',
        HttpStatus.FORBIDDEN,
      );
    }

    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      deals: { some: { organizationId } },
    };

    if (search) {
      where.OR = [
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
        { normalizedAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [assets, total] = await Promise.all([
      this.prismaService.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.asset.count({ where }),
    ]);

    return {
      data: assets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get(':assetId')
  async getAsset(
    @AuthUser('organizationId') organizationId: string | null,
    @Param('assetId') assetId: string,
  ) {
    if (!organizationId) {
      throw new HttpException(
        'User not in organization',
        HttpStatus.FORBIDDEN,
      );
    }

    const asset = await this.prismaService.asset.findUnique({
      where: { id: assetId },
      include: {
        deals: {
          where: { organizationId },
          select: { id: true },
        },
      },
    });

    if (!asset) {
      throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);
    }

    // Verify asset has at least one deal belonging to user's organization
    if (asset.deals.length === 0) {
      throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);
    }

    // Remove deals array from response (was only used for verification)
    const { deals, ...assetData } = asset;

    return assetData;
  }
}
