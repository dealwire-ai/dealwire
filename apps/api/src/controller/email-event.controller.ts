import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../service/prisma/prisma.service';

@Controller('events')
export class EmailEventController {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Get all email processing events (deals only)
   */
  @Get()
  async getEvents(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('organizationId') organizationId?: string,
    @Query('userId') userId?: string,
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
        select: {
          id: true,
          sourceMessageId: true,
          sourceSubject: true,
          sourceFrom: true,
          sourceReceivedAt: true,
          initialScreeningDecision: true,
          detectionConfidence: true,
          detectionReason: true,
          folderMovedTo: true,
          createdAt: true,
          receivedByUser: {
            select: { email: true, firstName: true, lastName: true },
          },
          organization: {
            select: { name: true },
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

    const [total, yesCount, noCount] = await Promise.all([
      this.prismaService.deal.count({ where }),
      this.prismaService.deal.count({ where: { ...where, initialScreeningDecision: 'YES' } }),
      this.prismaService.deal.count({ where: { ...where, initialScreeningDecision: 'NO' } }),
    ]);

    return {
      total,
      deals: total,
      dealDecisions: {
        yes: yesCount,
        no: noCount,
      },
    };
  }

  @Get(':messageId')
  async getEvent(@Param('messageId') messageId: string) {
    const deal = await this.prismaService.deal.findUnique({
      where: { sourceMessageId: messageId },
      include: {
        receivedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        organization: {
          select: { id: true, name: true },
        },
        documents: true,
        asset: true,
      },
    });

    if (!deal) {
      throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
    }

    return deal;
  }
}
