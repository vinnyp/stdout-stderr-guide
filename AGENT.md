# stdout-stderr-guide — Project Instructions

## Purpose
Educational scripts demonstrating stdout vs stderr across bash, Python, and Node.js.
Every addition must serve a learning objective. No feature for its own sake.

## Structure
Each language lives in its own subdirectory with exactly three files:

  bash/
    dirlist.sh       — the subject program (recursive directory lister)
    demo.sh          — runs experiments and prints results
    demo-report.md   — sidecar report with live results and explanations

  python/
    dirlist.py
    demo.py
    demo-report.md

  nodejs/
    dirlist.js
    demo.js
    demo-report.md
    package.json

## The invariants every implementation must preserve
- Data (directory paths) → stdout only
- Diagnostics (INFO, WARN, ERROR) → stderr only
- Every diagnostic line includes the program name as a prefix (e.g. `dirlist.sh: warning: ...`)
- Exit codes follow the GNU convention: 0 = success, 1 = runtime error, 2 = usage error
- Usage errors (bad/missing arguments) exit 2; runtime errors exit 1; never conflate them
- --wrong-output flag exists and routes everything to stdout
- --use-logging (Python/Node) or equivalent flag demonstrates the library approach
- The simulated "private" permission-denied case triggers a WARN
- Experiments are numbered 1–7 and cover the same scenarios across all languages

## Language-specific rules

**Bash**
- log_info / log_warn / log_error helpers always write to >&2
- emit() writes to stdout with no redirection — never redirect inside emit()

**Python**
- print() for data output only — never for diagnostics
- Diagnostics use print(..., file=sys.stderr) in the print-mode implementation
- logging.basicConfig(stream=sys.stderr) — always explicit even though it's the default
- Wrong mode uses plain print() with no file= argument — that IS the mistake, document it

**Node.js**
- console.log() for data output only — never for diagnostics
- console.error() for diagnostics in the console-mode implementation
- winston transport must point to process.stderr explicitly
- Wrong mode uses console.log() for everything — that IS the mistake, document it

## Demo scripts
- Experiments must run the subject program as a subprocess, not inline
- stderr is suppressed (devnull) when isolating stdout output for display
- All six experiments must produce real numbers from the actual filesystem scan
- Never hardcode counts — always derive them from subprocess output

## Reports
- Generated after running the demo against ~/Projects
- Results (directory counts) must reflect the actual run, not placeholders
- Each report includes: core rule, per-experiment command + output + explanation,
  language-specific insight section, summary box, redirect cheatsheet, file index
- The language-specific insight section is mandatory — it is the reason the report exists

## Cross-language consistency
When adding a new language, verify:
- Same 6 experiments in the same order
- Same --wrong-output flag name
- Same simulated "private" directory warning
- Report follows the same section structure as bash/demo-report.md and python/demo-report.md
- Phantom line count difference (wrong vs correct) is called out explicitly
