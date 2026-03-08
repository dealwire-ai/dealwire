import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { NotificationsModule } from './notifications.module';
import { PublicDataController } from '../controller/public-data.controller';
import { SodaAdapter } from '../service/public-data/soda.adapter';
import { NycIngestionService } from '../service/public-data/nyc-ingestion.service';
import { DistressScoringService } from '../service/public-data/distress-scoring.service';
import { ParcelQueryService } from '../service/public-data/parcel-query.service';
import { SkipTraceService } from '../service/public-data/skip-trace.service';
import { NyctlQuarterlyService } from '../service/public-data/nyctl-quarterly.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PublicDataController],
  providers: [
    SodaAdapter,
    NycIngestionService,
    DistressScoringService,
    ParcelQueryService,
    SkipTraceService,
    NyctlQuarterlyService,
    ClerkAuthGuard,
  ],
  exports: [ParcelQueryService],
})
export class PublicDataModule {}
