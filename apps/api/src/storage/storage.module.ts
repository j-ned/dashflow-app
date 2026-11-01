import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { provideClass } from '../common/nest/provide-class';
import { ENV } from '../config/env.token';

@Global()
@Module({
  providers: [provideClass(StorageService, ENV)],
  exports: [StorageService],
})
export class StorageModule {}
