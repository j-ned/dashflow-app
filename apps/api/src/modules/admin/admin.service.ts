import { Injectable } from '@nestjs/common';
import { AdminRepository, type AdminUserRow } from './admin.repository';

export type AdminUserView = {
  id: string;
  email: string;
  role: 'user' | 'admin';
  isDemoAccount: boolean;
  createdAt: Date;
};

function toView(row: AdminUserRow): AdminUserView {
  return {
    id: row.id,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'user',
    isDemoAccount: row.isDemoAccount,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class AdminService {
  constructor(private readonly admin: AdminRepository) {}

  async listUsers(opts: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: AdminUserView[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.admin.listUsers(opts),
      this.admin.countAll(opts.search),
    ]);
    return { items: rows.map(toView), total };
  }
}
