import { Module } from '@nestjs/common';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { AuthModule } from '../../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [PrescriptionsController], providers: [PrescriptionsService] })
export class PrescriptionsModule {}
