import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { hashPassword, signJwt, verifyJwt, verifyPassword } from './auth.js';
import { canAccessEntity, hasPermission, matchPermission } from './rbac.js';

test('password hash roundtrip', () => {
  const hash = hashPassword('s3cret-pass');
  assert.match(hash, /^scrypt\$/);
  assert.equal(verifyPassword('s3cret-pass', hash), true);
  assert.equal(verifyPassword('wrong', hash), false);
  assert.equal(verifyPassword('x', 'garbage'), false);
});

test('jwt sign/verify + tamper + expiry', () => {
  const token = signJwt({ sub: 'u1', email: 'a@b.c', roles: ['admin'] }, 'secret', 60);
  const payload = verifyJwt(token, 'secret');
  assert.equal(payload?.sub, 'u1');
  assert.equal(payload?.roles[0], 'admin');
  assert.equal(verifyJwt(token, 'other-secret'), null);
  assert.equal(verifyJwt(token.slice(0, -3) + 'xyz', 'secret'), null);
  const expired = signJwt({ sub: 'u1', email: 'a@b.c', roles: [] }, 'secret', -10);
  assert.equal(verifyJwt(expired, 'secret'), null);
  assert.equal(verifyJwt('not-a-token', 'secret'), null);
});

test('permission pattern matching', () => {
  assert.equal(matchPermission('*', 'anything:at:all'), true);
  assert.equal(matchPermission('entity:customer:create', 'entity:customer:create'), true);
  assert.equal(matchPermission('entity:customer:*', 'entity:customer:delete'), true);
  assert.equal(matchPermission('entity:*:read', 'entity:order:read'), true);
  assert.equal(matchPermission('entity:customer:create', 'entity:order:create'), false);
  assert.equal(matchPermission('forms:manage', 'forms:manage'), true);
  assert.equal(matchPermission('forms', 'forms:manage'), false);
});

test('hasPermission + entity access gates', () => {
  const viewer = { id: '1', email: 'v@x.io', name: 'v', roles: ['viewer'], permissions: ['entity:*:read'] };
  const editor = { id: '2', email: 'e@x.io', name: 'e', roles: ['editor'], permissions: ['entity:*:read'] };
  const admin = { id: '3', email: 'a@x.io', name: 'a', roles: ['admin'], permissions: ['*'] };
  const open: EntityLike = { name: 'note', fields: [] };
  const guarded: EntityLike = { name: 'salary', fields: [], permissions: { read: ['admin'], create: ['admin'] } };

  assert.equal(hasPermission(viewer, 'forms:manage'), false);
  assert.equal(hasPermission(admin, 'forms:manage'), true);

  assert.equal(canAccessEntity(viewer, open, 'read'), true);
  assert.equal(canAccessEntity(viewer, open, 'create'), true); // no explicit perms => any authed user
  assert.equal(canAccessEntity(viewer, guarded, 'read'), false);
  assert.equal(canAccessEntity(editor, guarded, 'create'), false);
  assert.equal(canAccessEntity(admin, guarded, 'create'), true);
  assert.equal(canAccessEntity(null, { name: 'x', fields: [], permissions: { read: ['*'] } }, 'read'), false,
    'anonymous never passes while auth is on (route must disable auth)');
  assert.equal(canAccessEntity(viewer, { name: 'x', fields: [], permissions: { read: ['*'] } }, 'read'), true);
});

interface EntityLike {
  name: string;
  fields: never[];
  permissions?: Record<string, string[]>;
}
