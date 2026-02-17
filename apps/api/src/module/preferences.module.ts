import { Module } from '@nestjs/common';
import { ScreeningPreferencesService } from '../service/preferences/screening-preferences.service';
import { ScreeningBucketService } from '../service/preferences/screening-bucket.service';
import { BrokerIntelligenceService } from '../service/deal/broker-intelligence.service';
import { ScreeningPreferencesController } from '../controller/screening-preferences.controller';
import { ScreeningBucketController } from '../controller/screening-bucket.controller';
import { PrismaModule } from './prisma.module';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ScreeningPreferencesController, ScreeningBucketController],
  providers: [ScreeningPreferencesService, ScreeningBucketService, BrokerIntelligenceService, ClerkAuthGuard],
  exports: [ScreeningPreferencesService, ScreeningBucketService, BrokerIntelligenceService],
})
export class PreferencesModule {}
