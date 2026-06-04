import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createAppointmentSchema,
  createEncryptedAppointmentSchema,
  updateAppointmentStatusSchema,
} from './dto/appointment.dto';

@Controller('appointments')
export class AppointmentsController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: AppointmentsService) {
    super();
  }

  protected toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, patientId, practitionerId } = parseBody(createEncryptedAppointmentSchema, body);
      return {
        patientId,
        practitionerId,
        date: '1970-01-01',
        time: '00:00',
        encryptedData,
      };
    }
    const d = parseBody(createAppointmentSchema, body);
    return {
      patientId: d.patientId,
      practitionerId: d.practitionerId,
      date: d.date,
      time: d.time,
      status: d.status ?? 'scheduled',
      reason: d.reason ?? null,
      outcome: d.outcome ?? null,
    };
  }

  protected toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const patch: Record<string, unknown> = { encryptedData: body.encryptedData };
      if (body.patientId !== undefined) patch.patientId = body.patientId;
      if (body.practitionerId !== undefined) patch.practitionerId = body.practitionerId;
      return patch;
    }
    const { id: _i, userId: _u, ...rest } = body;
    return rest;
  }

  @UseGuards(CsrfGuard) @Patch(':id/status')
  async setStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const { status } = parseBody(updateAppointmentStatusSchema, body);
    const row = await this.svc.setStatus(u.id, id, status);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }
}
