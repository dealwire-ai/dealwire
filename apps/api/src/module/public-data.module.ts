import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma.module';
import { NotificationsModule } from './notifications.module';
import { PublicDataController } from '../controller/public-data.controller';
import { SkipTraceWebhookController } from '../controller/skip-trace-webhook.controller';
import { ParcelCrmController } from '../controller/parcel-crm.controller';
import { SodaAdapter } from '../service/public-data/soda.adapter';
import { NycIngestionService } from '../service/public-data/nyc-ingestion.service';
import { DistressScoringService } from '../service/public-data/distress-scoring.service';
import { ParcelQueryService } from '../service/public-data/parcel-query.service';
import { SkipTraceService } from '../service/public-data/skip-trace.service';
import { NyctlQuarterlyService } from '../service/public-data/nyctl-quarterly.service';
import { CareScraperService } from '../service/public-data/care-scraper.service';
import { PhoneNoteService } from '../service/public-data/phone-note.service';
import { PropertyListService } from '../service/public-data/property-list.service';
import { PublicDataSchedulerService } from '../service/public-data/public-data-scheduler.service';
import { AttomAvmService } from '../service/public-data/attom-avm.service';
import { ParcelDealStageService } from '../service/public-data/parcel-deal-stage.service';
import { ParcelDealService } from '../service/public-data/parcel-deal.service';
import { ParcelActivityService } from '../service/public-data/parcel-activity.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [PrismaModule, NotificationsModule, ScheduleModule],
  controllers: [
    PublicDataController,
    SkipTraceWebhookController,
    ParcelCrmController,
  ],
  providers: [
    SodaAdapter,
    NycIngestionService,
    DistressScoringService,
    ParcelQueryService,
    SkipTraceService,
    NyctlQuarterlyService,
    CareScraperService,
    PhoneNoteService,
    PropertyListService,
    ParcelDealStageService,
    ParcelDealService,
    ParcelActivityService,
    PublicDataSchedulerService,
    AttomAvmService,
    ClerkAuthGuard,
  ],
  exports: [
    ParcelQueryService,
    PropertyListService,
    PhoneNoteService,
    ParcelDealStageService,
    ParcelDealService,
    ParcelActivityService,
  ],
})
export class PublicDataModule {}
