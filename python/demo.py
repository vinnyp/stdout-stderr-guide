#!/usr/bin/env python3
"""
demo.py — Side-by-side demonstration of stdout vs stderr in Python.

Aligns with demo.sh for experiments 1–2 and 4–7; experiment 3 is the Python lesson
(logging vs print) instead of Bash's grep pipe — see docs/guide.md § The 7 experiments.
Also covers:
  - print() with and without file=sys.stderr
  - logging module (stderr by default)
  - --wrong-output showing pollution in all modes

Usage:
    python demo.py [path]      (defaults to /tmp)
"""

import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).parent / "dirlist.py"
PATH_ARG = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
PY = sys.executable   # use whatever python is running this demo


# ── display helpers ───────────────────────────────────────────────────────────

def hr():
    print("\n" + "─" * 70)

def header(title: str):
    hr()
    print(f"\n  {title}\n")

def cmd(command: str):
    print(f"  \033[1;36m$\033[0m {command}")

def note(text: str):
    print(f"  \033[33m↳ {text}\033[0m")

def result(text: str):
    print(f"  \033[32mResult:\033[0m {text}")

def run(args: list[str], *, merge_stderr: bool = False) -> str:
    """Run a command and return its stdout (optionally with stderr merged in)."""
    stderr = subprocess.STDOUT if merge_stderr else subprocess.DEVNULL
    out = subprocess.run(args, capture_output=False,
                         stdout=subprocess.PIPE, stderr=stderr)
    return out.stdout.decode()

def run_with_ec(args: list[str]) -> tuple[str, str, int]:
    """Run a command and return (stdout, stderr, exit_code)."""
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return r.stdout, r.stderr, r.returncode

def count_lines(text: str) -> int:
    return len([l for l in text.splitlines() if l.strip()])

def first_lines(text: str, n: int = 4) -> str:
    lines = text.splitlines()[:n]
    return "\n".join(f"    {l}" for l in lines)


# ── experiments ───────────────────────────────────────────────────────────────

header("EXPERIMENT 1 — Raw output, no pipe")

print()
print("  CORRECT (print mode) — stdout only, what a pipe would receive:")
cmd(f"python dirlist.py {PATH_ARG} 2>/dev/null")
note("print() goes to stdout. print(..., file=sys.stderr) goes to stderr.")
note("Suppressing stderr isolates the clean data stream.")
out = run([PY, str(SCRIPT), PATH_ARG])
print(first_lines(out))
print("    ...")

print()
print("  CORRECT (print mode) — full terminal view (both streams):")
note("Without a redirect, your terminal receives both fd 1 and fd 2.")
note("stderr ([INFO] lines) still appears on screen — it just bypasses pipes.")
out_merged = run([PY, str(SCRIPT), PATH_ARG], merge_stderr=True)
print(first_lines(out_merged, 6))
print("    ...")

print()
print("  CORRECT (logging mode) — stdout only:")
cmd(f"python dirlist.py --use-logging {PATH_ARG} 2>/dev/null")
note("logging.info() and logging.warning() go to stderr automatically.")
note("No file= argument needed — the logging handler owns that routing.")
out_log = run([PY, str(SCRIPT), "--use-logging", PATH_ARG])
print(first_lines(out_log))
print("    ...")

print()
print("  WRONG MODE — stdout only:")
cmd(f"python dirlist.py --wrong-output {PATH_ARG} 2>/dev/null")
note("[INFO] lines written via plain print() land on stdout — pipe consumers see them.")
out_wrong = run([PY, str(SCRIPT), "--wrong-output", PATH_ARG])
print(first_lines(out_wrong, 6))
print("    ...")


header("EXPERIMENT 2 — Pipe to wc -l (count lines)")

print()
print("  CORRECT (print mode):")
cmd(f"python dirlist.py {PATH_ARG} | wc -l")
note("[INFO] lines go to stderr — wc -l never sees them.")
correct_count = count_lines(run([PY, str(SCRIPT), PATH_ARG]))
result(f"{correct_count} directories")

print()
print("  CORRECT (logging mode):")
cmd(f"python dirlist.py --use-logging {PATH_ARG} | wc -l")
note("Same result — logging routes diagnostics to stderr regardless of format.")
log_count = count_lines(run([PY, str(SCRIPT), "--use-logging", PATH_ARG]))
result(f"{log_count} directories")

print()
print("  WRONG MODE:")
cmd(f"python dirlist.py --wrong-output {PATH_ARG} | wc -l")
note("Every [INFO] line is counted. Count is inflated.")
wrong_count = count_lines(run([PY, str(SCRIPT), "--wrong-output", PATH_ARG]))
result(f"{wrong_count} lines  ← includes log lines")

print()
phantom = wrong_count - correct_count
print(f"  \033[31mDifference: {phantom} phantom lines from log noise\033[0m")


header("EXPERIMENT 3 — logging vs print: the key difference")

print()
note("print() is a presentation tool. It has no concept of severity or routing.")
note("You must manually pass file=sys.stderr for every diagnostic line.")
note("logging knows what it is: it routes, filters, and formats automatically.")
print()
print("  Correct print approach:")
print("""
    import sys

    print(data)                         # data  → stdout  ✓
    print(f"[INFO] ...", file=sys.stderr)  # diag  → stderr  ✓
    print(f"[WARN] ...", file=sys.stderr)  # warn  → stderr  ✓
""")
print("  Wrong print approach (easy mistake):")
print("""
    print(data)                         # data  → stdout  ✓
    print(f"[INFO] ...")                # diag  → stdout  ✗  (missing file=)
    print(f"[WARN] ...")                # warn  → stdout  ✗  (missing file=)
""")
print("  Logging approach (preferred):")
print("""
    import logging, sys

    logging.basicConfig(stream=sys.stderr, ...)  # one-time setup, stderr is default
    log = logging.getLogger(__name__)

    print(data)          # data  → stdout  ✓
    log.info("...")      # diag  → stderr  ✓  (automatic, no file= needed)
    log.warning("...")   # warn  → stderr  ✓  (automatic, no file= needed)
    log.error("...")     # error → stderr  ✓  (you also get level filtering for free)
""")
note("With logging you get level filtering, structured formatting, and correct")
note("routing for free. print(file=sys.stderr) works but is error-prone at scale.")


header("EXPERIMENT 4 — Suppress stderr (2>/dev/null)")

print()
cmd(f"python dirlist.py {PATH_ARG} 2>/dev/null | wc -l")
note("Silences all diagnostic output. Data stream is unaffected.")
note("Works identically for both the print and logging modes.")
silent_count = count_lines(run([PY, str(SCRIPT), PATH_ARG]))
result(f"{silent_count} directories  (no [INFO] clutter)")


header("EXPERIMENT 5 — Capture stderr to a file (2>file)")

import tempfile, os
with tempfile.NamedTemporaryFile(mode='w', suffix='.log', delete=False) as f:
    logfile = f.name

print()
cmd(f"python dirlist.py --use-logging {PATH_ARG} 2>{logfile} | wc -l")
note("stderr goes to a log file. stdout still flows to the pipe unaffected.")
note("logging makes this especially clean — swap the handler and nothing else changes.")
proc = subprocess.run(
    [PY, str(SCRIPT), "--use-logging", PATH_ARG],
    stdout=subprocess.PIPE,
    stderr=open(logfile, "w"),
)
file_count = count_lines(proc.stdout.decode())
result(f"{file_count} directories")
print()
print(f"  Log file ({logfile}):")
with open(logfile) as f:
    for line in f:
        print(f"    {line}", end="")
os.unlink(logfile)


header("EXPERIMENT 6 — Merge stderr into stdout (2>&1)")

print()
cmd(f"python dirlist.py {PATH_ARG} 2>&1 | wc -l")
note("2>&1 merges stderr into stdout. wc -l now counts everything.")
note("Same result as --wrong-output. Use intentionally, never accidentally.")
merged_count = count_lines(run([PY, str(SCRIPT), PATH_ARG], merge_stderr=True))
result(f"{merged_count} lines  (directories + log lines merged)")


header("EXPERIMENT 7 — Exit codes")

print()
note("Exit codes let callers and pipelines know whether a program succeeded.")
note("GNU convention: 0 = success  |  1 = runtime error  |  2 = usage error")
note("argparse exits with 2 automatically on bad arguments — no extra code needed.")
print()

print("  SUCCESS — correct invocation:")
cmd(f"python dirlist.py {PATH_ARG} >/dev/null 2>&1; echo $?")
_, _, ec = run_with_ec([PY, str(SCRIPT), PATH_ARG])
result(f"exit {ec}  — success")

print()
print("  USAGE ERROR (exit 2) — no path argument:")
cmd("python dirlist.py")
note("argparse prints its own error to stderr and exits 2 automatically.")
_, err, ec = run_with_ec([PY, str(SCRIPT)])
for line in err.strip().splitlines():
    print(f"    {line}")
result(f"exit {ec}  — usage error (fix the call)")

print()
print("  RUNTIME ERROR (exit 1) — path does not exist:")
cmd("python dirlist.py /no/such/path")
note("Valid invocation, bad input. sys.exit(EXIT_ERR) exits 1.")
_, err, ec = run_with_ec([PY, str(SCRIPT), "/no/such/path"])
for line in err.strip().splitlines():
    print(f"    {line}")
result(f"exit {ec}  — runtime error (fix the input)")

print()
note("Callers branch on exit code: 0=proceed, 1=retry or log, 2=fix the invocation.")


header("SUMMARY")

print("""
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Python stdout/stderr routing                                        │
  │                                                                       │
  │  print(data)                    → stdout  ✓  data                   │
  │  print(msg, file=sys.stderr)    → stderr  ✓  diagnostic (print)     │
  │  log.info/warning/error(msg)    → stderr  ✓  diagnostic (logging)   │
  │                                                                       │
  │  print(msg)          [no file=] → stdout  ✗  wrong — pollutes pipes │
  ├─────────────────────────────────────────────────────────────────────┤
  │  Exit codes (GNU convention)                                         │
  │    0   success                                                        │
  │    1   runtime error (file not found, bad input, etc.)               │
  │    2   usage error  (wrong/missing arguments)                        │
  │        argparse exits 2 automatically — no extra code needed         │
  ├─────────────────────────────────────────────────────────────────────┤
  │  Why prefer logging over print(file=sys.stderr)?                     │
  │                                                                       │
  │  • One setup call; all log.* calls route correctly automatically     │
  │  • Level filtering: silence DEBUG in prod, verbose in dev            │
  │  • Swap handlers to write logs to a file, syslog, or a cloud sink   │
  │    without touching application code                                  │
  │  • print(file=sys.stderr) works but you must remember it every time  │
  └─────────────────────────────────────────────────────────────────────┘
""")
hr()
