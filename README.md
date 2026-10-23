# libft Lens

A learning tool for 42 students working on **libft**. You write the C yourself, then step through it and watch what it does to memory: stack frames, arrays, heap blocks, `'\0'` terminators and pointer arrows. A flowchart of your function lights up as each line runs.

Help comes in small steps: a question, then the concept, then a plain-language step, then the code with blanks. Full code is only shown at the last step, when you ask for it.

## What it does

- **All 43 libft exercises** from subject v19.3 (Part 1, Part 2 and the bonus lists), ordered from easy to hard. Each has a goal, the subject prototype, allowed functions, tests, two hints, and a starter file.
- **Steps to get there.** Each starter shows the plan as numbered placeholders (`/* ▢ 1: count until the terminator */`). When you are stuck on a step, reveal it gradually: what it achieves, then a plain-language step, then the C with blanks, and only then the code. Revealing code marks the exercise as assisted.
- **Live as you type.** About half a second after you stop typing, your code runs against the selected test in a background worker. Click any line to see memory at the last moment that line ran.
- **Memory view.** Stack frames, arrays, string literals and `malloc` blocks drawn cell by cell, with pointers as arrows (including `char **` and `t_list` nodes). The beginner view hides addresses; Expert view shows them.
- **Step animations.** When stepping forward one step (or pressing Play), stack frames slide in and out, pointer arrows glide to their new target, changed values flip, copied bytes fly from source to destination, malloc blocks grow in, freed blocks crumble, and leaks pulse at the end. The code line and the flowchart highlight sweep to the next line. Scrubbing and stepping back stay instant. Turn it off with the Animations switch; the system "reduce motion" setting turns it off too.
- **Flow view.** A flowchart of the current function lights up the line about to run and the arrow just taken, and counts how often each line ran.
- **Catches real bugs** with a clear explanation: out-of-bounds reads and writes, NULL dereference, use after free, double free, invalid free, writes to string literals, dangling stack pointers, uninitialised values, missing returns, division by zero, signed overflow, infinite loops and leaks.
- **Checks against the subject**: prototype, forbidden functions and a partial Norm check.
- **Linking.** When your code calls another libft function, your own passing version is linked in. Until that exercise passes, a built-in version is used. Linked code runs without being recorded step by step.
- **Free code mode** to paste and visualise any C in the supported subset.

## Run it locally

No build step and no dependencies. ES modules need to be served over HTTP:

```bash
npm start
```

(`tools/serve.py` is a static server that disables caching, so edits to modules always reload.)

Then open http://localhost:8080.

## Tests

```bash
npm test
```

The tests check C semantics and bug detection. For each of the 43 exercises they also check that the reference passes every test, has the subject prototype, uses only allowed functions and passes the partial Norm check, and that the starter compiles with any single step filled in.

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
src/libft.js      subject catalog and test drivers
src/exercises.js  goals, hints and reference solutions with hidden steps
src/blocks.js     expands solutions into starters and reveal levels
src/program.js    links libft dependencies and test drivers
src/worker.js     runs programs off the main thread
src/samples.js    example programs
src/app.js        UI
test/             node:test suite
tools/serve.py    no-cache dev server
```
