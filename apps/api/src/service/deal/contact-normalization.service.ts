import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const NON_PERSON_SENDER_TOKENS = new Set([
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'info',
  'support',
  'marketing',
  'deals',
  'notifications',
]);

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
   * Parse display name into first and last. "Last, First" if comma present; else "First Last".
   */
  private parseDisplayName(displayName: string): { firstName: string; lastName: string | null } {
    const trimmed = displayName.trim();
    if (!trimmed) {
      return { firstName: '', lastName: null };
    }
    if (trimmed.includes(',')) {
      const [last, ...firstParts] = trimmed.split(',');
      const lastName = last?.trim() || '';
      const firstName = firstParts.join(',').trim() || '';
      return { firstName, lastName: lastName || null };
    }
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) {
      return { firstName: trimmed, lastName: null };
    }
    return {
      firstName: trimmed.slice(0, spaceIdx),
      lastName: trimmed.slice(spaceIdx + 1).trim() || null,
    };
  }

  /**
   * Return false if name looks like company/noreply/no specific person; true if it looks like a person name.
   */
  private shouldSaveSenderName(name: string | undefined, email: string): boolean {
    if (!name || !name.trim()) {
      return false;
    }
    const trimmed = name.trim();
    if (trimmed.toLowerCase() === email.toLowerCase()) {
      return false;
    }
    const lower = trimmed.toLowerCase();
    if (NON_PERSON_SENDER_TOKENS.has(lower)) {
      return false;
    }
    const localPart = email.split('@')[0]?.toLowerCase() || '';
    if (localPart && lower === localPart) {
      return false;
    }
    return true;
  }

  /**
   * Find or create a contact by normalized email (and optional display name for firstName/lastName).
   * Returns the contactId or null if email is invalid.
   */
  async findOrCreateContact(email: string, displayName?: string): Promise<string | null> {
    try {
      const normalizedEmail = this.normalizeEmail(email);

      if (!normalizedEmail) {
        this.logger.warn(
          `Cannot create contact: invalid email address`,
        );
        return null;
      }

      const saveName = this.shouldSaveSenderName(displayName, normalizedEmail);
      const parsedName = saveName && displayName ? this.parseDisplayName(displayName) : null;

      // Try to find existing contact by normalized email
      const existingContact = await this.prismaService.contact.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, firstName: true, lastName: true },
      });

      if (existingContact) {
        const hasNoName = !existingContact.firstName && !existingContact.lastName;
        if (hasNoName && parsedName && (parsedName.firstName || parsedName.lastName)) {
          await this.prismaService.contact.update({
            where: { id: existingContact.id },
            data: {
              firstName: parsedName.firstName || null,
              lastName: parsedName.lastName,
            },
          });
          this.logger.log(
            `Updated contact ${existingContact.id} with name for normalized email: ${normalizedEmail}`,
          );
        } else {
          this.logger.log(
            `Found existing contact ${existingContact.id} for normalized email: ${normalizedEmail}`,
          );
        }
        return existingContact.id;
      }

      // Create new contact
      const newContact = await this.prismaService.contact.create({
        data: {
          email: normalizedEmail,
          ...(parsedName && (parsedName.firstName || parsedName.lastName)
            ? {
                firstName: parsedName.firstName || null,
                lastName: parsedName.lastName,
              }
            : {}),
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
