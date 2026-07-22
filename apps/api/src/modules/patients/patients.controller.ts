import { Controller, UseGuards } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { parseBody } from '../../common/parse-body';
import {
  createPatientSchema,
  createEncryptedPatientSchema,
  updatePatientSchema,
  updateEncryptedPatientSchema,
} from './dto/patient.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: PatientsService) {
    super();
  }

  protected toCreateValues(body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(createEncryptedPatientSchema, body);
      return {
        firstName: '',
        lastName: '',
        birthDate: '1970-01-01',
        encryptedData,
      };
    }
    const d = parseBody(createPatientSchema, body);
    return {
      firstName: d.firstName,
      lastName: d.lastName,
      birthDate: d.birthDate,
      color: d.color ?? null,
      notes: d.notes ?? null,
    };
  }

  protected toUpdatePatch(body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(updateEncryptedPatientSchema, body);
      return { encryptedData };
    }
    const d = parseBody(updatePatientSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.firstName !== undefined) patch.firstName = d.firstName;
    if (d.lastName !== undefined) patch.lastName = d.lastName;
    if (d.birthDate !== undefined) patch.birthDate = d.birthDate;
    if (d.color !== undefined) patch.color = d.color;
    if (d.notes !== undefined) patch.notes = d.notes;
    return patch;
  }
}
