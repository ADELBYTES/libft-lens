// C type model for a 64-bit little-endian target (LP64, like macOS and Linux at 42).

const int = (name, size, signed) => ({ k: "int", name, size, signed });

export const T = {
  void: { k: "void", name: "void", size: 1 },
  char: int("char", 1, true),
  schar: int("signed char", 1, true),
  uchar: int("unsigned char", 1, false),
  short: int("short", 2, true),
  ushort: int("unsigned short", 2, false),
  int: int("int", 4, true),
  uint: int("unsigned int", 4, false),
  long: int("long", 8, true),
  ulong: int("unsigned long", 8, false),
  llong: int("long long", 8, true),
  ullong: int("unsigned long long", 8, false),
};

export const ptr = (to) => ({ k: "ptr", to, size: 8 });
export const arr = (of, n) => ({ k: "arr", of, n, get size() { return n == null ? 0 : n * sizeOf(of); } });
export const fn = (ret, params, variadic = false) => ({ k: "fn", ret, params, variadic, size: 1 });

// typedef names every libft file can use without the headers
export const BUILTIN_TYPEDEFS = {
  size_t: { ...T.ulong, alias: "size_t" },
  ssize_t: { ...T.long, alias: "ssize_t" },
  uintptr_t: { ...T.ulong, alias: "uintptr_t" },
  intptr_t: { ...T.long, alias: "intptr_t" },
  ptrdiff_t: { ...T.long, alias: "ptrdiff_t" },
  int8_t: { ...T.schar, alias: "int8_t" },
  uint8_t: { ...T.uchar, alias: "uint8_t" },
  int16_t: { ...T.short, alias: "int16_t" },
  uint16_t: { ...T.ushort, alias: "uint16_t" },
  int32_t: { ...T.int, alias: "int32_t" },
  uint32_t: { ...T.uint, alias: "uint32_t" },
  int64_t: { ...T.long, alias: "int64_t" },
  uint64_t: { ...T.ulong, alias: "uint64_t" },
  bool: { ...T.uchar, alias: "bool" },
};

export function sizeOf(t) {
  if (t.k === "struct") {
    if (!t.complete) throw new Error(`struct ${t.tag} is used before its fields are defined`);
    return t.size;
  }
  return t.size;
}

export function alignOf(t) {
  if (t.k === "arr") return alignOf(t.of);
  if (t.k === "struct") return t.align || 1;
  return Math.min(t.size || 1, 8);
}

export function layoutStruct(st, fields) {
  let off = 0, align = 1;
  st.fields = fields.map((f) => {
    const a = alignOf(f.type);
    off = Math.ceil(off / a) * a;
    const field = { name: f.name, type: f.type, offset: off };
    off += sizeOf(f.type);
    align = Math.max(align, a);
    return field;
  });
  st.size = Math.ceil(off / align) * align || 1;
  st.align = align;
  st.complete = true;
}

export const isInt = (t) => t.k === "int";
export const isPtr = (t) => t.k === "ptr";
export const isScalar = (t) => t.k === "int" || t.k === "ptr";
export const isCharLike = (t) => t.k === "int" && t.size === 1;

export function typeName(t, inner = "") {
  switch (t.k) {
    case "void": case "int": return (t.alias || t.name) + (inner ? " " + inner : "");
    case "struct": return (t.alias || `struct ${t.tag || "(anon)"}`) + (inner ? " " + inner : "");
    case "ptr": {
      const needParens = t.to.k === "arr" || t.to.k === "fn";
      const s = needParens ? `(*${inner})` : `*${inner}`;
      return typeName(t.to, s);
    }
    case "arr": return typeName(t.of, `${inner}[${t.n ?? ""}]`);
    case "fn": return typeName(t.ret, `${inner}(${t.params.map((p) => typeName(p)).join(", ") || "void"}${t.variadic ? ", ..." : ""})`);
  }
  return "?";
}

// structural type equality used for prototype checks; const is ignored on purpose
export function sameType(a, b) {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case "void": return true;
    case "int": return a.size === b.size && a.signed === b.signed && (a.name === "char") === (b.name === "char");
    case "ptr": return sameType(a.to, b.to);
    case "arr": return a.n === b.n && sameType(a.of, b.of);
    case "struct": return a === b || (a.tag && a.tag === b.tag);
    case "fn": return sameType(a.ret, b.ret) && a.params.length === b.params.length && a.params.every((p, i) => sameType(p, b.params[i]));
  }
  return false;
}

// usual arithmetic conversions, simplified for integer-only C
export function promote(t) {
  if (t.k === "int" && t.size < 4) return T.int;
  return t;
}

export function commonType(a, b) {
  a = promote(a); b = promote(b);
  if (a.size !== b.size) return a.size > b.size ? a : b;
  if (!a.signed) return a;
  if (!b.signed) return b;
  return a;
}
