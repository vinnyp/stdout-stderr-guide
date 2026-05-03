# stdout-stderr-guide

> **stdout = data. stderr = voice. Exit codes always explicit.**

A hands-on, multi-language guide to stdout and stderr discipline. Run the demos, watch the pipes break, understand why — then carry the rules into every project you write.

Primary references for the norms discussed here — POSIX stream semantics, GNU and Google CLI guidance, and selected practice articles — are collected in [**Works cited**](#works-cited). [**Resources**](#resources) lists extra manuals and tutorials (shell redirection, buffering, Python `logging`, Node streams) that complement the demos but are not required reading.

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

[**POSIX**](https://pubs.opengroup.org/onlinepubs/9699919799/functions/stderr.html) defines **standard error** as the stream **for writing diagnostic output** (alongside **standard input** for conventional input and **standard output** for conventional output). That separation is exactly what keeps pipelines machine-readable: diagnostics do not belong in the primary result stream sent to a pipe or file.

**Diagnostics and failures belong on stderr** — errors, warnings, progress that is not part of the primary payload, and usage text printed because the user invoked the program incorrectly. Even a script that writes clean data to stdout will corrupt a pipeline if it prints failures on stdout and exits `0`.

**Exception developers routinely rely on:** informational output that *is* the requested result of the invocation — notably **`--help`** and **`--version`** when the user asks for them explicitly — is widely treated as **conventional output on stdout** with exit code `0`, consistent with GNU CLI expectations and common practice; by contrast, usage summaries emitted because of **invalid or missing arguments** are diagnostics and belong on **stderr** with a nonzero exit (see GNU *Coding Standards* on command-line interfaces and error formatting; Stack Overflow discussion of stdout/stderr conventions).[^node-help]

[^node-help]: The sample **`dirlist.js`** in this repo uses minimal manual argument parsing and does **not** implement optional **`--help` / `--version`** handling on stdout. That keeps the script small; production CLIs should follow the GNU pattern above.

**Exit codes are your program's verdict.** `0` means success. Non-zero means failure. Always set them explicitly on error — a program that exits `0` after failing silently corrupts pipelines and automation. See the exit codes section below for which non-zero code to use.

### How this relates to “logs as streams” (Twelve-Factor App)

The [Twelve-Factor App **logs** factor](https://12factor.net/logs) describes processes emitting **logs as a single stream** for the execution environment to route — a pattern tuned to **long-running services** in containers and platforms. **Unix CLI tools** still normally keep **primary, pipeable output** on stdout and **human-directed diagnostics** on stderr so downstream commands are not polluted. This repository’s demos follow that **CLI / pipeline** model; service-wide log aggregation is a different layer (often consuming whatever stream or socket the platform attaches).

### Brief pointers to broader practice

- **Google Shell Style Guide:** route errors to stderr so normal output stays separable (for example via a small `err()` helper that redirects to fd 2).
- **Greg’s Wiki (BashFAQ/002):** Bash redirection semantics and capturing command output — relevant to getting redirects right (including the order-of-evaluation note in the cheatsheet below).
- **Community Q&A:** Unix & Linux Stack Exchange threads on when stderr is appropriate and on placing progress or status output so it does not corrupt redirected primary output (see works cited).

---

## What's inside

Each language directory includes a **`dirlist`**, a **`demo`**, and a **`demo-report.md`**. Node.js also ships **`package.json`** so `winston` installs cleanly.

| File | Purpose |
|---|---|
| `dirlist.<ext>` | Recursively lists directories. Correct and `--wrong-output` modes. |
| `demo.<ext>` | Runs 7 experiments that prove the difference with real pipe output. |
| `demo-report.md` | Sidecar report with commands, explanations, and representative outputs. |
| `package.json` | *(Node.js only)* Manifest and `winston` dependency — run `npm install` before `demo.js`. |
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

Each demo runs 7 experiments against the path you provide and prints the results. You will see the phantom line counts appear live (experiments 1–6) plus exit-code behaviour (experiment 7).

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

## Exit codes

Exit codes are the third leg of the I/O contract, alongside stdout and stderr. A program that exits `0` after printing an error to stderr has still failed — and pipelines, scripts, and agents that check `$?` will be misled.

### The GNU convention

This is what `grep`, `diff`, `ls`, `curl`, and many Unix tools follow — and what this project uses. It aligns with the broader idea that callers can branch on exit status while treating stdout as the successful **data** channel when status is zero:

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

---

## Resources

These links go deeper than this README: official manuals, language docs, and articles that explain *mechanisms* (how Bash applies redirections, how libc buffers streams, how to configure Python or Node). Use them when you are implementing or debugging real programs — not as competing “style guides.” Items already listed in [Works cited](#works-cited) are summarized here only when they serve a different purpose (e.g. BashFAQ as tutorial vs citation).

### Shell and POSIX utilities

- **[GNU Bash Manual — Redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html)** — Authoritative description of how Bash parses `>`, `>>`, `2>`, `2>&1`, here-documents, and moving file descriptors. Read this when the cheatsheet above is not enough or when behaviour differs between interactive shells and scripts.

- **[Greg’s Wiki — BashFAQ/002](https://mywiki.wooledge.org/BashFAQ/002)** — Practical patterns: capturing stdout in a variable, avoiding subshell pitfalls, and understanding why naive redirects fail. Essential when wiring demos into larger Bash automation.

- **[The Open Group — `cat` utility](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/cat.html)** — POSIX text for a utility whose **standard output** is “conventional output.” Useful background for what “primary output of the command” means in formal specs (compare with stderr for diagnostics on the [stderr](https://pubs.opengroup.org/onlinepubs/9699919799/functions/stderr.html) page).

### Streams, buffering, and behaviour

- **[Why stdout is faster than stderr? (Orhun)](https://blog.orhun.dev/stdout-vs-stderr/)** — Short article on buffering defaults and write paths in typical libc setups. Helps explain intermittent “delayed” stdout lines when piping or redirecting to files, and why stderr often feels more “immediate” on a terminal.

### Python

- **[Python — Logging HOWTO](https://docs.python.org/3/howto/logging.html)** — How to route `logging` to stderr, set levels and handlers, and avoid spraying diagnostics on stdout by accident. Pairs directly with the Python demo’s `--use-logging` mode.

### Node.js

- **[Node.js — `process.stdout` / `process.stderr`](https://nodejs.org/api/process.html#processstdout)** — Official API reference for the streams behind `console.log` / `console.error`. Use when tuning encoding, buffering, or attaching transports (e.g. Winston) without guessing behaviour.

### Teaching-oriented redirection primer

- **[Seneca Polytechnic — Redirections and read/write to files](https://pressbooks.senecapolytechnic.ca/uli101/chapter/week-5-redirections-and-read-read-to-files/)** — Introductory chapter with exercises and diagrams. Good if you are onboarding someone who has never seen `2>` or `2>&1` and needs a slower walkthrough than this repo’s experiment ladder.

---

## Works cited

References are listed for attribution and further reading. URLs were verified as of the documentation update; if a link moves, search by title and publisher.

### Standards and canonical specifications

- **IEEE / The Open Group.** *The Open Group Base Specifications Issue 7, 2018 edition* (IEEE Std 1003.1-2017). Defines the standard streams: stdin for conventional input, stdout for conventional output, stderr for diagnostic output (including buffering expectations). Stream definitions: [stdin, stdout, stderr](https://pubs.opengroup.org/onlinepubs/9699919799/functions/stderr.html).

### GNU Project

- **GNU Project.** *GNU Coding Standards.* Section “Standards for Command Line Interfaces” (programs should support `--help` and `--version`; CLI consistency). [Command-Line Interfaces](https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces.html).
- **GNU Project.** *GNU Coding Standards.* Section “Formatting Error Messages” (noninteractive error message shape; usage messages capitalized, etc.). [Errors](https://www.gnu.org/prep/standards/html_node/Errors.html).

### Shell and tooling style guides

- **Google.** *Google Shell Style Guide.* Error reporting and separation from normal output (stderr). [Shell Style Guide](https://google.github.io/styleguide/shellguide.html).
- **GreyCat et al.** *Greg’s Wiki — BashFAQ/002: How can I redirect the output of a command to a variable?* Bash redirection and subshell behaviour (widely used reference for shell I/O). [BashFAQ/002](https://mywiki.wooledge.org/BashFAQ/002).

### Essays, methodology, and historical discussion

- **McIlroy, Doug.** Introduction and commentary in *A Research UNIX Reader: Annotated Excerpts from the Programmer’s Manual, 1971–1986* (Bell Laboratories). Primary-source discussion of diagnostics on standard output before stderr, pipes, and the introduction of standard error; quotation in this README is taken from McIlroy’s introduction.

- **Twelve-Factor App.** *Logs* — treat logs as event streams; export to stdout (and let the environment route). [12factor.net/logs](https://12factor.net/logs). *(Contrast with CLI pipeline discipline in the section “How this relates to logs as streams” above.)*

### Community Q&A (illustrative practice, not normative standards)

- **Kusalananda et al.** “When to use standard error stream in command-line application?” *Unix & Linux Stack Exchange*, 12 Jan. 2017. [Discussion](https://unix.stackexchange.com/questions/336983/when-to-use-standard-error-stream-in-command-line-application).

- **Szonye et al.** “Do progress reports / logging information belong on stderr or stdout?” *Unix & Linux Stack Exchange*, 21 Dec. 2016. [Discussion](https://unix.stackexchange.com/questions/331611/do-progress-reports-logging-information-belong-on-stderr-or-stdout).

- **Various authors.** “What are the conventions for stdout/stderr messages?” *Stack Overflow*, Feb. 2010. [Discussion](https://stackoverflow.com/questions/7977852/what-are-the-conventions-for-stdout-stderr-messages) (includes `--help` / usage stream conventions often cited alongside GNU practice).

- **jk., Stephen Kitt et al.** “What was the point of separating stdout and stderr?” *Retrocomputing Stack Exchange*, 28 Jun. 2019. Historical context for distinct streams. [Discussion](https://retrocomputing.stackexchange.com/questions/11499/what-was-the-point-of-separating-stdout-and-stderr).
