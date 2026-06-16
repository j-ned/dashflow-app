import type { AdminUserView } from './admin.types';

export function anAdminUser(over: Partial<AdminUserView> = {}): AdminUserView {
  return {
    id: 'u1',
    email: 'user@example.com',
    role: 'user',
    isDemoAccount: false,
    createdAt: '2026-01-15T10:00:00.000Z',
    ...over,
  };
}
