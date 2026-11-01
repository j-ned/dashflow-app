import { Module } from '@nestjs/common';
import { DemoService } from './demo.service';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';
import { ENV } from '../../config/env.token';

@Module({
  providers: [provideClass(DemoService, DRIZZLE, ENV)],
  exports: [DemoService],
})
export class DemoModule {}
