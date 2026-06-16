import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { MedicationsService } from './medications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createMedicationSchema,
  createEncryptedMedicationSchema,
  refillMedicationSchema,
} from './dto/medication.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';

@UseGuards(JwtAuthGuard)
@Controller('medications')
export class MedicationsController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: MedicationsService) {
    super();
  }

  protected toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, patientId, prescriptionId } = parseBody(createEncryptedMedicationSchema, body);
      return {
        prescriptionId: prescriptionId ?? null,
        patientId,
        name: '',
        type: 'comprime',
        dosage: '',
        startDate: '1970-01-01',
        encryptedData,
      };
    }
    const d = parseBody(createMedicationSchema, body);
    return {
      prescriptionId: d.prescriptionId ?? null,
      patientId: d.patientId,
      name: d.name,
      type: d.type,
      dosage: d.dosage,
      quantity: d.quantity ?? 0,
      dailyRate: d.dailyRate ?? '1',
      startDate: d.startDate,
      alertDaysBefore: d.alertDaysBefore ?? 7,
      skipDays: d.skipDays ?? [],
    };
  }

  protected toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const patch: Record<string, unknown> = { encryptedData: body.encryptedData };
      if (body.prescriptionId !== undefined) patch.prescriptionId = body.prescriptionId ?? null;
      if (body.patientId !== undefined) patch.patientId = body.patientId;
      return patch;
    }
    const { id: _i, userId: _u, ...rest } = body;
    return rest;
  }

  // Static route must come before /:id to avoid param capture
  @Get('alerts')
  alerts(@CurrentUser() u: AuthUser) { return this.svc.alerts(u.id); }

  @UseGuards(CsrfGuard) @Patch(':id/refill')
  async refill(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const { quantity } = parseBody(refillMedicationSchema, body);
    const row = await this.svc.refill(u.id, id, quantity);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }
}
