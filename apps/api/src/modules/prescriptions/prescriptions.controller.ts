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
import { PrescriptionsService } from './prescriptions.service';
import { StorageService } from '../../storage/storage.service';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { parseBody } from '../../common/parse-body';
import { assertValidUpload } from '../../common/files/validate-upload';
import {
  createPrescriptionSchema,
  createEncryptedPrescriptionSchema,
  updatePrescriptionSchema,
  updateEncryptedPrescriptionSchema,
} from './dto/prescription.dto';

@UseGuards(JwtAuthGuard)
@Controller('prescriptions')
export class PrescriptionsController extends OwnedCrudController<unknown> {
  constructor(
    protected readonly svc: PrescriptionsService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  protected toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const { encryptedData, appointmentId, practitionerId, patientId } =
        parseBody(createEncryptedPrescriptionSchema, body);
      return {
        appointmentId: appointmentId ?? null,
        practitionerId: practitionerId ?? null,
        patientId,
        issuedDate: '1970-01-01',
        encryptedData,
      };
    }
    const d = parseBody(createPrescriptionSchema, body);
    return {
      appointmentId: d.appointmentId ?? null,
      practitionerId: d.practitionerId ?? null,
      patientId: d.patientId,
      issuedDate: d.issuedDate,
      validUntil: d.validUntil ?? null,
      documentUrl: d.documentUrl ?? null,
      notes: d.notes ?? null,
    };
  }

  protected toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (body.encryptedData) {
      const d = parseBody(updateEncryptedPrescriptionSchema, body);
      const patch: Record<string, unknown> = { encryptedData: d.encryptedData };
      if (d.appointmentId !== undefined)
        patch.appointmentId = d.appointmentId ?? null;
      if (d.practitionerId !== undefined)
        patch.practitionerId = d.practitionerId ?? null;
      if (d.patientId !== undefined) patch.patientId = d.patientId;
      return patch;
    }
    const d = parseBody(updatePrescriptionSchema, body);
    const patch: Record<string, unknown> = {};
    if (d.appointmentId !== undefined)
      patch.appointmentId = d.appointmentId ?? null;
    if (d.practitionerId !== undefined)
      patch.practitionerId = d.practitionerId ?? null;
    if (d.patientId !== undefined) patch.patientId = d.patientId;
    if (d.issuedDate !== undefined) patch.issuedDate = d.issuedDate;
    if (d.validUntil !== undefined) patch.validUntil = d.validUntil;
    if (d.documentUrl !== undefined) patch.documentUrl = d.documentUrl;
    if (d.notes !== undefined) patch.notes = d.notes;
    return patch;
  }

  // Static route must come before /:id to avoid param capture
  @Get('by-appointment/:appointmentId')
  byAppointment(
    @CurrentUser() u: AuthUser,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.svc.byAppointment(u.id, appointmentId);
  }

  // --- Document file sub-routes ---

  @UseGuards(CsrfGuard)
  @Post(':id/document')
  @UseInterceptors(
    FileInterceptor('document', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async uploadDocument(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    await assertValidUpload(file);
    const existing = await this.svc.getOne(u.id, id);
    if (!existing) throw new NotFoundException('Non trouvé');
    const key = this.storage.prescriptionKey(u.id, id, file.mimetype);
    await this.storage.upload(key, file.buffer, file.mimetype);
    return this.svc.update(u.id, id, { documentUrl: key });
  }

  @Get(':id/document')
  async getDocument(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const presc = await this.svc.getOne(u.id, id);
    if (!presc?.documentUrl)
      throw new NotFoundException('Document introuvable');
    const obj = await this.storage.getStream(presc.documentUrl);
    if (!obj) throw new NotFoundException('Document introuvable');
    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('Content-Disposition', 'attachment');
    obj.stream.pipe(res);
  }

  @UseGuards(CsrfGuard)
  @Delete(':id/document')
  @HttpCode(204)
  async deleteDocument(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    const presc = await this.svc.getOne(u.id, id);
    if (!presc) throw new NotFoundException('Non trouvé');
    if (presc.documentUrl) await this.storage.delete(presc.documentUrl);
    await this.svc.update(u.id, id, { documentUrl: null });
  }
}
