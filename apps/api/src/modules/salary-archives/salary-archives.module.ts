import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../storage/storage.module';
import { SalaryArchivesController } from './salary-archives.controller';
import { SalaryArchivesService } from './salary-archives.service';
import { StorageService } from '../../storage/storage.service';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [SalaryArchivesController],
  providers: [provideClass(SalaryArchivesService, DRIZZLE, StorageService)],
})
export class SalaryArchivesModule {}
