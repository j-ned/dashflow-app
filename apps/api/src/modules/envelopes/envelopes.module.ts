import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { EnvelopesController } from './envelopes.controller';
import { EnvelopesService } from './envelopes.service';

@Module({ imports: [AuthModule], controllers: [EnvelopesController], providers: [EnvelopesService] })
export class EnvelopesModule {}
