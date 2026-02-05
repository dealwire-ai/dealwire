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

@Controller('contacts')
@UseGuards(ClerkAuthGuard)
export class ContactController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getContacts(
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

  @Get(':contactId')
  async getContact(
    @AuthUser('organizationId') organizationId: string | null,
    @Param('contactId') contactId: string,
  ) {
    if (!organizationId) {
      throw new HttpException(
        'User not in organization',
        HttpStatus.FORBIDDEN,
      );
    }

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
}
