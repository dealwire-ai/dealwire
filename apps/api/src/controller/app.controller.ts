import { Controller, Get, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from '../service/app.service';
import { DealDigestService } from '../service/deal/deal-digest.service';
import { PrismaService } from '../service/prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dealDigestService: DealDigestService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health(@Res() res: Response): void {
    // Plain text response - more reliable for healthchecks
    res.status(200).send('ok');
  }

  /** DEV ONLY — trigger digest immediately, bypassing schedule check */
  @Post('dev/trigger-digest')
  async triggerDigest(@Query('orgId') orgId?: string) {
    let targetOrgId = orgId;
    if (!targetOrgId) {
      const org = await this.prisma.organization.findFirst({ select: { id: true } });
      if (!org) return { ok: false, error: 'No organizations found' };
      targetOrgId = org.id;
    }
    await this.dealDigestService.sendDigestForOrganization(targetOrgId);
    return { ok: true, orgId: targetOrgId };
  }
}

