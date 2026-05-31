import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PractitionersService } from './practitioners.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { createPractitionerSchema, createEncryptedPractitionerSchema } from './dto/practitioner.dto';

@UseGuards(JwtAuthGuard)
@Controller('practitioners')
export class PractitionersController {
  constructor(private readonly svc: PractitionersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(createEncryptedPractitionerSchema, body);
      return this.svc.create(u.id, { name: '', type: 'autre', encryptedData });
    }
    const d = parseBody(createPractitionerSchema, body);
    return this.svc.create(u.id, {
      name: d.name,
      type: d.type,
      phone: d.phone ?? null,
      email: d.email ?? null,
      address: d.address ?? null,
      bookingUrl: d.bookingUrl ?? null,
    });
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const patch = body.encryptedData
      ? { encryptedData: body.encryptedData }
      : (({ id: _i, userId: _u, createdAt: _c, ...rest }) => rest)(body);
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { await this.svc.remove(u.id, id); }
}
