import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BrokerStats {
  contactId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  totalDeals: number;
  yesCount: number;
  noCount: number;
  passRate: number; // 0-100
  topCities: Array<{ city: string; count: number }>;
  topStates: Array<{ state: string; count: number }>;
  lastDealAt: Date | null;
  firstDealAt: Date | null;
  /** Average days between deals (null if < 2 deals) */
  avgDaysBetweenDeals: number | null;
}

export interface BrokerLeaderboard {
  brokers: BrokerStats[];
  totalBrokers: number;
  totalDeals: number;
  periodStart: Date | null;
  periodEnd: Date | null;
}

export interface DigestBrokerContext {
  contactId: string;
  email: string;
  name: string | null;
  totalDeals: number;
  passRate: number;
  recentDeals: number; // deals in last 30 days
}

@Injectable()
export class BrokerIntelligenceService {
  private readonly logger = new Logger(BrokerIntelligenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get computed stats for a single broker within an organization.
   */
  async getBrokerStats(
    contactId: string,
    organizationId: string,
  ): Promise<BrokerStats | null> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });
    if (!contact) return null;

    const deals = await this.prisma.deal.findMany({
      where: { organizationId, contactId },
      include: {
        initialScreening: { select: { decision: true } },
        asset: { select: { city: true, state: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (deals.length === 0) return null;

    return this.computeStats(contact, deals);
  }

  /**
   * Get broker leaderboard for an organization.
   * Returns top brokers ranked by deal count with full stats.
   */
  async getLeaderboard(
    organizationId: string,
    options: {
      limit?: number;
      since?: Date;
      sortBy?: 'dealCount' | 'passRate';
    } = {},
  ): Promise<BrokerLeaderboard> {
    const { limit = 10, since, sortBy = 'dealCount' } = options;

    const whereClause: Record<string, unknown> = { organizationId, contactId: { not: null } };
    if (since) {
      whereClause.createdAt = { gte: since };
    }

    // Get all deals with contacts for this org
    const deals = await this.prisma.deal.findMany({
      where: whereClause,
      include: {
        contact: true,
        initialScreening: { select: { decision: true } },
        asset: { select: { city: true, state: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by contact
    const contactDeals = new Map<string, typeof deals>();
    for (const deal of deals) {
      if (!deal.contactId || !deal.contact) continue;
      const existing = contactDeals.get(deal.contactId) || [];
      existing.push(deal);
      contactDeals.set(deal.contactId, existing);
    }

    // Compute stats for each broker
    const brokerStats: BrokerStats[] = [];
    for (const [, groupedDeals] of contactDeals) {
      const contact = groupedDeals[0].contact!;
      brokerStats.push(this.computeStats(contact, groupedDeals));
    }

    // Sort
    if (sortBy === 'passRate') {
      brokerStats.sort((a, b) => b.passRate - a.passRate || b.totalDeals - a.totalDeals);
    } else {
      brokerStats.sort((a, b) => b.totalDeals - a.totalDeals);
    }

    return {
      brokers: brokerStats.slice(0, limit),
      totalBrokers: brokerStats.length,
      totalDeals: deals.length,
      periodStart: since || null,
      periodEnd: new Date(),
    };
  }

  /**
   * Get lightweight broker context for a set of contact IDs.
   * Used by the digest to annotate each deal with broker info.
   */
  async getBrokerContextForDigest(
    contactIds: string[],
    organizationId: string,
  ): Promise<Map<string, DigestBrokerContext>> {
    if (contactIds.length === 0) return new Map();

    const uniqueIds = [...new Set(contactIds.filter(Boolean))];

    // Get all deals for these contacts in this org
    const deals = await this.prisma.deal.findMany({
      where: {
        organizationId,
        contactId: { in: uniqueIds },
      },
      select: {
        contactId: true,
        createdAt: true,
        contact: { select: { id: true, email: true, firstName: true, lastName: true } },
        initialScreening: { select: { decision: true } },
      },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = new Map<string, DigestBrokerContext>();

    // Group by contact
    const byContact = new Map<string, typeof deals>();
    for (const deal of deals) {
      if (!deal.contactId || !deal.contact) continue;
      const existing = byContact.get(deal.contactId) || [];
      existing.push(deal);
      byContact.set(deal.contactId, existing);
    }

    for (const [contactId, contactDeals] of byContact) {
      const contact = contactDeals[0].contact!;
      const yesCount = contactDeals.filter((d) => d.initialScreening?.decision === 'YES').length;
      const recentDeals = contactDeals.filter((d) => d.createdAt >= thirtyDaysAgo).length;
      const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null;

      result.set(contactId, {
        contactId,
        email: contact.email,
        name,
        totalDeals: contactDeals.length,
        passRate: contactDeals.length > 0 ? Math.round((yesCount / contactDeals.length) * 100) : 0,
        recentDeals,
      });
    }

    return result;
  }

  /**
   * Get summary stats for an organization (for digest header).
   */
  async getOrgDealSummary(
    organizationId: string,
    since?: Date,
  ): Promise<{
    totalScreened: number;
    yesCount: number;
    noCount: number;
    passRate: number;
    uniqueBrokers: number;
    topMarkets: Array<{ location: string; count: number }>;
  }> {
    const whereClause: Record<string, unknown> = { organizationId };
    if (since) {
      whereClause.createdAt = { gte: since };
    }

    const deals = await this.prisma.deal.findMany({
      where: whereClause,
      select: {
        contactId: true,
        initialScreening: { select: { decision: true } },
        asset: { select: { city: true, state: true } },
      },
    });

    const yesCount = deals.filter((d) => d.initialScreening?.decision === 'YES').length;
    const noCount = deals.filter((d) => d.initialScreening?.decision === 'NO').length;
    const uniqueBrokers = new Set(deals.map((d) => d.contactId).filter(Boolean)).size;

    // Top markets
    const marketCounts = new Map<string, number>();
    for (const deal of deals) {
      if (deal.asset?.city || deal.asset?.state) {
        const location = [deal.asset.city, deal.asset.state].filter(Boolean).join(', ');
        marketCounts.set(location, (marketCounts.get(location) || 0) + 1);
      }
    }
    const topMarkets = [...marketCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([location, count]) => ({ location, count }));

    return {
      totalScreened: deals.length,
      yesCount,
      noCount,
      passRate: deals.length > 0 ? Math.round((yesCount / deals.length) * 100) : 0,
      uniqueBrokers,
      topMarkets,
    };
  }

  private computeStats(
    contact: { id: string; email: string; firstName: string | null; lastName: string | null },
    deals: Array<{
      createdAt: Date;
      initialScreening: { decision: string } | null;
      asset: { city: string | null; state: string | null } | null;
    }>,
  ): BrokerStats {
    const yesCount = deals.filter((d) => d.initialScreening?.decision === 'YES').length;
    const noCount = deals.filter((d) => d.initialScreening?.decision === 'NO').length;

    // Geographic focus
    const cityCounts = new Map<string, number>();
    const stateCounts = new Map<string, number>();
    for (const deal of deals) {
      if (deal.asset?.city) {
        cityCounts.set(deal.asset.city, (cityCounts.get(deal.asset.city) || 0) + 1);
      }
      if (deal.asset?.state) {
        stateCounts.set(deal.asset.state, (stateCounts.get(deal.asset.state) || 0) + 1);
      }
    }

    const topCities = [...cityCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([city, count]) => ({ city, count }));

    const topStates = [...stateCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([state, count]) => ({ state, count }));

    // Deal frequency
    const dates = deals.map((d) => d.createdAt.getTime()).sort((a, b) => a - b);
    let avgDaysBetweenDeals: number | null = null;
    if (dates.length >= 2) {
      const totalDays = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
      avgDaysBetweenDeals = Math.round(totalDays / (dates.length - 1));
    }

    return {
      contactId: contact.id,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      totalDeals: deals.length,
      yesCount,
      noCount,
      passRate: deals.length > 0 ? Math.round((yesCount / deals.length) * 100) : 0,
      topCities,
      topStates,
      lastDealAt: dates.length > 0 ? new Date(dates[dates.length - 1]) : null,
      firstDealAt: dates.length > 0 ? new Date(dates[0]) : null,
      avgDaysBetweenDeals,
    };
  }
}
