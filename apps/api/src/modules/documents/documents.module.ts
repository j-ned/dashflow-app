import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
