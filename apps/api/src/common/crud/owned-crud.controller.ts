import {
  Body, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CsrfGuard } from '../guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../decorators/current-user.decorator';

export interface CrudService<T> {
  list(userId: string): Promise<T[]>;
  getOne(userId: string, id: string): Promise<T | undefined>;
  create(userId: string, values: Record<string, unknown>): Promise<T>;
  update(userId: string, id: string, patch: Record<string, unknown>): Promise<T | undefined>;
  remove(userId: string, id: string): Promise<void>;
}

@UseGuards(JwtAuthGuard)
export abstract class OwnedCrudController<T> {
  protected abstract readonly svc: CrudService<T>;
  protected abstract toCreateValues(body: Record<string, unknown>): Record<string, unknown>;
  protected abstract toUpdatePatch(body: Record<string, unknown>): Record<string, unknown>;

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    return this.svc.create(u.id, this.toCreateValues(body));
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const row = await this.svc.update(u.id, id, this.toUpdatePatch(body));
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.svc.remove(u.id, id);
  }
}
