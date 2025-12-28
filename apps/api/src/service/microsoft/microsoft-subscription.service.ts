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

  /**
   * Create a new Microsoft Graph subscription for a user's inbox
   */
  async createSubscription(userId: string): Promise<boolean> {
    const accessToken = await this.graphService.getAccessToken(userId);
    if (!accessToken) {
      this.logger.error(`Cannot create subscription: no token for ${userId}`);
      return false;
    }

    // Check if user already has a subscription in our DB
    const existing = await this.prisma.microsoftSubscription.findUnique({
      where: { userId },
    });

    if (existing) {
      this.logger.log(`User ${userId} already has subscription ${existing.subscriptionId}`);
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
          `Failed to create subscription for ${userId}: ${response.status} - ${errorText}`,
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
        `Created subscription ${subscription.id} for user ${userId}`,
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

    const accessToken = await this.graphService.getAccessToken(userId);
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
          body: JSON.stringify({ expirationDateTime }),
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

    const accessToken = await this.graphService.getAccessToken(userId);
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
   * Get user ID by Graph subscription ID (for webhook handling)
   */
  async getUserBySubscriptionId(subscriptionId: string): Promise<string | null> {
    const subscription = await this.prisma.microsoftSubscription.findUnique({
      where: { subscriptionId },
    });
    return subscription?.userId || null;
  }

  /**
   * Renew all subscriptions expiring within the next 24 hours
   * Call this from a cron job
   */
  async renewExpiringSubscriptions(): Promise<void> {
    const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const expiring = await this.prisma.microsoftSubscription.findMany({
      where: { expiresAt: { lt: threshold } },
    });

    this.logger.log(`Found ${expiring.length} subscriptions to renew`);

    for (const sub of expiring) {
      await this.renewSubscription(sub.userId);
    }
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


