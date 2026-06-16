import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { parseBody } from '../../common/parse-body';
import { AdminService } from './admin.service';
import { listQuerySchema } from './dto/admin.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query() query: Record<string, unknown>) {
    const { search, page, pageSize } = parseBody(listQuerySchema, query);
    return this.admin.listUsers({ search, limit: pageSize, offset: (page - 1) * pageSize });
  }
}
