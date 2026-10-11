/** AST interpreter + public expression API (compile w/ cache, fail-soft eval). */

import { tokenize } from './lexer.js';
import { ALLOWED_METHODS, BLOCKED_KEYS, Parser, type Expr } from './parser.js';

export type Scope = Record<string, unknown>;

function truthy(v: unknown): boolean {
  return Boolean(v);
}

function memberOf(obj: unknown, name: string): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (BLOCKED_KEYS.has(name)) return undefined;
  if (typeof obj === 'string' || Array.isArray(obj)) {
    if (name === 'length') return (obj as { length: number }).length;
  }
  if (typeof obj === 'object') {
    const rec = obj as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(rec, name)) return rec[name];
    return undefined;
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') return undefined;
  return (obj as Record<string, unknown>)[name];
}

function interpret(node: Expr, scope: Scope): unknown {
  switch (node.k) {
    case 'num': return node.v;
    case 'str': return node.v;
    case 'bool': return node.v;
    case 'null': return null;
    case 'undefined': return undefined;
    case 'ident': return scope[node.name];
    case 'member': return memberOf(interpret(node.obj, scope), node.name);
    case 'index': {
      const obj = interpret(node.obj, scope);
      const idx = interpret(node.index, scope);
      if (obj === null || obj === undefined) return undefined;
      if (typeof obj === 'string') {
        const i = Number(idx);
        return Number.isInteger(i) && i >= 0 && i < obj.length ? obj[i] : undefined;
      }
      if (Array.isArray(obj)) return (obj as unknown[])[Number(idx)];
      return memberOf(obj, String(idx));
    }
    case 'array': return node.items.map((i) => interpret(i, scope));
    case 'unary': {
      const v = interpret(node.operand, scope);
      if (node.op === '!') return !truthy(v);
      if (node.op === '-') return -(Number(v));
      return undefined;
    }
    case 'logical': {
      const left = interpret(node.left, scope);
      if (node.op === '&&') return truthy(left) ? interpret(node.right, scope) : left;
      if (node.op === '||') return truthy(left) ? left : interpret(node.right, scope);
      if (node.op === '??') return left === null || left === undefined ? interpret(node.right, scope) : left;
      return undefined;
    }
    case 'binary': {
      const l = interpret(node.left, scope);
      const r = interpret(node.right, scope);
      switch (node.op) {
        case '===': return l === r;
        case '!==': return l !== r;
        case '==': return l == r; // eslint-disable-line eqeqeq
        case '!=': return l != r; // eslint-disable-line eqeqeq
        case '<': return Number(l) < Number(r);
        case '<=': return Number(l) <= Number(r);
        case '>': return Number(l) > Number(r);
        case '>=': return Number(l) >= Number(r);
        case '+':
          if (typeof l === 'string' || typeof r === 'string') return String(l ?? '') + String(r ?? '');
          return Number(l) + Number(r);
        case '-': return Number(l) - Number(r);
        case '*': return Number(l) * Number(r);
        case '/': return Number(l) / Number(r);
        case '%': return Number(l) % Number(r);
        default: return undefined;
      }
    }
    case 'cond': return truthy(interpret(node.test, scope)) ? interpret(node.then, scope) : interpret(node.other, scope);
    case 'call': {
      // resolve method calls: callee must be member/index; validate method name
      let thisArg: unknown;
      let fnName: string;
      if (node.callee.k === 'member') {
        thisArg = interpret(node.callee.obj, scope);
        fnName = node.callee.name;
      } else if (node.callee.k === 'index') {
        thisArg = interpret(node.callee.obj, scope);
        fnName = String(interpret(node.callee.index, scope));
      } else {
        throw new SyntaxError('Only method calls are allowed in expressions');
      }
      if (!ALLOWED_METHODS.has(fnName)) {
        throw new SyntaxError(`Call to \`${fnName}\` is not allowed`);
      }
      const args = node.args.map((a) => interpret(a, scope));
      const target = thisArg as unknown as Record<string, unknown>;
      const fn = target?.[fnName];
      if (typeof fn !== 'function') {
        // allow Math.* style statics: Math.floor -> fn undefined on boxed? handled below
        const statics = MATH_STATIC[fnName];
        if (statics && (thisArg === Math || thisArg === undefined)) {
          return (statics as (...a: unknown[]) => unknown)(...args);
        }
        return undefined;
      }
      return (fn as (...a: unknown[]) => unknown).apply(thisArg, args);
    }
    default: return undefined;
  }
}

const MATH_STATIC: Record<string, (...args: number[]) => number> = {
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  abs: Math.abs, min: Math.min, max: Math.max, pow: Math.pow, sqrt: Math.sqrt,
};

const cache = new Map<string, Expr>();

function parse(expr: string): Expr {
  let ast = cache.get(expr);
  if (!ast) {
    ast = new Parser(tokenize(expr)).parse();
    if (cache.size > 500) cache.clear();
    cache.set(expr, ast);
  }
  return ast;
}

/** Evaluate; throws SyntaxError on bad syntax, returns undefined on runtime miss. */
export function evaluateExpression(expr: string, scope: Scope): unknown {
  if (!expr.trim()) return undefined;
  return interpret(parse(expr), scope);
}

export interface EvalResult {
  ok: boolean;
  value: unknown;
  error?: string;
}

/** Fail-soft variant used by visibility rules and computed defaults. */
export function tryEvaluate(expr: string, scope: Scope): EvalResult {
  try {
    return { ok: true, value: evaluateExpression(expr, scope) };
  } catch (err) {
    return { ok: false, value: undefined, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Boolean helper: `isVisible('x > 1', data)` — fails open (true) on bad expr. */
export function evaluateBoolean(expr: string, scope: Scope, fallback = true): boolean {
  const res = tryEvaluate(expr, scope);
  if (!res.ok) return fallback;
  return truthy(res.value);
}
