# Guide: why stdout and stderr matter

**Historical context** (McIlroy, why stderr exists, pipelines, and agents) lives in the [README](../README.md) so the GitHub landing page stays self-contained. This guide continues with the **technical narrative**: core rules, experiments, language-specific notes, and how to reuse [discipline.md](discipline.md) elsewhere.

For **exit-code tables**, **shell redirects**, and a **cheatsheet**, see [reference.md](reference.md). For **citations** and **extra reading**, see [bibliography.md](bibliography.md). The [README](../README.md) also has **quick start**, repository layout, and links to all docs.

---

## The core rules

```
stdout (fd 1)  =  DATA your program produces
                  → consumed by pipes, redirects, downstream tools

stderr (fd 2)  =  Your program's VOICE
                  → logs, progress, warnings, errors
                  → flows straight to the terminal, bypasses pipes
```

**`stderr` does not mean invisible.** Without a redirect, both streams appear on your terminal and look identical. The difference only surfaces when you pipe — which is exactly when it matters.

[**POSIX**](https://pubs.opengroup.org/onlinepubs/9699919799/functions/stderr.html) defines **standard error** as the stream **for writing diagnostic output** (alongside **standard input** for conventional input and **standard output** for conventional output). That separation is exactly what keeps pipelines machine-readable: diagnostics do not belong in the primary result stream sent to a pipe or file.

**Diagnostics and failures belong on stderr** — errors, warnings, progress that is not part of the primary payload, and usage text printed because the user invoked the program incorrectly. Even a script that writes clean data to stdout will corrupt a pipeline if it prints failures on stdout and exits `0`.

**Exception developers routinely rely on:** informational output that *is* the requested result of the invocation — notably **`--help`** and **`--version`** when the user asks for them explicitly — is widely treated as **conventional output on stdout** with exit code `0`, consistent with GNU CLI expectations and common practice; by contrast, usage summaries emitted because of **invalid or missing arguments** are diagnostics and belong on **stderr** with a nonzero exit (see GNU *Coding Standards* on command-line interfaces and error formatting; Stack Overflow discussion of stdout/stderr conventions — [bibliography.md](bibliography.md#community-qa-illustrative-practice-not-normative-standards)).[^node-help]

[^node-help]: The sample **`dirlist.js`** in this repo uses minimal manual argument parsing and does **not** implement optional **`--help` / `--version`** handling on stdout. That keeps the script small; production CLIs should follow the GNU pattern above.

**Exit codes are your program's verdict.** `0` means success. Non-zero means failure. Always set them explicitly on error — a program that exits `0` after failing silently corrupts pipelines and automation. Which codes to use is spelled out in [reference.md — Exit codes](reference.md#exit-codes).

### How this relates to logs as streams (Twelve-Factor App)

The [Twelve-Factor App **logs** factor](https://12factor.net/logs) describes processes emitting **logs as a single stream** for the execution environment to route — a pattern tuned to **long-running services** in containers and platforms. **Unix CLI tools** still normally keep **primary, pipeable output** on stdout and **human-directed diagnostics** on stderr so downstream commands are not polluted. This repository’s demos follow that **CLI / pipeline** model; service-wide log aggregation is a different layer (often consuming whatever stream or socket the platform attaches). See also the Twelve-Factor entry in [bibliography.md](bibliography.md#essays-methodology-and-historical-discussion).

### Brief pointers to broader practice

- **Google Shell Style Guide:** route errors to stderr so normal output stays separable (for example via a small `err()` helper that redirects to fd 2).
- **Greg’s Wiki (BashFAQ/002):** Bash redirection semantics and capturing command output — relevant to getting redirects right (including the order-of-evaluation note in [reference.md](reference.md#the-order-of-evaluation-gotcha)).
- **Community Q&A:** Unix & Linux Stack Exchange threads on when stderr is appropriate and on placing progress or status output so it does not corrupt redirected primary output (listed under [Works cited](bibliography.md#works-cited)).

---

## The 7 experiments

**Shared across Bash, Python, and Node:** experiments **1**, **2**, and **4–7** use the same scenario in each language (raw output, `wc -l`, suppress/capture/merge stderr, exit codes).

**Experiment 3 is stack-specific** (same slot, same goal — show how polluted stdout breaks tooling — but different mechanism):

| Language | Experiment 3 |
|---|---|
| **Bash** | Pipe to **`grep`** — log lines match patterns meant for paths |
| **Python** | **`logging` vs `print`** — routing and ergonomics |
| **Node.js** | **`console.error` / winston vs `console.log`** — built-in stderr routing |

| # | Experiment | What it shows |
|---|---|---|
| 1 | Raw output, no pipe | Without a pipe, both streams look identical on the terminal |
| 2 | Pipe to `wc -l` | Wrong mode inflates the count with log noise |
| 3 | *(see table above)* | Bash: `grep`; Python/Node: native vs library diagnostics |
| 4 | Suppress stderr (`2>/dev/null`) | Silence diagnostics without affecting the data stream |
| 5 | Capture stderr to a file (`2>file`) | Separate data from logs at the shell level |
| 6 | Merge stderr into stdout (`2>&1`) | What intentional (or accidental) stream merging looks like |
| 7 | Exit codes | `0` success, `1` runtime error, `2` usage error — live demonstration |

### Phantom line counts differ by implementation

The gap between **wrong mode** and **correct mode** line counts is **not** the same integer in every language: each `dirlist` emits a different number of diagnostic lines (and Bash includes an extra simulated WARN). What matters is that wrong mode adds **phantom** lines to the pipe — not matching the exact delta across stacks.

---

## Language-specific insights

### Bash

Diagnostic helpers must write to `>&2`. The easy mistake is writing a helper that calls `echo` without the redirect and never noticing because it looks fine in a terminal.

### Python

`print()` defaults to stdout for everything. Every diagnostic line needs an explicit `file=sys.stderr`. Forget it once — no error, just a wrong count downstream. The `logging` module solves this by owning routing at setup time: one `basicConfig` call, and every `log.info()` / `log.warning()` goes to stderr automatically.

### Node.js

`console.error()` already routes to stderr — the correct behaviour is the default. The mistake is using `console.log()` for everything. `winston` adds transport-based routing, level filtering, and structured JSON on top.

---

## Using the directives in your own projects

[`discipline.md`](discipline.md) contains a concise, language-specific rule set you can paste directly into any project's `AGENT.md`, `CLAUDE.md`, `GEMINI.md`, or equivalent agent instruction file. Once added, any AI coding agent working in that project will follow these rules when generating or modifying code.

```
stdout / stderr discipline
  stdout is for data only — anything a pipe or downstream tool will consume
  stderr is for diagnostics — logs, progress, warnings, errors, debug output
  Never mix the two; a wrong count from wc -l is the silent failure mode
  ...
```

If you are setting up a new project and want an AI agent to follow these practices from the start, copy the contents of `discipline.md` into your agent instruction file before writing any code.
