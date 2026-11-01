import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
