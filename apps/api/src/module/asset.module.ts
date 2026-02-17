import { Module } from '@nestjs/common';
import { AssetController } from '../controller/asset.controller';
import { PrismaModule } from './prisma.module';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AssetController],
  providers: [ClerkAuthGuard],
})
export class AssetModule {}
