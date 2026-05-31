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
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PrescriptionsService } from './prescriptions.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { createPrescriptionSchema, createEncryptedPrescriptionSchema } from './dto/prescription.dto';

@UseGuards(JwtAuthGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(
    private readonly svc: PrescriptionsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  // Static route must come before /:id to avoid param capture
  @Get('by-appointment/:appointmentId')
  byAppointment(@CurrentUser() u: AuthUser, @Param('appointmentId') appointmentId: string) {
    return this.svc.byAppointment(u.id, appointmentId);
  }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData, appointmentId, practitionerId, patientId } = parseBody(createEncryptedPrescriptionSchema, body);
      return this.svc.create(u.id, {
        appointmentId: appointmentId ?? null,
        practitionerId: practitionerId ?? null,
        patientId,
        issuedDate: '1970-01-01',
        encryptedData,
      });
    }
    const d = parseBody(createPrescriptionSchema, body);
    return this.svc.create(u.id, {
      appointmentId: d.appointmentId ?? null,
      practitionerId: d.practitionerId ?? null,
      patientId: d.patientId,
      issuedDate: d.issuedDate,
      validUntil: d.validUntil ?? null,
      documentUrl: d.documentUrl ?? null,
      notes: d.notes ?? null,
    });
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      patch = { encryptedData: body.encryptedData };
      if (body.appointmentId !== undefined) patch.appointmentId = body.appointmentId ?? null;
      if (body.practitionerId !== undefined) patch.practitionerId = body.practitionerId ?? null;
      if (body.patientId !== undefined) patch.patientId = body.patientId;
    } else {
      const { id: _i, userId: _u, ...rest } = body;
      patch = rest;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { await this.svc.remove(u.id, id); }

  // --- Document file sub-routes ---

  @UseGuards(CsrfGuard)
  @Post(':id/document')
  @UseInterceptors(FileInterceptor('document', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadDocument(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    const existing = await this.svc.getOne(u.id, id);
    if (!existing) throw new NotFoundException('Non trouvé');
    const key = this.storage.prescriptionKey(u.id, id, file.mimetype);
    await this.storage.upload(key, file.buffer, file.mimetype);
    return this.svc.update(u.id, id, { documentUrl: key });
  }

  @Get(':id/document')
  async getDocument(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const presc = await this.svc.getOne(u.id, id);
    if (!presc?.documentUrl) throw new NotFoundException('Document introuvable');
    const obj = await this.storage.getStream(presc.documentUrl);
    if (!obj) throw new NotFoundException('Document introuvable');
    res.setHeader('Content-Type', obj.contentType);
    obj.stream.pipe(res);
  }

  @UseGuards(CsrfGuard)
  @Delete(':id/document')
  @HttpCode(204)
  async deleteDocument(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    const presc = await this.svc.getOne(u.id, id);
    if (!presc) throw new NotFoundException('Non trouvé');
    if (presc.documentUrl) await this.storage.delete(presc.documentUrl);
    await this.svc.update(u.id, id, { documentUrl: null });
  }
}
