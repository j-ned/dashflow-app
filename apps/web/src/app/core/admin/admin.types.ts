export type AdminUserView = {
  readonly id: string;
  readonly email: string;
  readonly role: 'user' | 'admin';
  readonly isDemoAccount: boolean;
  readonly createdAt: string;
};

export type AdminUsersPage = {
  readonly items: readonly AdminUserView[];
  readonly total: number;
};
