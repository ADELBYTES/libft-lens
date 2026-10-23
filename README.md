# libft Lens

A learning tool for 42 students working on **libft**. You write the C yourself, then step through it and watch what it does to memory: stack frames, arrays, heap blocks, `'\0'` terminators and pointer arrows. A flowchart of your function lights up as each line runs.

The coach never writes code for you. Hints go from a question, to the concept, to a plain-language next step.

## What it does

- **Runs any C you type** (within the libft subset, below) in a C interpreter that runs entirely in the browser.
- **Memory view.** Shows each call's stack frame, every array, string literal and `malloc` block byte by byte, and draws pointers as arrows, including `char **` arrays and `t_list` nodes.
- **Catches real bugs** with a clear explanation: out-of-bounds reads and writes (stack and heap), NULL dereference, use after free, double free, invalid free, writes to string literals, dangling pointers to dead stack frames, uninitialised values, division by zero, signed overflow, infinite loops and leaks.
- **Logic flow.** A flowchart of the current function shows which line runs next, the arrow just taken and how many times each line has run. While you edit, it follows your cursor.
- **Path to pass.** For each libft function it checks the prototype against the subject, flags functions the subject forbids, runs a partial Norm check, gives milestone hints and runs tests. You can **Watch** any test run step by step.

## Run it locally

No build step and no dependencies. ES modules need to be served over HTTP:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Tests

```bash
npm test
```

The tests cover C semantics, bug detection, the samples, and a reference libft that must pass every walkthrough test driver.

## Supported C

Supported: integer types (`char` to `long long`, signed and unsigned, `size_t`), pointers, arrays (including multi-dimensional), structs and `typedef`, function pointers, `static` locals, globals, every operator, `if`/`while`/`do`/`for`, `break`/`continue`, string and char escapes, and object-like `#define`. `#include` lines are skipped. `t_list` is provided automatically when your file uses it without defining it.

Built-in libc: `malloc`, `calloc`, `free`, `write`, `printf`, `puts`, `putchar`, and the usual string, memory and `ctype` functions, so a `main` can compare against them.

Not supported yet: `float`/`double`, `union`, `enum`, `switch`, `goto`, function-like macros and `va_list`.

Always confirm with `cc -Wall -Wextra -Werror`, sanitizers and `norminette`: this is a teaching interpreter, not a compiler.

## Layout

```
index.html        page shell
css/app.css       styles (light and dark)
src/lexer.js      tokenizer and #define handling
src/parser.js     C subset parser → AST with statement ids
src/types.js      LP64 type model
src/interp.js     tracing interpreter over a byte-addressed memory model
src/flow.js       control-flow graph for the flowchart
src/checks.js     prototype, forbidden-function and Norm checks
src/libft.js      subject catalog, test drivers and hint ladders
src/samples.js    example programs
src/app.js        UI
test/             node:test suite
```
