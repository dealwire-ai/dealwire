import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Proforma, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';

export interface FieldMapEntry {
  extractedField: string;
  sheet: string;
  cell: string;
  label: string;
}

export interface ProformaPatch {
  name?: string;
  isDefault?: boolean;
  isReady?: boolean;
  fieldMap?: FieldMapEntry[];
}

@Injectable()
export class ProformaService {
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

    return this.prisma.proforma.create({
      data: {
        organizationId: orgId,
        name,
        s3Key,
        fieldMap: [],
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
