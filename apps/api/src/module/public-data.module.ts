import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { PublicDataController } from '../controller/public-data.controller';
import { SodaAdapter } from '../service/public-data/soda.adapter';
import { NycIngestionService } from '../service/public-data/nyc-ingestion.service';
import { DistressScoringService } from '../service/public-data/distress-scoring.service';
import { ParcelQueryService } from '../service/public-data/parcel-query.service';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [PublicDataController],
  providers: [
    SodaAdapter,
    NycIngestionService,
    DistressScoringService,
    ParcelQueryService,
    ClerkAuthGuard,
  ],
  exports: [ParcelQueryService],
})
export class PublicDataModule {}
