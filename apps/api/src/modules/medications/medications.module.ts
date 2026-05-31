import { Module } from '@nestjs/common';
import { MedicationsController } from './medications.controller';
import { MedicationsService } from './medications.service';
import { AuthModule } from '../../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [MedicationsController], providers: [MedicationsService] })
export class MedicationsModule {}
