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
import { BrokerIntelligenceService } from '../service/deal/broker-intelligence.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';
import { RequireOrgGuard } from '../guard/require-org.guard';
import { AuthUser } from '../decorator/auth-user.decorator';

@Controller('contacts')
@UseGuards(ClerkAuthGuard, RequireOrgGuard)
export class ContactController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly brokerIntelligence: BrokerIntelligenceService,
  ) {}

  @Get()
  async getContacts(
    @AuthUser('organizationId') organizationId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      deals: { some: { organizationId } },
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.prismaService.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.contact.count({ where }),
    ]);

    return {
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Static routes MUST come before parameterized routes
  @Get('stats/leaderboard')
  async getBrokerLeaderboard(
    @AuthUser('organizationId') organizationId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('sinceDays') sinceDays?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    const since = sinceDays
      ? new Date(Date.now() - parseInt(sinceDays, 10) * 24 * 60 * 60 * 1000)
      : undefined;

    return this.brokerIntelligence.getLeaderboard(organizationId, {
      limit,
      since,
      sortBy: sortBy === 'passRate' ? 'passRate' : 'dealCount',
    });
  }

  @Get(':contactId')
  async getContact(
    @AuthUser('organizationId') organizationId: string,
    @Param('contactId') contactId: string,
  ) {
    const contact = await this.prismaService.contact.findUnique({
      where: { id: contactId },
      include: {
        deals: {
          where: { organizationId },
          select: { id: true },
        },
      },
    });

    if (!contact) {
      throw new HttpException('Contact not found', HttpStatus.NOT_FOUND);
    }

    // Verify contact has at least one deal belonging to user's organization
    if (contact.deals.length === 0) {
      throw new HttpException('Contact not found', HttpStatus.NOT_FOUND);
    }

    // Remove deals array from response (was only used for verification)
    const { deals, ...contactData } = contact;

    return contactData;
  }

  @Get(':contactId/stats')
  async getBrokerStats(
    @AuthUser('organizationId') organizationId: string,
    @Param('contactId') contactId: string,
  ) {
    const stats = await this.brokerIntelligence.getBrokerStats(
      contactId,
      organizationId,
    );
    if (!stats) {
      throw new HttpException(
        'Contact not found or has no deals',
        HttpStatus.NOT_FOUND,
      );
    }

    return stats;
  }
}
