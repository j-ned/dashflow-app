import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AuthModule } from '../../auth/auth.module';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule],
  controllers: [AppointmentsController],
  providers: [provideClass(AppointmentsService, DRIZZLE)],
})
export class AppointmentsModule {}
