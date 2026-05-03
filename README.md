# stdout-stderr-guide

> **stdout = data. stderr = voice. Exit codes always explicit.**

A hands-on, multi-language guide to stdout and stderr discipline. Run the demos, watch the pipes break, understand why — then carry the rules into every project you write.

---

## The origin: why stderr exists at all

In the early Unix systems, every program wrote everything — output and diagnostics alike — to a single stream: standard output. This worked tolerably when output went to a terminal, but it became a serious problem the moment Unix introduced pipes.

Doug McIlroy invented the Unix pipe. Here is his account of what happened next, from *A Research UNIX Reader: Annotated Excerpts from the Programmer's Manual, 1971–1986*:

> All programs placed diagnostics on the standard output. This had always caused trouble when the output was redirected into a file, but became intolerable when the output was sent to an unsuspecting process. Nevertheless, unwilling to violate the simplicity of the standard-input-standard-output model, people tolerated this state of affairs through v6. Shortly thereafter Dennis Ritchie cut the Gordian knot by introducing the standard error file. That was not quite enough. With pipelines diagnostics could come from any of several programs running simultaneously. **Diagnostics needed to identify themselves.**
>
> — Doug McIlroy

Two separate problems are named here, and both are addressed by this project:

1. **Diagnostics pollute data.** When a program sends log messages and output down the same stream, any downstream consumer — a file, another program, a parser — receives corrupted input. The pipe was the moment this became intolerable, because the receiving program had no way to distinguish signal from noise.

2. **In a pipeline, you cannot tell who is talking.** Multiple programs run simultaneously and write to the same terminal. Without each program identifying itself in its diagnostic messages, a warning or error is unattributable. This is why `ls` says `ls: nothere: No such file or directory` — not just `nothere: No such file or directory`.

These two rules — separate the streams, and identify yourself in diagnostics — are the entire foundation of the Unix I/O model as it is still practiced today.

## Why this still matters

Mixing stdout and stderr is one of the most common and silent bugs in modern scripting. There is no error message when you get it wrong. The program appears to work. But the moment someone pipes your output to `wc -l`, `grep`, `awk`, or any downstream tool, the count is wrong, the filter matches garbage, or the parser chokes — and the cause is invisible because it happened before the pipe.

This project makes that failure concrete and reproducible across three languages.

The stakes are higher when agents are involved. When an AI agent **writes code** that mixes stdout and stderr, the bug is invisible during generation — both streams look identical in the agent's output preview, so nothing looks wrong. The code gets committed, runs in a pipeline, and produces a wrong count or a corrupted parse result with no obvious cause. An agent that has been given explicit stream discipline rules will produce correct code by default, every time, without needing a human to catch the mistake in review.

When an AI agent **executes code** — running shell commands, spawning subprocesses, or orchestrating multi-step pipelines — it typically captures stdout to act on the results. If the program being run mixes diagnostics into stdout, the agent receives polluted input and makes decisions based on it: it may count log lines as data records, parse a warning as a valid result, or miss an error entirely because it arrived on the wrong stream. Agents are also less likely than humans to notice that something is off — a human reading terminal output might notice the `[INFO]` lines; an agent processing captured stdout will treat them as data without question. Correct stream discipline is therefore not just a code quality concern — it is a correctness requirement for any system where agents read and act on program output.

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

**Error messages always go to stderr — no exceptions.** Even a script that writes clean data to stdout will silently corrupt a pipeline if it prints its error message to stdout and exits 0.

**Exit codes are your program's verdict.** `0` means success. Non-zero means failure. Always set them explicitly on error — a program that exits `0` after failing silently corrupts pipelines and automation. See the exit codes section below for which non-zero code to use.

---

## What's inside

Each language gets the same three files in its own directory:

| File | Purpose |
|---|---|
| `dirlist.<ext>` | Recursively lists directories. Correct and `--wrong-output` modes. |
| `demo.<ext>` | Runs 6 experiments that prove the difference with real pipe output. |
| `demo-report.md` | Sidecar report with live results, commands, and explanations. |
| *(7 experiments)* | Experiment 7 covers exit codes. |

```
stdout-stderr-guide/
├── bash/
│   ├── dirlist.sh
│   ├── demo.sh
│   └── demo-report.md
├── python/
│   ├── dirlist.py
│   ├── demo.py
│   └── demo-report.md
├── nodejs/
│   ├── dirlist.js
│   ├── demo.js
│   ├── demo-report.md
│   └── package.json
├── stdout_stderr_discipline.md   ← reusable directives for any project
└── AGENT.md                      ← instructions for AI coding agents
```

---

## Quick start

```bash
# Bash
cd bash
bash demo.sh /some/path

# Python
cd python
python demo.py /some/path

# Node.js
cd nodejs
npm install
node demo.js /some/path
```

Each demo runs 6 experiments against the path you provide and prints the results. You will see the phantom line counts appear live.

---

## The 6 experiments

Every demo — in every language — runs the same sequence:

| # | Experiment | What it shows |
|---|---|---|
| 1 | Raw output, no pipe | Without a pipe, both streams look identical on the terminal |
| 2 | Pipe to `wc -l` | Wrong mode inflates the count with log noise |
| 3 | Pipe to `grep` | Log lines match filters they were never meant to match |
| 4 | Suppress stderr (`2>/dev/null`) | Silence diagnostics without affecting the data stream |
| 5 | Capture stderr to a file (`2>file`) | Separate data from logs at the shell level |
| 6 | Merge stderr into stdout (`2>&1`) | What intentional (or accidental) stream merging looks like |
| 7 | Exit codes | `0` success, `1` runtime error, `2` usage error — live demonstration |

---

## Language-specific insights

### Bash
Diagnostic helpers must write to `>&2`. The easy mistake is writing a helper that calls `echo` without the redirect and never noticing because it looks fine in a terminal.

### Python
`print()` defaults to stdout for everything. Every diagnostic line needs an explicit `file=sys.stderr`. Forget it once — no error, just a wrong count downstream. The `logging` module solves this by owning routing at setup time: one `basicConfig` call, and every `log.info()` / `log.warning()` goes to stderr automatically.

### Node.js
`console.error()` already routes to stderr — the correct behaviour is the default. The mistake is using `console.log()` for everything. `winston` adds transport-based routing, level filtering, and structured JSON on top.

---

## Exit codes

Exit codes are the third leg of the I/O contract, alongside stdout and stderr. A program that exits `0` after printing an error to stderr has still failed — and pipelines, scripts, and agents that check `$?` will be misled.

### The GNU convention

This is what `grep`, `diff`, `ls`, `curl`, and most Unix tools follow — and what this project uses:

| Code | Meaning | When to use |
|---|---|---|
| `0` | Success | Everything worked. Output on stdout is valid. |
| `1` | Runtime error | Invocation was correct but something failed — file not found, permission denied, unexpected input. |
| `2` | Usage error | Wrong or missing arguments, unknown flags. The caller needs to fix the invocation, not the input. |

The `1` vs `2` distinction is what lets automation branch correctly: a `2` means "don't retry, fix the call"; a `1` might mean "log and retry with different input."

### The `sysexits.h` standard

For reference, BSD Unix defines a more granular set of codes in `/usr/include/sysexits.h`, used by some system tools and C programs. They run from `64–78`:

| Code | Name | Meaning |
|---|---|---|
| 64 | `EX_USAGE` | Command line usage error |
| 65 | `EX_DATAERR` | Input data was wrong format |
| 66 | `EX_NOINPUT` | Input file not found or unreadable |
| 70 | `EX_SOFTWARE` | Internal software error |
| 74 | `EX_IOERR` | I/O error |
| 77 | `EX_NOPERM` | Permission denied |
| 78 | `EX_CONFIG` | Configuration error |

These are well-specified but less universally known outside of C/BSD tooling. For most scripts and general-purpose programs, the simpler GNU `0/1/2` convention is the right choice — it is what people expect, what shells interpret, and what CI systems check.

### What to avoid

The shell reserves `126`–`128` for its own use (`126` = not executable, `127` = command not found, `128+N` = terminated by signal N). Scripts should not use these codes themselves to avoid ambiguity.

---

## Using the directives in your own projects

[`stdout_stderr_discipline.md`](stdout_stderr_discipline.md) contains a concise, language-specific rule set you can paste directly into any project's `AGENT.md`, `CLAUDE.md`, `GEMINI.md`, or equivalent agent instruction file. Once added, any AI coding agent working in that project will follow these rules when generating or modifying code.

```
stdout / stderr discipline
  stdout is for data only — anything a pipe or downstream tool will consume
  stderr is for diagnostics — logs, progress, warnings, errors, debug output
  Never mix the two; a wrong count from wc -l is the silent failure mode
  ...
```

If you are setting up a new project and want an AI agent to follow these practices from the start, copy the contents of `stdout_stderr_discipline.md` into your agent instruction file before writing any code.

---

## Redirect cheatsheet

| Stream | Action | Redirect | Effect |
|---|---|---|---|
| stderr | Silence | `2>/dev/null` | Discard all stderr |
| stderr | Save | `2>file.log` | Write stderr to file (overwrite) |
| stderr | Append | `2>>file.log` | Append stderr to file |
| stderr | Merge into stdout | `2>&1` | Route stderr to wherever stdout currently goes |
| stdout | Silence | `1>/dev/null` | Discard all stdout |
| stdout | Save | `1>file` | Write stdout to file (overwrite) |
| stdout | Append | `1>>file` | Append stdout to file |
| stdout | Merge into stderr | `1>&2` | Route stdout to wherever stderr currently goes |
| both | Silence | `>/dev/null 2>&1` | Discard everything |
| both | Save | `>file 2>&1` | Write everything to file |
| both | Pipe | `2>&1 \| cmd` | Send both streams into a pipeline |

### The order-of-evaluation gotcha

Redirections are evaluated left to right, and each one resolves to wherever the target stream points **at that moment** — not at the end. This catches everyone eventually:

```bash
# WRONG — stderr still goes to the terminal
some-cmd 2>&1 >file

# What actually happens, step by step:
#   2>&1   → stderr is pointed at stdout's current destination: the terminal
#   >file  → stdout is now pointed at file
# Result: stdout → file, stderr → terminal  (not what you wanted)


# CORRECT — both streams go to the file
some-cmd >file 2>&1

# What actually happens, step by step:
#   >file  → stdout is pointed at file
#   2>&1   → stderr is pointed at stdout's current destination: file
# Result: stdout → file, stderr → file  ✓
```

The rule: **redirect stdout first, then point stderr at it.** If you write `2>&1` before `>file`, stderr locks on to the terminal before stdout has been moved.
