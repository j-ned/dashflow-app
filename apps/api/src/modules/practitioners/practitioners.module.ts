import { Module } from '@nestjs/common';
import { PractitionersController } from './practitioners.controller';
import { PractitionersService } from './practitioners.service';
import { AuthModule } from '../../auth/auth.module';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule],
  controllers: [PractitionersController],
  providers: [provideClass(PractitionersService, DRIZZLE)],
})
export class PractitionersModule {}
