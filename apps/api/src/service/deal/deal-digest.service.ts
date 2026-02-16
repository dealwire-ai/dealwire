import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailSenderService } from '../email/email-sender.service';
import { ScreeningPreferencesService } from '../preferences/screening-preferences.service';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import { BrokerIntelligenceService, DigestBrokerContext } from './broker-intelligence.service';
import { ADMIN_EMAILS } from '../../config/email.config';
import CronExpressionParser from 'cron-parser';

@Injectable()
export class DealDigestService {
  private readonly logger = new Logger(DealDigestService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailSenderService: EmailSenderService,
    private readonly screeningPreferencesService: ScreeningPreferencesService,
    private readonly microsoftGraphService: MicrosoftGraphService,
    private readonly brokerIntelligence: BrokerIntelligenceService,
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
      // Get organization with users and Microsoft subscriptions
      const org = await this.prismaService.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          imageUrl: true,
          users: {
            select: {
              id: true,
              email: true,
              createdAt: true,
              microsoftSubscription: {
                select: {
                  id: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
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
              contact: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
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

      // Get broker context for all contacts in this digest
      const contactIds = screenings
        .map((s) => s.deal.contact?.id)
        .filter((id): id is string => !!id);
      const brokerContext = await this.brokerIntelligence.getBrokerContextForDigest(
        contactIds,
        organizationId,
      );

      // Get org-level summary stats
      const orgSummary = await this.brokerIntelligence.getOrgDealSummary(organizationId);

      // Get top brokers for leaderboard section
      const leaderboard = await this.brokerIntelligence.getLeaderboard(organizationId, {
        limit: 5,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });

      // Get organization preferences for email branding
      const preferences = await this.screeningPreferencesService.getPreferences(organizationId);

      // Format email with enhanced data
      const emailHtml = this.formatDigestEmail(screenings, preferences, brokerContext, orgSummary, leaderboard);

      // Get user emails
      const userEmails = org.users
        .map((u: { email: string | null }) => u.email)
        .filter((e: string | null): e is string => e !== null);

      if (userEmails.length === 0) {
        this.logger.warn(`No valid emails for organization ${organizationId}`);
        return;
      }

      // Find a user with Microsoft subscription (prefer first user by createdAt)
      type UserType = typeof org.users[0];
      const userWithMicrosoft = org.users.find(
        (u: UserType) => u.microsoftSubscription !== null,
      ) || org.users[0]; // Fallback to first user if none have Microsoft

      // Get Microsoft access token for the selected user
      const accessToken = userWithMicrosoft
        ? await this.microsoftGraphService.getMicrosoftOAuthTokenFromClerk(
            userWithMicrosoft.id,
            'debug',
          )
        : null;

      // Send email
      type ScreeningType = typeof screenings[0];
      const yesCount = screenings.filter((s: ScreeningType) => s.decision === 'YES').length;
      const noCount = screenings.filter((s: ScreeningType) => s.decision === 'NO').length;
      const subject = `Deal Digest: ${screenings.length} Deal${screenings.length > 1 ? 's' : ''} Screened (${yesCount} Yes, ${noCount} No)`;

      if (accessToken && userWithMicrosoft.email) {
        // Send via Microsoft Graph from user's Outlook account
        const success = await this.microsoftGraphService.sendMail(
          accessToken,
          userWithMicrosoft.email,
          userEmails,
          subject,
          emailHtml,
          ADMIN_EMAILS,
        );

        if (success) {
          this.logger.log(
            `Sent deal digest via Microsoft Graph from ${userWithMicrosoft.email} to ${userEmails.length} user(s) in organization ${organizationId}: ${screenings.length} screenings`,
          );
        } else {
          // Fallback to Resend if Microsoft Graph send failed
          this.logger.warn(
            `Microsoft Graph send failed, falling back to Resend for organization ${organizationId}`,
          );
          await this.emailSenderService.sendEmail({
            to: [...userEmails, ...ADMIN_EMAILS],
            subject,
            html: emailHtml,
          });
          this.logger.log(
            `Sent deal digest via Resend to ${userEmails.length + ADMIN_EMAILS.length} recipient(s) in organization ${organizationId}: ${screenings.length} screenings`,
          );
        }
      } else {
        // Fallback to Resend if no Microsoft token available
        await this.emailSenderService.sendEmail({
          to: [...userEmails, ...ADMIN_EMAILS],
          subject,
          html: emailHtml,
        });
        this.logger.log(
          `Sent deal digest via Resend to ${userEmails.length + ADMIN_EMAILS.length} recipient(s) in organization ${organizationId}: ${screenings.length} screenings`,
        );
      }

      // Mark all included screenings as sent
      const screeningIds = screenings.map((s: ScreeningType) => s.id);
      const digestSentAt = new Date();
      await this.prismaService.initialScreening.updateMany({
        where: {
          id: { in: screeningIds },
        },
        data: {
          digestSent: true,
          digestSentAt,
        },
      });
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
        contactId?: string | null;
        contact?: {
          id: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
        } | null;
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
    brokerContext?: Map<string, DigestBrokerContext>,
    orgSummary?: {
      totalScreened: number;
      yesCount: number;
      noCount: number;
      passRate: number;
      uniqueBrokers: number;
      topMarkets: Array<{ location: string; count: number }>;
    },
    leaderboard?: {
      brokers: Array<{
        email: string;
        firstName: string | null;
        lastName: string | null;
        totalDeals: number;
        passRate: number;
        yesCount: number;
      }>;
    },
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
      const decisionText = isYes ? 'YES' : 'NO';

      // Broker context line
      let brokerLine = '';
      const contactId = screening.deal.contact?.id;
      if (contactId && brokerContext?.has(contactId)) {
        const ctx = brokerContext.get(contactId)!;
        const brokerName = ctx.name || ctx.email;
        const parts: string[] = [];
        parts.push(`${ctx.totalDeals} deal${ctx.totalDeals !== 1 ? 's' : ''} total`);
        parts.push(`${ctx.passRate}% pass rate`);
        if (ctx.recentDeals > 1) {
          parts.push(`${ctx.recentDeals} in last 30 days`);
        }
        brokerLine = `<strong>Broker:</strong> ${this.escapeHtml(brokerName)} (${parts.join(' · ')})<br>`;
      }

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
            ${brokerLine}
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

    // Summary stats section
    const summaryHtml = orgSummary
      ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
        <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: ${brandColor};">
          Pipeline Overview
        </h2>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="padding: 4px 16px 4px 0; font-size: 13px; color: #6b7280;">All-time deals screened</td>
            <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #1f2937;">${orgSummary.totalScreened}</td>
            <td style="padding: 4px 16px 4px 24px; font-size: 13px; color: #6b7280;">Pass rate</td>
            <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #1f2937;">${orgSummary.passRate}%</td>
          </tr>
          <tr>
            <td style="padding: 4px 16px 4px 0; font-size: 13px; color: #6b7280;">Approved / Passed</td>
            <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #1f2937;">${orgSummary.yesCount} / ${orgSummary.noCount}</td>
            <td style="padding: 4px 16px 4px 24px; font-size: 13px; color: #6b7280;">Unique brokers</td>
            <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #1f2937;">${orgSummary.uniqueBrokers}</td>
          </tr>
        </table>
        ${orgSummary.topMarkets.length > 0 ? `
        <p style="margin: 12px 0 0 0; font-size: 13px; color: #6b7280;">
          <strong>Top markets:</strong> ${orgSummary.topMarkets.map((m) => `${this.escapeHtml(m.location)} (${m.count})`).join(' · ')}
        </p>` : ''}
      </div>`
      : '';

    // Top brokers section (last 30 days)
    const brokersHtml = leaderboard && leaderboard.brokers.length > 0
      ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
        <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: ${brandColor};">
          Top Brokers (Last 30 Days)
        </h2>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 13px;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6px 8px 6px 0; font-weight: 600; color: #6b7280;">Broker</td>
            <td style="padding: 6px 8px; font-weight: 600; color: #6b7280; text-align: center;">Deals</td>
            <td style="padding: 6px 8px; font-weight: 600; color: #6b7280; text-align: center;">Approved</td>
            <td style="padding: 6px 0 6px 8px; font-weight: 600; color: #6b7280; text-align: center;">Pass Rate</td>
          </tr>
          ${leaderboard.brokers.map((b) => {
            const name = [b.firstName, b.lastName].filter(Boolean).join(' ') || b.email;
            return `
          <tr>
            <td style="padding: 6px 8px 6px 0; color: #1f2937;">${this.escapeHtml(name)}</td>
            <td style="padding: 6px 8px; color: #1f2937; text-align: center;">${b.totalDeals}</td>
            <td style="padding: 6px 8px; color: #166534; text-align: center;">${b.yesCount}</td>
            <td style="padding: 6px 0 6px 8px; color: #1f2937; text-align: center;">${b.passRate}%</td>
          </tr>`;
          }).join('')}
        </table>
      </div>`
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
                            ${summaryHtml}
                            ${yesDealsHtml}
                            ${noDealsHtml}
                            ${brokersHtml}
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
