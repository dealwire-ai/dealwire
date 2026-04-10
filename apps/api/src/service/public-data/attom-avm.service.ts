import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AttomAvmResponse {
  status: {
    code: number;
    msg: string;
    total: number;
    attomId?: number;
  };
  property?: Array<{
    identifier?: { Id?: number; fips?: string; apn?: string; attomId?: number };
    address?: {
      oneLine?: string;
      line1?: string;
      line2?: string;
      locality?: string;
      countrySubd?: string;
      postal1?: string;
    };
    avm?: {
      eventDate?: string;
      amount?: {
        value?: number;
        high?: number;
        low?: number;
        scr?: number;
        fsd?: number;
      };
    };
    summary?: {
      proptype?: string;
      propertyType?: string;
      yearbuilt?: number;
    };
    owner?: {
      owner1?: { fullname?: string };
    };
  }>;
}

@Injectable()
export class AttomAvmService {
  private readonly logger = new Logger(AttomAvmService.name);
  private readonly apiKey = process.env.ATTOM_API_KEY;
  private readonly baseUrl =
    'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
  private readonly orgMonthlyLimit = parseInt(
    process.env.ORG_AVM_MONTHLY_LIMIT ?? '200',
  );

  constructor(private readonly prisma: PrismaService) {}

  /** Look up AVM for a parcel by BBL, store results, and track org usage */
  async lookupByBbl(
    bbl: string,
    organizationId: string,
    force = false,
  ): Promise<{
    avmValue: number | null;
    avmHigh: number | null;
    avmLow: number | null;
    avmConfidence: number | null;
    avmDate: string | null;
    cached: boolean;
  }> {
    if (!this.apiKey) {
      throw new Error('ATTOM API is not configured on this server');
    }

    const parcel = await this.prisma.parcel.findUnique({ where: { bbl } });
    if (!parcel) {
      throw new Error(`Parcel not found: ${bbl}`);
    }

    // Return cached data if we already have a valuation (unless force refresh)
    if (!force && parcel.avmValue != null && parcel.avmSyncedAt) {
      await this.recordOrgAccess(parcel.id, organizationId);
      return {
        avmValue: parcel.avmValue,
        avmHigh: parcel.avmHigh,
        avmLow: parcel.avmLow,
        avmConfidence: parcel.avmConfidence,
        avmDate: parcel.avmDate?.toISOString() ?? null,
        cached: true,
      };
    }

    // Check org monthly quota
    const usage = await this.getOrgMonthlyUsage(organizationId);
    if (usage >= this.orgMonthlyLimit) {
      throw new Error(
        `Monthly AVM lookup limit reached. Used: ${usage}/${this.orgMonthlyLimit}. ` +
          `Resets on the 1st of next month.`,
      );
    }

    // Build address for ATTOM lookup
    const address1 = parcel.address;
    if (!address1) {
      throw new Error(
        `Parcel ${bbl} has no address — cannot look up valuation`,
      );
    }

    const city = parcel.city || this.boroughToCity(parcel.borough);
    const zip = parcel.zipCode || '';
    const address2 = `${city}, NY ${zip}`.trim();

    // Call ATTOM API
    const url = new URL(`${this.baseUrl}/attomavm/detail`);
    url.searchParams.set('address1', address1);
    url.searchParams.set('address2', address2);

    this.logger.log(`Fetching AVM for ${bbl}: ${address1}, ${address2}`);

    const response = await fetch(url.toString(), {
      headers: {
        apikey: this.apiKey,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `ATTOM API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as AttomAvmResponse;

    if (
      !data.property?.length ||
      data.status?.code === 400 ||
      data.status?.msg === 'SuccessWithoutResult'
    ) {
      this.logger.warn(`No AVM data returned for ${bbl}`);
      // Record that we tried (still counts toward quota)
      await this.recordOrgAccess(parcel.id, organizationId);
      return {
        avmValue: null,
        avmHigh: null,
        avmLow: null,
        avmConfidence: null,
        avmDate: null,
        cached: false,
      };
    }

    const prop = data.property[0];
    const avm = prop.avm?.amount;
    const avmDate = prop.avm?.eventDate ? new Date(prop.avm.eventDate) : null;

    // Store on parcel
    await this.prisma.parcel.update({
      where: { bbl },
      data: {
        avmValue: avm?.value ?? null,
        avmHigh: avm?.high ?? null,
        avmLow: avm?.low ?? null,
        avmConfidence: avm?.scr ?? null,
        avmDate,
        avmSyncedAt: new Date(),
      },
    });

    // Record org access
    await this.recordOrgAccess(parcel.id, organizationId);

    this.logger.log(
      `AVM stored for ${bbl}: $${avm?.value?.toLocaleString()} (confidence: ${avm?.scr})`,
    );

    return {
      avmValue: avm?.value ?? null,
      avmHigh: avm?.high ?? null,
      avmLow: avm?.low ?? null,
      avmConfidence: avm?.scr ?? null,
      avmDate: avmDate?.toISOString() ?? null,
      cached: false,
    };
  }

  /** Count how many AVM lookups an org has used this month (non-cached only) */
  async getOrgMonthlyUsage(organizationId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.prisma.orgAvmLookup.count({
      where: {
        organizationId,
        lookedUpAt: { gte: startOfMonth },
      },
    });
  }

  /** Get org AVM usage info for frontend display */
  async getOrgUsageInfo(organizationId: string): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    const used = await this.getOrgMonthlyUsage(organizationId);
    return {
      used,
      limit: this.orgMonthlyLimit,
      remaining: Math.max(0, this.orgMonthlyLimit - used),
    };
  }

  private async recordOrgAccess(
    parcelId: string,
    organizationId: string,
  ): Promise<void> {
    await this.prisma.orgAvmLookup.upsert({
      where: {
        parcelId_organizationId: { parcelId, organizationId },
      },
      create: { parcelId, organizationId },
      update: { lookedUpAt: new Date() },
    });
  }

  private boroughToCity(borough: string): string {
    const map: Record<string, string> = {
      '1': 'New York',
      '2': 'Bronx',
      '3': 'Brooklyn',
      '4': 'Queens',
      '5': 'Staten Island',
    };
    return map[borough] || 'New York';
  }
}
