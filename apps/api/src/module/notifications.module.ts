import { Module } from '@nestjs/common';
import { NotificationService } from '../service/notifications/notification.service';
import { EmailModule } from './email.module';

@Module({
  imports: [EmailModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
