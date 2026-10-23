// Recursive-descent parser producing a small AST. Every statement gets an
// id so the interpreter can report "about to run node N" and the flowchart
// can light up the same node.

import { tokenize, CSyntaxError } from "./lexer.js";
import { T, ptr, arr, fn, BUILTIN_TYPEDEFS, layoutStruct, sizeOf } from "./types.js";

export { CSyntaxError };

const TYPE_KW = new Set(["void", "char", "short", "int", "long", "signed", "unsigned", "struct", "union", "enum",
  "const", "volatile", "static", "extern", "register", "inline", "typedef", "auto", "restrict", "float", "double"]);

const BIN_PREC = {
  "||": 1, "&&": 2, "|": 3, "^": 4, "&": 5, "==": 6, "!=": 6, "<": 7, ">": 7, "<=": 7, ">=": 7,
  "<<": 8, ">>": 8, "+": 9, "-": 9, "*": 10, "/": 10, "%": 10,
};
const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", "&=", "|=", "^="]);

// `prelude` is parsed first, on line 0, so it can supply typedefs (t_list)
// without shifting the student's line numbers.
export function parse(src, { file = "main", prelude = "" } = {}) {
  const pre = prelude ? tokenize(prelude).slice(0, -1).map((t) => ({ ...t, line: 0, pos: 0, end: 0 })) : [];
  const toks = [...pre, ...tokenize(src)];
  let i = 0;
  const typedefs = new Map(Object.entries(BUILTIN_TYPEDEFS));
  const structs = new Map();
  // ids restart for every parse so the same source gets the same ids in the page and in the worker
  let idCounter = 1;
  const newId = () => idCounter++;

  const peek = (o = 0) => toks[Math.min(i + o, toks.length - 1)];
  const at = (v, o = 0) => { const t = peek(o); return (t.t === "op" || t.t === "kw") && t.v === v; };
  const err = (msg, t = peek()) => { throw new CSyntaxError(msg, t.line, t.col); };
  const next = () => toks[i++];
  const expect = (v, what) => {
    if (!at(v)) {
      const t = peek();
      err(`expected '${v}'${what ? " " + what : ""} but found ${t.t === "eof" ? "end of file" : `'${tokText(t)}'`}`, t);
    }
    return next();
  };
  const accept = (v) => (at(v) ? next() : null);
  const text = (a, b) => src.slice(a, b).replace(/\s+/g, " ").trim();

  const isTypeStart = (o = 0) => {
    const t = peek(o);
    return (t.t === "kw" && TYPE_KW.has(t.v)) || (t.t === "id" && typedefs.has(t.v));
  };

  /* ---------------- declarations ---------------- */

  function parseSpecs() {
    let storage = null, base = null, signed = null, nShort = 0, nLong = 0, nChar = 0, nInt = 0, nVoid = 0, any = false, isConst = false;
    const start = peek();
    for (;;) {
      const t = peek();
      if (t.t === "kw") {
        if (["const", "volatile", "restrict", "inline", "register", "auto"].includes(t.v)) { if (t.v === "const") isConst = true; next(); any = true; continue; }
        if (t.v === "static" || t.v === "extern" || t.v === "typedef") { storage = t.v; next(); any = true; continue; }
        if (t.v === "signed" || t.v === "unsigned") { signed = t.v === "signed"; next(); any = true; continue; }
        if (t.v === "short") { nShort++; next(); any = true; continue; }
        if (t.v === "long") { nLong++; next(); any = true; continue; }
        if (t.v === "char") { nChar++; next(); any = true; continue; }
        if (t.v === "int") { nInt++; next(); any = true; continue; }
        if (t.v === "void") { nVoid++; next(); any = true; continue; }
        if (t.v === "float" || t.v === "double") err("float and double are not supported: libft only needs integers");
        if (t.v === "union") err("unions are not supported yet");
        if (t.v === "enum") err("enums are not supported yet");
        if (t.v === "struct") { base = parseStruct(); any = true; continue; }
        break;
      }
      if (t.t === "id" && typedefs.has(t.v) && !base && !nChar && !nInt && !nShort && !nLong && !nVoid && signed === null) {
        base = typedefs.get(t.v); next(); any = true; continue;
      }
      break;
    }
    if (!any) return null;
    let type;
    if (base) type = base;
    else if (nVoid) type = T.void;
    else if (nChar) type = signed === null ? T.char : signed ? T.schar : T.uchar;
    else if (nShort) type = signed === false ? T.ushort : T.short;
    else if (nLong >= 2) type = signed === false ? T.ullong : T.llong;
    else if (nLong === 1) type = signed === false ? T.ulong : T.long;
    else if (nInt || signed !== null) type = signed === false ? T.uint : T.int;
    else err("missing type name", start);
    return { type, storage, isConst, line: start.line };
  }

  function parseStruct() {
    next(); // struct
    let tag = null;
    if (peek().t === "id") tag = next().v;
    let st = tag ? structs.get(tag) : null;
    if (!st) {
      st = { k: "struct", tag, fields: [], size: 0, complete: false };
      if (tag) structs.set(tag, st);
    }
    if (accept("{")) {
      if (st.complete) err(`struct ${tag} is defined twice`);
      const fields = [];
      while (!at("}")) {
        const specs = parseSpecs();
        if (!specs) err("expected a field type inside the struct");
        do {
          const d = parseDeclarator();
          if (!d.name) err("struct field needs a name");
          fields.push({ name: d.name, type: d.apply(specs.type) });
        } while (accept(","));
        expect(";", "after struct field");
      }
      next();
      layoutStruct(st, fields);
    }
    return st;
  }

  // Returns { name, nameTok, params, apply(base) } where apply builds the full type.
  function parseDeclarator(abstract = false) {
    const ptrs = [];
    while (accept("*")) { ptrs.push(1); while (at("const") || at("volatile") || at("restrict")) next(); }
    let inner = null, name = null, nameTok = null;
    if (peek().t === "id" && !(abstract && typedefs.has(peek().v))) { nameTok = next(); name = nameTok.v; }
    else if (at("(") && (at("*", 1) || at("(", 1) || (peek(1).t === "id" && !typedefs.has(peek(1).v)))) {
      next(); inner = parseDeclarator(abstract); expect(")");
    }
    const suffixes = [];
    for (;;) {
      if (accept("[")) {
        if (accept("]")) { suffixes.push({ k: "arr", n: null }); continue; }
        const e = parseAssign();
        expect("]");
        suffixes.push({ k: "arr", n: Number(constEval(e)) });
        continue;
      }
      if (at("(")) { suffixes.push({ k: "fn", ...parseParams() }); continue; }
      break;
    }
    const d = {
      name: inner ? inner.name : name,
      nameTok: inner ? inner.nameTok : nameTok,
      params: inner ? inner.params : (suffixes[0] && suffixes[0].k === "fn" ? suffixes[0].list : null),
      apply(base) {
        let t = base;
        for (let p = 0; p < ptrs.length; p++) t = ptr(t);
        for (let s = suffixes.length - 1; s >= 0; s--) {
          const sx = suffixes[s];
          if (sx.k === "arr") {
            if (t.k === "fn") err("arrays of functions are not allowed");
            t = arr(t, sx.n);
          } else t = fn(t, sx.list.map((p) => p.type), sx.variadic);
        }
        return inner ? inner.apply(t) : t;
      },
    };
    return d;
  }

  function parseParams() {
    expect("(");
    const list = [];
    let variadic = false;
    if (accept(")")) return { list, variadic };
    if (at("void") && at(")", 1)) { next(); next(); return { list, variadic }; }
    do {
      if (accept("...")) { variadic = true; break; }
      const specs = parseSpecs();
      if (!specs) err("expected a parameter type");
      const d = parseDeclarator(true);
      let type = d.apply(specs.type);
      if (type.k === "arr") type = ptr(type.of);
      if (type.k === "fn") type = ptr(type);
      list.push({ name: d.name, type });
    } while (accept(","));
    expect(")", "to close the parameter list");
    return { list, variadic };
  }

  function parseTypeName() {
    const specs = parseSpecs();
    if (!specs) err("expected a type");
    return parseDeclarator(true).apply(specs.type);
  }

  function parseInitializer() {
    if (at("{")) {
      const t = next();
      const items = [];
      while (!at("}")) {
        items.push(parseInitializer());
        if (!accept(",")) break;
      }
      expect("}", "to close the initializer list");
      return { k: "init_list", items, line: t.line };
    }
    return parseAssign();
  }

  // local or global declaration after the specifiers have been read
  function parseDeclRest(specs, startTok) {
    const decls = [];
    if (at(";")) { next(); return decls; }
    do {
      const d = parseDeclarator();
      if (!d.name) err("declaration needs a name");
      let type = d.apply(specs.type);
      if (specs.storage === "typedef") {
        typedefs.set(d.name, type.k === "struct" ? Object.assign(type, { alias: type.alias || d.name }) : type);
        continue;
      }
      let init = null;
      if (accept("=")) init = parseInitializer();
      if (type.k === "arr" && type.n == null) {
        if (init && init.k === "str") type = arr(type.of, init.v.length + 1);
        else if (init && init.k === "init_list") type = arr(type.of, init.items.length);
        else err(`array ${d.name} needs a size`, d.nameTok);
      }
      decls.push({ name: d.name, type, init, line: d.nameTok.line, storage: specs.storage, params: d.params });
    } while (accept(","));
    expect(";", "at the end of the declaration");
    return decls;
  }

  /* ---------------- statements ---------------- */

  function parseBlock() {
    const open = expect("{");
    const items = [];
    while (!at("}")) {
      if (peek().t === "eof") err("this { is never closed", open);
      items.push(parseStatement());
    }
    const close = next();
    return { k: "block", items, line: open.line, endLine: close.line };
  }

  function stmtNode(k, startTok, extra) {
    const endTok = toks[i - 1];
    return { k, id: newId(), line: startTok.line, file, label: text(startTok.pos, endTok.end), ...extra };
  }

  function parseStatement() {
    const t = peek();
    if (at("{")) return parseBlock();
    if (at(";")) { next(); return { k: "empty", line: t.line }; }
    if (t.t === "kw") {
      switch (t.v) {
        case "if": {
          next(); expect("("); const c0 = peek(); const cond = parseExpr(); const cEnd = peek(); expect(")");
          const node = { k: "if", id: newId(), line: t.line, file, cond, label: `if (${text(c0.pos, toks[i - 2].end)})` };
          node.then = parseStatement();
          if (accept("else")) node.else = parseStatement();
          return node;
        }
        case "while": {
          next(); expect("("); const c0 = peek(); const cond = parseExpr(); expect(")");
          const node = { k: "while", id: newId(), line: t.line, file, cond, label: `while (${text(c0.pos, toks[i - 2].end)})` };
          node.body = parseStatement();
          return node;
        }
        case "do": {
          next();
          const node = { k: "do", id: newId(), line: t.line, file };
          node.body = parseStatement();
          const w = expect("while"); expect("("); const c0 = peek(); node.cond = parseExpr(); expect(")"); expect(";");
          node.condLine = w.line;
          node.label = `while (${text(c0.pos, toks[i - 3].end)})`;
          return node;
        }
        case "for": {
          next(); expect("(");
          const node = { k: "for", line: t.line, file, init: null, cond: null, incr: null };
          const i0 = peek();
          if (accept(";")) { /* no init */ }
          else if (isTypeStart()) {
            const specs = parseSpecs();
            const decls = parseDeclRest(specs, i0);
            node.init = { k: "decl", decls, id: newId(), line: i0.line, file, label: text(i0.pos, toks[i - 2].end) };
          } else {
            const e = parseExpr();
            expect(";");
            node.init = { k: "expr", e, id: newId(), line: i0.line, file, label: text(i0.pos, toks[i - 2].end) };
          }
          if (!at(";")) { const c0 = peek(); node.cond = parseExpr(); node.condId = newId(); node.condLabel = text(c0.pos, toks[i - 1].end); node.condLine = c0.line; }
          else node.condId = newId(), node.condLabel = "(always)", node.condLine = t.line;
          expect(";");
          if (!at(")")) { const c0 = peek(); node.incr = parseExpr(); node.incrId = newId(); node.incrLabel = text(c0.pos, toks[i - 1].end); node.incrLine = c0.line; }
          expect(")");
          node.body = parseStatement();
          return node;
        }
        case "return": {
          next();
          const e = at(";") ? null : parseExpr();
          expect(";", "after return");
          return stmtNode("return", t, { e });
        }
        case "break": next(); expect(";"); return stmtNode("break", t);
        case "continue": next(); expect(";"); return stmtNode("continue", t);
        case "switch": err("switch is not supported yet: use if / else if");
        case "goto": err("goto is not supported (and the Norm forbids it)");
        case "case": case "default": err("case labels are only allowed inside switch, which is not supported yet");
      }
    }
    if (isTypeStart()) {
      const specs = parseSpecs();
      const decls = parseDeclRest(specs, t);
      if (specs.storage === "typedef") return { k: "empty", line: t.line };
      return stmtNode("decl", t, { decls });
    }
    const e = parseExpr();
    expect(";", "at the end of the statement");
    return stmtNode("expr", t, { e });
  }

  /* ---------------- expressions ---------------- */

  const mk = (k, tok, extra) => ({ k, line: tok.line, pos: tok.pos, ...extra });

  function parseExpr() {
    let e = parseAssign();
    while (at(",")) { const t = next(); e = mk("comma", t, { l: e, r: parseAssign() }); }
    return e;
  }

  function parseAssign() {
    const l = parseCond();
    const t = peek();
    if (t.t === "op" && ASSIGN_OPS.has(t.v)) {
      next();
      return mk("assign", t, { op: t.v, l, r: parseAssign() });
    }
    return l;
  }

  function parseCond() {
    const c = parseBinary(1);
    if (at("?")) {
      const t = next();
      const a = parseExpr();
      expect(":", "in the ?: expression");
      return mk("cond", t, { c, a, b: parseCond() });
    }
    return c;
  }

  function parseBinary(minPrec) {
    let l = parseCast();
    for (;;) {
      const t = peek();
      const p = t.t === "op" ? BIN_PREC[t.v] : undefined;
      if (!p || p < minPrec) return l;
      next();
      const r = parseBinary(p + 1);
      l = mk(t.v === "&&" || t.v === "||" ? "logic" : "bin", t, { op: t.v, l, r });
    }
  }

  function parseCast() {
    if (at("(") && isTypeStart(1)) {
      const t = next();
      const type = parseTypeName();
      expect(")", "after the cast type");
      if (at("{")) err("compound literals are not supported");
      return mk("cast", t, { type, e: parseCast() });
    }
    return parseUnary();
  }

  function parseUnary() {
    const t = peek();
    if (at("++") || at("--")) { next(); return mk("pre", t, { op: t.v, e: parseUnary() }); }
    if (at("+") || at("-") || at("!") || at("~") || at("*") || at("&")) { next(); return mk("un", t, { op: t.v, e: parseCast() }); }
    if (at("sizeof")) {
      next();
      if (at("(") && isTypeStart(1)) { next(); const type = parseTypeName(); expect(")"); return mk("sizeof_t", t, { type }); }
      return mk("sizeof_e", t, { e: parseUnary() });
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let e = parsePrimary();
    for (;;) {
      const t = peek();
      if (accept("[")) { const idx = parseExpr(); expect("]"); e = mk("idx", t, { a: e, i: idx }); continue; }
      if (accept("(")) {
        const args = [];
        if (!at(")")) do args.push(parseAssign()); while (accept(","));
        expect(")", "to close the call");
        e = mk("call", t, { f: e, args });
        continue;
      }
      if (accept(".") || accept("->")) {
        const n = peek();
        if (n.t !== "id") err("expected a field name");
        next();
        e = mk("mem", t, { e, name: n.v, arrow: t.v === "->" });
        continue;
      }
      if (at("++") || at("--")) { next(); e = mk("post", t, { op: t.v, e }); continue; }
      return e;
    }
  }

  function parsePrimary() {
    const t = peek();
    if (t.t === "id") { next(); return mk("id", t, { name: t.v }); }
    if (t.t === "num") { next(); return mk("num", t, { v: t.v, type: literalType(t) }); }
    if (t.t === "char") { next(); return mk("num", t, { v: t.v, type: T.int, isChar: true }); }
    if (t.t === "str") {
      let bytes = [];
      while (peek().t === "str") bytes = bytes.concat(next().v);
      return mk("str", t, { v: bytes, sid: newId() });
    }
    if (accept("(")) { const e = parseExpr(); expect(")"); return e; }
    if (t.t === "eof") err("code ends in the middle of an expression");
    err(`expected an expression but found '${tokText(t)}'`);
  }

  function literalType(t) {
    const v = t.v, s = t.suffix;
    const u = s.includes("u"), l = s.includes("l");
    if (!l && !u && v <= 0x7fffffffn) return T.int;
    if (!l && u && v <= 0xffffffffn) return T.uint;
    if (!l && !u && t.hexOrOct && v <= 0xffffffffn) return T.uint;
    if (!u && v <= 0x7fffffffffffffffn) return T.long;
    return T.ulong;
  }

  function constEval(e) {
    switch (e.k) {
      case "num": return e.v;
      case "sizeof_t": return BigInt(sizeOf(e.type));
      case "cast": return constEval(e.e);
      case "un": {
        const v = constEval(e.e);
        if (e.op === "-") return -v;
        if (e.op === "+") return v;
        if (e.op === "~") return ~v;
        if (e.op === "!") return v ? 0n : 1n;
        break;
      }
      case "bin": {
        const a = constEval(e.l), b = constEval(e.r);
        switch (e.op) {
          case "+": return a + b; case "-": return a - b; case "*": return a * b;
          case "/": return a / b; case "%": return a % b; case "<<": return a << b; case ">>": return a >> b;
        }
      }
    }
    throw new CSyntaxError("array size must be a constant number", e.line, 1);
  }

  /* ---------------- translation unit ---------------- */

  const items = [];
  while (peek().t !== "eof") {
    if (accept(";")) continue;
    const startTok = peek();
    const specs = parseSpecs();
    if (!specs) err(`expected a declaration or function but found '${tokText(peek())}'`);
    if (accept(";")) continue; // e.g. struct definition on its own
    const save = i;
    const d = parseDeclarator();
    const type = d.name ? d.apply(specs.type) : null;
    if (type && type.k === "fn" && at("{") && specs.storage !== "typedef") {
      if (!d.params) err("function definition needs a parameter list");
      d.params.forEach((p, n) => { if (!p.name) err(`parameter ${n + 1} of ${d.name} needs a name`, d.nameTok); });
      const body = parseBlock();
      items.push({
        k: "func", name: d.name, type, params: d.params, body, line: startTok.line, file,
        endLine: body.endLine, startId: newId(), exitId: newId(), isStatic: specs.storage === "static",
        protoLabel: text(startTok.pos, toks.find((tk, n) => n >= save && tk.t === "op" && tk.v === "{").pos),
      });
      continue;
    }
    i = save;
    const decls = parseDeclRest(specs, startTok);
    for (const dcl of decls) {
      if (dcl.type.k === "fn") items.push({ k: "proto", name: dcl.name, type: dcl.type, line: dcl.line, file });
      else items.push({ k: "global", ...dcl, file });
    }
  }
  return { items, structs, typedefs, src };
}

function tokText(t) {
  if (t.t === "str") return '"..."';
  if (t.t === "char") return "'...'";
  return String(t.v);
}
