/** RBAC checks: permission patterns with `*` wildcards + entity action gates. */

import type { EntityAction, EntityDef } from '@mosaic/core';
import type { AuthUser } from './auth.js';

/** Match a user permission against a required permission, segment-wise `*` wildcards. */
export function matchPermission(userPerm: string, required: string): boolean {
  if (userPerm === '*') return true;
  const u = userPerm.split(':');
  const r = required.split(':');
  for (let i = 0; i < r.length; i++) {
    const up = u[i] ?? (u[u.length - 1] === '*' ? '*' : undefined);
    if (up === undefined) return false;
    if (up === '*') return true;
    if (up !== r[i]) return false;
  }
  // user perm may be longer (e.g. entity:customer:* required entity:customer) - only ok if trailing '*'
  for (let i = r.length; i < u.length; i++) {
    if (u[i] !== '*') return false;
  }
  return true;
}

export function hasPermission(user: AuthUser | null, required: string): boolean {
  if (!user) return false;
  return user.permissions.some((p) => matchPermission(p, required));
}

export function isAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.roles.includes('admin') || user.permissions.includes('*');
}

/**
 * Entity action gate (specificity rules):
 *  - admin bypasses everything
 *  - entity.permissions[action] undefined/empty/['*'] => any authenticated user
 *  - otherwise the listed ROLES are allowed, plus holders of an EXACT
 *    entity-scoped grant (`entity:<name>:<action>` / `entity:<name>:*`).
 *    Broad grants (`entity:*:<action>`) do NOT override a defined gate -
 *    entity metadata is more specific than role wildcards.
 */
export function canAccessEntity(user: AuthUser | null, entity: EntityDef, action: EntityAction): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const roles = entity.permissions?.[action];
  if (!roles || roles.length === 0 || roles.includes('*')) return true;
  if (roles.some((r) => user.roles.includes(r))) return true;
  const exact = `entity:${entity.name}:`;
  return user.permissions.some(
    (p) => p === `${exact}${action}` || p === `${exact}*`,
  );
}

/** Route-level gate used by module endpoints. */
export function requirePermission(user: AuthUser | null, perm: string): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return hasPermission(user, perm);
}
