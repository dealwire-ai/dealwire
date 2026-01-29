import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailSenderService } from '../email/email-sender.service';
import { ScreeningPreferencesService } from '../preferences/screening-preferences.service';
import CronExpressionParser from 'cron-parser';

@Injectable()
export class DealDigestService {
  private readonly logger = new Logger(DealDigestService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailSenderService: EmailSenderService,
    private readonly screeningPreferencesService: ScreeningPreferencesService,
  ) {}

  /**
   * Check and send digests for all organizations with configured schedules
   * Runs every 30 minutes to check per-organization schedules
   */
  @Cron('*/30 * * * *', {
    name: 'deal-digest-check',
    timeZone: 'UTC',
  })
  async checkAndSendDigests(): Promise<void> {
    this.logger.log('Running deal digest check job');
    await this.sendDigestsForScheduledOrgs();
  }

  /**
   * Send digests for all organizations that have digestSchedule configured
   */
  private async sendDigestsForScheduledOrgs(): Promise<void> {
    try {
      // Get all organizations with digestSchedule configured
      const organizations = await this.prismaService.organization.findMany({
        include: {
          users: {
            select: {
              email: true,
            },
          },
          screeningPreferences: {
            select: {
              digestSchedule: true,
              digestTimeZone: true,
            },
          },
        },
      });

      const now = new Date();

      for (const org of organizations) {
        const schedule = org.screeningPreferences?.digestSchedule;
        const timeZone = org.screeningPreferences?.digestTimeZone || 'America/New_York';

        if (!schedule) {
          continue;
        }

        // Check if it's time to send based on the schedule
        if (!this.isTimeToSend(schedule, timeZone, now)) {
          continue;
        }

        await this.sendDigestForOrganization(org.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to check and send digests: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Check if current time matches the CRON schedule in the given timezone
   * Only checks if we're within 5 minutes AFTER the scheduled time to prevent double-sending
   */
  private isTimeToSend(schedule: string, timeZone: string, now: Date): boolean {
    try {
      const interval = CronExpressionParser.parse(schedule, {
        tz: timeZone,
      });

      // Get the previous scheduled time
      const prev = interval.prev();

      // Check if we're within 5 minutes AFTER the scheduled time
      const timeSincePrev = now.getTime() - prev.getTime();
      const fiveMinutes = 5 * 60 * 1000;

      return timeSincePrev < fiveMinutes;
    } catch (error) {
      this.logger.error(`Invalid CRON expression: ${schedule}`, error);
      return false;
    }
  }

  /**
   * Send digest for a specific organization
   */
  private async sendDigestForOrganization(organizationId: string): Promise<void> {
    try {
      // Get organization with users
      const org = await this.prismaService.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          imageUrl: true,
          users: {
            select: {
              email: true,
            },
          },
        },
      });

      if (!org || org.users.length === 0) {
        this.logger.warn(`Organization ${organizationId} not found or has no users`);
        return;
      }

      // Find the most recent digest timestamp for this organization
      const lastDigest = await this.prismaService.initialScreening.findFirst({
        where: {
          deal: { organizationId },
          digestSent: true,
          digestSentAt: { not: null },
        },
        orderBy: { digestSentAt: 'desc' },
        select: { digestSentAt: true },
      });

      // Calculate sinceDate - default to 7 days ago if no previous digest
      const sinceDate =
        lastDigest?.digestSentAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Atomically mark unsent screenings as sent to prevent race conditions
      // This ensures only one process can claim the screenings
      const now = new Date();
      const updateResult = await this.prismaService.initialScreening.updateMany({
        where: {
          deal: { organizationId },
          digestSent: false,
          screenedAt: {
            gte: sinceDate,
          },
        },
        data: {
          digestSent: true,
          digestSentAt: now,
        },
      });

      // Skip if no screenings were updated (either none exist or another process claimed them)
      if (updateResult.count === 0) {
        this.logger.log(`No new screenings for organization ${organizationId} since last digest`);
        return;
      }

      // Fetch the screenings we just marked as sent (now guaranteed to be unique to this process)
      const screenings = await this.prismaService.initialScreening.findMany({
        where: {
          deal: { organizationId },
          digestSent: true,
          digestSentAt: now,
        },
        include: {
          deal: {
            include: {
              asset: {
                select: {
                  address: true,
                  city: true,
                  state: true,
                },
              },
              receivedByUser: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: {
          screenedAt: 'desc',
        },
      });

      // Get organization preferences for email branding
      const preferences = await this.screeningPreferencesService.getPreferences(organizationId);

      // Format email (use organization imageUrl from preferences, which comes from the organization record)
      const emailHtml = this.formatDigestEmail(screenings, preferences);

      // Get user emails
      const userEmails = org.users
        .map((u: { email: string | null }) => u.email)
        .filter((e: string | null): e is string => e !== null);

      if (userEmails.length === 0) {
        this.logger.warn(`No valid emails for organization ${organizationId}`);
        return;
      }

      // Send email
      type ScreeningType = typeof screenings[0];
      const yesCount = screenings.filter((s: ScreeningType) => s.decision === 'YES').length;
      const noCount = screenings.filter((s: ScreeningType) => s.decision === 'NO').length;
      const subject = `Deal Digest: ${screenings.length} Deal${screenings.length > 1 ? 's' : ''} Screened (${yesCount} Yes, ${noCount} No)`;

      await this.emailSenderService.sendEmail({
        to: userEmails,
        subject,
        html: emailHtml,
      });

      this.logger.log(
        `Sent deal digest to ${userEmails.length} user(s) in organization ${organizationId}: ${screenings.length} screenings`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to send digest for organization ${organizationId}: ${errorMessage}`,
        errorStack,
      );
    }
  }

  private formatDigestEmail(
    screenings: Array<{
      id: string;
      decision: 'YES' | 'NO';
      reason: string;
      screenedAt: Date;
      deal: {
        sourceSubject: string | null;
        sourceFrom: string | null;
        asset: {
          address: string | null;
          city: string | null;
          state: string | null;
        } | null;
        receivedByUser: {
          email: string;
          firstName: string | null;
          lastName: string | null;
        } | null;
      };
    }>,
    preferences: {
      companyName?: string | null;
      brandColor?: string | null;
      organizationImageUrl?: string | null;
    } | null,
  ): string {
    const companyName = preferences?.companyName || 'Deal Analyzer';
    const brandColor = preferences?.brandColor || '#2A4A7C';
    const organizationImageUrl = preferences?.organizationImageUrl;

    const logoImgTag = organizationImageUrl
      ? `<img src="${organizationImageUrl}" alt="${companyName}" style="max-width: 180px; height: auto; display: block; margin: 0 auto;" />`
      : '';

    // Separate YES and NO deals
    type ScreeningType = typeof screenings[0];
    const yesDeals = screenings.filter((s: ScreeningType) => s.decision === 'YES');
    const noDeals = screenings.filter((s: ScreeningType) => s.decision === 'NO');

    const formatDeal = (screening: typeof screenings[0], isYes: boolean) => {
      const location = screening.deal.asset
        ? [screening.deal.asset.address, screening.deal.asset.city, screening.deal.asset.state]
            .filter(Boolean)
            .join(', ')
        : 'Location not specified';
      const subject = screening.deal.sourceSubject || 'No subject';
      const from = screening.deal.sourceFrom || 'Unknown sender';
      const reason = screening.reason || 'No reason provided';
      const date = new Date(screening.screenedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      const bgColor = isYes ? '#f0fdf4' : '#fef2f2';
      const borderColor = isYes ? '#22c55e' : '#dc2626';
      const textColor = isYes ? '#166534' : '#991b1b';
      const labelColor = isYes ? '#15803d' : '#991b1b';
      const decisionText = isYes ? 'YES' : 'NO';

      return `
        <div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 16px 20px; margin: 0 0 20px 0; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">
              ${this.escapeHtml(subject)}
            </h3>
            <span style="background-color: ${borderColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
              ${decisionText}
            </span>
          </div>
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
            <strong>From:</strong> ${this.escapeHtml(from)}<br>
            <strong>Location:</strong> ${this.escapeHtml(location)}<br>
            <strong>Screened:</strong> ${date}
          </p>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid ${borderColor}40;">
            <p style="margin: 0; font-size: 14px; color: ${textColor}; font-style: italic;">
              <strong>Reason:</strong> ${this.escapeHtml(reason)}
            </p>
          </div>
        </div>
      `;
    };

    const yesDealsHtml =
      yesDeals.length > 0
        ? `
      <h2 style="margin: 24px 0 16px 0; font-size: 18px; font-weight: 600; color: ${brandColor};">
        Approved Deals (${yesDeals.length})
      </h2>
      ${yesDeals.map((s: ScreeningType) => formatDeal(s, true)).join('')}
    `
        : '';

    const noDealsHtml =
      noDeals.length > 0
        ? `
      <h2 style="margin: 24px 0 16px 0; font-size: 18px; font-weight: 600; color: ${brandColor};">
        Passed Deals (${noDeals.length})
      </h2>
      ${noDeals.map((s) => formatDeal(s, false)).join('')}
    `
        : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
        }
    </style>
</head>
<body>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
        <tr>
            <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0; max-width: 800px; margin: 20px auto;">
                    <tr>
                        <td style="padding: 25px 30px; text-align: center; background-color: #ffffff; border-bottom: 2px solid ${brandColor};">
                            ${logoImgTag}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px;">
                            <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: ${brandColor};">
                                Deal Digest
                            </h1>
                            <p style="margin: 0 0 24px 0; font-size: 14px; color: #666666; line-height: 1.6;">
                                The following ${screenings.length} deal${screenings.length > 1 ? 's were' : ' was'} screened since the last digest:
                            </p>
                            ${yesDealsHtml}
                            ${noDealsHtml}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 30px; background-color: #fafafa; border-top: 1px solid #e0e0e0; text-align: center; font-size: 11px; color: #999999;">
                            <p style="margin: 0;">${companyName}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
