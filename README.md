# stdout-stderr-guide

> **stdout = data. stderr = voice. Exit codes always explicit.**

A hands-on, multi-language guide to stdout and stderr discipline. Run the demos, watch the pipes break, understand why — then carry the rules into every project you write.

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

**Documentation (split for easier reading)**

| Document | Contents |
|---|---|
| [docs/guide.md](docs/guide.md) | **Core rules** (POSIX, `--help` nuance, Twelve-Factor contrast), **the seven experiments**, language-specific notes, reusing **[discipline.md](docs/discipline.md)** in other projects |
| [docs/reference.md](docs/reference.md) | **Exit codes** (GNU, `sysexits.h`, reserved codes) and the **redirect cheatsheet** (including `>file 2>&1` order) |
| [docs/bibliography.md](docs/bibliography.md) | **Resources** (manuals, tutorials) and **works cited** (standards, GNU, citations) |
| [docs/discipline.md](docs/discipline.md) | **Copy-paste rules** for stdout/stderr and exit codes (paste into `AGENT.md` / `CLAUDE.md` in other repos) |

Norms and citations are grounded in POSIX, GNU, and the sources listed in the bibliography — not duplicated in this file.

---

## What's inside

Each language directory includes a **`dirlist`**, a **`demo`**, and a **`demo-report.md`**. Node.js also ships **`package.json`** so `winston` installs cleanly.

| File | Purpose |
|---|---|
| `dirlist.<ext>` | Recursively lists directories. Correct and `--wrong-output` modes. |
| `demo.<ext>` | Runs 7 experiments that prove the difference with real pipe output. |
| `demo-report.md` | Sidecar report with commands, explanations, and representative outputs. |
| `package.json` | *(Node.js only)* Manifest and `winston` dependency — run `npm install` before `demo.js`. |
| *(7 experiments)* | Experiment 7 covers exit codes. See [docs/guide.md — The 7 experiments](docs/guide.md#the-7-experiments). |

```
stdout-stderr-guide/
├── docs/
│   ├── guide.md           ← narrative + experiments
│   ├── reference.md       ← exit codes + redirect cheatsheet
│   ├── bibliography.md    ← resources + works cited
│   └── discipline.md      ← copy-paste rules for other projects' agent files
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

Each demo runs 7 experiments against the path you provide and prints the results. You will see the phantom line counts appear live (experiments 1–6) plus exit-code behaviour (experiment 7). What each experiment does is described in [docs/guide.md](docs/guide.md#the-7-experiments).

Shell redirects and exit-code tables live in [docs/reference.md](docs/reference.md).
