import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MicrosoftSubscriptionService } from './microsoft-subscription.service';
import { microsoftConfig } from '../../config/microsoft.config';

@Injectable()
export class MicrosoftRenewalSchedulerService {
  private readonly logger = new Logger(MicrosoftRenewalSchedulerService.name);
  private readonly microsoftConfig = microsoftConfig();

  constructor(
    private readonly microsoftSubscriptionService: MicrosoftSubscriptionService,
  ) {}

  /**
   * Renew Microsoft Graph subscriptions and create missing subscriptions
   * Interval is configurable via MICROSOFT_SUBSCRIPTION_RENEWAL_INTERVAL_MINUTES (default: 360 minutes = 6 hours)
   * Subscriptions expire after ~3 days, so this gives us plenty of buffer
   */
  @Cron(microsoftConfig().subscriptionRenewalCron)
  async handleSubscriptionRenewal(): Promise<void> {
    this.logger.log(
      `Running scheduled subscription renewal (interval: ${this.microsoftConfig.subscriptionRenewalInterval})...`,
    );
    await this.microsoftSubscriptionService.renewExpiringSubscriptions();
    this.logger.log('Subscription renewal complete');
  }
}


