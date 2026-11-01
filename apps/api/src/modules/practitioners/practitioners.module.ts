import { Module } from '@nestjs/common';
import { PractitionersController } from './practitioners.controller';
import { PractitionersService } from './practitioners.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PractitionersController],
  providers: [PractitionersService],
})
export class PractitionersModule {}
