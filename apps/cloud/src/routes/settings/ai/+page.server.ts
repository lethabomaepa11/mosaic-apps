import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AI_PROVIDERS, testAiKey } from '#lib/server/ai';
import { getAiSettings, isAiProvider, saveAiSettings } from '#lib/server/ai-settings';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/login');
  return { settings: await getAiSettings(locals.user.id), defaults: Object.fromEntries(Object.entries(AI_PROVIDERS).map(([id, item]) => [id, item.defaultModel])) };
};

export const actions: Actions = {
  save: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const form = await request.formData();
    const provider = String(form.get('provider') ?? 'mosaic');
    const model = String(form.get('model') ?? '').trim().slice(0, 100);
    const apiKey = String(form.get('apiKey') ?? '').trim();
    if (!isAiProvider(provider)) return fail(400, { message: 'Choose a provider.' });
    if (provider !== 'mosaic') {
      const current = await getAiSettings(locals.user.id);
      const keepsKey = current.provider === provider && current.hasKey;
      if (!apiKey && !keepsKey) return fail(400, { message: `Paste your ${AI_PROVIDERS[provider].label} API key.` });
      if (model && !/^[\w.:\-/]+$/.test(model)) return fail(400, { message: 'That model name has unexpected characters.' });
      if (apiKey) {
        try {
          await testAiKey(provider, apiKey);
        } catch (cause) {
          console.error(`AI key check failed for ${provider}`, cause);
          return fail(400, { message: `${AI_PROVIDERS[provider].label} rejected that key. Check it and its billing, then try again.` });
        }
      }
    }
    await saveAiSettings(locals.user.id, { provider, model: provider === 'mosaic' ? '' : model, apiKey: provider === 'mosaic' ? undefined : apiKey || undefined });
    return { saved: true, message: provider === 'mosaic' ? 'Using the Mosaic default AI.' : `Saved. Your next build uses ${AI_PROVIDERS[provider].label}.` };
  },
};
