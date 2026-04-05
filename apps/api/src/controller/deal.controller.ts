import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../service/prisma/prisma.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { RequireOrgGuard } from '../guard/require-org.guard';
import { AuthUser } from '../decorator/auth-user.decorator';

@Controller('deals')
@UseGuards(ClerkAuthGuard, RequireOrgGuard)
export class DealController {
  private readonly logger = new Logger(DealController.name);

  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getDeals(
    @AuthUser('organizationId') organizationId: string,
    @AuthUser('userId') userId: string | null,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('decision') decision?: 'YES' | 'NO',
    @Query('search') search?: string,
  ) {
    this.logger.log(
      `GET /deals - userId=${userId}, organizationId=${organizationId}`,
    );

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
            select: {
              id: true,
              filename: true,
              contentType: true,
              sizeBytes: true,
            },
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
  async getStats(@AuthUser('organizationId') organizationId: string) {
    const where: any = { organizationId };

    const [total, yesCount, noCount, byConfidence, byFolder] =
      await Promise.all([
        this.prismaService.deal.count({ where }),
        this.prismaService.deal.count({
          where: { ...where, initialScreening: { decision: 'YES' } },
        }),
        this.prismaService.deal.count({
          where: { ...where, initialScreening: { decision: 'NO' } },
        }),
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
    @AuthUser('organizationId') organizationId: string,
    @Param('dealId') dealId: string,
  ) {
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
