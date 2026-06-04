import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RecurringEntriesService } from './recurring-entries.service';
import { StorageService } from '../../storage/storage.service';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import {
  createRecurringEntrySchema,
  createEncryptedRecurringEntrySchema,
} from './dto/recurring-entry.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';

@Controller('recurring-entries')
export class RecurringEntriesController extends OwnedCrudController<unknown> {
  constructor(
    protected readonly svc: RecurringEntriesService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  protected toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, memberId, accountId } = parseBody(createEncryptedRecurringEntrySchema, body);
      return {
        memberId: memberId ?? null,
        accountId: accountId ?? null,
        label: '',
        amount: '0',
        type: 'income',
        encryptedData,
      };
    }
    const d = parseBody(createRecurringEntrySchema, body);
    return {
      memberId: d.memberId ?? null,
      accountId: d.accountId ?? null,
      toAccountId: d.toAccountId ?? null,
      label: d.label,
      amount: d.amount,
      type: d.type,
      dayOfMonth: d.dayOfMonth ?? null,
      date: d.date ?? null,
      endDate: d.endDate ?? null,
      category: d.category ?? null,
    };
  }

  protected toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
    if (body.encryptedData) {
      const patch: Record<string, unknown> = { encryptedData: body.encryptedData };
      if (body.memberId !== undefined) patch.memberId = body.memberId;
      if (body.accountId !== undefined) patch.accountId = body.accountId;
      return patch;
    }
    const { id: _i, userId: _u, createdAt: _c, ...rest } = body;
    return rest;
  }

  // --- Payslip file sub-routes ---

  @UseGuards(CsrfGuard)
  @Post(':id/payslip')
  @UseInterceptors(FileInterceptor('payslip', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadPayslip(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    const existing = await this.svc.getOne(u.id, id);
    if (!existing) throw new NotFoundException('Non trouvé');
    const key = this.storage.payslipKey(u.id, id, file.mimetype);
    await this.storage.upload(key, file.buffer, file.mimetype);
    return this.svc.update(u.id, id, { payslipKey: key });
  }

  @Get(':id/payslip')
  async getPayslip(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const row = await this.svc.getOne(u.id, id);
    if (!row?.payslipKey) throw new NotFoundException('Fiche de paie introuvable');
    const obj = await this.storage.getStream(row.payslipKey);
    if (!obj) throw new NotFoundException('Fiche de paie introuvable');
    res.setHeader('Content-Type', obj.contentType);
    obj.stream.pipe(res);
  }

  @UseGuards(CsrfGuard)
  @Delete(':id/payslip')
  @HttpCode(204)
  async deletePayslip(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    if (row.payslipKey) await this.storage.delete(row.payslipKey);
    await this.svc.update(u.id, id, { payslipKey: null });
  }
}
