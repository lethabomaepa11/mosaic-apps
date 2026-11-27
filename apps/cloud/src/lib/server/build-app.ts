import { clarify, developSpec, fixSpec, reviewSpec, type Answer, type BuildFeature, type Question } from './agents';
import { verifyApp } from './mosaic-runtime';
import { AiError, type AiConfig } from './ai';
import { autoRepair, compileSpec, validateSpec, type AppSpec, type CompiledApp } from './spec';

export type AgentName = 'Planner' | 'Developer' | 'Verifier' | 'Reviewer';
export interface BuildEvents {
  think(agent: AgentName, message: string): Promise<void>;
  progress(percent: number): Promise<void>;
}
export type BuildResult =
  | { status: 'needs_input'; questions: Question[] }
  | { status: 'built'; spec: AppSpec; app: CompiledApp; reviewApproved: boolean };

export const MAX_FIX_ROUNDS = 6;
export const MAX_REVIEWS = 2;

function preservedDesign(current: AppSpec, next: AppSpec): string[] {
  const problems: string[] = [];
  for (const entity of current.entities) {
    const updated = next.entities.find((item) => item.name === entity.name);
    if (!updated) {
      problems.push(`Preserve the existing ${entity.name} entity and its records.`);
      continue;
    }
    if (entity.submission && !updated.submission) problems.push(`Preserve the existing ${entity.name} server-managed workflow.`);
    for (const field of entity.fields) {
      const candidate = updated.fields.find((item) => item.name === field.name);
      if (!candidate || candidate.type !== field.type || candidate.refEntity !== field.refEntity || field.options.some((option) => !candidate.options.includes(option))) {
        problems.push(`Preserve the existing ${entity.name}.${field.name} field, type and values.`);
      }
    }
  }
  for (const page of current.pages) {
    if (!next.pages.some((item) => item.slug === page.slug && item.route === page.route && item.access === page.access)) {
      problems.push(`Preserve the existing ${page.route} page and its access settings.`);
    }
  }
  return problems;
}

/**
 * Planner → Developer → (Verifier ⇄ Developer) → Reviewer → Developer → … until the app
 * passes real CRUD tests and the reviewer approves (or review rounds run out).
 */
export async function buildApp(
  input: { brief: string; answers: Answer[]; options: string; current?: AppSpec; change?: string; feature?: BuildFeature; reviewBrief?: string; askQuestions: boolean; ai?: AiConfig; customCode?: boolean },
  events: BuildEvents,
): Promise<BuildResult> {
  const config = input.ai;
  const shared = !config || config.provider === 'mosaic';
  const reported = new Set<string>();
  const modelConfig = (agent: AgentName): AiConfig => ({ ...(config ?? { provider: 'mosaic' }), onModel: async (model) => {
    if (agent === 'Developer') await config?.onModel?.(model);
    if (reported.has(model)) return;
    reported.add(model);
    await events.think(agent, `Response received from ${model}.`);
  } });
  const onWait = (agent: AgentName) => (seconds: number) => events.think(agent, `Retrying in ${seconds}s after an AI rate limit${shared ? ' on the shared tier' : ''}…`);
  const say = async (agent: AgentName, notes: string[]) => { for (const note of notes.slice(0, 4)) await events.think(agent, note); };

  if (input.askQuestions) {
    await events.think('Planner', input.current ? 'Reading your change request…' : 'Reading your brief…');
    const planned = await clarify({ brief: input.current ? `${input.change}\n\n(Existing app: ${input.current.summary})` : input.brief, options: input.options, config: modelConfig('Planner'), onWait: onWait('Planner') });
    await say('Planner', planned.thinking);
    const questions = planned.questions.filter((question) => question.question.trim()).slice(0, 3);
    if (questions.length) return { status: 'needs_input', questions };
  }
  await events.progress(15);

  await events.think('Developer', input.current ? 'Updating the app design for your change…' : 'Designing the data model, pages and sample data…');
  let { thinking, spec } = await developSpec({ ...input, config: modelConfig('Developer'), onWait: onWait('Developer') });
  await say('Developer', thinking);
  await events.progress(35);

  let reviews = 0;
  let reviewApproved = false;
  let verified: Extract<BuildResult, { status: 'built' }> | undefined;
  let previousDesignErrors = '';
  let repeatedDesignErrors = 0;
  const designProblems = (candidate: AppSpec) => [
    ...validateSpec(candidate),
    ...(input.feature && input.current ? preservedDesign(input.current, candidate) : []),
  ];
  for (let round = 1; round <= MAX_FIX_ROUNDS; round++) {
    const repaired = autoRepair(spec);
    spec = repaired.spec;
    if (repaired.repairs.length) await events.think('Verifier', `Auto-fixed ${repaired.repairs.length} small issue${repaired.repairs.length === 1 ? '' : 's'} (${repaired.repairs.slice(0, 2).join('; ')})`);
    let problems = designProblems(spec);
    let app: CompiledApp | undefined;
    const designErrors = JSON.stringify([...problems].sort());
    repeatedDesignErrors = problems.length && designErrors === previousDesignErrors ? repeatedDesignErrors + 1 : 0;
    previousDesignErrors = designErrors;
    if (repeatedDesignErrors >= 2) {
      throw new Error(`The same design errors remained after two repairs. ${problems.join(' | ')}`);
    }
    if (problems.length) {
      await events.think('Verifier', `Found ${problems.length} design problem${problems.length === 1 ? '' : 's'}: ${problems[0]}`);
    } else {
      app = compileSpec(spec);
      await events.think('Verifier', `Booting the app and testing create, list, edit and view for ${spec.entities.length} entities…`);
      problems = await verifyApp(spec, app);
      await events.think('Verifier', problems.length ? `${problems.length} check${problems.length === 1 ? '' : 's'} failed: ${problems[0]}`
        : app.workflows?.length ? 'CRUD and managed submission checks passed on a real database.' : 'All CRUD checks pass on a real database.');
    }
    await events.progress(Math.min(35 + round * 9, 85));

    if (!problems.length && app) {
      verified = { status: 'built', spec, app, reviewApproved };
      if (reviews >= MAX_REVIEWS) return { status: 'built', spec, app, reviewApproved };
      reviews++;
      await events.think('Reviewer', 'Reviewing the app against your brief as an MVP…');
      let review;
      try {
        review = await reviewSpec({ brief: input.reviewBrief ?? input.brief, answers: input.answers, spec, config: modelConfig('Reviewer'), onWait: onWait('Reviewer'), customCode: input.customCode });
      } catch (cause) {
        if (input.feature || !shared || !(cause instanceof AiError)) throw cause;
        await events.think('Reviewer', 'AI review is unavailable. Publishing the app that passed the database checks.');
        return verified;
      }
      await say('Reviewer', review.thinking);
      if (review.approved || (!input.feature && !review.issues.length)) return { status: 'built', spec, app, reviewApproved: true };
      if (!review.issues.length) throw new Error('The feature reviewer rejected the build without actionable feedback. Retry the review.');
      for (const issue of review.issues.slice(0, 3)) await events.think('Reviewer', `${issue.area}: ${issue.problem}`);
      problems = review.issues.map((issue) => `[review: ${issue.area}] ${issue.problem} Fix: ${issue.fix}`);
    }
    if (round === MAX_FIX_ROUNDS) break;
    await events.think('Developer', `Fixing ${problems.length} issue${problems.length === 1 ? '' : 's'}…`);
    let fixed;
    try {
      fixed = await fixSpec({ brief: input.reviewBrief ?? input.brief, answers: input.answers, spec, problems, config: modelConfig('Developer'), onWait: onWait('Developer') });
    } catch (cause) {
      if (input.feature || !verified || !shared || !(cause instanceof AiError)) throw cause;
      await events.think('Verifier', 'AI repair is unavailable. Publishing the last app that passed the database checks.');
      return verified;
    }
    await say('Developer', fixed.thinking);
    // A fix that drops the whole app is a model glitch, not a fix: keep the last design and retry.
    if (fixed.spec.entities.length) spec = fixed.spec;
    else await events.think('Verifier', 'The fix came back empty; keeping the previous design and trying again.');
  }
  // Out of rounds: ship only if the last spec still works, never a broken app.
  spec = autoRepair(spec).spec;
  const finalProblems = designProblems(spec);
  if (!finalProblems.length) {
    const app = compileSpec(spec);
    const failures = await verifyApp(spec, app);
    if (!failures.length) return { status: 'built', spec, app, reviewApproved };
    finalProblems.push(...failures);
  }
  throw new Error(`The app still fails checks after ${MAX_FIX_ROUNDS} rounds: ${finalProblems.slice(0, 2).join(' | ')}`);
}
