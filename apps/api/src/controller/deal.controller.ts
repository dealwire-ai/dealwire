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

@Controller('deals')
@UseGuards(ClerkAuthGuard)
export class DealController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getDeals(
    @AuthUser('organizationId') organizationId: string | null,
    @AuthUser('userId') userId: string | null,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('decision') decision?: 'YES' | 'NO',
    @Query('search') search?: string,
  ) {
    console.log('[DealController] GET /deals - userId:', userId, 'organizationId:', organizationId);
    
    if (!organizationId) {
      console.log('[DealController] ❌ Rejecting request - user not in organization');
      throw new HttpException(
        'User not in organization. Please ensure: 1) Your user exists in the database (synced via Clerk webhook), and 2) You are added to an organization in Clerk.',
        HttpStatus.FORBIDDEN,
      );
    }

    const skip = (page - 1) * limit;
    const where: any = { organizationId };

    if (decision) {
      where.initialScreening = { decision };
    }
    if (search) {
      where.OR = [
        { sourceSubject: { contains: search, mode: 'insensitive' } },
        { sourceFrom: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [deals, total] = await Promise.all([
      this.prismaService.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          receivedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          organization: {
            select: { id: true, name: true },
          },
          documents: {
            select: { id: true, filename: true, contentType: true, sizeBytes: true },
          },
          initialScreening: {
            select: { decision: true, reason: true },
          },
        },
      }),
      this.prismaService.deal.count({ where }),
    ]);

    return {
      data: deals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get('stats')
  async getStats(
    @AuthUser('organizationId') organizationId: string | null,
  ) {
    if (!organizationId) {
      throw new HttpException(
        'User not in organization',
        HttpStatus.FORBIDDEN,
      );
    }

    const where: any = { organizationId };

    const [total, yesCount, noCount, byConfidence, byFolder] = await Promise.all([
      this.prismaService.deal.count({ where }),
      this.prismaService.deal.count({ where: { ...where, initialScreening: { decision: 'YES' } } }),
      this.prismaService.deal.count({ where: { ...where, initialScreening: { decision: 'NO' } } }),
      this.prismaService.deal.groupBy({
        by: ['detectionConfidence'],
        where,
        _count: true,
      }),
      this.prismaService.deal.groupBy({
        by: ['folderMovedTo'],
        where: { ...where, folderMovedTo: { not: null } },
        _count: true,
      }),
    ]);

    return {
      total,
      decisions: {
        yes: yesCount,
        no: noCount,
      },
      byConfidence: byConfidence.map((g) => ({
        confidence: g.detectionConfidence || 'unknown',
        count: g._count,
      })),
      byFolder: byFolder.map((g) => ({
        folder: g.folderMovedTo,
        count: g._count,
      })),
    };
  }

  @Get(':dealId')
  async getDeal(
    @AuthUser('organizationId') organizationId: string | null,
    @Param('dealId') dealId: string,
  ) {
    if (!organizationId) {
      throw new HttpException(
        'User not in organization',
        HttpStatus.FORBIDDEN,
      );
    }

    const deal = await this.prismaService.deal.findUnique({
      where: { id: dealId },
      include: {
        receivedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        documents: {
          select: {
            id: true,
            filename: true,
            contentType: true,
            sizeBytes: true,
            s3Key: true,
            createdAt: true,
          },
        },
        asset: true,
        contact: true,
        initialScreening: true,
      },
    });

    if (!deal) {
      throw new HttpException('Deal not found', HttpStatus.NOT_FOUND);
    }

    // Verify deal belongs to user's organization
    if (deal.organizationId !== organizationId) {
      throw new HttpException('Deal not found', HttpStatus.NOT_FOUND);
    }

    return deal;
  }
}
