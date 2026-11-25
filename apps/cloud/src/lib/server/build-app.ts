import { clarify, developSpec, fixSpec, reviewSpec, type Answer, type Question } from './agents';
import { verifyApp } from './mosaic-runtime';
import type { AiConfig } from './ai';
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

/**
 * Planner → Developer → (Verifier ⇄ Developer) → Reviewer → Developer → … until the app
 * passes real CRUD tests and the reviewer approves (or review rounds run out).
 */
export async function buildApp(
  input: { brief: string; answers: Answer[]; options: string; current?: AppSpec; change?: string; askQuestions: boolean; ai?: AiConfig },
  events: BuildEvents,
): Promise<BuildResult> {
  const config = input.ai;
  const shared = !config || config.provider === 'mosaic';
  const onWait = (seconds: number) => void events.think('Planner', `Waiting ${seconds}s for the AI rate limit${shared ? ' (free shared tier; add your own key in Settings → AI for faster builds)' : ''}…`);
  const say = async (agent: AgentName, notes: string[]) => { for (const note of notes.slice(0, 4)) await events.think(agent, note); };

  if (input.askQuestions) {
    await events.think('Planner', input.current ? 'Reading your change request…' : 'Reading your brief…');
    const planned = await clarify({ brief: input.current ? `${input.change}\n\n(Existing app: ${input.current.summary})` : input.brief, options: input.options, config, onWait });
    await say('Planner', planned.thinking);
    const questions = planned.questions.filter((question) => question.question.trim()).slice(0, 3);
    if (questions.length) return { status: 'needs_input', questions };
  }
  await events.progress(15);

  await events.think('Developer', input.current ? 'Updating the app design for your change…' : 'Designing the data model, pages and sample data…');
  let { thinking, spec } = await developSpec({ brief: input.brief, answers: input.answers, options: input.options, current: input.current, change: input.change, config, onWait });
  await say('Developer', thinking);
  await events.progress(35);

  let reviews = 0;
  let reviewApproved = false;
  for (let round = 1; round <= MAX_FIX_ROUNDS; round++) {
    const repaired = autoRepair(spec);
    spec = repaired.spec;
    if (repaired.repairs.length) await events.think('Verifier', `Auto-fixed ${repaired.repairs.length} small issue${repaired.repairs.length === 1 ? '' : 's'} (${repaired.repairs.slice(0, 2).join('; ')})`);
    let problems = validateSpec(spec);
    let app: CompiledApp | undefined;
    if (problems.length) {
      await events.think('Verifier', `Found ${problems.length} design problem${problems.length === 1 ? '' : 's'}: ${problems[0]}`);
    } else {
      app = compileSpec(spec);
      await events.think('Verifier', `Booting the app and testing create, list, edit and view for ${spec.entities.length} entities…`);
      problems = await verifyApp(spec, app);
      await events.think('Verifier', problems.length ? `${problems.length} check${problems.length === 1 ? '' : 's'} failed: ${problems[0]}` : 'All CRUD checks pass on a real database.');
    }
    await events.progress(Math.min(35 + round * 9, 85));

    if (!problems.length && app) {
      if (reviews >= MAX_REVIEWS) return { status: 'built', spec, app, reviewApproved };
      reviews++;
      await events.think('Reviewer', 'Reviewing the app against your brief as an MVP…');
      const review = await reviewSpec({ brief: input.brief, answers: input.answers, spec, config, onWait });
      await say('Reviewer', review.thinking);
      if (review.approved || !review.issues.length) return { status: 'built', spec, app, reviewApproved: true };
      for (const issue of review.issues.slice(0, 3)) await events.think('Reviewer', `${issue.area}: ${issue.problem}`);
      problems = review.issues.map((issue) => `[review: ${issue.area}] ${issue.problem} Fix: ${issue.fix}`);
    }
    if (round === MAX_FIX_ROUNDS) break;
    await events.think('Developer', `Fixing ${problems.length} issue${problems.length === 1 ? '' : 's'}…`);
    const fixed = await fixSpec({ brief: input.brief, answers: input.answers, spec, problems, config, onWait });
    await say('Developer', fixed.thinking);
    // A fix that drops the whole app is a model glitch, not a fix: keep the last design and retry.
    if (fixed.spec.entities.length) spec = fixed.spec;
    else await events.think('Verifier', 'The fix came back empty; keeping the previous design and trying again.');
  }
  // Out of rounds: ship only if the last spec still works, never a broken app.
  spec = autoRepair(spec).spec;
  const finalProblems = validateSpec(spec);
  if (!finalProblems.length) {
    const app = compileSpec(spec);
    const failures = await verifyApp(spec, app);
    if (!failures.length) return { status: 'built', spec, app, reviewApproved };
    finalProblems.push(...failures);
  }
  throw new Error(`The app still fails checks after ${MAX_FIX_ROUNDS} rounds: ${finalProblems.slice(0, 2).join(' | ')}`);
}
