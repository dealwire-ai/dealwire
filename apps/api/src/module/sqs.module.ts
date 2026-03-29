import { Module } from '@nestjs/common';
import { SQSService } from '../service/sqs/sqs.service';

@Module({
  providers: [SQSService],
  exports: [SQSService],
})
export class SqsModule {}
