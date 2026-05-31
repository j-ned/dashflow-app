import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AuthModule } from '../../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [AppointmentsController], providers: [AppointmentsService] })
export class AppointmentsModule {}
