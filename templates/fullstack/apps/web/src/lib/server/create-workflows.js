import { buildEntitySchema, buildInsertSql, formatIssues, getEntity, HttpError, ident, isAdmin, writeAudit } from '@mosaic-apps/server';

/**
 * @typedef {{ field: string, source: 'constant' | 'userId' | 'userEmail' | 'profile', value: string }} ManagedValue
 * @typedef {{ entity: string, label: string, roles: string[], profile?: { entity: string, emailField: string },
 *   managed: ManagedValue[], input: { type: 'object', properties: Record<string, unknown>, required: string[], additionalProperties: false } }} CreateWorkflow
 */

/** @param {CreateWorkflow[]} workflows @returns {import('@mosaic-apps/server').MosaicEndpointRegistration[]} */
export function createWorkflowEndpoints(workflows) {
  return workflows.map((workflow) => ({
    method: 'POST',
    path: '/' + workflow.entity.replaceAll('_', '-') + '/submit',
    summary: `Submit ${workflow.label}`,
    tags: ['Workflows'],
    body: workflow.input,
    responses: {
      201: { description: 'Request created', schema: { type: 'object', required: ['success', 'data'], properties: {
        success: { type: 'boolean' }, data: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      } } },
      401: { description: 'Sign-in required' },
      403: { description: 'The user cannot submit this request' },
      422: { description: 'Invalid request fields' },
    },
    handler: async ({ user, db, json, request }) => {
      if (!user) throw new HttpError(401, 'Sign in to submit a request', 'UNAUTHENTICATED');
      if (workflow.roles.length && !workflow.roles.includes('*') && !isAdmin(user) && !workflow.roles.some((role) => user.roles.includes(role))) {
        throw new HttpError(403, 'Your role cannot submit this request', 'FORBIDDEN');
      }
      const body = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'application/json'
        ? await json().catch(() => null) : null;
      if (typeof body !== 'object' || body === null || Array.isArray(body)
          || Object.keys(body).some((key) => !Object.hasOwn(workflow.input.properties, key))) {
        throw new HttpError(422, 'Submit only the fields shown on the form', 'BAD_INPUT');
      }
      const id = await db.tx(async (tx) => {
        const entity = (await getEntity(tx, workflow.entity))?.definition;
        if (!entity) throw new HttpError(409, 'The workflow is not installed', 'WORKFLOW_UNAVAILABLE');
        /** @type {Record<string, unknown>} */
        let profile = {};
        if (workflow.profile) {
          const lookup = (await getEntity(tx, workflow.profile.entity))?.definition;
          if (!lookup) throw new HttpError(409, 'The user profile is not installed', 'WORKFLOW_UNAVAILABLE');
          const active = lookup.softDelete ? ' AND "deletedAt" IS NULL' : '';
          const result = await tx.query(`SELECT * FROM ${ident(lookup.name)} WHERE lower(${ident(workflow.profile.emailField)}) = lower($1)${active} LIMIT 2`, [user.email]);
          if (result.rows.length !== 1) throw new HttpError(403, 'Your account needs a unique matching profile', 'PROFILE_UNAVAILABLE');
          profile = result.rows[0];
        }
        /** @type {Record<string, unknown>} */
        const values = { ...body };
        for (const value of workflow.managed) {
          values[value.field] = value.source === 'profile' ? profile[value.value]
            : value.source === 'userId' ? user.id : value.source === 'userEmail' ? user.email : value.value;
          if (values[value.field] == null) throw new HttpError(403, 'Your profile is missing information required for this workflow', 'PROFILE_UNAVAILABLE');
        }
        const parsed = buildEntitySchema(entity, 'create').safeParse(values);
        if (!parsed.success) throw new HttpError(422, 'Check the values required for this request', 'BAD_INPUT', formatIssues(parsed.error));
        const insert = buildInsertSql(entity, /** @type {Record<string, unknown>} */ (parsed.data));
        const result = await tx.query(insert.sql, insert.params);
        return String(result.rows[0]?.id);
      });
      writeAudit(db, { action: 'create', entity: workflow.entity, recordId: id, user });
      return Response.json({ success: true, data: { id } }, { status: 201 });
    },
  }));
}
