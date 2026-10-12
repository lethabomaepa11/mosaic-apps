/** Platform-level record shapes (auth, audit, ref lists, settings, migrations). */

import type { FormDef } from './form.js';
import type { PageDef } from './page.js';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  roles: string[];
  avatarColor?: string;
  createdAt?: string;
  lastLoginAt?: string;
  disabled?: boolean;
}

export interface RoleRecord {
  name: string;
  displayName?: string;
  description?: string;
  /** permission strings: `*`, `entity:customer:*`, `settings:manage`, ... */
  permissions: string[];
}

export interface LoginResponse {
  token: string;
  user: UserRecord;
  expiresIn: number;
}

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'migrate' | 'publish';

export interface AuditEntry {
  id: string;
  action: AuditAction | string;
  entity?: string;
  recordId?: string;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
  userId?: string | null;
  userEmail?: string | null;
  ip?: string | null;
  createdAt: string;
}

export interface RefListItem {
  value: string;
  label?: string;
  color?: string;
  order?: number;
  disabled?: boolean;
}

export interface RefList {
  id: string;
  name: string;
  label?: string;
  items: RefListItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SettingRecord {
  key: string;
  value: unknown;
  description?: string;
  updatedAt?: string;
}

export interface NavItemDef {
  label: string;
  href: string;
  icon?: string;
  section?: string;
}

export interface ThemePalette {
  primary?: string;
  primaryForeground?: string;
  background?: string;
  surface?: string;
  surface2?: string;
  foreground?: string;
  foregroundMuted?: string;
  border?: string;
  space1?: string;
  space2?: string;
  space3?: string;
  space4?: string;
  space5?: string;
  space6?: string;
  radius?: string;
  font?: string;
  mono?: string;
}

export interface ThemeConfig extends ThemePalette {
  mode?: 'light' | 'dark' | 'system';
  /** Independent tokens used when the mode is dark; old flat tokens remain the light palette. */
  dark?: ThemePalette;
  activeTheme?: string;
  /** Optional named palettes, inspired by daisyUI's theme gallery. */
  themes?: Record<string, ThemePalette & { dark?: ThemePalette }>;
  transition?: { kind?: 'fade' | 'slide' | 'scale' | 'blur' | 'none'; duration?: number; delay?: number };
}

export interface TransitionConfig {
  kind?: 'fade' | 'slide' | 'scale' | 'blur' | 'none';
  duration?: number;
  delay?: number;
}

export type MigrationStatus = 'applied' | 'planned' | 'failed';

export interface MigrationStatement {
  sql: string;
  kind:
    | 'create-table'
    | 'add-column'
    | 'drop-column'
    | 'alter-column'
    | 'add-constraint'
    | 'drop-constraint'
    | 'create-index'
    | 'drop-index';
  risk: 'safe' | 'destructive';
  description: string;
}

export interface MigrationPlan {
  entity: string;
  statements: MigrationStatement[];
  warnings: string[];
  empty: boolean;
}

export interface MigrationRecord {
  id: string;
  entity: string;
  entityVersion: number;
  checksum: string;
  statements: MigrationStatement[];
  status: MigrationStatus;
  error?: string | null;
  appliedAt?: string;
}

export interface EntityRegistryRecord {
  name: string;
  definition: import('./entity.js').EntityDef;
  version: number;
  source: 'file' | 'database';
  updatedAt: string;
}

export type { FormDef, PageDef };
