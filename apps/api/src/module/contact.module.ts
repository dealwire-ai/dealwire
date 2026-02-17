import { Module } from '@nestjs/common';
import { ContactController } from '../controller/contact.controller';
import { PrismaModule } from './prisma.module';
import { PreferencesModule } from './preferences.module';
import { ClerkAuthGuard } from '../guard/clerk-auth.guard';

@Module({
  imports: [PrismaModule, PreferencesModule],
  controllers: [ContactController],
  providers: [ClerkAuthGuard],
})
export class ContactModule {}
