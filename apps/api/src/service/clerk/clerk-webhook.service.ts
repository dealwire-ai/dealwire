import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MicrosoftSubscriptionService } from '../microsoft/microsoft-subscription.service';

@Injectable()
export class ClerkWebhookService {
  private readonly logger = new Logger(ClerkWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly microsoftSubscription: MicrosoftSubscriptionService,
  ) {}

  async handleEvent(eventType: string, data: any): Promise<void> {
    switch (eventType) {
      case 'user.created':
        await this.createUser(data);
        break;
      case 'user.updated':
        await this.upsertUser(data);
        break;
      case 'user.deleted':
        await this.deleteUser(data.id);
        break;
      case 'organization.created':
        await this.createOrganization(data);
        break;
      case 'organization.updated':
        await this.upsertOrganization(data);
        break;
      case 'organization.deleted':
        await this.deleteOrganization(data.id);
        break;
      case 'organizationMembership.created':
      case 'organizationMembership.updated':
        await this.addUserToOrganization(
          data.public_user_data?.user_id,
          data.organization?.id,
        );
        break;
      case 'organizationMembership.deleted':
        await this.removeUserFromOrganization(data.public_user_data?.user_id);
        break;
      default:
        this.logger.log(`Unhandled Clerk event: ${eventType}`);
    }
  }

  private async createUser(data: any): Promise<void> {
    // Use upsert to handle edge cases (e.g., failed delete, re-signup with same email)
    await this.prisma.user.upsert({
      where: { id: data.id },
      update: {
        email: data.email_addresses?.[0]?.email_address,
        firstName: data.first_name,
        lastName: data.last_name,
        imageUrl: data.image_url,
      },
      create: {
        id: data.id,
        email: data.email_addresses?.[0]?.email_address || '',
        firstName: data.first_name,
        lastName: data.last_name,
        imageUrl: data.image_url,
      },
    });
    this.logger.log(`User created: ${data.id}`);

    // Create Microsoft Graph subscription for email notifications
    // This runs async - don't block the webhook response
    this.createMicrosoftSubscription(data.id);
  }

  private async createMicrosoftSubscription(userId: string): Promise<void> {
    try {
      const success = await this.microsoftSubscription.createSubscription(userId);
      if (success) {
        this.logger.log(`Microsoft subscription created for user ${userId}`);
      } else {
        this.logger.warn(
          `Failed to create Microsoft subscription for user ${userId} - ` +
          `user may not have connected Microsoft account`,
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating Microsoft subscription: ${msg}`);
    }
  }

  private async upsertUser(data: any): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: data.id },
      update: {
        email: data.email_addresses?.[0]?.email_address,
        firstName: data.first_name,
        lastName: data.last_name,
        imageUrl: data.image_url,
      },
      create: {
        id: data.id,
        email: data.email_addresses?.[0]?.email_address || '',
        firstName: data.first_name,
        lastName: data.last_name,
        imageUrl: data.image_url,
      },
    });
    this.logger.log(`User updated: ${data.id}`);
  }

  private async deleteUser(id: string): Promise<void> {
    // Delete Microsoft subscription first (cascade should handle it, but be explicit)
    try {
      await this.microsoftSubscription.deleteSubscription(id);
    } catch (error) {
      // Don't fail user deletion if subscription deletion fails
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to delete Microsoft subscription for ${id}: ${msg}`);
    }

    try {
      await this.prisma.user.delete({ where: { id } });
      this.logger.log(`User deleted: ${id}`);
    } catch (error) {
      // User might not exist in our DB yet
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to delete user ${id}: ${msg}`);
    }
  }

  private async createOrganization(data: any): Promise<void> {
    await this.prisma.organization.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        imageUrl: data.image_url,
      },
    });
    this.logger.log(`Organization created: ${data.id}`);
  }

  private async upsertOrganization(data: any): Promise<void> {
    await this.prisma.organization.upsert({
      where: { id: data.id },
      update: {
        name: data.name,
        slug: data.slug,
        imageUrl: data.image_url,
      },
      create: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        imageUrl: data.image_url,
      },
    });
    this.logger.log(`Organization updated: ${data.id}`);
  }

  private async deleteOrganization(id: string): Promise<void> {
    await this.prisma.organization.delete({ where: { id } });
    this.logger.log(`Organization deleted: ${id}`);
  }

  private async addUserToOrganization(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { organizationId },
    });
    this.logger.log(`User ${userId} added to org ${organizationId}`);
  }

  private async removeUserFromOrganization(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { organizationId: null },
    });
    this.logger.log(`User ${userId} removed from org`);
  }
}
