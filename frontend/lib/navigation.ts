import type { UserRole } from './authClient';

const workspaces: Record<UserRole, string> = {
  CUSTOMER: '/app/customer',
  FACTORY: '/app/factory',
  LOGIST: '/app/logist',
  ADMIN: '/app/admin',
};

export function workspacePath(role: UserRole, locale: string) {
  return `${workspaces[role]}?lang=${encodeURIComponent(locale)}`;
}
