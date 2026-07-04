import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SharedAccessService } from './shared-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { createSharedAccessSchema } from './dto/shared-access.dto';

@UseGuards(JwtAuthGuard)
@Controller('shared-access')
export class SharedAccessController {
  constructor(private readonly svc: SharedAccessService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }

  @UseGuards(CsrfGuard)
  @Post()
  @HttpCode(201)
  create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    const dto = parseBody(createSharedAccessSchema, body);
    return this.svc.create(u.id, dto.invitedEmail);
  }

  @UseGuards(CsrfGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.svc.remove(u.id, id);
  }
}
