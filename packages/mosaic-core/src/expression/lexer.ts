/** Tokenizer for the Mosaic mini-expression language (visibility rules, defaults). */

export type TokenType =
  | 'num'
  | 'str'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'lbracket'
  | 'rbracket'
  | 'lbrace'
  | 'rbrace'
  | 'comma'
  | 'dot'
  | 'question'
  | 'colon'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const OPS = [
  '===', '!==', '==', '!=', '>=', '<=', '&&', '||', '??',
  '>', '<', '+', '-', '*', '/', '%', '!',
];

const ID_START = /[A-Za-z_$]/;
const ID_PART = /[A-Za-z0-9_$]/;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const err = (msg: string): never => {
    throw new SyntaxError(`Expression error at ${i}: ${msg} in \`${input}\``);
  };
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') { tokens.push({ type: 'lparen', value: ch, pos: i++ }); continue; }
    if (ch === ')') { tokens.push({ type: 'rparen', value: ch, pos: i++ }); continue; }
    if (ch === '[') { tokens.push({ type: 'lbracket', value: ch, pos: i++ }); continue; }
    if (ch === ']') { tokens.push({ type: 'rbracket', value: ch, pos: i++ }); continue; }
    if (ch === '{') { tokens.push({ type: 'lbrace', value: ch, pos: i++ }); continue; }
    if (ch === '}') { tokens.push({ type: 'rbrace', value: ch, pos: i++ }); continue; }
    if (ch === ',') { tokens.push({ type: 'comma', value: ch, pos: i++ }); continue; }
    if (ch === '.') { tokens.push({ type: 'dot', value: ch, pos: i++ }); continue; }
    if (ch === '?' && input[i + 1] === '?') { tokens.push({ type: 'op', value: '??', pos: i }); i += 2; continue; }
    if (ch === '?') { tokens.push({ type: 'question', value: ch, pos: i++ }); continue; }
    if (ch === ':') { tokens.push({ type: 'colon', value: ch, pos: i++ }); continue; }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let out = '';
      while (j < input.length && input[j] !== quote) {
        if (input[j] === '\\' && j + 1 < input.length) {
          const next = input[j + 1]!;
          out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          j += 2;
        } else {
          out += input[j];
          j++;
        }
      }
      if (j >= input.length) err('unterminated string');
      tokens.push({ type: 'str', value: out, pos: i });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let j = i;
      while (j < input.length && /[0-9._eE]/.test(input[j]!)) {
        if ((input[j] === 'e' || input[j] === 'E') && (input[j + 1] === '+' || input[j + 1] === '-')) j++;
        j++;
      }
      tokens.push({ type: 'num', value: input.slice(i, j).replace(/_/g, ''), pos: i });
      i = j;
      continue;
    }
    if (ID_START.test(ch)) {
      let j = i;
      while (j < input.length && ID_PART.test(input[j]!)) j++;
      tokens.push({ type: 'ident', value: input.slice(i, j), pos: i });
      i = j;
      continue;
    }
    const op = OPS.find((o) => input.startsWith(o, i));
    if (op) {
      tokens.push({ type: 'op', value: op, pos: i });
      i += op.length;
      continue;
    }
    err(`unexpected character \`${ch}\``);
  }
  tokens.push({ type: 'eof', value: '', pos: i });
  return tokens;
}
