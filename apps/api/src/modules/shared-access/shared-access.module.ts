import { Module } from '@nestjs/common';
import { SharedAccessController } from './shared-access.controller';
import { SharedAccessService } from './shared-access.service';
import { AuthModule } from '../../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [SharedAccessController], providers: [SharedAccessService] })
export class SharedAccessModule {}
