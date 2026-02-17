import { Module } from '@nestjs/common';
import { DealController } from '../controller/deal.controller';
import { PrismaModule } from './prisma.module';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [DealController],
  providers: [ClerkAuthGuard],
})
export class DealModule {}
