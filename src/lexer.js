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
  STDOUT_FILENO: "1",
  STDERR_FILENO: "2",
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

  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; lineStart = i; atLineStart = true; continue; }
    if (c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v") { i++; continue; }
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
      const m = /^#\s*define\s+([A-Za-z_]\w*)(?!\()\s*(.*)$/.exec(text);
      if (m) macros[m[1]] = m[2].replace(/\/\/.*$/, "").trim();
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
  return toks;
}

export function tokenize(src) {
  const macros = { ...BUILTIN_MACROS };
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
