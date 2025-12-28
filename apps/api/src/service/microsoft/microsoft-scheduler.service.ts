import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MicrosoftSubscriptionService } from './microsoft-subscription.service';

@Injectable()
export class MicrosoftSchedulerService {
  private readonly logger = new Logger(MicrosoftSchedulerService.name);

  constructor(
    private readonly subscriptionService: MicrosoftSubscriptionService,
  ) {}

  /**
   * Renew Microsoft Graph subscriptions every 12 hours
   * Subscriptions expire after ~3 days, so this gives us plenty of buffer
   */
  @Cron(CronExpression.EVERY_12_HOURS)
  async handleSubscriptionRenewal(): Promise<void> {
    this.logger.log('Running scheduled subscription renewal...');
    await this.subscriptionService.renewExpiringSubscriptions();
    this.logger.log('Subscription renewal complete');
  }
}


