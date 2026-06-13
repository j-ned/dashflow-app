import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { parseBody } from '../../common/parse-body';
import { AdminService } from './admin.service';
import { listQuerySchema, overridePlanSchema } from './dto/admin.dto';

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

  @Get('metrics')
  metrics() {
    return this.admin.metrics();
  }

  @UseGuards(CsrfGuard)
  @Patch('users/:id/plan')
  async override(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const { planKey } = parseBody(overridePlanSchema, body);
    await this.admin.overridePlan(id, planKey);
    return { ok: true };
  }
}
