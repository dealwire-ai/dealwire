import { Module } from '@nestjs/common';
import { UnderwritingListenerService } from '../service/underwriting/underwriting-listener.service';
import { UnderwritingPipelineService } from '../service/underwriting/underwriting-pipeline.service';
import { PrismaModule } from './prisma.module';
import { S3Module } from './s3.module';

@Module({
  imports: [PrismaModule, S3Module],
  providers: [UnderwritingListenerService, UnderwritingPipelineService],
  exports: [UnderwritingPipelineService],
})
export class UnderwritingModule {}
