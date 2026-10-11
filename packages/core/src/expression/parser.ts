/**
 * Sandbox expression parser - produces an AST consumed by `interpreter.ts`.
 * Grammar: ternary, nullish, or, and, equality, relational, additive,
 * multiplicative, unary, postfix (member/index/call), primary (literals,
 * identifiers, grouped expr, array literals).
 */

import { tokenize, type Token } from './lexer.js';

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'null'; v: null }
  | { k: 'undefined' }
  | { k: 'ident'; name: string }
  | { k: 'member'; obj: Expr; name: string }
  | { k: 'index'; obj: Expr; index: Expr }
  | { k: 'call'; callee: Expr; args: Expr[] }
  | { k: 'unary'; op: string; operand: Expr }
  | { k: 'binary'; op: string; left: Expr; right: Expr }
  | { k: 'logical'; op: string; left: Expr; right: Expr }
  | { k: 'cond'; test: Expr; then: Expr; other: Expr }
  | { k: 'array'; items: Expr[] };

export const BLOCKED_KEYS = new Set(['constructor', '__proto__', 'prototype', 'eval', 'Function']);

const ALLOWED_METHODS = new Set([
  'startsWith', 'endsWith', 'includes', 'toLowerCase', 'toUpperCase', 'trim',
  'slice', 'indexOf', 'split', 'join', 'replace', 'toString', 'toFixed',
  'isArray', 'floor', 'ceil', 'round', 'abs', 'min', 'max', 'pow', 'sqrt',
  'map', 'filter', 'reduce', 'some', 'every', 'find', 'push', 'charAt',
]);

export { ALLOWED_METHODS };

export class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos]!; }
  private next(): Token { return this.tokens[this.pos++]!; }
  private isOp(...values: string[]): boolean {
    const t = this.peek();
    return t.type === 'op' && values.includes(t.value);
  }
  private expect(type: Token['type'], value?: string): Token {
    const t = this.next();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new SyntaxError(`Expected ${value ?? type} but got \`${t.value || t.type}\``);
    }
    return t;
  }

  parse(): Expr {
    const expr = this.parseTernary();
    if (this.peek().type !== 'eof') throw new SyntaxError(`Unexpected \`${this.peek().value}\``);
    return expr;
  }

  private parseTernary(): Expr {
    const test = this.parseNullish();
    if (this.peek().type === 'question') {
      this.next();
      const then = this.parseTernary();
      this.expect('colon');
      const other = this.parseTernary();
      return { k: 'cond', test, then, other };
    }
    return test;
  }

  private parseNullish(): Expr {
    let left = this.parseOr();
    while (this.isOp('??')) {
      this.next();
      left = { k: 'logical', op: '??', left, right: this.parseOr() };
    }
    return left;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.isOp('||')) {
      this.next();
      left = { k: 'logical', op: '||', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseEquality();
    while (this.isOp('&&')) {
      this.next();
      left = { k: 'logical', op: '&&', left, right: this.parseEquality() };
    }
    return left;
  }

  private parseEquality(): Expr {
    let left = this.parseRelational();
    while (this.isOp('==', '!=', '===', '!==')) {
      const op = this.next().value;
      left = { k: 'binary', op, left, right: this.parseRelational() };
    }
    return left;
  }

  private parseRelational(): Expr {
    let left = this.parseAdditive();
    while (this.isOp('<', '<=', '>', '>=')) {
      const op = this.next().value;
      left = { k: 'binary', op, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.isOp('+', '-')) {
      const op = this.next().value;
      left = { k: 'binary', op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.isOp('*', '/', '%')) {
      const op = this.next().value;
      left = { k: 'binary', op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.isOp('!', '-')) {
      const op = this.next().value;
      return { k: 'unary', op, operand: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let node = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (t.type === 'dot') {
        this.next();
        const name = this.expect('ident').value;
        if (BLOCKED_KEYS.has(name)) throw new SyntaxError(`Access to \`${name}\` is not allowed`);
        node = { k: 'member', obj: node, name };
      } else if (t.type === 'lbracket') {
        this.next();
        const index = this.parseTernary();
        this.expect('rbracket');
        node = { k: 'index', obj: node, index };
      } else if (t.type === 'lparen') {
        this.next();
        const args: Expr[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.parseTernary());
          while (this.peek().type === 'comma') { this.next(); args.push(this.parseTernary()); }
        }
        this.expect('rparen');
        node = { k: 'call', callee: node, args };
      } else break;
    }
    return node;
  }

  private parsePrimary(): Expr {
    const t = this.next();
    if (t.type === 'num') return { k: 'num', v: Number(t.value) };
    if (t.type === 'str') return { k: 'str', v: t.value };
    if (t.type === 'ident') {
      if (t.value === 'true') return { k: 'bool', v: true };
      if (t.value === 'false') return { k: 'bool', v: false };
      if (t.value === 'null') return { k: 'null', v: null };
      if (t.value === 'undefined') return { k: 'undefined' };
      if (BLOCKED_KEYS.has(t.value)) throw new SyntaxError(`\`${t.value}\` is not allowed`);
      return { k: 'ident', name: t.value };
    }
    if (t.type === 'lparen') {
      const inner = this.parseTernary();
      this.expect('rparen');
      return inner;
    }
    if (t.type === 'lbracket') {
      const items: Expr[] = [];
      if (this.peek().type !== 'rbracket') {
        items.push(this.parseTernary());
        while (this.peek().type === 'comma') { this.next(); items.push(this.parseTernary()); }
      }
      this.expect('rbracket');
      return { k: 'array', items };
    }
    throw new SyntaxError(`Unexpected \`${t.value || t.type}\``);
  }
}
