// Tracing interpreter. Every variable, literal and malloc block lives in one
// flat byte array, so pointer bugs behave (and get caught) the way they would
// in a real process: NULL page, red zones between blocks, freed blocks that
// are never reused, read-only string literals.

import { T, ptr, arr, fn, sizeOf, typeName, isPtr, isCharLike, promote, commonType } from "./types.js";

export class CRuntimeError extends Error {
  constructor(msg, kind, extra = {}) {
    super(msg);
    this.kind = kind;
    Object.assign(this, extra);
  }
}
class ExitSignal { constructor(code) { this.code = code; } }

const MEM_SIZE = 0x400000;
const NULL_PAGE = 0x1000;
const CODE_BASE = 0x2000;
const RODATA_BASE = 0x4000;
const GLOBAL_BASE = 0x8000;
const HEAP_BASE = 0x10000;
const HEAP_LIMIT = 0x300000;
const STACK_TOP = MEM_SIZE - 0x10;
const REDZONE = 16;
const MAX_MALLOC = 1 << 20;
const MAX_ALLOCS = 20000;
const MAX_OUTPUT = 64 * 1024;

export const hex = (n) => "0x" + n.toString(16);

const CMP = new Set(["<", ">", "<=", ">=", "==", "!="]);
const wrap = (v, t) => (t.signed ? BigInt.asIntN(t.size * 8, v) : BigInt.asUintN(t.size * 8, v));

/* ---------------- expression printer (labels for memory events) ---------------- */

export function exprStr(e) {
  switch (e.k) {
    case "id": return e.name;
    case "num": return e.isChar ? charLit(Number(e.v)) : String(e.v);
    case "str": return JSON.stringify(new TextDecoder().decode(new Uint8Array(e.v)));
    case "idx": return `${exprStr(e.a)}[${exprStr(e.i)}]`;
    case "mem": return `${exprStr(e.e)}${e.arrow ? "->" : "."}${e.name}`;
    case "un": return `${e.op}${wrapP(e.e)}`;
    case "pre": return `${e.op}${wrapP(e.e)}`;
    case "post": return `${wrapP(e.e)}${e.op}`;
    case "cast": return `(${typeName(e.type)})${wrapP(e.e)}`;
    case "bin": case "logic": return `${wrapP(e.l)} ${e.op} ${wrapP(e.r)}`;
    case "assign": return `${exprStr(e.l)} ${e.op} ${exprStr(e.r)}`;
    case "call": return `${exprStr(e.f)}(${e.args.map(exprStr).join(", ")})`;
    case "cond": return `${wrapP(e.c)} ? ${wrapP(e.a)} : ${wrapP(e.b)}`;
    case "comma": return `${exprStr(e.l)}, ${exprStr(e.r)}`;
    case "sizeof_t": return `sizeof(${typeName(e.type)})`;
    case "sizeof_e": return `sizeof ${wrapP(e.e)}`;
  }
  return "?";
}
const SIMPLE = new Set(["id", "num", "str", "idx", "mem", "call"]);
const wrapP = (e) => (SIMPLE.has(e.k) ? exprStr(e) : `(${exprStr(e)})`);

export function charLit(c) {
  if (c === 0) return "'\\0'";
  if (c === 10) return "'\\n'";
  if (c === 9) return "'\\t'";
  if (c === 39) return "'\\''";
  if (c === 92) return "'\\\\'";
  if (c >= 32 && c < 127) return `'${String.fromCharCode(c)}'`;
  return `'\\x${(c & 255).toString(16).padStart(2, "0")}'`;
}

/* ---------------- memory ---------------- */

class Memory {
  constructor(rec) {
    this.bytes = new Uint8Array(MEM_SIZE);
    this.init = new Uint8Array(MEM_SIZE);
    this.blocks = [];
    this.nextId = 1;
    this.heapTop = HEAP_BASE;
    this.rodataTop = RODATA_BASE;
    this.globalTop = GLOBAL_BASE;
    this.sp = STACK_TOP;
    this.heapCount = 0;
    this.rec = rec; // event sink
  }

  alloc(kind, size, info = {}) {
    let addr;
    const align = 16;
    if (kind === "heap") {
      if (++this.heapCount > MAX_ALLOCS) throw new CRuntimeError(`More than ${MAX_ALLOCS.toLocaleString("en")} allocations: the visualiser stops here. Free blocks you no longer need, or allocate fewer, bigger ones.`, "limit");
      addr = Math.ceil((this.heapTop + REDZONE) / align) * align;
      if (addr + size + REDZONE > HEAP_LIMIT) return null;
      this.heapTop = addr + size;
    } else if (kind === "rodata") {
      addr = Math.ceil((this.rodataTop + 1) / 8) * 8;
      this.rodataTop = addr + size;
    } else if (kind === "global") {
      addr = Math.ceil((this.globalTop + REDZONE) / align) * align;
      this.globalTop = addr + size;
    } else {
      addr = Math.floor((this.sp - size - REDZONE) / Math.min(16, Math.max(1, info.align || 8))) * Math.min(16, Math.max(1, info.align || 8));
      if (addr < HEAP_LIMIT + 0x1000) throw new CRuntimeError("Stack overflow: too many nested calls. Is a recursive function missing its base case?", "stack");
      this.sp = addr;
    }
    const b = { id: this.nextId++, kind, addr, size, alive: true, ...info };
    this.blocks.push(b);
    return b;
  }

  // newest first, so a live stack variable wins over a dead one at the same spot
  find(addr) {
    const l = this.last;
    if (l && l.alive && addr >= l.addr && addr < l.addr + l.size) return l;
    for (let k = this.blocks.length - 1; k >= 0; k--) {
      const b = this.blocks[k];
      if (addr >= b.addr && addr < b.addr + b.size) { if (b.alive) this.last = b; return b; }
    }
    return null;
  }

  nearest(addr) {
    let best = null, dist = Infinity;
    for (let k = this.blocks.length - 1; k >= 0; k--) {
      const b = this.blocks[k];
      const d = addr < b.addr ? b.addr - addr : addr - (b.addr + b.size) + 1;
      if (d >= 0 && d < dist && d <= REDZONE * 4) { best = b; dist = d; }
    }
    return best;
  }

  describeBlock(b) {
    if (b.kind === "heap") return `the ${b.size}-byte block from ${b.how || "malloc"} (line ${b.line})`;
    if (b.kind === "rodata") return `the string literal ${b.label}`;
    return `${b.name}${b.fnName ? ` in ${b.fnName}()` : ""} (${b.size} byte${b.size === 1 ? "" : "s"})`;
  }

  check(addr, size, write, label) {
    const what = label ? `${label}` : `address ${hex(addr)}`;
    if (addr < NULL_PAGE) {
      throw new CRuntimeError(addr === 0
        ? `NULL pointer dereference: ${what} ${write ? "writes to" : "reads from"} address 0x0. Check the pointer before using it.`
        : `Invalid access near NULL (${hex(addr)}): ${what} uses a NULL pointer plus an offset.`, "null", { addr, size, write, label });
    }
    const b = this.find(addr);
    if (!b) {
      const n = this.nearest(addr);
      let msg;
      if (n) {
        const past = addr - (n.addr + n.size);
        msg = addr >= n.addr + n.size
          ? `Out of bounds: ${what} is ${past + 1} byte${past ? "s" : ""} past the end of ${this.describeBlock(n)}.`
          : `Out of bounds: ${what} is ${n.addr - addr} byte${n.addr - addr === 1 ? "" : "s"} before the start of ${this.describeBlock(n)}.`;
        if (n.kind === "heap" && n.size === 0) msg = `Out of bounds: ${what} touches a 0-byte block from malloc(0) (line ${n.line}). It has no usable bytes.`;
      } else msg = `Wild pointer: ${what} uses address ${hex(addr)}, which belongs to no variable or allocation.`;
      throw new CRuntimeError(msg, n && n.kind === "heap" ? "heap-overflow" : n ? "overflow" : "wild", { addr, size, write, label, block: n && n.id });
    }
    if (!b.alive) {
      if (b.kind === "heap") throw new CRuntimeError(`Use after free: ${what} touches ${this.describeBlock(b)}, which was freed at line ${b.freedLine}.`, "uaf", { addr, size, write, label, block: b.id });
      throw new CRuntimeError(`Dangling pointer: ${what} points into ${b.name}, a local variable of ${b.fnName}() that no longer exists because the function returned.`, "dangling", { addr, size, write, label, block: b.id });
    }
    if (addr + size > b.addr + b.size) {
      throw new CRuntimeError(`Out of bounds: ${what} reads ${size} bytes but only ${b.addr + b.size - addr} remain in ${this.describeBlock(b)}.`, b.kind === "heap" ? "heap-overflow" : "overflow", { addr, size, write, label, block: b.id });
    }
    if (write && b.kind === "rodata") {
      throw new CRuntimeError(`Write to read-only memory: ${what} tries to modify the string literal ${b.label}. Literals cannot be changed; copy into an array or malloc'd block first.`, "rodata", { addr, size, write, label, block: b.id });
    }
    return b;
  }

  rawInt(addr, size, signed) {
    let v = 0n;
    for (let k = size - 1; k >= 0; k--) v = (v << 8n) | BigInt(this.bytes[addr + k]);
    return signed ? BigInt.asIntN(size * 8, v) : v;
  }
  rawWriteInt(addr, size, v) {
    v = BigInt.asUintN(size * 8, v);
    for (let k = 0; k < size; k++) { this.bytes[addr + k] = Number(v & 255n); this.init[addr + k] = 1; v >>= 8n; }
  }
  isInit(addr, size) { for (let k = 0; k < size; k++) if (!this.init[addr + k]) return false; return true; }

  load(addr, t, label) {
    const size = t.k === "struct" ? sizeOf(t) : t.size;
    const b = this.check(addr, size, false, label);
    let v;
    if (t.k === "int") v = { t, v: this.rawInt(addr, size, t.signed), uninit: !this.isInit(addr, size) };
    else if (t.k === "ptr") v = { t, v: Number(this.rawInt(addr, 8, false)), uninit: !this.isInit(addr, 8) };
    else if (t.k === "struct") v = { t, v: this.bytes.slice(addr, addr + size) };
    if (v) { this.rec({ k: "r", addr, size, block: b.id, label, text: v.uninit ? "garbage" : fmtVal(v) }); return v; }
    throw new CRuntimeError(`cannot read a value of type ${typeName(t)}`, "type");
  }

  store(addr, t, val, label) {
    const size = t.k === "struct" ? sizeOf(t) : t.size;
    const b = this.check(addr, size, true, label);
    if (t.k === "int") this.rawWriteInt(addr, size, val.v);
    else if (t.k === "ptr") this.rawWriteInt(addr, 8, BigInt(val.v));
    else if (t.k === "struct") { this.bytes.set(val.v, addr); this.init.fill(1, addr, addr + size); }
    else throw new CRuntimeError(`cannot store a value of type ${typeName(t)}`, "type");
    this.rec({ k: "w", addr, size, block: b.id, label, text: fmtVal(val) });
  }
}

function fmtVal(v) {
  if (v.t.k === "ptr") return v.v === 0 ? "NULL" : hex(v.v);
  if (v.t.k === "int") return isCharLike(v.t) ? charLit(Number(BigInt.asUintN(8, v.v))) : String(v.v);
  return "{...}";
}

/* ---------------- builtins (the libc a test main may use) ---------------- */

const P = { cc: ptr(T.char), v: ptr(T.void), sz: { ...T.ulong, alias: "size_t" }, ssz: { ...T.long, alias: "ssize_t" } };
const B = (ret, params, impl, variadic = false) => ({ type: fn(ret, params, variadic), impl });
const intv = (v) => ({ t: T.int, v: BigInt(v) });

function makeBuiltins(I) {
  const m = I.mem;
  const rd = (a, label) => { m.check(a, 1, false, label); return m.bytes[a]; };
  const wr = (a, v, label) => { m.check(a, 1, true, label); m.bytes[a] = v & 255; m.init[a] = 1; };
  const range = (k, addr, size, label) => { if (size > 0) { const b = m.find(addr); I.record({ k, addr, size, block: b && b.id, label }); } };
  const cstr = (a, who) => { // returns byte array without the terminator
    const out = [];
    for (let k = 0; ; k++) { const c = rd(a + k, `${who} reading byte ${k}`); if (!c) break; out.push(c); if (k > 1e6) break; }
    range("r", a, out.length + 1, who);
    return out;
  };
  const N = (v) => Number(v.v);
  const ptrArg = (v, who) => { if (v.v === 0) throw new CRuntimeError(`${who} was given a NULL pointer.`, "null"); return v.v; };

  const lib = {
    malloc: B(P.v, [P.sz], ([n]) => {
      const size = Number(BigInt.asUintN(64, n.v));
      if (size > MAX_MALLOC || I.failNow()) return { t: P.v, v: 0 };
      const b = m.alloc("heap", size, { line: I.line, how: `malloc(${size})` });
      return { t: P.v, v: b ? b.addr : 0 };
    }),
    calloc: B(P.v, [P.sz, P.sz], ([n, s]) => {
      const size = Number(BigInt.asUintN(64, n.v * s.v));
      if (n.v * s.v > BigInt(MAX_MALLOC) || I.failNow()) return { t: P.v, v: 0 };
      const b = m.alloc("heap", size, { line: I.line, how: `calloc(${n.v}, ${s.v})` });
      if (b) { m.bytes.fill(0, b.addr, b.addr + size); m.init.fill(1, b.addr, b.addr + size); }
      return { t: P.v, v: b ? b.addr : 0 };
    }),
    free: B(T.void, [P.v], ([p]) => {
      if (p.v === 0) return { t: T.void };
      const b = m.blocks.find((x) => x.kind === "heap" && x.addr === p.v);
      if (!b) {
        const inside = m.find(p.v);
        throw new CRuntimeError(inside && inside.kind === "heap"
          ? `Invalid free: the pointer is ${p.v - inside.addr} bytes into a malloc block, not at its start. free() needs the exact address malloc returned.`
          : `Invalid free: ${hex(p.v)} was not returned by malloc.`, "free");
      }
      if (!b.alive) throw new CRuntimeError(`Double free: this block was already freed at line ${b.freedLine}.`, "free");
      b.alive = false; b.freedLine = I.line;
      I.record({ k: "free", addr: b.addr, block: b.id });
      return { t: T.void };
    }),
    write: B(P.ssz, [T.int, P.v, P.sz], ([fd, buf, n]) => {
      const len = Number(n.v);
      const bytes = [];
      for (let k = 0; k < len; k++) bytes.push(rd(buf.v + k, `write() reading byte ${k} of the buffer`));
      range("r", buf.v, len, "write buffer");
      if (fd.v === 1n || fd.v === 2n) I.out(bytes);
      else return { t: P.ssz, v: -1n };
      return { t: P.ssz, v: BigInt(len) };
    }),
    putchar: B(T.int, [T.int], ([c]) => { I.out([Number(c.v) & 255]); return c; }),
    puts: B(T.int, [P.cc], ([s]) => { I.out([...cstr(ptrArg(s, "puts()"), "puts()"), 10]); return intv(1); }),
    printf: B(T.int, [P.cc], (args) => { const s = I.format(args, cstr, rd); I.out(s); return intv(s.length); }, true),
    strlen: B(P.sz, [P.cc], ([s]) => ({ t: P.sz, v: BigInt(cstr(ptrArg(s, "strlen()"), "strlen()").length) })),
    strcmp: B(T.int, [P.cc, P.cc], ([a, b]) => {
      const x = cstr(ptrArg(a, "strcmp()"), "strcmp()"), y = cstr(ptrArg(b, "strcmp()"), "strcmp()");
      for (let k = 0; ; k++) { const d = (x[k] || 0) - (y[k] || 0); if (d || k >= x.length) return intv(d); }
    }),
    strncmp: B(T.int, [P.cc, P.cc, P.sz], ([a, b, n]) => {
      for (let k = 0; k < N(n); k++) { const x = rd(a.v + k), y = rd(b.v + k); if (x !== y || !x) return intv(x - y); }
      return intv(0);
    }),
    strcpy: B(P.cc, [P.cc, P.cc], ([d, s]) => { const x = cstr(s.v, "strcpy()"); x.concat(0).forEach((c, k) => wr(d.v + k, c, "strcpy() destination")); range("w", d.v, x.length + 1, "strcpy()"); return d; }),
    strdup: B(P.cc, [P.cc], ([s]) => {
      const x = cstr(ptrArg(s, "strdup()"), "strdup()");
      const b = m.alloc("heap", x.length + 1, { line: I.line, how: "strdup" });
      x.concat(0).forEach((c, k) => wr(b.addr + k, c));
      return { t: P.cc, v: b.addr };
    }),
    strchr: B(P.cc, [P.cc, T.int], ([s, c]) => {
      const ch = Number(c.v) & 255;
      for (let k = 0; ; k++) { const x = rd(s.v + k, "strchr()"); if (x === ch) return { t: P.cc, v: s.v + k }; if (!x) return { t: P.cc, v: 0 }; }
    }),
    memset: B(P.v, [P.v, T.int, P.sz], ([d, c, n]) => { for (let k = 0; k < N(n); k++) wr(d.v + k, Number(c.v), `memset() byte ${k}`); range("w", d.v, N(n), "memset()"); return d; }),
    memcpy: B(P.v, [P.v, P.v, P.sz], ([d, s, n]) => { for (let k = 0; k < N(n); k++) wr(d.v + k, rd(s.v + k, `memcpy() source byte ${k}`), `memcpy() destination byte ${k}`); range("w", d.v, N(n), "memcpy()"); return d; }),
    memcmp: B(T.int, [P.v, P.v, P.sz], ([a, b, n]) => { for (let k = 0; k < N(n); k++) { const d = rd(a.v + k) - rd(b.v + k); if (d) return intv(d); } return intv(0); }),
    atoi: B(T.int, [P.cc], ([s]) => {
      const x = String.fromCharCode(...cstr(s.v, "atoi()"));
      const mm = /^[\t\n\v\f\r ]*([+-]?\d+)/.exec(x);
      return { t: T.int, v: wrap(mm ? BigInt(mm[1]) : 0n, T.int) };
    }),
    abs: B(T.int, [T.int], ([x]) => ({ t: T.int, v: wrap(x.v < 0n ? -x.v : x.v, T.int) })),
    exit: B(T.void, [T.int], ([c]) => { throw new ExitSignal(Number(c.v)); }),
    // test-only helpers used by the libft test drivers
    __expect_int: B(T.int, [T.long, T.long, P.cc], ([got, exp, what]) => {
      const ok = got.v === exp.v;
      I.expect(ok, `${I.cs(what.v)}: expected ${exp.v}, got ${got.v}`);
      return intv(ok ? 1 : 0);
    }),
    __expect_bool: B(T.int, [T.long, T.long, P.cc], ([got, exp, what]) => {
      const ok = (got.v !== 0n) === (exp.v !== 0n);
      I.expect(ok, `${I.cs(what.v)}: expected ${exp.v ? "non-zero" : "0"}, got ${got.v}`);
      return intv(ok ? 1 : 0);
    }),
    __expect_sign: B(T.int, [T.long, T.long, P.cc], ([got, exp, what]) => {
      const sg = (v) => (v > 0n ? 1 : v < 0n ? -1 : 0);
      const ok = sg(got.v) === sg(exp.v);
      I.expect(ok, `${I.cs(what.v)}: expected a ${["negative", "zero", "positive"][sg(exp.v) + 1]} result, got ${got.v}`);
      return intv(ok ? 1 : 0);
    }),
    __expect_str: B(T.int, [P.cc, P.cc, P.cc], ([got, exp, what]) => {
      if (got.v === 0) { I.expect(false, `${I.cs(what.v)}: expected "${I.cs(exp.v)}", got NULL`); return intv(0); }
      const g = I.cs(got.v), e = I.cs(exp.v);
      I.expect(g === e, `${I.cs(what.v)}: expected "${e}", got "${g}"`);
      return intv(g === e ? 1 : 0);
    }),
    __expect_mem: B(T.int, [P.v, P.v, P.sz, P.cc], ([a, b, n, what]) => {
      const x = [], y = [];
      for (let k = 0; k < N(n); k++) { x.push(rd(a.v + k)); y.push(m.bytes[b.v + k]); }
      const ok = x.every((c, k) => c === y[k]);
      const show = (arr) => arr.map((c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : c === 0 ? "\\0" : "\\x" + c.toString(16))).join("");
      I.expect(ok, `${I.cs(what.v)}: expected bytes "${show(y)}", got "${show(x)}"`);
      return intv(ok ? 1 : 0);
    }),
    // the n-th allocation from now returns NULL (1 = the very next one)
    __fail_malloc_after: B(T.void, [T.int], ([n]) => { I.failAfter = Number(n.v); return { t: T.void }; }),
    __expect_out: B(T.int, [P.cc, P.cc], ([exp, what]) => {
      const e = I.cs(exp.v), ok = I.stdout === e;
      I.expect(ok, `${I.cs(what.v)}: expected output ${JSON.stringify(e)}, got ${JSON.stringify(I.stdout)}`);
      I.outLen = 0; I.stdout = "";
      return intv(ok ? 1 : 0);
    }),
    __expect_ptr: B(T.int, [P.v, P.v, P.cc], ([a, b, what]) => {
      const ok = a.v === b.v;
      const d = (v) => (v === 0 ? "NULL" : I.ptrDesc(v));
      I.expect(ok, `${I.cs(what.v)}: expected ${d(b.v)}, got ${d(a.v)}`);
      return intv(ok ? 1 : 0);
    }),
  };
  for (const c of ["isalpha", "isdigit", "isalnum", "isascii", "isprint", "isspace", "isupper", "islower"]) {
    const test = {
      isalpha: (x) => /[A-Za-z]/.test(String.fromCharCode(x)) && x < 128, isdigit: (x) => x >= 48 && x <= 57,
      isalnum: (x) => (x >= 48 && x <= 57) || (/[A-Za-z]/.test(String.fromCharCode(x)) && x < 128), isascii: (x) => x >= 0 && x <= 127,
      isprint: (x) => x >= 32 && x <= 126, isspace: (x) => [9, 10, 11, 12, 13, 32].includes(x),
      isupper: (x) => x >= 65 && x <= 90, islower: (x) => x >= 97 && x <= 122,
    }[c];
    lib[c] = B(T.int, [T.int], ([x]) => intv(test(Number(x.v)) ? 1 : 0));
  }
  lib.toupper = B(T.int, [T.int], ([x]) => intv(x.v >= 97n && x.v <= 122n ? x.v - 32n : x.v));
  lib.tolower = B(T.int, [T.int], ([x]) => intv(x.v >= 65n && x.v <= 90n ? x.v + 32n : x.v));
  return lib;
}

export const BUILTIN_NAMES = ["malloc", "calloc", "free", "write", "putchar", "puts", "printf", "strlen", "strcmp", "strncmp", "strcpy", "strdup",
  "strchr", "memset", "memcpy", "memcmp", "atoi", "abs", "exit", "isalpha", "isdigit", "isalnum", "isascii", "isprint", "isspace", "isupper",
  "islower", "toupper", "tolower"];

/* ---------------- interpreter ---------------- */

export function run(program, opts = {}) {
  const I = new Interp(program, opts);
  return I.start(opts.entry || "main");
}

class Interp {
  constructor(program, opts) {
    this.opts = { trace: true, maxSteps: 300000, maxSnapshots: 3000, ...opts };
    this.prog = program;
    this.events = [];
    this.mem = new Memory((ev) => this.record(ev));
    this.funcs = new Map();
    this.globals = new Map();
    this.frames = [];
    this.frameId = 1;
    this.snaps = [];
    this.stdout = "";
    this.outLen = 0;
    this.expects = [];
    this.warnings = [];
    this.warned = new Set();
    this.steps = 0;
    this.line = 0;
    this.file = "main";
    this.literals = new Map();
    this.statics = new Map();
    this.prev = { node: null, line: 0, file: null };
    this.truncated = false;
    this.codeAddr = new Map();
    this.codeByAddr = new Map();
    this.builtins = makeBuiltins(this);
    let ca = CODE_BASE;
    for (const it of program.items) if (it.k === "func") {
      if (this.funcs.has(it.name)) throw new CRuntimeError(`${it.name} is defined twice.`, "link");
      this.funcs.set(it.name, it);
    }
    for (const name of [...this.funcs.keys(), ...Object.keys(this.builtins)]) {
      this.codeAddr.set(name, ca); this.codeByAddr.set(ca, name); ca += 16;
    }
    this.protos = new Map();
    for (const it of program.items) if (it.k === "proto") this.protos.set(it.name, it.type);
  }

  record(ev) { if (this.opts.trace) this.events.push(ev); }
  out(bytes) {
    const text = new TextDecoder().decode(new Uint8Array(bytes));
    this.outLen += bytes.length;
    this.stdout += text;
    if (this.outLen > MAX_OUTPUT) throw new CRuntimeError(`The program printed more than ${MAX_OUTPUT / 1024} KB, so it was stopped. Is a print inside a loop that never ends?`, "limit");
    this.record({ k: "out", text });
  }
  failNow() {
    if (!(this.failAfter > 0) || --this.failAfter > 0) return false;
    this.record({ k: "note", msg: "malloc returned NULL here: the test simulates running out of memory." });
    return true;
  }
  expect(ok, msg) { this.expects.push({ ok, msg, line: this.line }); this.record({ k: "expect", ok, msg }); }
  cs(addr) { // read a C string for messages without bounds errors
    if (!addr) return "NULL";
    const out = [];
    for (let k = 0; k < 4096; k++) { const c = this.mem.bytes[addr + k]; if (!c) break; out.push(c); }
    return new TextDecoder().decode(new Uint8Array(out));
  }
  ptrDesc(v) {
    const b = this.mem.find(v);
    if (!b) return hex(v);
    return `${b.kind === "heap" ? "heap block" : b.name || b.label}+${v - b.addr}`;
  }

  start(entry) {
    let error = null, exitCode = null;
    try {
      for (const it of this.prog.items) if (it.k === "global") this.declareGlobal(it);
      const main = this.funcs.get(entry);
      if (!main) throw new CRuntimeError(entry === "main"
        ? "There is no main() to run. Add one that calls your function, or run one of the tests on the right."
        : `${entry}() is not defined.`, "link");
      const args = [];
      if (main.params.length >= 2) {
        const name = this.literal([...new TextEncoder().encode("./a.out")], "argv[0]");
        const argv = this.mem.alloc("global", 16, { name: "argv", type: arr(ptr(T.char), 2) });
        this.mem.rawWriteInt(argv.addr, 8, BigInt(name)); this.mem.rawWriteInt(argv.addr + 8, 8, 0n);
        args.push(intv(1), { t: ptr(ptr(T.char)), v: argv.addr });
      }
      const r = this.callUser(main, args, null);
      exitCode = r && r.t.k === "int" ? Number(r.v) : 0;
    } catch (e) {
      if (e instanceof ExitSignal) exitCode = e.code;
      else if (e instanceof CRuntimeError) { error = { msg: e.message, kind: e.kind, line: this.line, file: this.file, addr: e.addr, size: e.size, write: e.write, block: e.block, label: e.label }; }
      else throw e;
    }
    const leaks = error ? [] : this.mem.blocks.filter((b) => b.kind === "heap" && b.alive).map((b) => ({ size: b.size, line: b.line, id: b.id }));
    if (error && this.opts.trace) {
      if (error.addr != null) this.events.push({ k: error.write ? "w" : "r", addr: error.addr, size: error.size || 1, block: error.block, label: error.label, bad: true });
      this.snap("error", this.prev.node, this.line, this.file, { error }, true);
    } else if (this.opts.trace) {
      this.snap("end", null, this.line, this.file, { leaks, exitCode }, true);
    }
    return { steps: this.snaps, stdout: this.stdout, error, exitCode, leaks, expects: this.expects, truncated: this.truncated, warnings: this.warnings, stepCount: this.steps };
  }

  tick(node, line, file) {
    this.line = line; this.file = file || this.file;
    if (++this.steps > this.opts.maxSteps) {
      throw new CRuntimeError(`Stopped after ${this.opts.maxSteps.toLocaleString("en")} steps. Is there a loop whose condition never becomes false?`, "timeout");
    }
  }

  // snapshot of the state *before* running `node`
  snap(kind, node, line, file, extra = {}, force = false) {
    if (!this.opts.trace) { this.events = []; return; }
    if (this.snaps.length >= this.opts.maxSnapshots && !force) { this.truncated = true; this.events = []; return; }
    const top = this.frames[this.frames.length - 1];
    const s = {
      kind, node, line, file, fn: top ? top.name : null,
      prevNode: this.prev.node, prevLine: this.prev.line, prevFile: this.prev.file,
      events: this.events, stdout: this.stdout, ...this.describe(), ...extra,
    };
    this.events = [];
    this.snaps.push(s);
    this.prev = { node, line, file };
  }

  step(kind, node, line, file, extra) {
    this.tick(node, line, file);
    // linked library code runs without being recorded step by step
    if (this.opts.quietFiles && this.opts.quietFiles.includes(file)) return;
    this.snap(kind, node, line, file, extra);
  }

  /* ---------- variables ---------- */

  literal(bytes, label) {
    const b = this.mem.alloc("rodata", bytes.length + 1, { label: label || JSON.stringify(new TextDecoder().decode(new Uint8Array(bytes))) });
    this.mem.bytes.set(bytes, b.addr); this.mem.bytes[b.addr + bytes.length] = 0;
    this.mem.init.fill(1, b.addr, b.addr + bytes.length + 1);
    return b.addr;
  }

  declareGlobal(g) {
    const size = sizeOf(g.type);
    const b = this.mem.alloc("global", size, { name: g.name, type: g.type, isVar: true, fnName: null });
    this.mem.init.fill(1, b.addr, b.addr + size);
    this.globals.set(g.name, { name: g.name, t: g.type, addr: b.addr, block: b });
    if (g.init) this.initialize(b.addr, g.type, g.init, g.name);
  }

  lookup(name) {
    const fr = this.frames[this.frames.length - 1];
    if (fr) for (let s = fr.scopes.length - 1; s >= 0; s--) { const v = fr.scopes[s].get(name); if (v) return v; }
    return this.globals.get(name) || null;
  }

  declareLocal(d) {
    const fr = this.frames[this.frames.length - 1];
    if (d.storage === "static") {
      // static locals live with the globals and are initialised only once
      let sv = this.statics.get(d);
      if (!sv) {
        const size = sizeOf(d.type);
        const b = this.mem.alloc("global", size, { name: d.name, type: d.type, isVar: true, fnName: fr.name, isStatic: true });
        this.mem.init.fill(1, b.addr, b.addr + size);
        sv = { name: d.name, t: d.type, addr: b.addr, block: b, isStatic: true };
        this.statics.set(d, sv);
        if (d.init) this.initialize(b.addr, d.type, d.init, d.name);
      }
      fr.scopes[fr.scopes.length - 1].set(d.name, sv);
      if (!fr.vars.includes(sv)) fr.vars.push(sv);
      return;
    }
    let v = fr.declCache.get(d);
    if (!v) {
      if (d.type.k === "void") throw new CRuntimeError(`${d.name} cannot have type void.`, "type");
      const size = sizeOf(d.type);
      const b = this.mem.alloc("stack", size, { name: d.name, type: d.type, isVar: true, fnName: fr.name, frame: fr.id, align: d.type.k === "arr" ? 8 : size });
      v = { name: d.name, t: d.type, addr: b.addr, block: b };
      fr.declCache.set(d, v);
      fr.vars.push(v);
    }
    fr.scopes[fr.scopes.length - 1].set(d.name, v);
    if (d.init) this.initialize(v.addr, d.type, d.init, d.name);
  }

  initialize(addr, t, init, name) {
    if (t.k === "arr") {
      const es = sizeOf(t.of);
      if (init.k === "str" && isCharLike(t.of)) {
        if (init.v.length > t.n) throw new CRuntimeError(`The string "${new TextDecoder().decode(new Uint8Array(init.v))}" needs ${init.v.length + 1} bytes but ${name} has only ${t.n}.`, "overflow");
        for (let k = 0; k < t.n; k++) this.mem.rawWriteInt(addr + k, 1, BigInt(init.v[k] || 0));
        this.record({ k: "w", addr, size: t.n, block: this.mem.find(addr).id, label: name });
        return;
      }
      if (init.k !== "init_list") throw new CRuntimeError(`Array ${name} must be initialised with { ... } or a string.`, "type");
      if (init.items.length > t.n) throw new CRuntimeError(`Too many initialisers for ${name}[${t.n}].`, "overflow");
      this.mem.bytes.fill(0, addr, addr + t.n * es); this.mem.init.fill(1, addr, addr + t.n * es);
      init.items.forEach((it, k) => this.initialize(addr + k * es, t.of, it, `${name}[${k}]`));
      return;
    }
    if (t.k === "struct") {
      if (init.k === "init_list") {
        this.mem.bytes.fill(0, addr, addr + t.size); this.mem.init.fill(1, addr, addr + t.size);
        init.items.forEach((it, k) => { const f = t.fields[k]; if (f) this.initialize(addr + f.offset, f.type, it, `${name}.${f.name}`); });
        return;
      }
    }
    if (init.k === "init_list") {
      if (!init.items.length) { this.mem.store(addr, t, this.convert(intv(0), t), name); return; }
      return this.initialize(addr, t, init.items[0], name);
    }
    this.mem.store(addr, t, this.convert(this.rv(init), t, name), name);
  }

  /* ---------- calls ---------- */

  callUser(f, args, callNode) {
    if (this.frames.length > 400) throw new CRuntimeError(`Stack overflow: ${f.name}() is nested more than 400 calls deep. Is a recursive function missing its base case?`, "stack");
    if (args.length !== f.params.length) throw new CRuntimeError(`${f.name}() takes ${f.params.length} argument${f.params.length === 1 ? "" : "s"} but was called with ${args.length}.`, "call");
    const fr = { id: this.frameId++, name: f.name, fn: f, scopes: [new Map()], vars: [], declCache: new Map(), sp: this.mem.sp, callLine: this.line, callFile: this.file };
    this.frames.push(fr);
    const savedLine = this.line, savedFile = this.file;
    f.params.forEach((p, k) => {
      const size = sizeOf(p.type);
      const b = this.mem.alloc("stack", size, { name: p.name, type: p.type, isVar: true, isParam: true, fnName: f.name, frame: fr.id, align: size });
      const v = { name: p.name, t: p.type, addr: b.addr, block: b, param: true };
      fr.vars.push(v); fr.scopes[0].set(p.name, v);
      this.mem.store(b.addr, p.type, this.convert(args[k], p.type, `argument ${k + 1} of ${f.name}()`), p.name);
    });
    this.step("enter", f.startId, f.line, f.file);
    let r;
    try { r = this.execBlock(f.body, false); } catch (e) { throw e; }
    let ret;
    const rt = f.type.ret;
    if (r && r.ret) ret = rt.k === "void" ? { t: T.void } : this.convert(r.val, rt, `the value returned by ${f.name}()`);
    else if (rt.k !== "void") {
      if (f.name === "main") ret = intv(0);
      else { this.warn(`${f.name}() reached its closing } without a return. The caller gets a garbage value.`); ret = { t: rt, v: rt.k === "ptr" ? 0xdeadbeef : wrap(0xbebebeben, rt), garbage: true }; }
    } else ret = { t: T.void };
    this.line = f.endLine;
    this.step("return", f.exitId, f.endLine, f.file, { retVal: ret.t.k === "void" ? null : this.valueText(ret), retFn: f.name });
    this.frames.pop();
    for (const v of fr.vars) if (!v.isStatic) v.block.alive = false;
    this.mem.blocks = this.mem.blocks.filter((b) => b.alive || b.kind !== "stack" || b.frame > fr.id - 50);
    this.mem.sp = fr.sp;
    this.line = savedLine; this.file = savedFile;
    return ret;
  }

  warn(msg, cc = false) {
    const key = msg + "@" + this.line + this.file;
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.warnings.push({ msg, line: this.line, file: this.file, cc });
    this.record({ k: "warn", msg, cc });
  }

  call(e) {
    let name = null, target;
    if (e.f.k === "id" && !this.lookup(e.f.name)) {
      name = e.f.name;
      if (!this.funcs.has(name) && !this.builtins[name]) {
        if (this.protos.has(name)) throw new CRuntimeError(`${name}() is declared but its body is not in this file. Paste the function in, or remove the call.`, "link");
        throw new CRuntimeError(`${name}() is not defined. Check the spelling, or write the function above where it is used.`, "link");
      }
    } else {
      target = this.rv(e.f);
      if (target.v === 0) throw new CRuntimeError(`Calling a NULL function pointer (${exprStr(e.f)}).`, "null");
      name = this.codeByAddr.get(target.v);
      if (!name) throw new CRuntimeError(`${exprStr(e.f)} does not point to a function.`, "wild");
    }
    const args = e.args.map((a) => this.rv(a));
    if (this.funcs.has(name)) {
      this.record({ k: "call", name });
      return this.callUser(this.funcs.get(name), args, e);
    }
    const b = this.builtins[name];
    const ps = b.type.params;
    if (args.length < ps.length || (!b.type.variadic && args.length > ps.length)) throw new CRuntimeError(`${name}() takes ${ps.length} argument${ps.length === 1 ? "" : "s"} but was called with ${args.length}.`, "call");
    const conv = args.map((a, k) => (k < ps.length ? this.convert(a, ps[k], `argument ${k + 1} of ${name}()`) : a));
    this.record({ k: "call", name, builtin: true });
    return b.impl(conv);
  }

  format(args, cstr, rd) {
    const fmt = cstr(args[0].v, "printf() format");
    let ai = 1;
    const out = [];
    const push = (s) => { for (const b of new TextEncoder().encode(s)) out.push(b); };
    for (let k = 0; k < fmt.length; k++) {
      const c = fmt[k];
      if (c !== 37) { out.push(c); continue; }
      let spec = "";
      k++;
      while (k < fmt.length && !/[diuxXcspo%]/.test(String.fromCharCode(fmt[k]))) spec += String.fromCharCode(fmt[k++]);
      const conv = String.fromCharCode(fmt[k]);
      if (conv === "%") { out.push(37); continue; }
      const mm = /^([-0+ #]*)(\d*)(?:\.(\d+))?(hh|h|ll|l|z)?$/.exec(spec) || ["", "", "", undefined, undefined];
      const flags = mm[1], width = +mm[2] || 0, prec = mm[3] != null ? +mm[3] : null, len = mm[4];
      const a = args[ai++];
      if (!a) throw new CRuntimeError(`printf() format has more % conversions than arguments.`, "call");
      let s;
      const bits = len === "l" || len === "ll" || len === "z" ? 64 : len === "h" ? 16 : len === "hh" ? 8 : 32;
      const iv = a.t.k === "ptr" ? BigInt(a.v) : a.v;
      if (conv === "d" || conv === "i") s = BigInt.asIntN(bits, iv).toString();
      else if (conv === "u") s = BigInt.asUintN(bits, iv).toString();
      else if (conv === "x" || conv === "X") { s = BigInt.asUintN(bits, iv).toString(16); if (conv === "X") s = s.toUpperCase(); }
      else if (conv === "o") s = BigInt.asUintN(bits, iv).toString(8);
      else if (conv === "c") s = String.fromCharCode(Number(BigInt.asUintN(8, iv)));
      else if (conv === "p") s = a.v ? hex(Number(a.v)) : "0x0";
      else if (conv === "s") {
        if (!a.v) s = "(null)";
        else {
          const bytes = cstr(a.v, "printf() %s");
          s = new TextDecoder().decode(new Uint8Array(prec != null ? bytes.slice(0, prec) : bytes));
        }
      }
      if (prec != null && /[diuxX]/.test(conv)) s = s.replace(/^(-?)(\d+)/, (_, sg, d) => sg + d.padStart(prec, "0"));
      if (flags.includes("+") && /[di]/.test(conv) && !s.startsWith("-")) s = "+" + s;
      if (s.length < width) s = flags.includes("-") ? s.padEnd(width) : flags.includes("0") && /[diuxX]/.test(conv) ? s.replace(/^([+-]?)/, (sg) => sg + "0".repeat(width - s.length)) : s.padStart(width);
      push(s);
    }
    return out;
  }

  /* ---------- statements ---------- */

  execBlock(b, scoped = true) {
    const fr = this.frames[this.frames.length - 1];
    fr.scopes.push(new Map());
    try {
      for (const s of b.items) { const r = this.exec(s); if (r) return r; }
    } finally { fr.scopes.pop(); }
    return null;
  }

  exec(s) {
    switch (s.k) {
      case "block": return this.execBlock(s);
      case "empty": return null;
      case "decl":
        this.step("stmt", s.id, s.line, s.file);
        for (const d of s.decls) this.declareLocal(d);
        return null;
      case "expr":
        this.step("stmt", s.id, s.line, s.file);
        this.rv(s.e);
        return null;
      case "return":
        this.step("stmt", s.id, s.line, s.file);
        return { ret: true, val: s.e ? this.rv(s.e) : null };
      case "break": this.step("stmt", s.id, s.line, s.file); return { brk: true };
      case "continue": this.step("stmt", s.id, s.line, s.file); return { cont: true };
      case "if": {
        this.step("cond", s.id, s.line, s.file);
        const c = this.truthy(this.rv(s.cond));
        this.record({ k: "cond", result: c, label: exprStr(s.cond) });
        if (c) return this.exec(s.then);
        if (s.else) return this.exec(s.else);
        return null;
      }
      case "while":
        for (;;) {
          this.step("cond", s.id, s.line, s.file);
          const c = this.truthy(this.rv(s.cond));
          this.record({ k: "cond", result: c, label: exprStr(s.cond), loop: true });
          if (!c) return null;
          const r = this.exec(s.body);
          if (r) { if (r.brk) return null; if (r.ret) return r; }
        }
      case "do":
        for (;;) {
          const r = this.exec(s.body);
          if (r) { if (r.brk) return null; if (r.ret) return r; }
          this.step("cond", s.id, s.condLine, s.file);
          const c = this.truthy(this.rv(s.cond));
          this.record({ k: "cond", result: c, label: exprStr(s.cond), loop: true });
          if (!c) return null;
        }
      case "for": {
        const fr = this.frames[this.frames.length - 1];
        fr.scopes.push(new Map());
        try {
          if (s.init) this.exec(s.init);
          for (;;) {
            this.step("cond", s.condId, s.condLine, s.file);
            if (s.cond) {
              const c = this.truthy(this.rv(s.cond));
              this.record({ k: "cond", result: c, label: exprStr(s.cond), loop: true });
              if (!c) return null;
            }
            const r = this.exec(s.body);
            if (r) { if (r.brk) return null; if (r.ret) return r; }
            if (s.incr) { this.step("stmt", s.incrId, s.incrLine, s.file); this.rv(s.incr); }
          }
        } finally { fr.scopes.pop(); }
      }
    }
    throw new CRuntimeError(`unsupported statement ${s.k}`, "internal");
  }

  /* ---------- values ---------- */

  truthy(v) {
    if (v.uninit) throw new CRuntimeError("A condition depends on a variable that was never given a value (uninitialised).", "uninit");
    if (v.t.k === "int") return v.v !== 0n;
    if (v.t.k === "ptr") return v.v !== 0;
    throw new CRuntimeError(`a ${typeName(v.t)} cannot be used as a condition`, "type");
  }

  convert(v, t, ctx) {
    if (t.k === "void") return { t };
    if (t.k === "int") {
      if (v.t.k === "int") return { t, v: wrap(v.v, t), uninit: v.uninit };
      if (v.t.k === "ptr") return { t, v: wrap(BigInt(v.v), t) };
    }
    if (t.k === "ptr") {
      if (v.t.k === "ptr") return { t, v: v.v, uninit: v.uninit };
      if (v.t.k === "int") return { t, v: Number(BigInt.asUintN(64, v.v)), uninit: v.uninit };
    }
    if (t.k === "struct" && v.t.k === "struct" && (v.t === t || v.t.tag === t.tag)) return { t, v: v.v };
    if (v.t.k === "void") throw new CRuntimeError(`${ctx || "this expression"} uses the result of a void function.`, "type");
    throw new CRuntimeError(`cannot convert ${typeName(v.t)} to ${typeName(t)}${ctx ? " for " + ctx : ""}`, "type");
  }

  decay(lv) {
    if (lv.t.k === "arr") return { t: ptr(lv.t.of), v: lv.addr };
    if (lv.t.k === "fn") return { t: ptr(lv.t), v: lv.addr };
    return this.mem.load(lv.addr, lv.t, lv.label);
  }

  lv(e) {
    switch (e.k) {
      case "id": {
        const v = this.lookup(e.name);
        if (v) return { addr: v.addr, t: v.t, label: e.name };
        if (this.funcs.has(e.name) || this.builtins[e.name]) {
          const f = this.funcs.get(e.name);
          return { addr: this.codeAddr.get(e.name), t: f ? f.type : this.builtins[e.name].type, label: e.name, isFn: true };
        }
        throw new CRuntimeError(`${e.name} is not declared. Declare it at the top of the function before using it.`, "name");
      }
      case "idx": {
        let a = this.rv(e.a), i = this.rv(e.i);
        if (a.t.k === "int" && i.t.k === "ptr") [a, i] = [i, a];
        if (a.t.k !== "ptr") throw new CRuntimeError(`${exprStr(e.a)} is not an array or pointer, so it cannot be indexed.`, "type");
        if (i.t.k !== "int") throw new CRuntimeError(`array index ${exprStr(e.i)} must be an integer`, "type");
        if (a.t.to.k === "void") throw new CRuntimeError(`${exprStr(e.a)} is a void pointer: cast it (for example to unsigned char *) before indexing.`, "type");
        if (a.uninit) throw new CRuntimeError(`${exprStr(e.a)} is used before it was given a value. It points nowhere yet.`, "uninit");
        return { addr: a.v + Number(i.v) * sizeOf(a.t.to), t: a.t.to, label: exprStr(e) };
      }
      case "un":
        if (e.op === "*") {
          const p = this.rv(e.e);
          if (p.t.k !== "ptr") throw new CRuntimeError(`${exprStr(e.e)} is not a pointer, so it cannot be dereferenced with *.`, "type");
          if (p.t.to.k === "void") throw new CRuntimeError(`${exprStr(e.e)} is a void pointer: cast it before dereferencing.`, "type");
          if (p.uninit) throw new CRuntimeError(`${exprStr(e.e)} is used before it was given a value. It points nowhere yet.`, "uninit");
          if (p.t.to.k === "fn") return { addr: p.v, t: p.t.to, label: exprStr(e), isFn: true };
          return { addr: p.v, t: p.t.to, label: exprStr(e) };
        }
        break;
      case "mem": {
        let base;
        if (e.arrow) {
          const p = this.rv(e.e);
          if (p.t.k !== "ptr" || p.t.to.k !== "struct") throw new CRuntimeError(`${exprStr(e.e)} is not a pointer to a struct, so -> cannot be used.`, "type");
          if (p.uninit) throw new CRuntimeError(`${exprStr(e.e)} is used before it was given a value.`, "uninit");
          base = { addr: p.v, t: p.t.to };
        } else {
          base = this.lv(e.e);
          if (base.t.k !== "struct") throw new CRuntimeError(`${exprStr(e.e)} is not a struct, so . cannot be used.`, "type");
        }
        const f = base.t.fields.find((x) => x.name === e.name);
        if (!f) throw new CRuntimeError(`${typeName(base.t)} has no field named ${e.name}.`, "name");
        return { addr: base.addr + f.offset, t: f.type, label: exprStr(e) };
      }
    }
    throw new CRuntimeError(`${exprStr(e)} cannot be assigned to or have its address taken.`, "type");
  }

  rv(e) {
    switch (e.k) {
      case "num": return { t: e.type, v: e.v };
      case "str": {
        let a = this.literals.get(e.sid);
        if (!a) { a = this.literal(e.v); this.literals.set(e.sid, a); }
        return { t: ptr(T.char), v: a };
      }
      case "id": case "idx": case "mem": {
        const l = this.lv(e);
        if (l.isFn) return { t: ptr(l.t), v: l.addr };
        return this.decay(l);
      }
      case "un": {
        if (e.op === "*") { const l = this.lv(e); if (l.isFn) return { t: ptr(l.t), v: l.addr }; return this.decay(l); }
        if (e.op === "&") {
          const l = this.lv(e.e);
          return { t: ptr(l.t), v: l.addr };
        }
        const v = this.rv(e.e);
        if (e.op === "!") return intv(this.truthy(v) ? 0 : 1);
        if (v.t.k !== "int") throw new CRuntimeError(`unary ${e.op} needs a number, but ${exprStr(e.e)} is ${typeName(v.t)}`, "type");
        const t = promote(v.t);
        if (e.op === "-") return this.overflowCheck({ t, v: wrap(-v.v, t) }, -wrap(v.v, t), e);
        if (e.op === "+") return { t, v: wrap(v.v, t) };
        if (e.op === "~") return { t, v: wrap(~v.v, t) };
        break;
      }
      case "pre": case "post": {
        const l = this.lv(e.e);
        const old = this.mem.load(l.addr, l.t, l.label);
        const d = e.op === "++" ? 1 : -1;
        let nv;
        if (l.t.k === "ptr") nv = { t: l.t, v: old.v + d * (l.t.to.k === "void" ? 1 : sizeOf(l.t.to)) };
        else if (l.t.k === "int") nv = { t: l.t, v: wrap(old.v + BigInt(d), l.t) };
        else throw new CRuntimeError(`${exprStr(e.e)} cannot be incremented`, "type");
        if (old.uninit) throw new CRuntimeError(`${exprStr(e.e)} is incremented before it was given a value.`, "uninit");
        this.mem.store(l.addr, l.t, nv, l.label);
        return e.k === "pre" ? nv : old;
      }
      case "assign": {
        const l = this.lv(e.l);
        if (l.t.k === "arr") throw new CRuntimeError(`${exprStr(e.l)} is an array: you cannot assign to a whole array, copy it element by element.`, "type");
        let r = this.rv(e.r);
        if (e.op !== "=") {
          const cur = this.mem.load(l.addr, l.t, l.label);
          if (cur.uninit) throw new CRuntimeError(`${exprStr(e.l)} is used before it was given a value.`, "uninit");
          r = this.binop(e.op.slice(0, -1), cur, r, e);
        }
        const v = this.convert(r, l.t, `assignment to ${exprStr(e.l)}`);
        this.mem.store(l.addr, l.t, v, l.label);
        return v;
      }
      case "bin": {
        const a = this.rv(e.l), b = this.rv(e.r);
        return this.binop(e.op, a, b, e);
      }
      case "logic": {
        const a = this.truthy(this.rv(e.l));
        if (e.op === "&&" && !a) return intv(0);
        if (e.op === "||" && a) return intv(1);
        return intv(this.truthy(this.rv(e.r)) ? 1 : 0);
      }
      case "cond": return this.truthy(this.rv(e.c)) ? this.rv(e.a) : this.rv(e.b);
      case "comma": this.rv(e.l); return this.rv(e.r);
      case "cast": {
        if (e.type.k === "void") { this.rv(e.e); return { t: T.void }; }
        return this.convert(this.rv(e.e), e.type, "the cast");
      }
      case "sizeof_t": return { t: T.ulong, v: BigInt(sizeOf(e.type)) };
      case "sizeof_e": return { t: T.ulong, v: BigInt(sizeOf(this.typeOf(e.e))) };
      case "call": return this.call(e);
    }
    throw new CRuntimeError(`unsupported expression ${e.k}`, "internal");
  }

  overflowCheck(res, exact, e) {
    if (res.t.signed && res.v !== exact) this.warn(`Signed overflow in ${exprStr(e)}: the exact result ${exact} does not fit in ${typeName(res.t)}. This is undefined behaviour in C.`);
    return res;
  }

  binop(op, a, b, e) {
    if (a.uninit || b.uninit) {
      const which = a.uninit ? (e.l || e) : (e.r || e);
      throw new CRuntimeError(`${exprStr(which)} is used before it was given a value (uninitialised).`, "uninit");
    }
    const ap = a.t.k === "ptr", bp = b.t.k === "ptr";
    if (ap || bp) {
      const es = (p) => (p.t.to.k === "void" ? 1 : sizeOf(p.t.to));
      if (op === "+" && ap && !bp) return { t: a.t, v: a.v + Number(b.v) * es(a) };
      if (op === "+" && bp && !ap) return { t: b.t, v: b.v + Number(a.v) * es(b) };
      if (op === "-" && ap && !bp) return { t: a.t, v: a.v - Number(b.v) * es(a) };
      if (op === "-" && ap && bp) return { t: T.long, v: BigInt(Math.trunc((a.v - b.v) / es(a))) };
      const cmp = { "==": (x, y) => x === y, "!=": (x, y) => x !== y, "<": (x, y) => x < y, ">": (x, y) => x > y, "<=": (x, y) => x <= y, ">=": (x, y) => x >= y }[op];
      if (cmp) {
        const x = ap ? a.v : Number(a.v), y = bp ? b.v : Number(b.v);
        return intv(cmp(x, y) ? 1 : 0);
      }
      throw new CRuntimeError(`operator ${op} cannot be used on a pointer (${exprStr(e)})`, "type");
    }
    if (a.t.k !== "int" || b.t.k !== "int") throw new CRuntimeError(`operator ${op} needs numbers (${exprStr(e)})`, "type");
    if (op === "<<" || op === ">>") {
      const t = promote(a.t);
      const sh = Number(b.v);
      if (sh < 0 || sh >= t.size * 8) throw new CRuntimeError(`Shift by ${sh} bits in ${exprStr(e)} is out of range for ${typeName(t)}.`, "shift");
      const x = wrap(a.v, t);
      return { t, v: wrap(op === "<<" ? x << BigInt(sh) : x >> BigInt(sh), t) };
    }
    const t = commonType(a.t, b.t);
    if (CMP.has(op) && !t.signed && promote(a.t).signed !== promote(b.t).signed && e.l && e.r && e.l.k !== "num" && e.r.k !== "num") {
      const [sg, us] = promote(a.t).signed ? [a.t, b.t] : [b.t, a.t];
      this.warn(`${exprStr(e)} compares a signed ${typeName(sg)} with an unsigned ${typeName(us)}. cc -Wall -Wextra -Werror refuses to compile this (-Wsign-compare).`, true);
    }
    const x = wrap(a.v, t), y = wrap(b.v, t);
    switch (op) {
      case "+": return this.overflowCheck({ t, v: wrap(x + y, t) }, x + y, e);
      case "-": return this.overflowCheck({ t, v: wrap(x - y, t) }, x - y, e);
      case "*": return this.overflowCheck({ t, v: wrap(x * y, t) }, x * y, e);
      case "/": case "%":
        if (y === 0n) throw new CRuntimeError(`Division by zero in ${exprStr(e)}.`, "div0");
        return { t, v: wrap(op === "/" ? x / y : x % y, t) };
      case "&": return { t, v: wrap(x & y, t) };
      case "|": return { t, v: wrap(x | y, t) };
      case "^": return { t, v: wrap(x ^ y, t) };
      case "==": return intv(x === y ? 1 : 0);
      case "!=": return intv(x !== y ? 1 : 0);
      case "<": return intv(x < y ? 1 : 0);
      case ">": return intv(x > y ? 1 : 0);
      case "<=": return intv(x <= y ? 1 : 0);
      case ">=": return intv(x >= y ? 1 : 0);
    }
    throw new CRuntimeError(`unsupported operator ${op}`, "internal");
  }

  // static type of an expression, used by sizeof
  typeOf(e) {
    switch (e.k) {
      case "id": { const v = this.lookup(e.name); if (v) return v.t; break; }
      case "num": return e.type;
      case "str": return arr(T.char, e.v.length + 1);
      case "idx": { const t = this.typeOf(e.a); return t.k === "ptr" ? t.to : t.k === "arr" ? t.of : T.int; }
      case "un":
        if (e.op === "*") { const t = this.typeOf(e.e); return t.k === "ptr" ? t.to : t.k === "arr" ? t.of : T.int; }
        if (e.op === "&") return ptr(this.typeOf(e.e));
        return promote(this.typeOf(e.e));
      case "mem": {
        let t = this.typeOf(e.e);
        if (e.arrow) t = t.to;
        const f = t && t.fields && t.fields.find((x) => x.name === e.name);
        if (f) return f.type;
        break;
      }
      case "cast": return e.type;
      case "call": {
        const f = e.f.k === "id" && (this.funcs.get(e.f.name) || this.builtins[e.f.name]);
        if (f) return f.type.ret;
        break;
      }
      case "assign": return this.typeOf(e.l);
      case "sizeof_t": case "sizeof_e": return T.ulong;
    }
    throw new CRuntimeError(`sizeof cannot work out the type of ${exprStr(e)}`, "type");
  }

  /* ---------- describing state for the UI ---------- */

  valueText(v) {
    if (v.garbage) return "garbage";
    if (v.t.k === "ptr") return v.v === 0 ? "NULL" : hex(v.v);
    if (v.t.k === "int") return isCharLike(v.t) ? `${v.v} ${charLit(Number(BigInt.asUintN(8, v.v)))}` : String(v.v);
    return "?";
  }

  target(addr) {
    if (addr === 0) return { null: true };
    const fnName = this.codeByAddr.get(addr);
    if (fnName) return { fn: fnName };
    let b = this.mem.find(addr);
    let pastEnd = false;
    if (!b) {
      b = this.mem.blocks.slice().reverse().find((x) => x.addr + x.size === addr);
      if (b) pastEnd = true;
    }
    if (!b) return { wild: true };
    return { block: b.id, off: addr - b.addr, pastEnd, dead: !b.alive };
  }

  scalarCell(addr, t) {
    const m = this.mem;
    const init = m.isInit(addr, t.k === "struct" ? 1 : t.size);
    if (t.k === "ptr") {
      const v = Number(m.rawInt(addr, 8, false));
      return { kind: "ptr", init, raw: v, text: init ? (v ? hex(v) : "NULL") : "?", target: init ? this.target(v) : null, to: typeName(t.to) };
    }
    if (t.k === "int") {
      const v = m.rawInt(addr, t.size, t.signed);
      if (isCharLike(t)) return { kind: "char", init, raw: Number(BigInt.asUintN(8, v)), text: init ? charText(Number(BigInt.asUintN(8, v))) : "?", num: String(v) };
      return { kind: "int", init, raw: String(v), text: init ? String(v) : "?" };
    }
    if (t.k === "struct") {
      return { kind: "struct", fields: t.fields.map((f) => ({ name: f.name, type: typeName(f.type), ...this.cellFor(addr + f.offset, f.type) })) };
    }
    if (t.k === "arr") return { kind: "arr", text: `${typeName(t)}` };
    return { kind: "other", text: "?" };
  }

  cellFor(addr, t) {
    if (t.k === "arr") return { kind: "inline-arr", items: Array.from({ length: Math.min(t.n, 16) }, (_, k) => this.scalarCell(addr + k * sizeOf(t.of), t.of)) };
    return this.scalarCell(addr, t);
  }

  describe() {
    const m = this.mem;
    const frames = this.frames.map((fr) => ({
      id: fr.id, name: fr.name,
      vars: fr.vars.filter((v) => v.block.alive).map((v) => {
        const base = { name: v.name, type: typeName(v.t), addr: v.addr, block: v.block.id, param: !!v.param };
        if (v.t.k === "arr") return { ...base, kind: "arr" };
        return { ...base, ...this.scalarCell(v.addr, v.t) };
      }),
    }));
    // pointer sources: [{addr, to}] used to infer how to draw heap and literal blocks
    const sources = [];
    const collect = (cell, to) => {
      if (!cell) return;
      if (cell.kind === "ptr" && cell.init && cell.raw) sources.push({ addr: cell.raw, to: cell.toT });
      if (cell.kind === "struct") cell.fields.forEach((f) => collect(f));
      if (cell.kind === "inline-arr") cell.items.forEach((c) => collect(c));
    };
    const tagPtrTypes = (addr, t, cell) => {
      if (t.k === "ptr" && cell.kind === "ptr") cell.toT = t.to;
      if (t.k === "struct" && cell.kind === "struct") t.fields.forEach((f, k) => tagPtrTypes(addr + f.offset, f.type, cell.fields[k]));
    };
    for (const fr of this.frames) for (const v of fr.vars) {
      if (!v.block.alive || v.t.k === "arr") continue;
      const cell = this.scalarCell(v.addr, v.t);
      tagPtrTypes(v.addr, v.t, cell);
      collect(cell);
    }
    const shown = new Map(); // block id -> elem type
    const innermost = (t) => { while (t.k === "arr") t = t.of; return t; };
    for (const b of m.blocks) {
      if (b.isVar && b.type.k === "arr" && b.alive) shown.set(b.id, innermost(b.type));
      if (b.isVar && b.kind === "global" && b.type.k !== "arr") continue;
      if (b.kind === "heap") shown.set(b.id, null);
    }
    const inferFrom = (list) => {
      for (const s of list) {
        const b = m.find(s.addr) || m.blocks.find((x) => x.addr + x.size === s.addr);
        if (!b || b.isVar) continue;
        if (!shown.has(b.id) || shown.get(b.id) === null) {
          if (s.to && s.to.k !== "void" && s.to.k !== "fn") shown.set(b.id, s.to);
          else if (!shown.has(b.id)) shown.set(b.id, null);
        }
      }
    };
    inferFrom(sources);
    // pointers stored inside shown blocks (char ** arrays, list nodes) refine the picture
    for (let pass = 0; pass < 4; pass++) {
      const more = [];
      for (const [id, et] of shown) {
        if (!et || (et.k !== "ptr" && et.k !== "struct")) continue;
        const b = m.blocks.find((x) => x.id === id);
        const es = sizeOf(et);
        for (let k = 0; k * es + es <= b.size && k < 64; k++) {
          const cell = this.scalarCell(b.addr + k * es, et);
          tagPtrTypes(b.addr + k * es, et, cell);
          (function walk(c) { if (c.kind === "ptr" && c.init && c.raw) more.push({ addr: c.raw, to: c.toT }); if (c.kind === "struct") c.fields.forEach(walk); })(cell);
        }
      }
      const n = shown.size;
      const fresh = more.filter((s) => !sources.some((x) => x.addr === s.addr && x.to === s.to));
      inferFrom(fresh);
      sources.push(...fresh);
      if (shown.size === n && !fresh.length) break;
    }
    const referenced = (b) => sources.some((s) => s.addr >= b.addr && s.addr <= b.addr + b.size);
    const blocks = [];
    for (const b of m.blocks) {
      if (!shown.has(b.id)) continue;
      let et = shown.get(b.id) || (b.kind === "rodata" ? T.char : T.uchar);
      let es = sizeOf(et);
      if (es > b.size && b.size > 0) { et = T.uchar; es = 1; }
      const n = b.size === 0 ? 0 : Math.floor(b.size / es);
      const cells = [];
      for (let k = 0; k < Math.min(n, 64); k++) cells.push(this.cellFor(b.addr + k * es, et));
      const lost = b.kind === "heap" && b.alive && !referenced(b);
      if (lost && !b.lostReported) { b.lostReported = true; this.warn(`Memory leak: the ${b.size}-byte block from line ${b.line} is no longer pointed to by anything, so it can never be freed.`); }
      blocks.push({
        id: b.id, kind: b.kind, addr: b.addr, size: b.size, alive: b.alive, freedLine: b.freedLine,
        name: b.isVar ? b.name : b.kind === "heap" ? b.how : b.label, owner: b.fnName || null, line: b.line,
        elem: typeName(et), elemSize: es, count: n, cells, more: Math.max(0, n - 64), lost,
      });
    }
    return { frames, blocks };
  }
}

function charText(c) {
  if (c === 0) return "\\0";
  if (c === 10) return "\\n";
  if (c === 9) return "\\t";
  if (c >= 32 && c < 127) return String.fromCharCode(c);
  return "\\x" + c.toString(16).padStart(2, "0");
}
