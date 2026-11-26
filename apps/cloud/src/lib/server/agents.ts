import { aiJson, type AiConfig } from './ai';
import { frameworkGuideContext, MOSAIC_KNOWLEDGE } from './mosaic-knowledge';
import { APP_SPEC_SCHEMA, describeSpec, normalizeSpec, type AppSpec } from './spec';

export interface Question { question: string; options: string[] }
export interface Answer { question: string; answer: string }
export interface ReviewIssue { area: string; problem: string; fix: string }
export interface BuildFeature { name: string; scope: string; acceptance: string[] }

const thinking = { type: 'array', items: { type: 'string' } } as const;
const strings = { type: 'array', items: { type: 'string' } } as const;
const questionsSchema = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['question', 'options'], properties: { question: { type: 'string' }, options: strings } } } as const;
const briefBlock = (brief: string, answers: Answer[]) =>
  `BRIEF:\n${brief}${answers.length ? `\n\nTHE USER ANSWERED:\n${answers.map((item) => `- ${item.question} → ${item.answer}`).join('\n')}` : ''}`;
const NOTE = 'Also return "thinking": 2-4 short first-person progress notes for the user (e.g. "Modelling loans as a link between equipment and employees"). Plain words, no JSON or jargon. Follow everything the user said; where they left something open (or said to decide), choose a sensible default and say it in a note (e.g. "Assuming reception staff and practitioners sign in").';

/** Planner: ask only what genuinely changes the app; otherwise proceed with sensible defaults. */
export async function clarify(input: { brief: string; options: string; config?: AiConfig; onWait?: (seconds: number) => void }): Promise<{ thinking: string[]; questions: Question[] }> {
  return aiJson({
    name: 'mosaic_clarify', maxTokens: 1500, config: input.config, onWait: input.onWait,
    system: `You are the product planner for Mosaic, which builds business web apps from a brief.\nDecide whether the brief is clear enough to build a solid MVP. Ask questions ONLY when the answer would materially change the data model or who uses the app (e.g. who signs in, what the core records are, a key workflow). Never ask about colours, tech stack or things you can sensibly assume. Ask at most 3 questions, each with 2-4 short suggested answers. If the brief is clear, return an empty questions list.\n${NOTE}`,
    user: `${input.brief}\n\nOPTIONS: ${input.options}`,
    schema: { type: 'object', additionalProperties: false, required: ['thinking', 'questions'], properties: { thinking, questions: questionsSchema } },
  });
}

type PlanningInput = { brief: string; answers: Answer[]; options: string; config: AiConfig; onWait: (seconds: number) => Promise<void> };

export async function refineBrief(input: PlanningInput): Promise<{ spec: string; questions: Question[] }> {
  const result = await aiJson<{ spec: string; questions: Question[] }>({
    name: 'mosaic_refine_brief', maxTokens: 3200, config: input.config, onWait: input.onWait,
    system: `You evaluate app briefs and turn them into implementation-ready product specs. ${MOSAIC_KNOWLEDGE}
Preserve explicit requirements, workflows, roles, permissions, edge cases and acceptance criteria. Document actors, access, data, screens, how each workflow starts and ends, business rules and how to verify it. For a well-defined brief, refine directly without asking redundant questions. Ask up to 3 specific questions with suggested answers when missing or contradictory requirements materially change the application. Use prior answers and avoid repeating resolved questions. If the user delegates, choose reasonable defaults for ambiguity.
Cloud supports managed submission endpoints that derive ownership, organization and initial status on the server. Users can choose entries from readable directories. Managed submissions can use existing profiles or create a simple profile tied to a public signup's account ID on first use. It cannot implement arbitrary approval transitions, balance accounting, per-record browsing, tenant-wide access policies, custom invitations, email verification or password recovery. Treat framework-only examples in the reference as developer extensions. When an explicit requirement cannot be delivered, explain it in a question and request explicit approval of a safe, specific scope reduction before proceeding. General delegation does not approve removing requirements or weakening security. Where scope is explicitly reduced, record excluded requirements so the planner cannot treat them as delivered. Return an empty spec while questions remain.`,
    user: `${briefBlock(input.brief, input.answers)}\n\nOPTIONS: ${input.options}${frameworkGuideContext(input.brief)}`,
    schema: { type: 'object', additionalProperties: false, required: ['spec', 'questions'], properties: { spec: { type: 'string' }, questions: questionsSchema } },
  });
  if (typeof result.spec !== 'string' || !Array.isArray(result.questions) || (!result.spec.trim() && !result.questions.length)
      || result.questions.some((item) => typeof item?.question !== 'string' || !item.question.trim()
        || !Array.isArray(item.options) || item.options.some((option) => typeof option !== 'string'))) {
    throw new Error('The brief evaluator returned an incomplete result. Retry to continue refining the brief.');
  }
  return { spec: result.spec.trim(), questions: result.questions.slice(0, 3) };
}

export async function planFeatures(input: PlanningInput & { refinedSpec: string }): Promise<BuildFeature[]> {
  const result = await aiJson<{ features: BuildFeature[] }>({
    name: 'mosaic_feature_plan', maxTokens: 3200, config: input.config, onWait: input.onWait,
    system: 'You are the feature planner. Break the approved spec into dependency-ordered vertical slices. The first slice must deliver a usable workflow in preview, including required access controls. Each later slice should add one coherent feature or workflow with observable acceptance checks. Cover the agreed scope, carry forward required details from the original brief and answers, and respect exclusions in the refined spec. Use one slice only for an app with a single coherent feature. Name each slice and return focused scope and concrete acceptance checks.',
    user: `${briefBlock(input.brief, input.answers)}\n\nOPTIONS: ${input.options}\n\nREFINED SPEC:\n${input.refinedSpec}${frameworkGuideContext(input.refinedSpec)}`,
    schema: { type: 'object', additionalProperties: false, required: ['features'], properties: {
      features: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'scope', 'acceptance'], properties: { name: { type: 'string' }, scope: { type: 'string' }, acceptance: strings } } },
    } },
  });
  if (!Array.isArray(result.features) || !result.features.length || result.features.some((item) =>
    typeof item?.name !== 'string' || !item.name.trim() || typeof item.scope !== 'string' || !item.scope.trim()
    || !Array.isArray(item.acceptance) || !item.acceptance.length || item.acceptance.some((check) => typeof check !== 'string' || !check.trim()))) {
    throw new Error('The planner returned an incomplete feature plan. Retry to continue planning.');
  }
  return result.features;
}

const specAnswer = { type: 'object', additionalProperties: false, required: ['thinking', 'spec'], properties: { thinking, spec: APP_SPEC_SCHEMA } } as const;

// Spec answers are large; strict mode rejects a whole answer over one missing key, so guide
// with the schema and normalise the result instead.
async function specCall(input: { name: string; system: string; user: string; schema: object; config?: AiConfig; onWait?: (seconds: number) => void }): Promise<{ thinking: string[]; spec: AppSpec }> {
  const raw = await aiJson<{ thinking?: unknown; spec?: unknown }>({ ...input, strict: false });
  return { thinking: Array.isArray(raw.thinking) ? raw.thinking.map(String) : [], spec: normalizeSpec(raw.spec ?? raw) };
}

/** Developer: writes the first spec, or revises the current one for a change request. */
export async function developSpec(input: { brief: string; answers: Answer[]; options: string; current?: AppSpec; change?: string; feature?: BuildFeature; config?: AiConfig; onWait?: (seconds: number) => void }): Promise<{ thinking: string[]; spec: AppSpec }> {
  const task = input.current
    ? `CURRENT APP SPEC (JSON):\n${JSON.stringify(input.current)}\n\nREQUESTED CHANGE:\n${input.change}\n\nReturn the complete updated spec. Keep existing entity and field names unless the change requires renaming (renames lose data). Preserve public registration and permissions unless the request changes who can sign up or what they can do.`
    : 'Write the complete app spec for this brief.';
  return specCall({
    name: 'mosaic_app_spec', config: input.config, onWait: input.onWait,
    system: `You are a senior Mosaic developer. ${MOSAIC_KNOWLEDGE}\n${NOTE}`,
    user: `${briefBlock(input.brief, input.answers)}\n\nOPTIONS: ${input.options}\n\n${task}\n${input.feature ? 'Implement only the current feature described in the brief. Preserve existing routes, access, and working workflows.' : ''}\nGive the primary user a task-focused starting screen with domain-specific sections and action labels. Choose a compact menu based on the brief.${frameworkGuideContext(input.change ?? input.brief)}`,
    schema: specAnswer,
  });
}

/** Developer: repairs the spec against verifier errors or reviewer feedback. */
export async function fixSpec(input: { brief: string; answers: Answer[]; spec: AppSpec; problems: string[]; config?: AiConfig; onWait?: (seconds: number) => void }): Promise<{ thinking: string[]; spec: AppSpec }> {
  return specCall({
    name: 'mosaic_app_spec_fix', config: input.config, onWait: input.onWait,
    system: `You are a senior Mosaic developer fixing an app spec. ${MOSAIC_KNOWLEDGE}\nFix every listed problem and change nothing else that works. ${NOTE}`,
    user: `${briefBlock(input.brief, input.answers)}\n\nCURRENT APP SPEC (JSON):\n${JSON.stringify(input.spec)}\n\nPROBLEMS TO FIX:\n${input.problems.map((problem, index) => `${index + 1}. ${problem}`).join('\n')}${frameworkGuideContext(input.problems.join(' '))}`,
    schema: specAnswer,
  });
}

/** Reviewer: an independent check that the app is a complete, sensible MVP for the brief. */
export async function reviewSpec(input: { brief: string; answers: Answer[]; spec: AppSpec; config?: AiConfig; onWait?: (seconds: number) => void }): Promise<{ thinking: string[]; approved: boolean; issues: ReviewIssue[] }> {
  return aiJson({
    name: 'mosaic_review', maxTokens: 2000, config: input.config, onWait: input.onWait,
    system: `You are a strict but practical reviewer of Mosaic apps. ${MOSAIC_KNOWLEDGE}\nThe app below already passed automated CRUD tests. Check that someone can find and complete each main task from the navigation and workflow sections. Check every stated acceptance criterion within the requested scope. A workflow description or status field is not evidence that automation or access checks run. Missing task-specific screens or actions are blocking issues even if records can be entered in management tables. Check relationships, statuses, roles, permissions, and sample data. Report at most 5 blocking issues with concrete fixes. Approve when nothing blocks the agreed scope. ${NOTE}`,
    user: `${briefBlock(input.brief, input.answers)}\n\nAPP:\n${describeSpec(input.spec)}`,
    schema: { type: 'object', additionalProperties: false, required: ['thinking', 'approved', 'issues'], properties: { thinking, approved: { type: 'boolean' }, issues: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['area', 'problem', 'fix'], properties: { area: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } } } } } },
  });
}
