// Tokenizer for the C subset libft needs. Handles comments, simple #define
// macros (object-like only) and skips every other preprocessor line.

export class CSyntaxError extends Error {
  constructor(msg, line, col) {
    super(msg);
    this.line = line;
    this.col = col;
  }
}

const KEYWORDS = new Set([
  "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum",
  "extern", "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return",
  "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void",
  "volatile", "while",
]);

const OPS = [
  "...", "<<=", ">>=", "->", "++", "--", "<<", ">>", "<=", ">=", "==", "!=", "&&", "||",
  "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=",
  "+", "-", "*", "/", "%", "<", ">", "=", "!", "~", "&", "|", "^", "?", ":", ";", ",", ".",
  "(", ")", "[", "]", "{", "}",
];

// Macros every libft file can rely on without seeing the headers.
const BUILTIN_MACROS = {
  NULL: "((void *)0)",
  INT_MAX: "2147483647",
  INT_MIN: "(-2147483647 - 1)",
  UINT_MAX: "4294967295U",
  LONG_MAX: "9223372036854775807L",
  LONG_MIN: "(-9223372036854775807L - 1)",
  SIZE_MAX: "18446744073709551615UL",
  CHAR_BIT: "8",
  EOF: "(-1)",
  STDIN_FILENO: "0",
  STDOUT_FILENO: "1",
  STDERR_FILENO: "2",
  O_RDONLY: "0",
  O_WRONLY: "1",
  O_RDWR: "2",
  O_CREAT: "64",
  OPEN_MAX: "1024",
  FD_SETSIZE: "1024",
};

const ESCAPES = { n: 10, t: 9, r: 13, v: 11, f: 12, a: 7, b: 8, e: 27, "\\": 92, "'": 39, '"': 34, "?": 63 };

function readEscape(src, i, line, col) {
  // src[i] is the character after the backslash
  const c = src[i];
  if (c in ESCAPES) return [ESCAPES[c], i + 1];
  if (c === "x") {
    let j = i + 1, v = 0;
    while (j < src.length && /[0-9a-fA-F]/.test(src[j])) v = v * 16 + parseInt(src[j++], 16);
    if (j === i + 1) throw new CSyntaxError("\\x needs hex digits", line, col);
    return [v & 255, j];
  }
  if (/[0-7]/.test(c)) {
    let j = i, v = 0;
    while (j < i + 3 && /[0-7]/.test(src[j])) v = v * 8 + (src.charCodeAt(j++) - 48);
    return [v & 255, j];
  }
  throw new CSyntaxError(`unknown escape \\${c}`, line, col);
}

function rawTokens(src, macros) {
  const toks = [];
  let i = 0, line = 1, lineStart = 0;
  let atLineStart = true;
  const col = () => i - lineStart + 1;
  // #if / #ifdef / #ifndef nesting: each level knows whether it is on and whether a branch was taken
  const conds = [];
  const live = () => conds.every((c) => c.on);

  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; lineStart = i; atLineStart = true; continue; }
    if (c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v") { i++; continue; }
    // inside a branch that is switched off, only directives matter
    if (!live() && !(c === "#" && atLineStart)) { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) throw new CSyntaxError("comment is never closed with */", line, col());
      for (let j = i; j < end; j++) if (src[j] === "\n") { line++; lineStart = j + 1; }
      i = end + 2;
      continue;
    }
    if (c === "#" && atLineStart) {
      // collect the directive, honouring backslash-newline continuations
      let j = i, text = "";
      while (j < src.length && src[j] !== "\n") {
        if (src[j] === "\\" && src[j + 1] === "\n") { text += " "; j += 2; line++; lineStart = j; continue; }
        text += src[j++];
      }
      directive(text.replace(/\/\*.*?\*\/|\/\/.*$/g, "").trim(), conds, live, macros, line);
      i = j;
      continue;
    }
    atLineStart = false;
    const start = i, startCol = col();

    if (/[A-Za-z_]/.test(c)) {
      while (i < src.length && /\w/.test(src[i])) i++;
      const v = src.slice(start, i);
      toks.push({ t: KEYWORDS.has(v) ? "kw" : "id", v, line, col: startCol, pos: start, end: i });
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1]))) {
      let m = /^(0[xX][0-9a-fA-F]+|[0-9]+)([uUlL]*)/.exec(src.slice(i));
      if (!m || /^[0-9]*\.[0-9]/.test(src.slice(i)) || /[eE]/.test(src[i + (m ? m[0].length : 0)] || "")) {
        throw new CSyntaxError("floating-point numbers are not supported", line, startCol);
      }
      i += m[0].length;
      if (/\w/.test(src[i] || "")) throw new CSyntaxError(`bad number ${src.slice(start, i + 1)}`, line, startCol);
      let digits = m[1];
      let value = digits.length > 1 && digits[0] === "0" && !/[xX]/.test(digits[1])
        ? BigInt("0o" + digits.slice(1))
        : BigInt(digits);
      const suf = m[2].toLowerCase();
      toks.push({ t: "num", v: value, suffix: suf, hexOrOct: digits.length > 1 && digits[0] === "0", line, col: startCol, pos: start, end: i });
      continue;
    }
    if (c === "'") {
      i++;
      let v;
      if (src[i] === "\\") [v, i] = readEscape(src, i + 1, line, col());
      else if (src[i] === "'" || src[i] === "\n" || i >= src.length) throw new CSyntaxError("empty character literal", line, startCol);
      else { v = src.charCodeAt(i) & 255; i++; }
      if (src[i] !== "'") throw new CSyntaxError("character literal needs a closing '", line, startCol);
      i++;
      // char is signed on the 42 machines, so '\x80' is -128 like with cc
      toks.push({ t: "char", v: BigInt(v > 127 ? v - 256 : v), line, col: startCol, pos: start, end: i });
      continue;
    }
    if (c === '"') {
      i++;
      const bytes = [];
      while (src[i] !== '"') {
        if (i >= src.length || src[i] === "\n") throw new CSyntaxError('string is never closed with "', line, startCol);
        if (src[i] === "\\") {
          if (src[i + 1] === "\n") { i += 2; line++; lineStart = i; continue; }
          let v; [v, i] = readEscape(src, i + 1, line, col()); bytes.push(v);
        } else {
          // keep UTF-8 bytes so multibyte characters take their real size
          for (const b of new TextEncoder().encode(src[i])) bytes.push(b);
          i++;
        }
      }
      i++;
      toks.push({ t: "str", v: bytes, line, col: startCol, pos: start, end: i });
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new CSyntaxError(`unexpected character '${c}'`, line, startCol);
    i += op.length;
    toks.push({ t: "op", v: op, line, col: startCol, pos: start, end: i });
  }
  if (conds.length) throw new CSyntaxError("#if, #ifdef or #ifndef is missing its #endif", line, 1);
  return toks;
}

function directive(text, conds, live, macros, line) {
  const d = /^#\s*(\w*)\s*(.*)$/.exec(text);
  const kind = d ? d[1] : "", arg = d ? d[2].trim() : "";
  const top = conds[conds.length - 1];
  const need = () => { if (!top) throw new CSyntaxError(`#${kind} without a matching #if`, line, 1); };
  switch (kind) {
    case "ifdef": case "ifndef": {
      const parent = live();
      const on = parent && ((kind === "ifdef") === (arg.split(/\s/)[0] in macros));
      conds.push({ on, taken: on, parent });
      break;
    }
    case "if": {
      const parent = live();
      const on = parent && evalIf(arg, macros, line);
      conds.push({ on, taken: on, parent });
      break;
    }
    case "elif":
      need();
      if (top.taken) top.on = false;
      else { top.on = top.parent && evalIf(arg, macros, line); top.taken = top.on; }
      break;
    case "else": need(); top.on = top.parent && !top.taken; top.taken = true; break;
    case "endif": need(); conds.pop(); break;
    case "define": {
      if (!live()) break;
      const m = /^([A-Za-z_]\w*)(?!\()\s*(.*)$/.exec(arg);
      if (m) macros[m[1]] = m[2].trim();
      break;
    }
    case "undef": if (live()) delete macros[arg.split(/\s/)[0]]; break;
    case "error": if (live()) throw new CSyntaxError(`#error ${arg}`, line, 1); break;
    default: break; // #include, #pragma: nothing to do here
  }
}

// #if expressions: integers, defined(X), macros, ! && || comparisons and arithmetic
function evalIf(expr, macros, line) {
  const src = expr.replace(/defined\s*\(\s*(\w+)\s*\)|defined\s+(\w+)/g, (_, a, b) => ((a || b) in macros ? "1" : "0"))
    .replace(/[A-Za-z_]\w*/g, (id) => (id in macros && /^\(?-?\d+[uUlL]*\)?$/.test(macros[id]) ? macros[id].replace(/[()uUlL]/g, "") : "0"));
  const toks = src.match(/\d+|&&|\|\||==|!=|<=|>=|[-+*/%<>!()]/g) || [];
  let p = 0;
  const peek = () => toks[p];
  const bin = (next, ops) => () => {
    let v = next();
    while (ops[peek()]) { const op = toks[p++]; v = ops[op](v, next()); }
    return v;
  };
  const unary = () => {
    const t = toks[p++];
    if (t === "!") return unary() ? 0 : 1;
    if (t === "-") return -unary();
    if (t === "(") { const v = or(); p++; return v; }
    if (t === undefined || !/^\d+$/.test(t)) throw new CSyntaxError(`cannot evaluate #if ${expr}`, line, 1);
    return Number(t);
  };
  const mul = bin(unary, { "*": (a, b) => a * b, "/": (a, b) => (b ? Math.trunc(a / b) : 0), "%": (a, b) => (b ? a % b : 0) });
  const add = bin(mul, { "+": (a, b) => a + b, "-": (a, b) => a - b });
  const rel = bin(add, { "<": (a, b) => +(a < b), ">": (a, b) => +(a > b), "<=": (a, b) => +(a <= b), ">=": (a, b) => +(a >= b) });
  const eq = bin(rel, { "==": (a, b) => +(a === b), "!=": (a, b) => +(a !== b) });
  const and = bin(eq, { "&&": (a, b) => +(a && b) });
  const or = bin(and, { "||": (a, b) => +(a || b) });
  return or() !== 0;
}

// `defines` plays the role of cc -D NAME=value
export function tokenize(src, defines = {}) {
  const macros = { ...BUILTIN_MACROS, ...defines };
  const toks = rawTokens(src, macros);
  // expand object-like macros, guarding against self-reference
  const cache = {};
  const expand = (name, seen) => {
    if (cache[name]) return cache[name];
    const body = rawTokens(macros[name], {});
    const out = [];
    for (const t of body) {
      if (t.t === "id" && t.v in macros && !seen.has(t.v)) out.push(...expand(t.v, new Set([...seen, t.v])));
      else out.push(t);
    }
    return (cache[name] = out);
  };
  const out = [];
  for (const t of toks) {
    if (t.t === "id" && t.v in macros) {
      for (const m of expand(t.v, new Set([t.v]))) out.push({ ...m, line: t.line, col: t.col, pos: t.pos, end: t.end, macro: t.v });
    } else out.push(t);
  }
  out.push({ t: "eof", v: "", line: toks.length ? toks[toks.length - 1].line : 1, col: 1, pos: src.length, end: src.length });
  return out;
}
