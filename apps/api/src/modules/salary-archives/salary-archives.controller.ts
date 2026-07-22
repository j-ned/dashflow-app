import {
  BadRequestException,
  Body,
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
import { SalaryArchivesService } from './salary-archives.service';
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
  createSalaryArchiveSchema,
  createEncryptedSalaryArchiveSchema,
  updateSalaryArchiveSchema,
  updateEncryptedSalaryArchiveSchema,
} from './dto/salary-archive.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';

@UseGuards(JwtAuthGuard)
@Controller('salary-archives')
export class SalaryArchivesController extends OwnedCrudController<unknown> {
  constructor(
    protected readonly svc: SalaryArchivesService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  // E2EE : en mode chiffré, month/salary sont des placeholders (le vrai contenu
  // est dans encryptedData, opaque au serveur). Le payslip s'upload via POST :id/payslip.
  protected toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, accountId } = parseBody(
        createEncryptedSalaryArchiveSchema,
        body,
      );
      return {
        accountId: accountId ?? null,
        month: '0000-00',
        salary: '0',
        encryptedData,
      };
    }
    const d = parseBody(createSalaryArchiveSchema, body);
    return {
      accountId: d.accountId ?? null,
      month: d.month,
      salary: d.salary,
      totalExpenses: d.totalExpenses ?? '0',
      totalSpendings: d.totalSpendings ?? '0',
      spendings: d.spendings ?? [],
    };
  }

  protected toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const d = parseBody(updateEncryptedSalaryArchiveSchema, body);
      const patch: Record<string, unknown> = { encryptedData: d.encryptedData };
      if (d.accountId !== undefined) patch.accountId = d.accountId;
      return patch;
    }
    const d = parseBody(updateSalaryArchiveSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.month !== undefined) patch.month = d.month;
    if (d.salary !== undefined) patch.salary = d.salary;
    if (d.totalExpenses !== undefined) patch.totalExpenses = d.totalExpenses;
    if (d.totalSpendings !== undefined) patch.totalSpendings = d.totalSpendings;
    if (d.spendings !== undefined) patch.spendings = d.spendings;
    if (d.accountId !== undefined) patch.accountId = d.accountId;
    return patch;
  }

  @UseGuards(CsrfGuard)
  @Post()
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('payslip', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  override async create(
    @CurrentUser() u: AuthUser,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    const row = (await this.svc.create(u.id, this.toCreateValues(body))) as {
      id: string;
    };
    if (!file) return row;
    await assertValidUpload(file);
    const key = this.storage.payslipKey(u.id, row.id, file.mimetype);
    await this.storage.upload(key, file.buffer, file.mimetype);
    return this.svc.update(u.id, row.id, { payslipKey: key });
  }

  @UseGuards(CsrfGuard)
  @Delete(':id')
  @HttpCode(204)
  override async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Not found');
    await this.svc.remove(u.id, id);
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
