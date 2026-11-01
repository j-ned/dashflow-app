import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../storage/storage.module';
import { SalaryArchivesController } from './salary-archives.controller';
import { SalaryArchivesService } from './salary-archives.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [SalaryArchivesController],
  providers: [SalaryArchivesService],
})
export class SalaryArchivesModule {}
