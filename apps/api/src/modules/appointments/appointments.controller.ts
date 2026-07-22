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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createAppointmentSchema,
  createEncryptedAppointmentSchema,
  updateAppointmentSchema,
  updateEncryptedAppointmentSchema,
  updateAppointmentStatusSchema,
} from './dto/appointment.dto';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: AppointmentsService) {
    super();
  }

  protected toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, patientId, practitionerId } = parseBody(
        createEncryptedAppointmentSchema,
        body,
      );
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

  protected toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const d = parseBody(updateEncryptedAppointmentSchema, body);
      const patch: Record<string, unknown> = { encryptedData: d.encryptedData };
      if (d.patientId !== undefined) patch.patientId = d.patientId;
      if (d.practitionerId !== undefined)
        patch.practitionerId = d.practitionerId;
      return patch;
    }
    const d = parseBody(updateAppointmentSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.patientId !== undefined) patch.patientId = d.patientId;
    if (d.practitionerId !== undefined) patch.practitionerId = d.practitionerId;
    if (d.date !== undefined) patch.date = d.date;
    if (d.time !== undefined) patch.time = d.time;
    if (d.status !== undefined) patch.status = d.status;
    if (d.reason !== undefined) patch.reason = d.reason;
    if (d.outcome !== undefined) patch.outcome = d.outcome;
    return patch;
  }

  @UseGuards(CsrfGuard)
  @Patch(':id/status')
  async setStatus(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const { status } = parseBody(updateAppointmentStatusSchema, body);
    const row = await this.svc.setStatus(u.id, id, status);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }
}
