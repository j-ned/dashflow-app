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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { assertValidUpload } from '../../common/files/validate-upload';
import {
  createRecurringEntrySchema,
  createEncryptedRecurringEntrySchema,
  updateRecurringEntrySchema,
  updateEncryptedRecurringEntrySchema,
} from './dto/recurring-entry.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';

@UseGuards(JwtAuthGuard)
@Controller('recurring-entries')
export class RecurringEntriesController extends OwnedCrudController<unknown> {
  constructor(
    protected readonly svc: RecurringEntriesService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  protected toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, memberId, accountId, toAccountId } = parseBody(
        createEncryptedRecurringEntrySchema,
        body,
      );
      return {
        memberId: memberId ?? null,
        accountId: accountId ?? null,
        // toAccountId reste en clair (référence FK) : sans lui, un virement chiffré ne crédite
        // jamais le compte destination (le solde le filtre par to_account_id).
        toAccountId: toAccountId ?? null,
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

  protected toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const d = parseBody(updateEncryptedRecurringEntrySchema, body);
      const patch: Record<string, unknown> = { encryptedData: d.encryptedData };
      if (d.memberId !== undefined) patch.memberId = d.memberId;
      if (d.accountId !== undefined) patch.accountId = d.accountId;
      if (d.toAccountId !== undefined) patch.toAccountId = d.toAccountId;
      return patch;
    }
    const d = parseBody(updateRecurringEntrySchema, body);
    const patch: Record<string, unknown> = {};
    if (d.memberId !== undefined) patch.memberId = d.memberId;
    if (d.accountId !== undefined) patch.accountId = d.accountId;
    if (d.toAccountId !== undefined) patch.toAccountId = d.toAccountId;
    if (d.label !== undefined) patch.label = d.label;
    if (d.amount !== undefined) patch.amount = d.amount;
    if (d.type !== undefined) patch.type = d.type;
    if (d.dayOfMonth !== undefined) patch.dayOfMonth = d.dayOfMonth;
    if (d.date !== undefined) patch.date = d.date;
    if (d.endDate !== undefined) patch.endDate = d.endDate;
    if (d.category !== undefined) patch.category = d.category;
    return patch;
  }

  // --- Payslip file sub-routes ---

  @UseGuards(CsrfGuard)
  @Post(':id/payslip')
  @UseInterceptors(
    FileInterceptor('payslip', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async uploadPayslip(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    await assertValidUpload(file);
    const existing = await this.svc.getOne(u.id, id);
    if (!existing) throw new NotFoundException('Non trouvé');
    const key = this.storage.payslipKey(u.id, id, file.mimetype);
    await this.storage.upload(key, file.buffer, file.mimetype);
    return this.svc.update(u.id, id, { payslipKey: key });
  }

  @Get(':id/payslip')
  async getPayslip(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const row = await this.svc.getOne(u.id, id);
    if (!row?.payslipKey)
      throw new NotFoundException('Fiche de paie introuvable');
    const obj = await this.storage.getStream(row.payslipKey);
    if (!obj) throw new NotFoundException('Fiche de paie introuvable');
    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('Content-Disposition', 'attachment');
    obj.stream.pipe(res);
  }

  @UseGuards(CsrfGuard)
  @Delete(':id/payslip')
  @HttpCode(204)
  async deletePayslip(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    if (row.payslipKey) await this.storage.delete(row.payslipKey);
    await this.svc.update(u.id, id, { payslipKey: null });
  }
}
