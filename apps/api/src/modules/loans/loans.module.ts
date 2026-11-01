import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule],
  controllers: [LoansController],
  providers: [provideClass(LoansService, DRIZZLE)],
})
export class LoansModule {}
