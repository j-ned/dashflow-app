import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { createPrescriptionSchema, createEncryptedPrescriptionSchema } from './dto/prescription.dto';

@UseGuards(JwtAuthGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly svc: PrescriptionsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  // Static route must come before /:id to avoid param capture
  @Get('by-appointment/:appointmentId')
  byAppointment(@CurrentUser() u: AuthUser, @Param('appointmentId') appointmentId: string) {
    return this.svc.byAppointment(u.id, appointmentId);
  }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData, appointmentId, practitionerId, patientId } = parseBody(createEncryptedPrescriptionSchema, body);
      return this.svc.create(u.id, {
        appointmentId: appointmentId ?? null,
        practitionerId: practitionerId ?? null,
        patientId,
        issuedDate: '1970-01-01',
        encryptedData,
      });
    }
    const d = parseBody(createPrescriptionSchema, body);
    return this.svc.create(u.id, {
      appointmentId: d.appointmentId ?? null,
      practitionerId: d.practitionerId ?? null,
      patientId: d.patientId,
      issuedDate: d.issuedDate,
      validUntil: d.validUntil ?? null,
      documentUrl: d.documentUrl ?? null,
      notes: d.notes ?? null,
    });
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      patch = { encryptedData: body.encryptedData };
      if (body.appointmentId !== undefined) patch.appointmentId = body.appointmentId ?? null;
      if (body.practitionerId !== undefined) patch.practitionerId = body.practitionerId ?? null;
      if (body.patientId !== undefined) patch.patientId = body.patientId;
    } else {
      const { id: _i, userId: _u, ...rest } = body;
      patch = rest;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { await this.svc.remove(u.id, id); }
}
