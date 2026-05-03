# stdout vs stderr — Demo Report

**Path scanned:** `~/projects`  
**Generated:** 2026-05-03

---

## The core rule

```
stdout (fd 1)  =  DATA your program produces
                  → consumed by pipes, redirects, downstream tools

stderr (fd 2)  =  Your program's VOICE
                  → logs, progress, warnings, errors
                  → flows straight to the terminal, bypasses pipes
```

`stderr` does **not** mean invisible. It means **bypasses pipes**. Without a redirect, your terminal receives both streams — they look the same. The difference only surfaces when you pipe.

---

## Experiment 1 — Raw output, no pipe

### Correct mode: stdout only (what a pipe consumer receives)

```bash
$ ./dirlist.sh ~/Projects 2>/dev/null
```

`2>/dev/null` suppresses stderr so you can isolate what stdout contains — only directory paths, no `[INFO]` lines.

```
/home/user/projects/api-server
/home/user/projects/api-server/logs
/home/user/projects/api-server/tests
/home/user/projects/web-client
...
```

### Correct mode: full terminal view (both streams, no redirect)

```bash
$ ./dirlist.sh ~/Projects
```

Without a redirect, your terminal is the destination for both `fd 1` and `fd 2`. `[INFO]` lines still appear on screen — they just travel via `fd 2`.

```
[INFO]  Starting directory scan: /home/user/projects
[INFO]  Timestamp: Sun May  3 14:13:36 EDT 2026
/home/user/projects/api-server
/home/user/projects/api-server/logs
...
```

### Wrong mode: stdout only (`--wrong-output`)

```bash
$ ./dirlist.sh --wrong-output ~/Projects 2>/dev/null
```

In wrong mode `[INFO]` lines are written to stdout, so they appear here too. This is exactly what `wc -l`, `grep`, and other pipe consumers will receive.

```
[INFO]  Starting directory scan (WRONG MODE): /home/user/projects
[INFO]  Timestamp: Sun May  3 14:13:36 EDT 2026
/home/user/projects/api-server
/home/user/projects/api-server/logs
...
```

---

## Experiment 2 — Pipe to `wc -l` (count lines)

```bash
# Correct
$ ./dirlist.sh ~/Projects | wc -l
5027 directories   ← exact count, [INFO] lines bypassed the pipe

# Wrong
$ ./dirlist.sh --wrong-output ~/Projects | wc -l
5032 lines         ← 5 phantom lines from [INFO] noise
```

**Difference: 5 phantom lines** — in wrong mode, `dirlist.sh` writes **five** non-directory lines to stdout before any `private/` handling: two `[INFO]` lines at the start (scan + timestamp), then after the directory list three more `[INFO]` lines (summary, rule-of-thumb separator, closing hint). If a directory named `private` appears in the tree, a **`[WARN]`** line is also on stdout, and the phantom count increases by one.

---

## Experiment 3 — Pipe to `grep`

```bash
# Correct
$ ./dirlist.sh ~/Projects | grep -c '.'
5027   ← every match is a real directory

# Wrong
$ ./dirlist.sh --wrong-output ~/Projects | grep -c '.'
5032   ← [INFO] lines matched too; a stricter pattern like grep "^/" would silently drop them
```

---

## Experiment 4 — Suppress stderr (`2>/dev/null`)

```bash
$ ./dirlist.sh ~/Projects 2>/dev/null | wc -l
5027 directories   ← no [INFO] clutter, same data
```

Silences the diagnostic voice entirely. Useful in scripts where you want clean output without log noise reaching the terminal.

---

## Experiment 5 — Capture stderr to a file (`2>file`)

```bash
$ ./dirlist.sh ~/Projects 2>dirlist.log | wc -l
5027 directories
```

`dirlist.log` receives:
```
[INFO]  Starting directory scan: /home/user/projects
[INFO]  Timestamp: Sun May  3 14:14:39 EDT 2026
[INFO]  Done. Found 5027 directories, skipped 0.
```

stdout still flows to the pipe unaffected. This is how production programs separate structured output from operational logs.

---

## Experiment 6 — Merge stderr into stdout (`2>&1`)

```bash
$ ./dirlist.sh ~/Projects 2>&1 | wc -l
5030 lines   ← directories + 3 [INFO] lines merged
```

`2>&1` intentionally merges both streams. Use it deliberately (e.g. capturing all output to a single log file) but never by accident — the result is the same broken behaviour as `--wrong-output`.

---

## Experiment 7 — Exit codes

Exit codes tell callers and pipelines whether a program succeeded. This project follows the GNU convention: **`0`** success, **`1`** runtime error (valid invocation but something failed — e.g. path not found), **`2`** usage error (wrong or missing arguments).

### Success — correct invocation

```bash
$ ./dirlist.sh ~/Projects >/dev/null 2>&1; echo $?
0
```

### Usage error — no path argument

```bash
$ ./dirlist.sh
```

The error message goes to **stderr**. Exit **`2`** signals “fix the call,” not “retry with different input.”

### Runtime error — path does not exist

```bash
$ ./dirlist.sh /no/such/path
```

Invocation shape was valid; the path failed. Exit **`1`** — appropriate for missing files, permission denied, or other failures after parsing arguments.

In scripts that compose pipelines, use **`set -o pipefail`** so a nonzero exit from any stage of the pipe is visible in `$?` instead of being masked by the last command.

---

## Files

| File | Purpose |
|---|---|
| `dirlist.sh` | Main script — lists directories recursively |
| `demo.sh` | Runs all 7 experiments side-by-side |

```bash
# Re-run the demo against any path
./demo.sh /some/path
```
