import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { createPatientSchema, createEncryptedPatientSchema } from './dto/patient.dto';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly svc: PatientsService) {}

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
      const { encryptedData } = parseBody(createEncryptedPatientSchema, body);
      return this.svc.create(u.id, { firstName: '', lastName: '', birthDate: '1970-01-01', encryptedData });
    }
    const d = parseBody(createPatientSchema, body);
    return this.svc.create(u.id, {
      firstName: d.firstName,
      lastName: d.lastName,
      birthDate: d.birthDate,
      color: d.color ?? null,
      notes: d.notes ?? null,
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
