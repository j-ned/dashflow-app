import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createAppointmentSchema,
  createEncryptedAppointmentSchema,
  updateAppointmentStatusSchema,
} from './dto/appointment.dto';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly svc: AppointmentsService) {}

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
      const { encryptedData, patientId, practitionerId } = parseBody(createEncryptedAppointmentSchema, body);
      return this.svc.create(u.id, {
        patientId,
        practitionerId,
        date: '1970-01-01',
        time: '00:00',
        encryptedData,
      });
    }
    const d = parseBody(createAppointmentSchema, body);
    return this.svc.create(u.id, {
      patientId: d.patientId,
      practitionerId: d.practitionerId,
      date: d.date,
      time: d.time,
      status: d.status ?? 'scheduled',
      reason: d.reason ?? null,
      outcome: d.outcome ?? null,
    });
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      patch = { encryptedData: body.encryptedData };
      if (body.patientId !== undefined) patch.patientId = body.patientId;
      if (body.practitionerId !== undefined) patch.practitionerId = body.practitionerId;
    } else {
      const { id: _i, userId: _u, ...rest } = body;
      patch = rest;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Patch(':id/status')
  async setStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const { status } = parseBody(updateAppointmentStatusSchema, body);
    const row = await this.svc.setStatus(u.id, id, status);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { await this.svc.remove(u.id, id); }
}
