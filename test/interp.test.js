import test from "node:test";
import assert from "node:assert/strict";
import { parse, CSyntaxError } from "../src/parser.js";
import { run } from "../src/interp.js";
import { buildFlow } from "../src/flow.js";
import { checkFunction, normCheck } from "../src/checks.js";
import { TESTS, LIST_PRELUDE } from "../src/libft.js";
import { SAMPLES } from "../src/samples.js";

const exec = (src, opts) => run(parse(src, { prelude: /t_list/.test(src) ? LIST_PRELUDE : "" }), opts);
const out = (body) => exec(`int main(void) { ${body} return 0; }`).stdout;

test("integer semantics follow C on a 64-bit target", () => {
  assert.equal(out(`printf("%d %d", -7 / 2, -7 % 2);`), "-3 -1");
  assert.equal(out(`printf("%d", -1 < 1u);`), "0");
  assert.equal(out(`printf("%d", (char)200);`), "-56");
  assert.equal(out(`unsigned char c = 255; c++; printf("%d", c);`), "0");
  assert.equal(out(`printf("%zu %zu", sizeof(int), sizeof(char *));`), "4 8");
  assert.equal(out(`size_t n = 0; n--; printf("%lu", n);`), "18446744073709551615");
  assert.equal(out(`int a[4] = {1, 2}; printf("%d%d%d%d %zu", a[0], a[1], a[2], a[3], sizeof a);`), "1200 16");
  assert.equal(out(`printf("[%5d|%-3s|%c|%x]", 42, "ab", 'z', 255);`), "[   42|ab |z|ff]");
});

test("pointers, structs and function pointers", () => {
  assert.equal(out(`char s[] = "abc"; char *p = s; p += 2; printf("%c %ld", *p, p - s);`), "c 2");
  const r = exec(`
    char up(unsigned int i, char c) { return c - 32 + i * 0; }
    char *map(const char *s, char (*f)(unsigned int, char)) {
      char *r = malloc(4); int i = 0;
      while (s[i]) { r[i] = f(i, s[i]); i++; }
      r[i] = 0; return r;
    }
    int main(void) { char *x = map("abc", up); printf("%s", x); free(x); return 0; }`);
  assert.equal(r.error, null);
  assert.equal(r.stdout, "ABC");
  assert.equal(exec(`
    int main(void) { t_list a; t_list b; a.next = &b; b.next = 0; b.content = "hi";
      printf("%s", (char *)a.next->content); return 0; }`).stdout, "hi");
});

test("catches the classic memory bugs", () => {
  const kind = (body) => { const r = exec(`int main(void) { ${body} return 0; }`); return r.error && r.error.kind; };
  assert.equal(kind(`char *p = malloc(3); p[3] = 'x'; free(p);`), "heap-overflow");
  assert.equal(kind(`int *p = 0; *p = 1;`), "null");
  assert.equal(kind(`char *s = "abc"; s[0] = 'x';`), "rodata");
  assert.equal(kind(`char *p = malloc(2); free(p); p[0] = 'a';`), "uaf");
  assert.equal(kind(`char *p = malloc(2); free(p); free(p);`), "free");
  assert.equal(kind(`int i; if (i) i = 1;`), "uninit");
  assert.equal(kind(`int a[2]; a[2] = 1;`), "overflow");
  assert.equal(kind(`int i = 0; while (i < 3) { }`), "timeout");
  assert.equal(kind(`int x = 1 / (1 - 1);`), "div0");
  const leak = exec(`int main(void) { char *p = malloc(5); p = 0; return 0; }`);
  assert.equal(leak.leaks.length, 1);
  assert.equal(leak.leaks[0].size, 5);
  const dangling = exec(`int *f(void) { int x = 4; return &x; } int main(void) { int *p = f(); return *p; }`);
  assert.equal(dangling.error.kind, "dangling");
});

test("syntax errors carry a line number", () => {
  assert.throws(() => parse("int main(void)\n{\n\tint i\n\treturn 0;\n}"), (e) => e instanceof CSyntaxError && e.line === 4);
  assert.throws(() => parse("int main(void) { float x; }"), /float/);
});

test("samples run as documented", () => {
  const by = Object.fromEntries(SAMPLES.map((s) => [s.id, exec(s.code)]));
  assert.equal(by.strlen.stdout, "3\n");
  assert.equal(by.memmove.stdout, "ababab\n");
  assert.equal(by.strdup.error.kind, "heap-overflow");
  assert.equal(by.split.stdout, "[ab]\n[cd]\n[e]\n");
  assert.equal(by.split.leaks.length, 0);
  assert.equal(by.lists.stdout, "one\ntwo\nthree\n");
  for (const r of Object.values(by)) assert.ok(r.steps.length > 1);
});

test("trace snapshots describe frames, blocks and pointer targets", () => {
  const r = exec(SAMPLES.find((s) => s.id === "strlen").code);
  const inLoop = r.steps.find((s) => s.fn === "ft_strlen" && s.kind === "cond");
  const s = inLoop.frames.at(-1).vars.find((v) => v.name === "s");
  assert.equal(s.kind, "ptr");
  const lit = inLoop.blocks.find((b) => b.id === s.target.block);
  assert.equal(lit.kind, "rodata");
  assert.deepEqual(lit.cells.map((c) => c.text), ["h", "i", "!", "\\0"]);
});

const REF = `
size_t ft_strlen(const char *s) { size_t i = 0; while (s[i]) i++; return i; }
int ft_isalpha(int c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'); }
void *ft_memset(void *s, int c, size_t n) { unsigned char *p = s; size_t i = 0; while (i < n) p[i++] = (unsigned char)c; return s; }
void *ft_memmove(void *d, const void *s, size_t n) { unsigned char *a = d; const unsigned char *b = s;
  if (a == b || !n) return d; if (a > b) { while (n--) a[n] = b[n]; } else { size_t i = 0; while (i < n) { a[i] = b[i]; i++; } } return d; }
char *ft_strdup(const char *s) { char *d = malloc(ft_strlen(s) + 1); size_t i = 0; if (!d) return NULL; while (s[i]) { d[i] = s[i]; i++; } d[i] = 0; return d; }
static size_t wc(char const *s, char c) { size_t n = 0; while (*s) { if (*s != c && (s[1] == c || !s[1])) n++; s++; } return n; }
char **ft_split(char const *s, char c) { char **w = malloc(sizeof(char *) * (wc(s, c) + 1)); size_t k = 0, l;
  while (*s) { l = 0; while (s[l] && s[l] != c) l++; if (l) { w[k] = malloc(l + 1); for (size_t j = 0; j < l; j++) w[k][j] = s[j]; w[k++][l] = 0; } s += l + (s[l] != 0); }
  w[k] = NULL; return w; }
t_list *ft_lstnew(void *c) { t_list *n = malloc(sizeof(t_list)); if (!n) return 0; n->content = c; n->next = 0; return n; }
`;

test("a correct libft passes the walkthrough tests", () => {
  for (const fn of ["ft_isalpha", "ft_strlen", "ft_memset", "ft_memmove", "ft_strdup", "ft_split", "ft_lstnew"]) {
    for (const t of TESTS[fn]) {
      const r = exec(REF + "\n" + t.code, { trace: false });
      assert.equal(r.error, null, `${fn} / ${t.name}: ${r.error && r.error.msg}`);
      assert.ok(r.expects.length > 0 && r.expects.every((e) => e.ok), `${fn} / ${t.name}: ${r.expects.filter((e) => !e.ok).map((e) => e.msg)}`);
      assert.equal(r.leaks.length, 0, `${fn} / ${t.name} leaks`);
    }
  }
});

test("static checks: prototype, forbidden calls, Norm", () => {
  const src = "int\tft_isalpha(char c)\n{\n\tint\tx = 0;\n\tfor (x = 0; x < 1; x++)\n\t\t;\n\treturn (isalpha(c));\n}\n";
  const p = parse(src);
  const f = p.items[0];
  const c = checkFunction(p, f);
  assert.equal(c.protoOk, false);
  assert.deepEqual(c.forbidden.map((x) => x.name), ["isalpha"]);
  const norm = normCheck(p, src).map((n) => n.msg).join(" ");
  assert.match(norm, /for loops are forbidden/);
  assert.match(norm, /initialised on the same line/);
});

test("flowchart has a back edge for every loop", () => {
  const p = parse(SAMPLES.find((s) => s.id === "memmove").code);
  const fl = buildFlow(p.items.find((it) => it.name === "ft_memmove"));
  const rows = new Map(fl.nodes.map((n) => [n.id, n.row]));
  assert.ok(fl.edges.some((e) => rows.get(e.to) < rows.get(e.from)));
  assert.ok(fl.edges.some((e) => e.label === "false"));
});
