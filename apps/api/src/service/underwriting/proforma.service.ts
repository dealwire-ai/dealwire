import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Proforma, Prisma } from '@prisma/client';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { excelToText } from './extraction-types';

export interface FieldMapEntry {
  name: string;
  description: string;
  sheet: string;
  cell: string;
}

export interface ProformaPatch {
  name?: string;
  isDefault?: boolean;
  isReady?: boolean;
  fieldMap?: FieldMapEntry[];
}

const ScannedFieldSchema = z.object({
  name: z.string(),
  description: z.string(),
  sheet: z.string(),
  cell: z.string(),
});

const ScannedFieldsSchema = z.object({
  fields: z.array(ScannedFieldSchema),
});

@Injectable()
export class ProformaService {
  private readonly logger = new Logger(ProformaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  list(orgId: string): Promise<Proforma[]> {
    return this.prisma.proforma.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async scanProformaFields(buffer: Buffer): Promise<FieldMapEntry[]> {
    try {
      const text = excelToText(buffer);

      const { object } = await generateObject({
        model: anthropic('claude-haiku-4-5-20251001'),
        schema: ScannedFieldsSchema,
        system: `You are analyzing a real estate pro forma Excel template to identify input cells.

Your task: find all cells that are INPUTS (hard-coded values users enter), NOT formulas or outputs.

For each input cell, return:
- name: short plain-English label (e.g. "Purchase Price", "Cap Rate", "Total Units")
- description: one sentence describing what this value represents
- sheet: the Excel sheet name exactly as it appears
- cell: the cell address (e.g. "B5", "C12")

Focus on purchase terms, income assumptions, expense assumptions, financing parameters, and unit/property characteristics. Target 10-30 fields. Skip formula cells, headers, and labels.`,
        messages: [
          {
            role: 'user',
            content: `Here is the pro forma spreadsheet content:\n\n${text}\n\nIdentify all input cells (not formulas) and return them with plain-English names and descriptions.`,
          },
        ],
      });

      this.logger.log(`[proforma] Scanned ${object.fields.length} input fields from template`);
      return object.fields;
    } catch (err) {
      this.logger.error('[proforma] Field scan failed, using empty fieldMap', err);
      return [];
    }
  }

  async create(
    orgId: string,
    name: string,
    buffer: Buffer,
    filename: string,
  ): Promise<Proforma> {
    const s3Key = await this.s3.uploadProformaTemplate(buffer, filename, orgId);

    // Auto-set isDefault for the org's first proforma
    const existing = await this.prisma.proforma.count({ where: { organizationId: orgId } });
    const isDefault = existing === 0;

    // AI-scan the template to discover input cells
    const fieldMap = await this.scanProformaFields(buffer);

    return this.prisma.proforma.create({
      data: {
        organizationId: orgId,
        name,
        s3Key,
        fieldMap: fieldMap as unknown as Prisma.InputJsonValue,
        isDefault,
        isReady: false,
      },
    });
  }

  async update(orgId: string, id: string, patch: ProformaPatch): Promise<Proforma> {
    const existing = await this.prisma.proforma.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Proforma not found');
    if (existing.organizationId !== orgId) throw new ForbiddenException();

    if (patch.isDefault === true) {
      // Clear isDefault on all other org proformas first, then update target
      await this.prisma.$transaction([
        this.prisma.proforma.updateMany({
          where: { organizationId: orgId, id: { not: id } },
          data: { isDefault: false },
        }),
        this.prisma.proforma.update({
          where: { id },
          data: {
            ...(patch.name !== undefined && { name: patch.name }),
            isDefault: true,
            ...(patch.isReady !== undefined && { isReady: patch.isReady }),
            ...(patch.fieldMap !== undefined && {
              fieldMap: patch.fieldMap as unknown as Prisma.InputJsonValue,
            }),
          },
        }),
      ]);
      return this.prisma.proforma.findUnique({ where: { id } }) as Promise<Proforma>;
    }

    return this.prisma.proforma.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.isDefault !== undefined && { isDefault: patch.isDefault }),
        ...(patch.isReady !== undefined && { isReady: patch.isReady }),
        ...(patch.fieldMap !== undefined && {
          fieldMap: patch.fieldMap as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async remove(orgId: string, id: string): Promise<void> {
    const existing = await this.prisma.proforma.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Proforma not found');
    if (existing.organizationId !== orgId) throw new ForbiddenException();
    await this.prisma.proforma.delete({ where: { id } });
  }
}
