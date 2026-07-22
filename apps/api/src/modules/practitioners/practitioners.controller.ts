import { Controller, UseGuards } from '@nestjs/common';
import { PractitionersService } from './practitioners.service';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';
import { parseBody } from '../../common/parse-body';
import {
  createPractitionerSchema,
  createEncryptedPractitionerSchema,
  updatePractitionerSchema,
  updateEncryptedPractitionerSchema,
} from './dto/practitioner.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('practitioners')
export class PractitionersController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: PractitionersService) {
    super();
  }

  protected toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(
        createEncryptedPractitionerSchema,
        body,
      );
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

  protected toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(
        updateEncryptedPractitionerSchema,
        body,
      );
      return { encryptedData };
    }
    const d = parseBody(updatePractitionerSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.name !== undefined) patch.name = d.name;
    if (d.type !== undefined) patch.type = d.type;
    if (d.phone !== undefined) patch.phone = d.phone;
    if (d.email !== undefined) patch.email = d.email;
    if (d.address !== undefined) patch.address = d.address;
    if (d.bookingUrl !== undefined) patch.bookingUrl = d.bookingUrl;
    return patch;
  }
}
