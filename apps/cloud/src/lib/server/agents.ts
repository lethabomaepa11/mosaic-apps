import { aiJson, type AiConfig } from './ai';
import { MOSAIC_KNOWLEDGE } from './mosaic-knowledge';
import { APP_SPEC_SCHEMA, describeSpec, normalizeSpec, type AppSpec } from './spec';

export interface Question { question: string; options: string[] }
export interface Answer { question: string; answer: string }
export interface ReviewIssue { area: string; problem: string; fix: string }

const thinking = { type: 'array', items: { type: 'string' } } as const;
const briefBlock = (brief: string, answers: Answer[]) =>
  `BRIEF:\n${brief}${answers.length ? `\n\nTHE USER ANSWERED:\n${answers.map((item) => `- ${item.question} → ${item.answer}`).join('\n')}` : ''}`;
const NOTE = 'Also return "thinking": 2-4 short first-person progress notes for the user (e.g. "Modelling loans as a link between equipment and employees"). Plain words, no JSON or jargon. Follow everything the user said; where they left something open (or said to decide), choose a sensible default and say it in a note (e.g. "Assuming reception staff and practitioners sign in").';

/** Planner: ask only what genuinely changes the app; otherwise proceed with sensible defaults. */
export async function clarify(input: { brief: string; options: string; config?: AiConfig; onWait?: (seconds: number) => void }): Promise<{ thinking: string[]; questions: Question[] }> {
  return aiJson({
    name: 'mosaic_clarify', maxTokens: 1500, config: input.config, onWait: input.onWait,
    system: `You are the product planner for Mosaic, which builds business web apps from a brief.\nDecide whether the brief is clear enough to build a solid MVP. Ask questions ONLY when the answer would materially change the data model or who uses the app (e.g. who signs in, what the core records are, a key workflow). Never ask about colours, tech stack or things you can sensibly assume. Ask at most 3 questions, each with 2-4 short suggested answers. If the brief is clear, return an empty questions list.\n${NOTE}`,
    user: `${input.brief}\n\nOPTIONS: ${input.options}`,
    schema: { type: 'object', additionalProperties: false, required: ['thinking', 'questions'], properties: { thinking, questions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['question', 'options'], properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } } } } } },
  });
}

const specAnswer = { type: 'object', additionalProperties: false, required: ['thinking', 'spec'], properties: { thinking, spec: APP_SPEC_SCHEMA } } as const;

// Spec answers are large; strict mode rejects a whole answer over one missing key, so guide
// with the schema and normalise the result instead.
async function specCall(input: { name: string; system: string; user: string; schema: object; config?: AiConfig; onWait?: (seconds: number) => void }): Promise<{ thinking: string[]; spec: AppSpec }> {
  const raw = await aiJson<{ thinking?: unknown; spec?: unknown }>({ ...input, strict: false });
  return { thinking: Array.isArray(raw.thinking) ? raw.thinking.map(String) : [], spec: normalizeSpec(raw.spec ?? raw) };
}

/** Developer: writes the first spec, or revises the current one for a change request. */
export async function developSpec(input: { brief: string; answers: Answer[]; options: string; current?: AppSpec; change?: string; config?: AiConfig; onWait?: (seconds: number) => void }): Promise<{ thinking: string[]; spec: AppSpec }> {
  const task = input.current
    ? `CURRENT APP SPEC (JSON):\n${JSON.stringify(input.current)}\n\nREQUESTED CHANGE:\n${input.change}\n\nReturn the complete updated spec. Keep existing entity and field names unless the change requires renaming (renames lose data).`
    : 'Write the complete app spec for this brief.';
  return specCall({
    name: 'mosaic_app_spec', config: input.config, onWait: input.onWait,
    system: `You are a senior Mosaic developer. ${MOSAIC_KNOWLEDGE}\n${NOTE}`,
    user: `${briefBlock(input.brief, input.answers)}\n\nOPTIONS: ${input.options}\n\n${task}`,
    schema: specAnswer,
  });
}

/** Developer: repairs the spec against verifier errors or reviewer feedback. */
export async function fixSpec(input: { brief: string; answers: Answer[]; spec: AppSpec; problems: string[]; config?: AiConfig; onWait?: (seconds: number) => void }): Promise<{ thinking: string[]; spec: AppSpec }> {
  return specCall({
    name: 'mosaic_app_spec_fix', config: input.config, onWait: input.onWait,
    system: `You are a senior Mosaic developer fixing an app spec. ${MOSAIC_KNOWLEDGE}\nFix every listed problem and change nothing else that works. ${NOTE}`,
    user: `${briefBlock(input.brief, input.answers)}\n\nCURRENT APP SPEC (JSON):\n${JSON.stringify(input.spec)}\n\nPROBLEMS TO FIX:\n${input.problems.map((problem, index) => `${index + 1}. ${problem}`).join('\n')}`,
    schema: specAnswer,
  });
}

/** Reviewer: an independent check that the app is a complete, sensible MVP for the brief. */
export async function reviewSpec(input: { brief: string; answers: Answer[]; spec: AppSpec; config?: AiConfig; onWait?: (seconds: number) => void }): Promise<{ thinking: string[]; approved: boolean; issues: ReviewIssue[] }> {
  return aiJson({
    name: 'mosaic_review', maxTokens: 2000, config: input.config, onWait: input.onWait,
    system: `You are a strict but practical reviewer of Mosaic MVPs. ${MOSAIC_KNOWLEDGE}\nThe app below already passed automated CRUD tests. Judge whether it is a complete, sensible MVP for the brief: every workflow possible, CRUD for every core record, correct relationships, statuses/dates/amounts the domain needs, sensible roles and permissions, clear navigation, realistic sample data. Report only issues that block the MVP (at most 5), each with a concrete fix. Approve when nothing blocks the MVP. ${NOTE}`,
    user: `${briefBlock(input.brief, input.answers)}\n\nAPP:\n${describeSpec(input.spec)}`,
    schema: { type: 'object', additionalProperties: false, required: ['thinking', 'approved', 'issues'], properties: { thinking, approved: { type: 'boolean' }, issues: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['area', 'problem', 'fix'], properties: { area: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } } } } } },
  });
}
