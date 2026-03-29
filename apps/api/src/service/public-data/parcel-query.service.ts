import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Building class group definitions for grouped filtering.
 * Groups per Daniel's 3/4 feedback. D class excluded entirely.
 */
const BUILDING_CLASS_GROUP_PREFIXES: Record<string, string[]> = {
  residential: ['A', 'B', 'C'], // C1-C7 excluded (they're in walkup)
  commercial: [
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  ],
  walkup: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'],
};

// Walk-up codes that overlap with residential 'C' prefix
const WALKUP_CODES = new Set([
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'C8',
  'C9',
  'CC',
]);

export interface ParcelQueryFilters {
  boroughs?: string[];
  excludeCoops?: boolean;
  excludeDClass?: boolean;
  hasActiveLien?: boolean;
  minDistressScore?: number;
  maxDistressScore?: number;
  minUnits?: number;
  maxUnits?: number;
  minOutstandingTaxBill?: number;
  maxOutstandingTaxBill?: number;
  minLienSaleAmount?: number;
  maxLienSaleAmount?: number;
  zipCode?: string;
  search?: string;
  buildingClasses?: string[];
  buildingClassGroups?: string[];
  listType?: string;
  hasNoList?: boolean;
  organizationId?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

@Injectable()
export class ParcelQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build Prisma where clause from query filters.
   */
  private buildWhere(filters: ParcelQueryFilters): Prisma.ParcelWhereInput {
    const where: Prisma.ParcelWhereInput = {};

    if (filters.boroughs && filters.boroughs.length > 0) {
      where.borough = { in: filters.boroughs };
    }

    if (filters.excludeCoops) {
      where.isCoopExcluded = false;
    }

    if (filters.hasActiveLien !== undefined) {
      where.hasActiveLien = filters.hasActiveLien;
    }

    if (
      filters.minDistressScore !== undefined ||
      filters.maxDistressScore !== undefined
    ) {
      where.distressScore = {};
      if (filters.minDistressScore !== undefined) {
        (where.distressScore as Prisma.IntNullableFilter).gte =
          filters.minDistressScore;
      }
      if (filters.maxDistressScore !== undefined) {
        (where.distressScore as Prisma.IntNullableFilter).lte =
          filters.maxDistressScore;
      }
    }

    if (filters.minUnits !== undefined || filters.maxUnits !== undefined) {
      where.unitsTotal = {};
      if (filters.minUnits !== undefined) {
        (where.unitsTotal as Prisma.IntNullableFilter).gte = filters.minUnits;
      }
      if (filters.maxUnits !== undefined) {
        (where.unitsTotal as Prisma.IntNullableFilter).lte = filters.maxUnits;
      }
    }

    if (
      filters.minOutstandingTaxBill !== undefined ||
      filters.maxOutstandingTaxBill !== undefined
    ) {
      where.outstandingTaxBill = {};
      if (filters.minOutstandingTaxBill !== undefined) {
        (where.outstandingTaxBill as Prisma.IntNullableFilter).gte =
          filters.minOutstandingTaxBill;
      }
      if (filters.maxOutstandingTaxBill !== undefined) {
        (where.outstandingTaxBill as Prisma.IntNullableFilter).lte =
          filters.maxOutstandingTaxBill;
      }
    }

    if (
      filters.minLienSaleAmount !== undefined ||
      filters.maxLienSaleAmount !== undefined
    ) {
      where.lienSaleAmount = {};
      if (filters.minLienSaleAmount !== undefined) {
        (where.lienSaleAmount as Prisma.IntNullableFilter).gte =
          filters.minLienSaleAmount;
      }
      if (filters.maxLienSaleAmount !== undefined) {
        (where.lienSaleAmount as Prisma.IntNullableFilter).lte =
          filters.maxLienSaleAmount;
      }
    }

    if (filters.zipCode) {
      where.zipCode = filters.zipCode;
    }

    // Building class filtering: groups take precedence over individual classes
    if (filters.buildingClassGroups && filters.buildingClassGroups.length > 0) {
      const prefixes: string[] = [];
      for (const groupId of filters.buildingClassGroups) {
        const groupPrefixes = BUILDING_CLASS_GROUP_PREFIXES[groupId];
        if (groupPrefixes) prefixes.push(...groupPrefixes);
      }
      if (prefixes.length > 0) {
        // For groups with single-char prefixes (A, B, C, etc.), use startsWith.
        // For walkup codes (C1-C7), use exact prefix match.
        // Handle the residential/walkup overlap: if residential is selected but
        // walkup is not, exclude C1-C7+ from the C prefix matches.
        const hasResidential =
          filters.buildingClassGroups.includes('residential');
        const hasWalkup = filters.buildingClassGroups.includes('walkup');

        const conditions: any[] = prefixes.map((p) => ({
          buildingClass: { startsWith: p },
        }));

        where.AND = [...((where.AND as any[]) || []), { OR: conditions }];

        // If residential selected without walkup, exclude C1-C7 etc.
        if (hasResidential && !hasWalkup) {
          where.AND.push({
            NOT: {
              buildingClass: { in: Array.from(WALKUP_CODES) },
            },
          });
        }
      }
    } else if (filters.buildingClasses && filters.buildingClasses.length > 0) {
      where.buildingClass = { in: filters.buildingClasses };
    }

    // Exclude D class by default (elevator apartments, mostly coops)
    if (filters.excludeDClass !== false) {
      where.AND = [
        ...((where.AND as any[]) || []),
        { NOT: { buildingClass: { startsWith: 'D' } } },
      ];
    }

    if (filters.search) {
      where.OR = [
        { address: { contains: filters.search, mode: 'insensitive' } },
        { bbl: { contains: filters.search } },
        { ownerName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // List type filtering (requires organizationId)
    if (filters.organizationId) {
      if (filters.listType) {
        where.listAssignments = {
          some: {
            organizationId: filters.organizationId,
            listType: filters.listType as any,
          },
        };
      } else if (filters.hasNoList) {
        where.listAssignments = {
          none: { organizationId: filters.organizationId },
        };
      }
    }

    return where;
  }

  /**
   * Build Prisma orderBy from sort field + direction.
   */
  private buildOrderBy(
    sort?: string,
    order?: 'asc' | 'desc',
  ): Prisma.ParcelOrderByWithRelationInput {
    const dir = order || 'desc';
    const sortField = sort || 'distressScore';

    const validSortFields = [
      'distressScore',
      'address',
      'borough',
      'buildingClass',
      'unitsTotal',
      'buildingArea',
      'estimatedMarketValue',
      'yearBuilt',
      'violationsOpen',
      'violationsPerUnit',
      'violationsClassC',
      'hasActiveLien',
      'ownerName',
      'outstandingTaxBill',
      'totalOutstandingBalance',
      'lienSaleAmount',
      'lienRedemptiveValue',
      'createdAt',
      'updatedAt',
    ];

    if (validSortFields.includes(sortField)) {
      return { [sortField]: { sort: dir, nulls: 'last' } };
    }

    return { distressScore: { sort: 'desc', nulls: 'last' } };
  }

  /**
   * Query parcels with filters, pagination, and sorting.
   */
  async queryParcels(filters: ParcelQueryFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where = this.buildWhere(filters);
    const orderBy = this.buildOrderBy(filters.sort, filters.order);

    const includeRelations = filters.organizationId
      ? {
          listAssignments: {
            where: { organizationId: filters.organizationId },
            select: { listType: true },
            take: 1,
          },
          orgSkipTraces: {
            where: { organizationId: filters.organizationId },
            select: { id: true },
            take: 1,
          },
        }
      : undefined;

    const [data, total] = await Promise.all([
      this.prisma.parcel.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        ...(includeRelations && { include: includeRelations }),
      }),
      this.prisma.parcel.count({ where }),
    ]);

    // Flatten relations and strip phone data for orgs that haven't traced
    const flatData = filters.organizationId
      ? data.map((p) => {
          const record = p as typeof p & {
            listAssignments?: { listType: string }[];
            orgSkipTraces?: { id: string }[];
          };
          const _listType = record.listAssignments?.[0]?.listType ?? null;
          const hasOrgAccess = (record.orgSkipTraces?.length ?? 0) > 0;

          // Strip contact data if org hasn't skip traced this parcel
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { listAssignments, orgSkipTraces, ...rest } = record;
          return {
            ...rest,
            _listType,
            ownerPhones: hasOrgAccess ? rest.ownerPhones : null,
            ownerEmails: hasOrgAccess ? rest.ownerEmails : null,
            skipTraceStatus: hasOrgAccess ? rest.skipTraceStatus : null,
            skipTracedAt: hasOrgAccess ? rest.skipTracedAt : null,
          };
        })
      : data;

    return {
      data: flatData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single parcel by BBL.
   */
  async getParcelByBbl(bbl: string, organizationId?: string) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { bbl },
      ...(organizationId && {
        include: {
          orgSkipTraces: {
            where: { organizationId },
            select: { id: true },
            take: 1,
          },
        },
      }),
    });

    if (!parcel) return null;

    // Strip contact data if org hasn't traced this parcel
    if (organizationId) {
      const record = parcel as typeof parcel & {
        orgSkipTraces?: { id: string }[];
      };
      const hasAccess = (record.orgSkipTraces?.length ?? 0) > 0;
      if (!hasAccess) {
        return {
          ...parcel,
          ownerPhones: null,
          ownerEmails: null,
          skipTraceStatus: null,
          skipTracedAt: null,
        };
      }
    }

    return parcel;
  }

  /**
   * Get aggregate stats across parcels.
   */
  async getStats(filters: ParcelQueryFilters = {}) {
    const where = this.buildWhere(filters);

    const [
      total,
      withLiens,
      avgScore,
      byBorough,
      debtSum,
      withPlutoData,
      withViolations,
      withTaxBills,
      withNyctlData,
      withSkipTrace,
      withCompleteData,
    ] = await Promise.all([
      this.prisma.parcel.count({ where }),
      this.prisma.parcel.count({ where: { ...where, hasActiveLien: true } }),
      this.prisma.parcel.aggregate({
        where,
        _avg: { distressScore: true },
      }),
      this.prisma.parcel.groupBy({
        by: ['borough'],
        where,
        _count: true,
        _avg: { distressScore: true },
      }),
      this.prisma.parcel.aggregate({
        where,
        _sum: { totalOutstandingBalance: true },
      }),
      this.prisma.parcel.count({
        where: { ...where, buildingClass: { not: null } },
      }),
      this.prisma.parcel.count({
        where: { ...where, violationsSyncedAt: { not: null } },
      }),
      this.prisma.parcel.count({
        where: { ...where, outstandingTaxBill: { not: null } },
      }),
      this.prisma.parcel.count({
        where: { ...where, lienSaleAmount: { not: null } },
      }),
      this.prisma.parcel.count({
        where: { ...where, skipTraceStatus: 'found' },
      }),
      this.prisma.parcel.count({
        where: {
          ...where,
          skipTraceStatus: 'found',
          lienSaleAmount: { not: null },
          violationsSyncedAt: { not: null },
        },
      }),
    ]);

    return {
      total,
      withActiveLiens: withLiens,
      avgDistressScore:
        Math.round((avgScore._avg.distressScore || 0) * 10) / 10,
      byBorough: byBorough.map((g) => ({
        borough: g.borough,
        count: g._count,
        avgScore: Math.round((g._avg.distressScore || 0) * 10) / 10,
      })),
      totalOutstandingDebt: debtSum._sum.totalOutstandingBalance || 0,
      withPlutoData,
      withViolations,
      withTaxBills,
      withNyctlData,
      withSkipTrace,
      withCompleteData,
    };
  }

  /**
   * Stream all matching parcels for CSV export.
   */
  async getAllForExport(filters: ParcelQueryFilters) {
    const where = this.buildWhere(filters);
    const orderBy = this.buildOrderBy(filters.sort, filters.order);

    return this.prisma.parcel.findMany({
      where,
      orderBy,
    });
  }
}
