# Stream discipline

> stdout = data, stderr = voice, exit codes always explicit.

Concise rules you can paste into another repo’s `AGENT.md`, `CLAUDE.md`, `GEMINI.md`, or similar. For the full story and demos, see [guide.md](guide.md).

## Core rules
- stdout is for data only — anything a pipe or downstream tool will consume
- stderr is for diagnostics — logs, progress, warnings, errors, debug output
- Never mix the two; a wrong count from `wc -l` is the silent failure mode

## Bash
- All diagnostic helpers must write to `>&2`
- Never redirect inside emit/output functions — let the caller decide

## Python
- `print()` for data output only
- Diagnostics belong on stderr: either `print(..., file=sys.stderr)` at small scale or the `logging` module with `logging.basicConfig(stream=sys.stderr)` (preferred as complexity grows)
- Never use plain `print()` for diagnostic messages — missing `file=sys.stderr` is silent corruption

## Node.js
- `console.log()` for data output only
- `console.error()` for all diagnostics — it already routes to stderr, use it
- Never use `console.log()` for diagnostic messages
- Production code uses a logger (`winston`/`pino`) with a stderr transport

## General
- **Identify yourself** — every diagnostic line must include the program's own name as a prefix (e.g. `dirlist: warning: permission denied`). In a pipeline, diagnostics from multiple programs share the same terminal simultaneously; without a name prefix you cannot tell which program produced which message. This is why `ls` says `ls: nothere: No such file or directory`, not just `nothere: No such file or directory`.
- **Diagnostics and failures belong on stderr** — including usage text printed because of invalid or missing arguments. The usual exception: when the user explicitly requests **`--help`** or **`--version`**, treat that output as conventional **stdout** with exit `0` (GNU CLI practice); usage emitted for bad invocations stays on stderr with a nonzero exit.

## Exit codes (GNU convention)
Follow the same convention used by `grep`, `diff`, `ls`, and most Unix tools:

| Code | Meaning | When to use |
|---|---|---|
| `0` | Success | Program ran and produced its output correctly |
| `1` | Runtime error | Valid invocation, but something went wrong — file not found, permission denied, unexpected input |
| `2` | Usage error | Wrong or missing arguments, unknown flags — the caller needs to fix the invocation |

**Rules:**
- Always exit non-zero on failure — a program that exits 0 after failing silently corrupts pipelines and automation
- Distinguish `1` from `2` — it tells the caller whether to retry with different input (`1`) or fix the call itself (`2`)
- Never use exit codes `126`–`128`; the shell reserves these for "not executable", "command not found", and signal exits
- In Python, `argparse` exits `2` automatically on bad arguments — no extra code needed
- In bash, capture `${PIPESTATUS[0]}` (not `$?`) to get the exit code of the first command in a pipeline
