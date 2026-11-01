import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { EnvelopesController } from './envelopes.controller';
import { EnvelopesService } from './envelopes.service';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule],
  controllers: [EnvelopesController],
  providers: [provideClass(EnvelopesService, DRIZZLE)],
})
export class EnvelopesModule {}
