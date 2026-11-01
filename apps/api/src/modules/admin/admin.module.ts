import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';
import { MAILER } from '../../mail/mailer';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [
    provideClass(AdminService, AdminRepository, MAILER),
    provideClass(AdminRepository, DRIZZLE),
  ],
  exports: [AdminService],
})
export class AdminModule {}
