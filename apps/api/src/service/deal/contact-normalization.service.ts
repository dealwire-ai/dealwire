import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContactNormalizationService {
  private readonly logger = new Logger(ContactNormalizationService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Normalize email address: lowercase, trim, remove extra spaces
   */
  normalizeEmail(email: string): string {
    if (!email) {
      return '';
    }
    return email
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  /**
   * Find or create a contact by normalized email
   * Returns the contactId or null if email is invalid
   */
  async findOrCreateContact(email: string): Promise<string | null> {
    try {
      const normalizedEmail = this.normalizeEmail(email);

      if (!normalizedEmail) {
        this.logger.warn(
          `Cannot create contact: invalid email address`,
        );
        return null;
      }

      // Try to find existing contact by normalized email
      const existingContact = await this.prismaService.contact.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (existingContact) {
        this.logger.log(
          `Found existing contact ${existingContact.id} for normalized email: ${normalizedEmail}`,
        );
        return existingContact.id;
      }

      // Create new contact
      const newContact = await this.prismaService.contact.create({
        data: {
          email: normalizedEmail,
        },
        select: { id: true },
      });

      this.logger.log(
        `Created new contact ${newContact.id} for normalized email: ${normalizedEmail}`,
      );

      return newContact.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to find or create contact: ${errorMessage}`,
      );
      // Don't throw - return null so deal processing can continue
      return null;
    }
  }
}
