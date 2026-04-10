import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AttomAllEventsResponse {
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
    summary?: {
      proptype?: string;
      propertyType?: string;
      yearbuilt?: number;
    };
    assessment?: {
      assessed?: {
        assdttlvalue?: number;
        assdlandvalue?: number;
        assdimprvalue?: number;
      };
      market?: {
        mktttlvalue?: number;
        mktlandvalue?: number;
        mktimprvalue?: number;
      };
      tax?: {
        taxamt?: number;
        taxyear?: number;
      };
    };
    avm?: {
      eventDate?: string;
      amount?: {
        value?: number;
        high?: number;
        low?: number;
        scr?: number;
      };
    };
    sale?: {
      saleTransDate?: string;
      amount?: {
        saleamt?: number;
        salerecdate?: string;
        saletranstype?: string;
      };
    };
  }>;
}

export interface ValuationResult {
  avmValue: number | null;
  avmHigh: number | null;
  avmLow: number | null;
  avmConfidence: number | null;
  avmDate: string | null;
  marketValue: number | null;
  assessedValue: number | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  taxAmount: number | null;
  taxYear: number | null;
  cached: boolean;
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

  /** Look up valuation for a parcel by BBL using ATTOM /allevents/detail */
  async lookupByBbl(
    bbl: string,
    organizationId: string,
    force = false,
  ): Promise<ValuationResult> {
    if (!this.apiKey) {
      throw new Error('ATTOM API is not configured on this server');
    }

    const parcel = await this.prisma.parcel.findUnique({ where: { bbl } });
    if (!parcel) {
      throw new Error(`Parcel not found: ${bbl}`);
    }

    // Return cached data if we already have valuation data (unless force refresh)
    if (!force && parcel.avmSyncedAt) {
      await this.recordOrgAccess(parcel.id, organizationId);
      return {
        avmValue: parcel.avmValue,
        avmHigh: parcel.avmHigh,
        avmLow: parcel.avmLow,
        avmConfidence: parcel.avmConfidence,
        avmDate: parcel.avmDate?.toISOString() ?? null,
        marketValue: parcel.marketValue,
        assessedValue: parcel.assessedValue,
        lastSalePrice: parcel.lastSalePrice,
        lastSaleDate: parcel.lastSaleDate?.toISOString() ?? null,
        taxAmount: parcel.taxAmount,
        taxYear: parcel.taxYear,
        cached: true,
      };
    }

    // Check org monthly quota
    const usage = await this.getOrgMonthlyUsage(organizationId);
    if (usage >= this.orgMonthlyLimit) {
      throw new Error(
        `Monthly valuation lookup limit reached. Used: ${usage}/${this.orgMonthlyLimit}. ` +
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

    // Call ATTOM /allevents/detail — returns assessment + AVM + sale in one call
    const url = new URL(`${this.baseUrl}/allevents/detail`);
    url.searchParams.set('address1', address1);
    url.searchParams.set('address2', address2);

    this.logger.log(`Fetching valuation for ${bbl}: ${address1}, ${address2}`);

    const response = await fetch(url.toString(), {
      headers: {
        apikey: this.apiKey,
        Accept: 'application/json',
      },
    });

    // ATTOM returns HTTP 400 with "SuccessWithoutResult" when no data exists
    if (!response.ok && response.status !== 400) {
      throw new Error(
        `ATTOM API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as AttomAllEventsResponse;

    if (
      !data.property?.length ||
      data.status?.code === 400 ||
      data.status?.msg === 'SuccessWithoutResult'
    ) {
      this.logger.warn(`No ATTOM data returned for ${bbl}`);
      await this.prisma.parcel.update({
        where: { bbl },
        data: { avmSyncedAt: new Date() },
      });
      await this.recordOrgAccess(parcel.id, organizationId);
      return {
        avmValue: null,
        avmHigh: null,
        avmLow: null,
        avmConfidence: null,
        avmDate: null,
        marketValue: null,
        assessedValue: null,
        lastSalePrice: null,
        lastSaleDate: null,
        taxAmount: null,
        taxYear: null,
        cached: false,
      };
    }

    const prop = data.property[0];

    // Extract AVM (only available for condos/SFR)
    const avmAmt = prop.avm?.amount;
    const hasAvm = avmAmt && avmAmt.value && avmAmt.value > 0;
    const avmDate = prop.avm?.eventDate ? new Date(prop.avm.eventDate) : null;

    // Extract assessment
    const market = prop.assessment?.market;
    const assessed = prop.assessment?.assessed;
    const tax = prop.assessment?.tax;

    // Extract last sale
    const sale = prop.sale;
    const saleDate = sale?.saleTransDate ? new Date(sale.saleTransDate) : null;

    const result: ValuationResult = {
      avmValue: hasAvm ? (avmAmt.value ?? null) : null,
      avmHigh: hasAvm ? (avmAmt.high ?? null) : null,
      avmLow: hasAvm ? (avmAmt.low ?? null) : null,
      avmConfidence: hasAvm ? (avmAmt.scr ?? null) : null,
      avmDate: avmDate?.toISOString() ?? null,
      marketValue: market?.mktttlvalue ?? null,
      assessedValue: assessed?.assdttlvalue ?? null,
      lastSalePrice: sale?.amount?.saleamt ?? null,
      lastSaleDate: saleDate?.toISOString() ?? null,
      taxAmount: tax?.taxamt ?? null,
      taxYear: tax?.taxyear ?? null,
      cached: false,
    };

    // Store on parcel
    await this.prisma.parcel.update({
      where: { bbl },
      data: {
        avmValue: result.avmValue,
        avmHigh: result.avmHigh,
        avmLow: result.avmLow,
        avmConfidence: result.avmConfidence,
        avmDate,
        marketValue: result.marketValue,
        assessedValue: result.assessedValue,
        lastSalePrice: result.lastSalePrice,
        lastSaleDate: saleDate,
        taxAmount: result.taxAmount,
        taxYear: result.taxYear,
        avmSyncedAt: new Date(),
      },
    });

    await this.recordOrgAccess(parcel.id, organizationId);

    const bestValue =
      result.avmValue ?? result.marketValue ?? result.assessedValue;
    this.logger.log(
      `Valuation stored for ${bbl}: best=$${bestValue?.toLocaleString() ?? 'N/A'}, ` +
        `market=$${result.marketValue?.toLocaleString() ?? 'N/A'}, ` +
        `lastSale=$${result.lastSalePrice?.toLocaleString() ?? 'N/A'}`,
    );

    return result;
  }

  /** Count how many valuation lookups an org has used this month */
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

  /** Get org usage info for frontend display */
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
