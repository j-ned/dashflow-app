import { Module } from '@nestjs/common';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
})
export class PrescriptionsModule {}
