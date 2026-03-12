import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MicrosoftGraphService } from './microsoft-graph.service';
import { microsoftConfig } from '../../config/microsoft.config';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const SUBSCRIPTION_RESOURCE = "me/mailFolders('Inbox')/messages";
// Max subscription lifetime is ~4230 minutes (~3 days) for mail
const SUBSCRIPTION_EXPIRY_MINUTES = 4000;

interface GraphSubscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: string;
  clientState: string;
}

@Injectable()
export class MicrosoftSubscriptionService {
  private readonly logger = new Logger(MicrosoftSubscriptionService.name);
  private readonly microsoftConfig = microsoftConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphService: MicrosoftGraphService,
  ) {}

  private async userLabel(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!user) return userId;
    return `${user.firstName ?? ''} ${user.lastName ?? ''} <${user.email}>`.trim();
  }

  /**
   * Create a new Microsoft Graph subscription for a user's inbox
   */
  async createSubscription(userId: string): Promise<boolean> {
    // Use debug level - it's expected that users might not have connected Microsoft yet
    const accessToken = await this.graphService.getMicrosoftOAuthTokenFromClerk(
      userId,
      'debug',
    );
    if (!accessToken) {
      this.logger.debug(`Cannot create subscription: no token for ${userId}`);
      return false;
    }

    // Check if user already has a subscription in our DB
    const existing = await this.prisma.microsoftSubscription.findUnique({
      where: { userId },
    });

    if (existing) {
      this.logger.log(
        `User ${await this.userLabel(userId)} already has subscription ${existing.subscriptionId}`,
      );
      const hoursUntilExpiry =
        (existing.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilExpiry < 24) {
        return this.renewSubscription(userId);
      }
      return true;
    }

    // Clean up any existing subscriptions on Microsoft's side
    // (from previous sign-ups that weren't properly cleaned up)
    await this.deleteExistingGraphSubscriptions(accessToken);

    const expirationDateTime = new Date(
      Date.now() + SUBSCRIPTION_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    try {
      const response = await fetch(`${GRAPH_BASE_URL}/subscriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changeType: 'created',
          notificationUrl: `${this.microsoftConfig.apiBaseUrl}/webhooks/microsoft`,
          resource: SUBSCRIPTION_RESOURCE,
          expirationDateTime,
          clientState: this.microsoftConfig.webhookSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to create subscription for ${await this.userLabel(userId)}: ${response.status} - ${errorText}`,
        );
        return false;
      }

      const subscription: GraphSubscription = await response.json();

      await this.prisma.microsoftSubscription.create({
        data: {
          userId,
          subscriptionId: subscription.id,
          resource: SUBSCRIPTION_RESOURCE,
          expiresAt: new Date(subscription.expirationDateTime),
        },
      });

      this.logger.log(
        `Created subscription ${subscription.id} for ${await this.userLabel(userId)}`,
      );
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating subscription for ${userId}: ${msg}`);
      return false;
    }
  }

  /**
   * Renew an existing subscription before it expires
   */
  async renewSubscription(userId: string): Promise<boolean> {
    const subscription = await this.prisma.microsoftSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      this.logger.warn(`No subscription found for user ${userId} to renew`);
      return this.createSubscription(userId);
    }

    const accessToken =
      await this.graphService.getMicrosoftOAuthTokenFromClerk(userId);
    if (!accessToken) {
      this.logger.error(`Cannot renew subscription: no token for ${userId}`);
      return false;
    }

    const expirationDateTime = new Date(
      Date.now() + SUBSCRIPTION_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    try {
      const response = await fetch(
        `${GRAPH_BASE_URL}/subscriptions/${subscription.subscriptionId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expirationDateTime,
            notificationUrl: `${this.microsoftConfig.apiBaseUrl}/webhooks/microsoft`,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to renew subscription ${subscription.subscriptionId}: ${response.status} - ${errorText}`,
        );
        // Subscription might have been deleted - try recreating
        if (response.status === 404) {
          await this.prisma.microsoftSubscription.delete({
            where: { userId },
          });
          return this.createSubscription(userId);
        }
        return false;
      }

      const renewed: GraphSubscription = await response.json();

      await this.prisma.microsoftSubscription.update({
        where: { userId },
        data: { expiresAt: new Date(renewed.expirationDateTime) },
      });

      this.logger.log(`Renewed subscription ${subscription.subscriptionId}`);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error renewing subscription: ${msg}`);
      return false;
    }
  }

  /**
   * Delete a user's subscription (e.g., when user disconnects or is deleted)
   */
  async deleteSubscription(userId: string): Promise<void> {
    let subscription;
    try {
      subscription = await this.prisma.microsoftSubscription.findUnique({
        where: { userId },
      });
    } catch {
      // Table might not exist during migrations
      return;
    }

    if (!subscription) return;

    const accessToken =
      await this.graphService.getMicrosoftOAuthTokenFromClerk(userId);
    if (accessToken) {
      try {
        await fetch(
          `${GRAPH_BASE_URL}/subscriptions/${subscription.subscriptionId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
      } catch {
        // Best effort - subscription will expire anyway
      }
    }

    try {
      await this.prisma.microsoftSubscription.delete({ where: { userId } });
      this.logger.log(`Deleted subscription for user ${userId}`);
    } catch {
      // Best effort
    }
  }

  /**
   * Resolve the designated monitoring inbox email for an organization.
   *
   * If the org has a designatedMonitoringInboxEmail set and that user has a live
   * Microsoft subscription, returns that email. Otherwise falls back to the oldest
   * user in the org who has a live subscription.
   *
   * Returns null if no users in the org have a subscription at all.
   */
  async resolveDesignatedMonitoringInboxEmailForOrganization(
    organizationId: string,
  ): Promise<string | null> {
    if (!organizationId) return null;

    // Load the designated email from preferences
    const prefs = await this.prisma.screeningPreferences.findUnique({
      where: { organizationId },
      select: { designatedMonitoringInboxEmail: true },
    });

    const designatedEmail = prefs?.designatedMonitoringInboxEmail;

    if (designatedEmail) {
      // Verify a user with that email exists in this org and has a live subscription
      const designatedUser = await this.prisma.user.findFirst({
        where: {
          organizationId,
          email: { equals: designatedEmail, mode: 'insensitive' },
          microsoftSubscription: { isNot: null },
        },
        select: { email: true },
      });

      if (designatedUser?.email) {
        return designatedUser.email;
      }
    }

    // Fallback: oldest user in the org with a live subscription
    const fallbackUser = await this.prisma.user.findFirst({
      where: {
        organizationId,
        microsoftSubscription: { isNot: null },
      },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    });

    return fallbackUser?.email ?? null;
  }

  /**
   * Get user ID by Graph subscription ID (for webhook handling)
   */
  async getUserBySubscriptionId(
    subscriptionId: string,
  ): Promise<string | null> {
    const subscription = await this.prisma.microsoftSubscription.findUnique({
      where: { subscriptionId },
    });
    return subscription?.userId || null;
  }

  /**
   * Renew all subscriptions expiring within the next 24 hours
   * Also creates subscriptions for users who have OAuth tokens but no subscription
   * Call this from a cron job
   */
  async renewExpiringSubscriptions(): Promise<void> {
    const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const expiring = await this.prisma.microsoftSubscription.findMany({
      where: { expiresAt: { lt: threshold } },
    });

    this.logger.log(
      `Found ${expiring.length} subscriptions expiring within 24 hours`,
    );

    let renewed = 0;
    let failed = 0;

    for (const sub of expiring) {
      const success = await this.renewSubscription(sub.userId);
      if (success) {
        renewed++;
      } else {
        failed++;
      }
    }

    if (expiring.length > 0) {
      this.logger.log(
        `Subscription renewal: ${renewed} renewed, ${failed} failed`,
      );
    }

    // Also check for users with Microsoft OAuth tokens but no subscription
    await this.createMissingSubscriptions();
  }

  /**
   * Find users who have Microsoft OAuth tokens but no subscription and create them
   */
  private async createMissingSubscriptions(): Promise<void> {
    // Get all users
    const allUsers = await this.prisma.user.findMany({
      select: { id: true },
    });

    this.logger.log(
      `Checking ${allUsers.length} users for missing subscriptions`,
    );

    let created = 0;
    let failed = 0;
    let skipped = 0;
    let alreadyHasSubscription = 0;

    for (const user of allUsers) {
      // Check if user already has a subscription
      const existing = await this.prisma.microsoftSubscription.findUnique({
        where: { userId: user.id },
      });

      if (existing) {
        alreadyHasSubscription++;
        continue;
      }

      // Check if user has a Microsoft OAuth token (use debug level - expected that many users won't have tokens)
      const accessToken =
        await this.graphService.getMicrosoftOAuthTokenFromClerk(
          user.id,
          'debug',
        );
      if (!accessToken) {
        skipped++;
        continue;
      }

      // User has token but no subscription - create it
      this.logger.log(
        `Found ${await this.userLabel(user.id)} with Microsoft token but no subscription, creating...`,
      );
      const success = await this.createSubscription(user.id);
      if (success) {
        created++;
      } else {
        failed++;
      }
    }

    this.logger.log(
      `Subscription check complete: ${allUsers.length} users checked, ` +
        `${alreadyHasSubscription} already have subscriptions, ` +
        `${created} created, ${failed} failed, ${skipped} skipped (no token)`,
    );
  }

  /**
   * Delete all existing subscriptions on Microsoft's side
   * This cleans up orphaned subscriptions from previous sign-ups
   */
  private async deleteExistingGraphSubscriptions(
    accessToken: string,
  ): Promise<void> {
    try {
      // List all subscriptions
      const response = await fetch(`${GRAPH_BASE_URL}/subscriptions`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to list subscriptions: ${response.status}`);
        return;
      }

      const data = await response.json();
      const subscriptions = data.value || [];

      // Delete each subscription for our resource
      for (const sub of subscriptions) {
        if (sub.resource === SUBSCRIPTION_RESOURCE) {
          this.logger.log(`Deleting orphaned subscription ${sub.id}`);
          await fetch(`${GRAPH_BASE_URL}/subscriptions/${sub.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
      }
    } catch (error) {
      // Best effort - continue with creation even if cleanup fails
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to clean up old subscriptions: ${msg}`);
    }
  }
}
