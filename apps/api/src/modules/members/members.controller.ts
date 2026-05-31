import { Body, Controller, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { updateMemberColorSchema } from './dto/member.dto';

@UseGuards(JwtAuthGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly svc: MembersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  @UseGuards(CsrfGuard) @Patch(':id/color')
  async color(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const { color } = parseBody(updateMemberColorSchema, body);
    const row = await this.svc.updateColor(u.id, id, color);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }
}
