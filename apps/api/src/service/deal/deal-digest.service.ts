import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';
import { EmailSenderService } from '../email/email-sender.service';
import { ScreeningPreferencesService } from '../preferences/screening-preferences.service';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import { S3Service } from '../s3/s3.service';
import {
  BrokerIntelligenceService,
  DigestBrokerContext,
} from './broker-intelligence.service';
import { ADMIN_EMAILS } from '../../config/email.config';
import CronExpressionParser from 'cron-parser';
import { formatFileSize, escapeHtml, getErrorMessage } from '../../util/format';
import { EMAIL_DEFAULTS, DECISION_COLORS } from '../../util/email-branding';

interface DigestActionLinks {
  webLink?: string;
  desktopLink?: string; // outlook:<entryId> protocol link for classic Win32 Outlook
  documentLinks?: Array<{ filename: string; url: string; sizeBytes?: number }>;
  dealRoomLinks?: string[];
  caLinks?: string[];
}

@Injectable()
export class DealDigestService implements OnModuleInit {
  private readonly logger = new Logger(DealDigestService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailSenderService: EmailSenderService,
    private readonly screeningPreferencesService: ScreeningPreferencesService,
    private readonly microsoftGraphService: MicrosoftGraphService,
    private readonly s3Service: S3Service,
    private readonly brokerIntelligence: BrokerIntelligenceService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const cronExpression = process.env.DIGEST_CHECKER_CRON ?? '*/30 * * * *';
    const job = new CronJob(cronExpression, () => {
      this.logger.log('Running deal digest check job');
      void this.sendDigestsForScheduledOrgs();
    });
    this.schedulerRegistry.addCronJob('deal-digest-check', job);
    job.start();
    this.logger.log(`Deal digest checker scheduled: ${cronExpression}`);
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
        const timeZone =
          org.screeningPreferences?.digestTimeZone || 'America/New_York';

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
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to check and send digests: ${getErrorMessage(error)}`,
        errorStack,
      );
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
  async sendDigestForOrganization(organizationId: string): Promise<void> {
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
        this.logger.warn(
          `Organization ${organizationId} not found or has no users`,
        );
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
        lastDigest?.digestSentAt ||
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Atomically mark unsent screenings as sent to prevent race conditions
      // This ensures only one process can claim the screenings
      const now = new Date();
      const updateResult = await this.prismaService.initialScreening.updateMany(
        {
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
        },
      );

      // Skip if no screenings were updated (either none exist or another process claimed them)
      if (updateResult.count === 0) {
        this.logger.log(
          `No new screenings for organization ${organizationId} since last digest`,
        );
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
              documents: {
                select: {
                  filename: true,
                  s3Key: true,
                  contentType: true,
                  sizeBytes: true,
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
      const brokerContext =
        await this.brokerIntelligence.getBrokerContextForDigest(
          contactIds,
          organizationId,
        );

      // Get org-level summary stats
      const orgSummary =
        await this.brokerIntelligence.getOrgDealSummary(organizationId);

      // Get top brokers for leaderboard section
      const leaderboard = await this.brokerIntelligence.getLeaderboard(
        organizationId,
        {
          limit: 5,
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      );

      // Build action links for each deal (pre-signed S3 URLs, extracted links, webLinks)
      const actionLinksMap = await this.buildActionLinksForDigest(screenings);

      // Get organization preferences for email branding
      const preferences =
        await this.screeningPreferencesService.getPreferences(organizationId);

      // Format email with enhanced data
      const emailHtml = this.formatDigestEmail(
        screenings,
        preferences,
        brokerContext,
        orgSummary,
        leaderboard,
        actionLinksMap,
      );

      // Get user emails
      const userEmails = org.users
        .map((u: { email: string | null }) => u.email)
        .filter((e: string | null): e is string => e !== null);

      if (userEmails.length === 0) {
        this.logger.warn(`No valid emails for organization ${organizationId}`);
        return;
      }

      // Pick the sender: prefer any designated monitoring inbox user, then fall
      // back to the oldest user with a subscription (same priority as inbox monitoring).
      type UserType = (typeof org.users)[0];
      const designatedEmails = (
        preferences?.designatedMonitoringInboxEmails ?? []
      ).map((e) => e.toLowerCase());
      const usersWithSub = org.users.filter(
        (u: UserType) => u.microsoftSubscription !== null,
      );
      const userWithMicrosoft =
        (designatedEmails.length > 0
          ? usersWithSub.find(
              (u: UserType) =>
                !!u.email && designatedEmails.includes(u.email.toLowerCase()),
            )
          : undefined) ||
        usersWithSub[0] || // oldest user with subscription (already ordered by createdAt asc)
        org.users[0]; // last resort: no one has a subscription

      // Get Microsoft access token for the selected user
      const accessToken = userWithMicrosoft
        ? await this.microsoftGraphService.getMicrosoftOAuthTokenFromClerk(
            userWithMicrosoft.id,
            'debug',
          )
        : null;

      // Send email
      type ScreeningType = (typeof screenings)[0];
      const yesCount = screenings.filter(
        (s: ScreeningType) => s.decision === 'YES',
      ).length;
      const noCount = screenings.filter(
        (s: ScreeningType) => s.decision === 'NO',
      ).length;
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
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to send digest for organization ${organizationId}: ${getErrorMessage(error)}`,
        errorStack,
      );
    }
  }

  /**
   * Build action links for all deals in a digest batch.
   * Generates pre-signed S3 URLs for documents and extracts stored links.
   */
  private async buildActionLinksForDigest(
    screenings: Array<{
      deal: {
        id?: string;
        sourceWebLink?: string | null;
        sourceEntryId?: string | null;
        extractedLinks?: unknown;
        documents?: Array<{
          filename: string;
          s3Key: string | null;
          sizeBytes: number | null;
        }>;
      };
    }>,
  ): Promise<Map<string, DigestActionLinks>> {
    const map = new Map<string, DigestActionLinks>();

    for (const screening of screenings) {
      const deal = screening.deal as {
        id: string;
        sourceWebLink?: string | null;
        sourceEntryId?: string | null;
        extractedLinks?: unknown;
        documents?: Array<{
          filename: string;
          s3Key: string | null;
          sizeBytes: number | null;
        }>;
      };
      if (!deal.id) continue;

      const links: DigestActionLinks = {};

      // Web link to original email in Outlook
      if (deal.sourceWebLink) {
        links.webLink = deal.sourceWebLink;
      }

      // Desktop deep link for classic Win32 Outlook
      if (deal.sourceEntryId) {
        links.desktopLink = `outlook:${deal.sourceEntryId}`;
      }

      // Pre-signed S3 URLs for documents
      if (deal.documents && deal.documents.length > 0) {
        const docLinks: Array<{
          filename: string;
          url: string;
          sizeBytes?: number;
        }> = [];
        for (const doc of deal.documents) {
          if (doc.s3Key) {
            try {
              const url = await this.s3Service.getPresignedUrl(doc.s3Key);
              docLinks.push({
                filename: doc.filename,
                url,
                sizeBytes: doc.sizeBytes || undefined,
              });
            } catch {
              // Skip docs that fail
            }
          }
        }
        if (docLinks.length > 0) {
          links.documentLinks = docLinks;
        }
      }

      // Extracted links from email HTML (stored at processing time)
      if (deal.extractedLinks && typeof deal.extractedLinks === 'object') {
        const extracted = deal.extractedLinks as {
          dealRoomLinks?: string[];
          caLinks?: string[];
        };
        if (extracted.dealRoomLinks?.length) {
          links.dealRoomLinks = extracted.dealRoomLinks;
        }
        if (extracted.caLinks?.length) {
          links.caLinks = extracted.caLinks;
        }
      }

      // Only store if there's something
      if (
        links.webLink ||
        links.desktopLink ||
        links.documentLinks ||
        links.dealRoomLinks ||
        links.caLinks
      ) {
        map.set(deal.id, links);
      }
    }

    return map;
  }

  private formatDigestEmail(
    screenings: Array<{
      id: string;
      decision: 'YES' | 'NO';
      reason: string;
      screenedAt: Date;
      deal: {
        id: string;
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
    actionLinksMap?: Map<string, DigestActionLinks>,
  ): string {
    const companyName = preferences?.companyName || EMAIL_DEFAULTS.companyName;
    const brandColor = preferences?.brandColor || EMAIL_DEFAULTS.brandColor;
    const organizationImageUrl = preferences?.organizationImageUrl;
    const inboundEmail = process.env.SCREENING_INBOUND_EMAIL || '';

    // Separate YES and NO deals
    type ScreeningType = (typeof screenings)[0];
    const yesDeals = screenings.filter(
      (s: ScreeningType) => s.decision === 'YES',
    );
    const noDeals = screenings.filter(
      (s: ScreeningType) => s.decision === 'NO',
    );

    const formatDeal = (screening: (typeof screenings)[0], isYes: boolean) => {
      const location = screening.deal.asset
        ? [
            screening.deal.asset.address,
            screening.deal.asset.city,
            screening.deal.asset.state,
          ]
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

      const colors = isYes ? DECISION_COLORS.yes : DECISION_COLORS.no;
      const accentColor = colors.accent;
      const pillBg = colors.pillBg;
      const pillText = colors.pillText;
      const reasonColor = colors.reason;
      const decisionText = isYes ? 'YES' : 'NO';

      // Broker context line
      let brokerLine = '';
      const contactId = screening.deal.contact?.id;
      if (contactId && brokerContext?.has(contactId)) {
        const ctx = brokerContext.get(contactId)!;
        const brokerName = ctx.name || ctx.email;
        const parts: string[] = [];
        parts.push(
          `${ctx.totalDeals} deal${ctx.totalDeals !== 1 ? 's' : ''} total`,
        );
        parts.push(`${ctx.passRate}% pass rate`);
        if (ctx.recentDeals > 1) {
          parts.push(`${ctx.recentDeals} in last 30 days`);
        }
        brokerLine = `
                    <tr>
                      <td style="padding: 2px 0; font-size: 14px; font-weight: 500; color: #6b7280;">Broker</td>
                      <td style="padding: 2px 0 2px 12px; font-size: 14px; font-weight: 500; color: #1f2937;">${escapeHtml(brokerName)} <span style="color: #6b7280; font-size: 13px;">(${parts.join(' &middot; ')})</span></td>
                    </tr>`;
      }

      return `
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 16px 0; border-collapse: collapse;">
          <tr>
            <td style="width: 4px; background-color: ${accentColor}; border-radius: 8px 0 0 8px;"></td>
            <td style="background-color: #ffffff; border: 1px solid #e5e7eb; border-left: none; border-radius: 0 8px 8px 0; padding: 20px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="font-size: 17px; font-weight: 700; color: #111827; padding-bottom: 12px;">
                    ${escapeHtml(subject)}
                  </td>
                  <td style="text-align: right; vertical-align: top; padding-bottom: 12px;">
                    <span style="background-color: ${pillBg}; color: ${pillText}; padding: 4px 14px; border-radius: 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">
                      ${decisionText}
                    </span>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 14px;">
                <tr>
                  <td style="padding: 2px 0; font-size: 14px; font-weight: 500; color: #6b7280; width: 70px;">From</td>
                  <td style="padding: 2px 0 2px 12px; font-size: 14px; font-weight: 500; color: #1f2937;">${escapeHtml(from)}</td>
                </tr>${brokerLine}
                <tr>
                  <td style="padding: 2px 0; font-size: 14px; font-weight: 500; color: #6b7280;">Location</td>
                  <td style="padding: 2px 0 2px 12px; font-size: 14px; font-weight: 500; color: #1f2937;">${screening.deal.asset && location !== 'Location not specified' ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}" style="color: #2563eb; text-decoration: none;" target="_blank">${escapeHtml(location)}</a>` : escapeHtml(location)}</td>
                </tr>
                <tr>
                  <td style="padding: 2px 0; font-size: 14px; font-weight: 500; color: #6b7280;">Screened</td>
                  <td style="padding: 2px 0 2px 12px; font-size: 14px; font-weight: 500; color: #1f2937;">${date}</td>
                </tr>
              </table>
              <div style="border-top: 1px solid #f3f4f6; padding-top: 14px;">
                <p style="margin: 0; font-size: 15px; font-weight: 500; color: ${reasonColor}; line-height: 1.5;">
                  ${escapeHtml(reason)}
                </p>
              </div>
              ${this.renderDealActionLinks(screening.deal.id, actionLinksMap)}
              ${inboundEmail ? this.buildCommandLink(subject, reason, isYes, location, inboundEmail) : ''}
            </td>
          </tr>
        </table>
      `;
    };

    const yesDealsHtml =
      yesDeals.length > 0
        ? `
      <h2 style="margin: 32px 0 20px 0; font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">
        Approved Deals <span style="color: #6b7280; font-weight: 500; font-size: 16px;">(${yesDeals.length})</span>
      </h2>
      ${yesDeals.map((s: ScreeningType) => formatDeal(s, true)).join('')}
    `
        : '';

    const noDealsHtml =
      noDeals.length > 0
        ? `
      <h2 style="margin: 32px 0 20px 0; font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">
        Passed Deals <span style="color: #6b7280; font-weight: 500; font-size: 16px;">(${noDeals.length})</span>
      </h2>
      ${noDeals.map((s) => formatDeal(s, false)).join('')}
    `
        : '';

    // Summary stats section — compact inline bar
    const summaryHtml = orgSummary
      ? `
      <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 20px; margin: 0 0 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="font-size: 14px; font-weight: 500; color: #4b5563; padding-right: 20px;">
              <span style="font-weight: 700; color: #111827;">${orgSummary.totalScreened}</span> screened
            </td>
            <td style="font-size: 14px; font-weight: 500; color: #4b5563; padding-right: 20px;">
              <span style="font-weight: 700; color: #16a34a;">${orgSummary.yesCount}</span> approved
            </td>
            <td style="font-size: 14px; font-weight: 500; color: #4b5563; padding-right: 20px;">
              <span style="font-weight: 700; color: #111827;">${orgSummary.passRate}%</span> pass rate
            </td>
            <td style="font-size: 14px; font-weight: 500; color: #4b5563;">
              <span style="font-weight: 700; color: #111827;">${orgSummary.uniqueBrokers}</span> brokers
            </td>
          </tr>
        </table>
        ${
          orgSummary.topMarkets.length > 0
            ? `
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
          <span style="font-size: 13px; color: #6b7280;">Top markets:</span>
          ${orgSummary.topMarkets.map((m) => `<span style="font-size: 13px; color: #1f2937; margin-left: 6px;">${escapeHtml(m.location)} <span style="color: #6b7280;">(${m.count})</span></span>`).join(' &middot;')}
        </div>`
            : ''
        }
      </div>`
      : '';

    // Top brokers section (last 30 days)
    const brokersHtml =
      leaderboard && leaderboard.brokers.length > 0
        ? `
      <div style="margin: 0 0 32px 0;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">
          Top Brokers <span style="color: #6b7280; font-weight: 500; font-size: 16px;">Last 30 Days</span>
        </h2>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px; border: 1px solid #e5e7eb; border-radius: 8px; border-collapse: separate; overflow: hidden;">
          <tr>
            <td style="padding: 10px 16px; font-weight: 700; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">Broker</td>
            <td style="padding: 10px 16px; font-weight: 700; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">Deals</td>
            <td style="padding: 10px 16px; font-weight: 700; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">Approved</td>
            <td style="padding: 10px 16px; font-weight: 700; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">Pass Rate</td>
          </tr>
          ${leaderboard.brokers
            .map((b, i) => {
              const name =
                [b.firstName, b.lastName].filter(Boolean).join(' ') || b.email;
              const rowBg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
              const borderBottom =
                i < leaderboard.brokers.length - 1
                  ? 'border-bottom: 1px solid #f3f4f6;'
                  : '';
              return `
          <tr>
            <td style="padding: 10px 16px; color: #111827; font-weight: 600; background-color: ${rowBg}; ${borderBottom}">${escapeHtml(name)}</td>
            <td style="padding: 10px 16px; color: #1f2937; font-weight: 500; text-align: center; background-color: ${rowBg}; ${borderBottom}">${b.totalDeals}</td>
            <td style="padding: 10px 16px; color: #16a34a; font-weight: 600; text-align: center; background-color: ${rowBg}; ${borderBottom}">${b.yesCount}</td>
            <td style="padding: 10px 16px; color: #1f2937; font-weight: 500; text-align: center; background-color: ${rowBg}; ${borderBottom}">${b.passRate}%</td>
          </tr>`;
            })
            .join('')}
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
            background-color: #f1f5f9;
        }
    </style>
</head>
<body>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
        <tr>
            <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 800px; margin: 0 auto;">
                    <tr>
                        <td style="padding: 28px 32px; text-align: center; background-color: ${brandColor}; border-radius: 0 0 0 0;">
                            ${organizationImageUrl ? `<img src="${organizationImageUrl}" alt="${companyName}" style="max-width: 160px; height: auto; display: block; margin: 0 auto;" />` : `<span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">${escapeHtml(companyName)}</span>`}
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #ffffff; padding: 36px 36px 24px 36px;">
                            <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #111827; letter-spacing: -0.5px;">
                                Deal Digest
                            </h1>
                            <p style="margin: 0 0 32px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                                ${screenings.length} deal${screenings.length > 1 ? 's' : ''} screened since the last digest
                            </p>
                            ${summaryHtml}
                            ${yesDealsHtml}
                            ${noDealsHtml}
                            ${brokersHtml}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 36px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                            <p style="margin: 0; font-size: 13px; color: #6b7280;">${escapeHtml(companyName)}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
  }

  /**
   * Render inline action links for a deal card in the digest.
   * Shows: View Email, Download docs, Deal room, Sign CA — as compact link row.
   */
  private renderDealActionLinks(
    dealId: string,
    actionLinksMap?: Map<string, DigestActionLinks>,
  ): string {
    if (!actionLinksMap) return '';
    const links = actionLinksMap.get(dealId);
    if (!links) return '';

    const linkStyle =
      'color: #2563eb; text-decoration: none; font-size: 13px; font-weight: 600;';
    const separatorStyle = 'color: #d1d5db; margin: 0 6px; font-size: 13px;';
    const items: string[] = [];

    if (links.webLink) {
      items.push(
        `<a href="${links.webLink}" style="${linkStyle}" target="_blank">View Email</a>`,
      );
    }

    if (links.desktopLink) {
      items.push(
        `<a href="${links.desktopLink}" style="${linkStyle}" target="_blank">Open in Desktop</a>`,
      );
    }

    if (links.documentLinks && links.documentLinks.length > 0) {
      for (const doc of links.documentLinks) {
        const size = doc.sizeBytes ? ` (${formatFileSize(doc.sizeBytes)})` : '';
        items.push(
          `<a href="${doc.url}" style="${linkStyle}" target="_blank">${escapeHtml(doc.filename)}${size}</a>`,
        );
      }
    }

    if (links.dealRoomLinks && links.dealRoomLinks.length > 0) {
      items.push(
        `<a href="${links.dealRoomLinks[0]}" style="${linkStyle}" target="_blank">Deal Room</a>`,
      );
    }

    if (links.caLinks && links.caLinks.length > 0) {
      items.push(
        `<a href="${links.caLinks[0]}" style="${linkStyle}" target="_blank">Sign CA</a>`,
      );
    }

    if (items.length === 0) return '';

    const separator = `<span style="${separatorStyle}">|</span>`;
    return `
              <div style="border-top: 1px solid #f3f4f6; padding-top: 10px; margin-top: 10px;">
                ${items.join(separator)}
              </div>`;
  }

  private buildCommandLink(
    subject: string,
    reason: string,
    isYes: boolean,
    location: string,
    inboundEmail: string,
  ): string {
    const truncatedSubject =
      subject.length > 60 ? subject.slice(0, 57) + '...' : subject;
    const decisionLabel = isYes ? 'YES' : 'NO';
    const sharedContext = `Deal: ${subject}\nLocation: ${location}\nAI Decision: ${decisionLabel}\nAI Reason: ${reason}`;

    let label: string;
    let emailSubject: string;
    let body: string;

    if (isYes) {
      label = 'Skip deals like this';
      emailSubject = `Skip deals like this: ${truncatedSubject}`;
      body = `${sharedContext}\n\nPlease update my criteria to skip deals like this in the future. Feel free to add to my always-skip list or tighten my screening buckets based on the characteristics of this deal.`;
    } else {
      label = 'Accept deals like this';
      emailSubject = `Accept deals like this: ${truncatedSubject}`;
      body = `${sharedContext}\n\nI think deals like this should be approved. Please adjust my buy box or screening criteria so similar deals pass in the future.`;
    }

    const href = `mailto:${inboundEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`;
    const linkStyle =
      'color: #6b7280; text-decoration: none; font-size: 12px; font-weight: 600;';

    const muteSubject = `Mute this deal: ${truncatedSubject}`;
    const muteBody = `Deal: ${subject}\nLocation: ${location}\n\nPlease mute this specific deal. I've already made my decision and don't want future emails about this property to ever surface as YES.`;
    const muteHref = `mailto:${inboundEmail}?subject=${encodeURIComponent(muteSubject)}&body=${encodeURIComponent(muteBody)}`;
    const muteLinkStyle =
      'color: #9ca3af; text-decoration: none; font-size: 12px; font-weight: 600;';

    return `
              <div style="padding-top: 8px; margin-top: 6px;">
                <span style="font-size: 12px; color: #d1d5db; margin-right: 6px;">Agent:</span>
                <a href="${href}" style="${linkStyle}">${label}</a>
                <span style="color: #e5e7eb; margin: 0 6px;">·</span>
                <a href="${muteHref}" style="${muteLinkStyle}">Mute this deal</a>
              </div>`;
  }
}
