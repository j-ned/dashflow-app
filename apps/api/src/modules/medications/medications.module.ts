import { Module } from '@nestjs/common';
import { MedicationsController } from './medications.controller';
import { MedicationsService } from './medications.service';
import { AuthModule } from '../../auth/auth.module';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule],
  controllers: [MedicationsController],
  providers: [provideClass(MedicationsService, DRIZZLE)],
})
export class MedicationsModule {}
