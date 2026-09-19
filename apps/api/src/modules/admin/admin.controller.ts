import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { STRICT_THROTTLE } from '../../auth/throttle';
import { AdminService } from './admin.service';
import { listQuerySchema, sendNoticesSchema } from './dto/admin.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query() query: Record<string, unknown>) {
    const { search, page, pageSize } = parseBody(listQuerySchema, query);
    return this.admin.listUsers({
      search,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }

  /** Par motif de relance : comptes concernés et comptes encore dans le délai de 7 jours. */
  @Get('notices/summary')
  noticeSummary() {
    return this.admin.noticeSummary();
  }

  /** Envoi groupé (sans `userIds`) ou sélectif (avec). Les textes sont fixes, choisis par `reason`. */
  @Post('notices')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @Throttle(STRICT_THROTTLE)
  sendNotices(@CurrentUser() u: AuthUser, @Body() body: unknown) {
    const { reason, userIds } = parseBody(sendNoticesSchema, body);
    return this.admin.sendNotices(reason, userIds, u.id);
  }
}
