# stdout vs stderr — Node.js Demo Report

**Path scanned:** `~/projects`  
**Generated:** 2026-05-03  
**Scripts:** `dirlist.js`, `demo.js`  
**Dependencies:** `winston` (`npm install winston`)

---

## The core rule

```
stdout (fd 1)  =  DATA your program produces
                  → consumed by pipes, redirects, downstream tools

stderr (fd 2)  =  Your program's VOICE
                  → logs, progress, warnings, errors
                  → flows straight to the terminal, bypasses pipes
```

`stderr` does **not** mean invisible. It means **bypasses pipes**. Without a redirect, your terminal receives both streams. The difference only surfaces when you pipe.

---

## Three Node.js approaches

| Approach | Diagnostic call | Routing |
|---|---|---|
| Correct `console` | `console.error(msg)` | Automatic — already stderr by default |
| **`winston` (preferred)** | `log.info()` / `log.warn()` | Transport-based — swap destination without touching call sites |
| Wrong `console` | `console.log(msg)` | stdout — pollutes pipe consumers |

### The Node.js advantage over Python

Unlike Python's `print()` which defaults to stdout for everything, **`console.error()` already routes to stderr**. The correct behaviour is the default — you just have to use the right function. The mistake in Node.js is reaching for `console.log()` for both data and diagnostics.

The four primitives, from lowest to highest level:

```js
process.stdout.write(data + '\n')  // raw fd 1 — what console.log wraps
process.stderr.write(msg  + '\n')  // raw fd 2 — what console.error wraps
console.log(data)                  // stdout  ✓  data
console.error(msg)                 // stderr  ✓  diagnostic (already correct!)
```

---

## Experiment 1 — Raw output, no pipe

### Correct (console mode) — stdout only, what a pipe receives

```bash
$ node dirlist.js ~/Projects 2>/dev/null
```

`2>/dev/null` suppresses stderr so only the data stream is visible. No `[INFO]` lines.

```
/home/user/projects/api-server
/home/user/projects/web-client
/home/user/projects/cli-tool
...
```

### Correct (console mode) — full terminal view (both streams)

```bash
$ node dirlist.js ~/Projects
```

Without a redirect the terminal receives both `fd 1` and `fd 2`. `[INFO]` lines still appear on screen — they just travel via `fd 2` and bypass any pipe.

```
[INFO]  Starting directory scan: /home/user/projects
/home/user/projects/api-server
/home/user/projects/web-client
...
```

### Correct (winston mode) — stdout only

```bash
$ node dirlist.js --use-logging ~/Projects 2>/dev/null
```

`log.info()` routes to stderr via the configured transport. Suppressing stderr gives identical clean output — no arguments needed at the call site.

```
/home/user/projects/api-server
/home/user/projects/web-client
...
```

### Wrong mode — stdout only

```bash
$ node dirlist.js --wrong-output ~/Projects 2>/dev/null
```

`[INFO]` was written with `console.log()`, so it lands on stdout. Even with stderr suppressed, the log lines appear — because they were never on stderr in the first place.

```
[INFO]  Starting directory scan (WRONG MODE): /home/user/projects
/home/user/projects/api-server
/home/user/projects/web-client
...
```

---

## Experiment 2 — Pipe to `wc -l` (count lines)

```bash
# Correct — console mode
$ node dirlist.js ~/Projects | wc -l
5098 directories   ← exact count

# Correct — winston mode
$ node dirlist.js --use-logging ~/Projects | wc -l
5098 directories   ← identical result

# Wrong
$ node dirlist.js --wrong-output ~/Projects | wc -l
5100 lines         ← 2 phantom lines from [INFO] noise
```

Both correct modes produce the same count. Winston's transport layer is transparent to the pipe.

---

## Experiment 3 — `console.error()` vs `console.log()`: the Node.js advantage

### Wrong approach — `console.log()` for everything

```js
console.log(data)           // stdout  ✓
console.log('[INFO] ...')   // stdout  ✗  should be console.error()
console.log('[WARN] ...')   // stdout  ✗  should be console.error()
```

This is the single most common mistake. It looks fine in a terminal (both streams display), but breaks the moment someone pipes your output.

### Correct console approach

```js
console.log(data)             // stdout  ✓  data
console.error('[INFO] ...')   // stderr  ✓  diagnostic — no extra setup needed
console.error('[WARN] ...')   // stderr  ✓  warning
```

This is already the correct behaviour. `console.error` is not "for errors" — it is for anything that should go to stderr: info, warnings, progress, debug output.

### Winston approach (preferred for production)

```js
const winston = require('winston');

const log = winston.createLogger({
  level: 'debug',
  format: winston.format.printf(({ level, message }) => `[${level.toUpperCase()}]  ${message}`),
  transports: [
    new winston.transports.Stream({ stream: process.stderr }),  // stderr by default
  ],
});

console.log(data)    // data  → stdout  ✓
log.info('...')      // diag  → stderr  ✓  transport handles routing
log.warn('...')      // warn  → stderr  ✓  transport handles routing
log.error('...')     // error → stderr  ✓  swap transport = change destination
```

You also get for free:

- **Transport layer** — swap `Stream(process.stderr)` for `File`, `Http`, or a cloud transport without changing any call site
- **Level filtering** — set `level: 'warn'` in production to silence all `debug`/`info` output
- **Structured JSON** — use `winston.format.json()` for machine-parseable logs (useful with log aggregators like Datadog or Splunk)

`console.error()` is not wrong — it is perfectly fine for scripts and small tools. Reach for winston when the program runs in production, needs log aggregation, or you want to control verbosity per environment.

---

## Experiment 4 — Suppress stderr (`2>/dev/null`)

```bash
$ node dirlist.js ~/Projects 2>/dev/null | wc -l
5098 directories   ← no [INFO] clutter, same data
```

Works identically for both `console.error` and `winston` modes, because both route diagnostics to `fd 2`.

---

## Experiment 5 — Capture stderr to a file (`2>file`)

```bash
$ node dirlist.js --use-logging ~/Projects 2>dirlist.log | wc -l
5098 directories
```

`dirlist.log` receives:
```
[INFO]  Starting directory scan: /home/user/projects
[INFO]  Done. Found 5098 directories, skipped 0.
```

stdout flows to the pipe unaffected. With winston, you can skip the shell redirect entirely by adding a `File` transport in code:

```js
new winston.transports.File({ filename: 'dirlist.log' })
```

---

## Experiment 6 — Merge stderr into stdout (`2>&1`)

```bash
$ node dirlist.js ~/Projects 2>&1 | wc -l
5100 lines   ← directories + [INFO] lines merged
```

`2>&1` intentionally merges both streams. The result is the same inflated count as `--wrong-output`. Use deliberately (e.g. capturing everything to a single log), never by accident.

---

## Experiment 7 — Exit codes

Exit codes tell callers and pipelines whether a program succeeded. GNU convention: **`0`** success, **`1`** runtime error, **`2`** usage error.

### Success — correct invocation

```bash
$ node dirlist.js ~/Projects >/dev/null 2>&1; echo $?
0
```

### Usage error — no path argument

```bash
$ node dirlist.js
```

The CLI prints a missing-argument message to **stderr** and exits **`2`** (fix the invocation).

### Runtime error — path does not exist

```bash
$ node dirlist.js /no/such/path
```

Arguments were valid; scanning fails. The program uses **`process.exit(EXIT_ERR)`** with exit **`1`** and writes the failure to stderr.

Callers can branch: **`0`** proceed, **`1`** runtime failure, **`2`** usage mistake.

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│  Node.js stdout/stderr routing                                       │
│                                                                       │
│  console.log(data)              → stdout  ✓  data                   │
│  console.error(msg)             → stderr  ✓  diagnostic (built-in!) │
│  process.stdout.write(data)     → stdout  ✓  raw primitive           │
│  process.stderr.write(msg)      → stderr  ✓  raw primitive           │
│  log.info/warn/error(msg)       → stderr  ✓  diagnostic (winston)   │
│                                                                       │
│  console.log(msg) for diagnos.  → stdout  ✗  wrong — pollutes pipes │
├─────────────────────────────────────────────────────────────────────┤
│  Why prefer winston over console.error()?                            │
│                                                                       │
│  • Transport layer: swap file, HTTP, or cloud with zero call changes │
│  • Level filtering: silence debug in prod without touching code      │
│  • Structured JSON output: machine-parseable logs out of the box     │
│  • console.error() is fine for small scripts; winston for anything   │
│    that runs in production or needs log aggregation                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|---|---|
| `dirlist.js` | Main script — lists directories recursively |
| `demo.js` | Runs all 7 experiments side-by-side |
| `package.json` | Project manifest (`winston` dependency) |

```bash
npm install          # install winston
node demo.js /some/path
```
