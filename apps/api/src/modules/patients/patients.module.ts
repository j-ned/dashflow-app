import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../storage/storage.module';
import { StorageService } from '../../storage/storage.service';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [PatientsController],
  providers: [provideClass(PatientsService, DRIZZLE, StorageService)],
})
export class PatientsModule {}
