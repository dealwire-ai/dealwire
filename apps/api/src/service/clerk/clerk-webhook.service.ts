import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MicrosoftSubscriptionService } from '../microsoft/microsoft-subscription.service';
import { ScreeningBucketService } from '../preferences/screening-bucket.service';

@Injectable()
export class ClerkWebhookService {
  private readonly logger = new Logger(ClerkWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly microsoftSubscription: MicrosoftSubscriptionService,
    private readonly screeningBucketService: ScreeningBucketService,
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
      case 'oauth_access_token.created':
        await this.handleOAuthTokenCreated(data);
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
        await this.addUserToOrganization(data);
        break;
      case 'organizationMembership.deleted':
        await this.removeUserFromOrganization(
          data.public_user_data?.user_id,
          data.organization?.id,
        );
        break;
      default:
        this.logger.log(`Unhandled Clerk event: ${eventType}`);
    }
  }

  private async createUser(data: any): Promise<void> {
    // Log all user creation data for debugging
    const userData = {
      id: data.id,
      email: data.email_addresses?.[0]?.email_address,
      firstName: data.first_name,
      lastName: data.last_name,
      imageUrl: data.image_url,
      emailAddresses: data.email_addresses,
      externalAccounts: data.external_accounts,
      samlAccounts: data.saml_accounts,
      passwordEnabled: data.password_enabled,
      totpEnabled: data.totp_enabled,
      backupCodesEnabled: data.backup_codes_enabled,
      twoFactorEnabled: data.two_factor_enabled,
      publicMetadata: data.public_metadata,
      privateMetadata: data.private_metadata,
      unsafeMetadata: data.unsafe_metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      lastSignInAt: data.last_sign_in_at,
      banned: data.banned,
      locked: data.locked,
      lockoutExpiresInSeconds: data.lockout_expires_in_seconds,
      verificationAttemptsRemaining: data.verification_attempts_remaining,
      createdAtTimestamp: data.created_at_timestamp,
      updatedAtTimestamp: data.updated_at_timestamp,
    };

    this.logger.log(
      `User created: ${data.id} - Full payload: ${JSON.stringify(userData, null, 2)}`,
    );

    // Extract SSO connection info if present
    if (data.external_accounts && data.external_accounts.length > 0) {
      const ssoConnections = data.external_accounts.map((acc: any) => ({
        provider: acc.provider,
        externalId: acc.external_id,
        email: acc.email_address,
        verified: acc.verification?.status === 'verified',
      }));
      this.logger.log(
        `User ${data.id} SSO connections: ${JSON.stringify(ssoConnections)}`,
      );
    }

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

    // Only attempt Microsoft Graph subscription if user signed up with Microsoft
    const hasMicrosoft = data.external_accounts?.some(
      (acc: any) =>
        acc.provider === 'microsoft' || acc.provider === 'oauth_microsoft',
    );
    if (hasMicrosoft) {
      this.createMicrosoftSubscription(data.id);
    } else {
      this.logger.debug(
        `User ${data.id} has no Microsoft account — skipping subscription creation`,
      );
    }
  }

  private async createMicrosoftSubscription(userId: string): Promise<void> {
    try {
      const success =
        await this.microsoftSubscription.createSubscription(userId);
      if (success) {
        this.logger.log(`Microsoft subscription created for user ${userId}`);
      } else {
        this.logger.debug(
          `Failed to create Microsoft subscription for user ${userId} - ` +
            `token may not be available yet`,
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating Microsoft subscription: ${msg}`);
    }
  }

  /**
   * Poll for a user to appear in the DB, retrying a few times with a short delay.
   * Handles the race where oauth_access_token.created fires before user.created is processed.
   */
  private async waitForUser(
    userId: string,
    retries = 5,
    delayMs = 2000,
  ): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) return true;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return false;
  }

  /**
   * Handle OAuth token creation - create subscription when Microsoft is connected
   */
  private async handleOAuthTokenCreated(data: any): Promise<void> {
    const userId = data.user_id;
    const provider = data.provider;

    // Only handle Microsoft OAuth connections
    if (provider !== 'microsoft' && provider !== 'oauth_microsoft') {
      return;
    }

    if (!userId) {
      this.logger.warn('OAuth token created event missing user_id');
      return;
    }

    this.logger.log(`Microsoft OAuth token created for user ${userId}`);

    // Ensure user exists in our DB first — retry a few times in case
    // user.created webhook hasn't been processed yet (common race condition)
    const userExists = await this.waitForUser(userId);

    if (!userExists) {
      this.logger.warn(
        `User ${userId} not found in DB after retries — subscription will be created by next cron run`,
      );
      return;
    }

    // Create subscription now that Microsoft is connected
    await this.createMicrosoftSubscription(userId);
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
      this.logger.warn(
        `Failed to delete Microsoft subscription for ${id}: ${msg}`,
      );
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
        screeningPreferences: {
          create: {
            // Default empty preferences
          },
        },
      },
    });
    await this.screeningBucketService.ensureDefaultBuckets(data.id);
    this.logger.log(
      `Organization created: ${data.id} with default screening preferences and buckets`,
    );
  }

  private async upsertOrganization(data: any): Promise<void> {
    const org = await this.prisma.organization.upsert({
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
        screeningPreferences: {
          create: {
            // Default empty preferences
          },
        },
      },
    });

    // Ensure screening preferences exist (in case org was created before this migration)
    const existingPrefs = await this.prisma.screeningPreferences.findUnique({
      where: { organizationId: data.id },
    });

    if (!existingPrefs) {
      await this.prisma.screeningPreferences.create({
        data: {
          organizationId: data.id,
        },
      });
      this.logger.log(
        `Created default screening preferences for organization ${data.id}`,
      );
    }

    await this.screeningBucketService.ensureDefaultBuckets(data.id);

    this.logger.log(`Organization updated: ${data.id}`);
  }

  private async deleteOrganization(id: string): Promise<void> {
    await this.prisma.organization.delete({ where: { id } });
    this.logger.log(`Organization deleted: ${id}`);
  }

  private async addUserToOrganization(data: any): Promise<void> {
    const userId = data.public_user_data?.user_id;
    const organizationId = data.organization?.id;
    const organization = data.organization;

    if (!userId || !organizationId) {
      this.logger.warn(
        `Missing userId or organizationId in membership event: userId=${userId}, orgId=${organizationId}`,
      );
      return;
    }

    // Ensure organization exists first (race condition: membership.created can fire before organization.created)
    if (organization) {
      const org = await this.prisma.organization.upsert({
        where: { id: organizationId },
        update: {
          name: organization.name,
          slug: organization.slug,
          imageUrl: organization.image_url,
        },
        create: {
          id: organizationId,
          name: organization.name,
          slug: organization.slug,
          imageUrl: organization.image_url,
          screeningPreferences: {
            create: {
              // Default empty preferences
            },
          },
        },
      });

      // Ensure screening preferences exist (in case org was created before this migration)
      const existingPrefs = await this.prisma.screeningPreferences.findUnique({
        where: { organizationId },
      });

      if (!existingPrefs) {
        await this.prisma.screeningPreferences.create({
          data: {
            organizationId,
          },
        });
        this.logger.log(
          `Created default screening preferences for organization ${organizationId}`,
        );
      }

      await this.screeningBucketService.ensureDefaultBuckets(organizationId);
    }

    // Ensure user exists before updating
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      this.logger.warn(
        `User ${userId} does not exist, cannot add to organization ${organizationId}`,
      );
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { organizationId },
    });
    this.logger.log(`User ${userId} added to org ${organizationId}`);
  }

  private async removeUserFromOrganization(
    userId: string,
    organizationId?: string,
  ): Promise<void> {
    // Only null out the org if the user is still in the org being removed from.
    // When moving a user between orgs, Clerk fires membership.created (new org)
    // and membership.deleted (old org) in quick succession — if deleted fires after
    // created, we'd otherwise wipe the new org assignment.
    const where: any = { id: userId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const result = await this.prisma.user.updateMany({
      where,
      data: { organizationId: null },
    });
    if (result.count > 0) {
      this.logger.log(`User ${userId} removed from org ${organizationId}`);
    } else {
      this.logger.log(
        `User ${userId} already reassigned to a different org — skipping remove from ${organizationId}`,
      );
    }
  }
}
