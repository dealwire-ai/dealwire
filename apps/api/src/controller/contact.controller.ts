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

@Controller('contacts')
@UseGuards(ClerkAuthGuard)
export class ContactController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getContacts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (organizationId) {
      where.deals = { some: { organizationId } };
    }
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
  async getContact(@Param('contactId') contactId: string) {
    const contact = await this.prismaService.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new HttpException('Contact not found', HttpStatus.NOT_FOUND);
    }

    return contact;
  }
}
