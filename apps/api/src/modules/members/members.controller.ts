import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { updateMemberColorSchema, createMemberSchema, updateMemberSchema, encryptedMemberSchema } from './dto/member.dto';

@UseGuards(JwtAuthGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly svc: MembersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(encryptedMemberSchema, body);
      return this.svc.create(u.id, { encryptedData });
    }
    const d = parseBody(createMemberSchema, body);
    return this.svc.create(u.id, { firstName: d.firstName, lastName: d.lastName ?? '', color: d.color ?? null });
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      patch = { encryptedData: body.encryptedData };
    } else {
      const d = parseBody(updateMemberSchema, body);
      patch = { firstName: d.firstName, lastName: d.lastName ?? '', color: d.color ?? null };
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { await this.svc.remove(u.id, id); }

  @UseGuards(CsrfGuard) @Patch(':id/color')
  async color(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const { color } = parseBody(updateMemberColorSchema, body);
    const row = await this.svc.updateColor(u.id, id, color);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }
}
