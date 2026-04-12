import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Proforma, Prisma } from '@prisma/client';
import { generateObject } from 'ai';
import { z } from 'zod';
import { proformaScanModel } from './model-config';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { excelToTextWithCellRefs } from './extractors/extraction-types';
import { trackLlm } from '../llm/tracked-llm';

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
      const rawText = excelToTextWithCellRefs(buffer);
      // Haiku limit is 200k tokens (~4 chars/token).
      // Input cells are almost always in the first few sheets, so truncation is safe.
      const MAX_CHARS = 190_000;
      const text =
        rawText.length > MAX_CHARS
          ? rawText.slice(0, MAX_CHARS) + '\n\n[... truncated for length ...]'
          : rawText;

      const { object } = await trackLlm('proforma_scan', () =>
        generateObject({
          model: proformaScanModel(),
          schema: ScannedFieldsSchema,
          system: `You are analyzing a real estate pro forma Excel template to identify input cells.

The spreadsheet is serialized as: CELLREF:"value" per cell, with (formula) marking computed cells.
Example: B6:"Name"  C6:"Northway at Fern Forest"  means C6 contains the property name input.

Your task: find all cells that are INPUTS (hard-coded values a user would change per deal), NOT formulas or outputs.
Cells marked (formula) are computed — never return them as inputs.

For each input cell, return:
- name: short plain-English label (e.g. "Purchase Price", "Cap Rate", "Total Units")
- description: one sentence describing what this value represents
- sheet: the Excel sheet name exactly as it appears
- cell: the cell address exactly as shown (e.g. "C6", "G9") — copy it verbatim from the serialized data

Focus on purchase terms, income assumptions, expense assumptions, financing parameters, and unit/property characteristics. Target 10-30 fields. Skip formula cells, headers, and labels.`,
          messages: [
            {
              role: 'user',
              content: `Here is the pro forma spreadsheet content:\n\n${text}\n\nIdentify all input cells (not formulas) and return them with plain-English names and descriptions. Copy cell addresses verbatim from the data above.`,
            },
          ],
        }),
      );

      this.logger.log(
        `[proforma] Scanned ${object.fields.length} input fields from template`,
      );
      return object.fields as FieldMapEntry[];
    } catch (err) {
      this.logger.error(
        '[proforma] Field scan failed, using empty fieldMap',
        err,
      );
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
    const existing = await this.prisma.proforma.count({
      where: { organizationId: orgId },
    });
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

  async update(
    orgId: string,
    id: string,
    patch: ProformaPatch,
  ): Promise<Proforma> {
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
      return this.prisma.proforma.findUnique({
        where: { id },
      }) as Promise<Proforma>;
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
