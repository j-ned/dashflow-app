import {
  Controller,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { createReminderSchema, updateReminderSchema } from './dto/reminder.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';

@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController extends OwnedCrudController<unknown> {
  constructor(protected readonly svc: RemindersService) {
    super();
  }

  protected toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    const d = parseBody(createReminderSchema, body);
    return {
      type: d.type,
      target: d.target,
      medicationId: d.medicationId ?? null,
      appointmentId: d.appointmentId ?? null,
      recipientEmail: d.recipientEmail,
      enabled: d.enabled ?? true,
    };
  }

  protected toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    const d = parseBody(updateReminderSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.type !== undefined) patch.type = d.type;
    if (d.target !== undefined) patch.target = d.target;
    if (d.medicationId !== undefined) patch.medicationId = d.medicationId;
    if (d.appointmentId !== undefined) patch.appointmentId = d.appointmentId;
    if (d.recipientEmail !== undefined) patch.recipientEmail = d.recipientEmail;
    if (d.enabled !== undefined) patch.enabled = d.enabled;
    return patch;
  }

  @UseGuards(CsrfGuard)
  @Patch(':id/toggle')
  async toggle(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.toggle(u.id, id);
    if (row === undefined) throw new NotFoundException('Non trouvé');
    return row;
  }
}
