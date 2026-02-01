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

@Controller('deals')
@UseGuards(ClerkAuthGuard)
export class DealController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getDeals(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('organizationId') organizationId?: string,
    @Query('userId') userId?: string,
    @Query('decision') decision?: 'YES' | 'NO',
    @Query('search') search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (userId) {
      where.receivedByUserId = userId;
    }
    if (decision) {
      where.initialScreeningDecision = decision;
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
    @Query('organizationId') organizationId?: string,
    @Query('userId') userId?: string,
  ) {
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (userId) {
      where.receivedByUserId = userId;
    }

    const [total, yesCount, noCount, byConfidence, byFolder] = await Promise.all([
      this.prismaService.deal.count({ where }),
      this.prismaService.deal.count({ where: { ...where, initialScreeningDecision: 'YES' } }),
      this.prismaService.deal.count({ where: { ...where, initialScreeningDecision: 'NO' } }),
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
  async getDeal(@Param('dealId') dealId: string) {
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

    return deal;
  }
}
