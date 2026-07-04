import { Module } from '@nestjs/common';
import { ConsumablesController } from './consumables.controller';
import { ConsumablesService } from './consumables.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ConsumablesController],
  providers: [ConsumablesService],
})
export class ConsumablesModule {}
