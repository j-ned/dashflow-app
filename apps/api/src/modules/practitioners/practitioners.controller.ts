import { Controller } from '@nestjs/common';
import { PractitionersService } from './practitioners.service';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';
import { parseBody } from '../../common/parse-body';
import { createPractitionerSchema, createEncryptedPractitionerSchema } from './dto/practitioner.dto';

@Controller('practitioners')
export class PractitionersController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: PractitionersService) {
    super();
  }

  protected toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(createEncryptedPractitionerSchema, body);
      return { name: '', type: 'autre', encryptedData };
    }
    const d = parseBody(createPractitionerSchema, body);
    return {
      name: d.name,
      type: d.type,
      phone: d.phone ?? null,
      email: d.email ?? null,
      address: d.address ?? null,
      bookingUrl: d.bookingUrl ?? null,
    };
  }

  protected toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
    return body.encryptedData
      ? { encryptedData: body.encryptedData }
      : (({ id: _i, userId: _u, createdAt: _c, ...rest }) => rest)(body);
  }
}
