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
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createMedicationSchema,
  createEncryptedMedicationSchema,
  updateMedicationSchema,
  updateEncryptedMedicationSchema,
  refillMedicationSchema,
} from './dto/medication.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';

@UseGuards(JwtAuthGuard)
@Controller('medications')
export class MedicationsController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: MedicationsService) {
    super();
  }

  protected toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, patientId, prescriptionId } = parseBody(
        createEncryptedMedicationSchema,
        body,
      );
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

  protected toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const d = parseBody(updateEncryptedMedicationSchema, body);
      const patch: Record<string, unknown> = { encryptedData: d.encryptedData };
      if (d.prescriptionId !== undefined)
        patch.prescriptionId = d.prescriptionId ?? null;
      if (d.patientId !== undefined) patch.patientId = d.patientId;
      return patch;
    }
    const d = parseBody(updateMedicationSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.prescriptionId !== undefined)
      patch.prescriptionId = d.prescriptionId ?? null;
    if (d.patientId !== undefined) patch.patientId = d.patientId;
    if (d.name !== undefined) patch.name = d.name;
    if (d.type !== undefined) patch.type = d.type;
    if (d.dosage !== undefined) patch.dosage = d.dosage;
    if (d.quantity !== undefined) patch.quantity = d.quantity;
    if (d.dailyRate !== undefined) patch.dailyRate = d.dailyRate;
    if (d.startDate !== undefined) patch.startDate = d.startDate;
    if (d.alertDaysBefore !== undefined)
      patch.alertDaysBefore = d.alertDaysBefore;
    if (d.skipDays !== undefined) patch.skipDays = d.skipDays;
    return patch;
  }

  // Static route must come before /:id to avoid param capture
  @Get('alerts')
  alerts(@CurrentUser() u: AuthUser) {
    return this.svc.alerts(u.id);
  }

  @UseGuards(CsrfGuard)
  @Patch(':id/refill')
  async refill(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const { quantity } = parseBody(refillMedicationSchema, body);
    const row = await this.svc.refill(u.id, id, quantity);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }
}
