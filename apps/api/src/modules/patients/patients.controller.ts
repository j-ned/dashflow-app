import { Controller } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { parseBody } from '../../common/parse-body';
import { createPatientSchema, createEncryptedPatientSchema } from './dto/patient.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';

@Controller('patients')
export class PatientsController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: PatientsService) { super(); }

  protected toCreateValues(body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(createEncryptedPatientSchema, body);
      return { firstName: '', lastName: '', birthDate: '1970-01-01', encryptedData };
    }
    const d = parseBody(createPatientSchema, body);
    return { firstName: d.firstName, lastName: d.lastName, birthDate: d.birthDate, color: d.color ?? null, notes: d.notes ?? null };
  }

  protected toUpdatePatch(body: Record<string, unknown>) {
    return body.encryptedData
      ? { encryptedData: body.encryptedData }
      : (({ id: _i, userId: _u, createdAt: _c, ...rest }) => rest)(body);
  }
}
