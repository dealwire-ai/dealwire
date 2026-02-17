import { Module } from '@nestjs/common';
import { NotificationService } from '../service/notifications/notification.service';
import { EmailServicesModule } from './email.module';

@Module({
  imports: [EmailServicesModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
