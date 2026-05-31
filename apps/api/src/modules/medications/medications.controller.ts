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

@UseGuards(JwtAuthGuard)
@Controller('medications')
export class MedicationsController {
  constructor(private readonly svc: MedicationsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  // Static route must come before /:id to avoid param capture
  @Get('alerts')
  alerts(@CurrentUser() u: AuthUser) { return this.svc.alerts(u.id); }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData, patientId, prescriptionId } = parseBody(createEncryptedMedicationSchema, body);
      return this.svc.create(u.id, {
        prescriptionId: prescriptionId ?? null,
        patientId,
        name: '',
        type: 'comprime',
        dosage: '',
        startDate: '1970-01-01',
        encryptedData,
      });
    }
    const d = parseBody(createMedicationSchema, body);
    return this.svc.create(u.id, {
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
    });
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      patch = { encryptedData: body.encryptedData };
      if (body.prescriptionId !== undefined) patch.prescriptionId = body.prescriptionId ?? null;
      if (body.patientId !== undefined) patch.patientId = body.patientId;
    } else {
      const { id: _i, userId: _u, ...rest } = body;
      patch = rest;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Patch(':id/refill')
  async refill(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const { quantity } = parseBody(refillMedicationSchema, body);
    const row = await this.svc.refill(u.id, id, quantity);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { await this.svc.remove(u.id, id); }
}
