import {
  Body,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CsrfGuard } from '../guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../decorators/current-user.decorator';
import { parsePageQuery, sendPage, type Page, type PageQuery } from './keyset';
import { clientRowId } from './client-row-id';

export interface CrudService<T> {
  list(userId: string, q?: PageQuery): Promise<Page<T>>;
  getOne(userId: string, id: string): Promise<T | undefined>;
  create(userId: string, values: Record<string, unknown>): Promise<T>;
  update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<T | undefined>;
  remove(userId: string, id: string): Promise<void>;
}

@UseGuards(JwtAuthGuard)
export abstract class OwnedCrudController<T> {
  protected abstract readonly svc: CrudService<T>;
  protected abstract toCreateValues(
    body: Record<string, unknown>,
  ): Record<string, unknown>;
  protected abstract toUpdatePatch(
    body: Record<string, unknown>,
  ): Record<string, unknown>;

  @Get()
  async list(
    @CurrentUser() u: AuthUser,
    @Query() query: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendPage(res, await this.svc.list(u.id, parsePageQuery(query)));
  }

  @Get(':id')
  async getOne(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard)
  @Post()
  @HttpCode(201)
  create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    // E2EE : le front fixe l'id pour lier le blob chiffré à sa ligne (cf. clientRowId).
    return this.svc.create(u.id, {
      ...this.toCreateValues(body),
      ...clientRowId(body),
    });
  }

  @UseGuards(CsrfGuard)
  @Put(':id')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const row = await this.svc.update(u.id, id, this.toUpdatePatch(body));
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.svc.remove(u.id, id);
  }
}
