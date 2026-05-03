#!/usr/bin/env bash
#
# demo.sh — Side-by-side demonstration of stdout vs stderr behavior.
#
# Run this script to see every experiment at once:
#   ./demo.sh [path]          (defaults to /tmp if no path given)
#
# Experiment 3 is "pipe to grep". Python/Node use the same slot for a language-specific
# lesson — see docs/guide.md § The 7 experiments.

set -uo pipefail
# Note: -e (errexit) is intentionally omitted in the demo script because head -6
# closes the pipe early and triggers SIGPIPE (exit 141). That's expected behavior
# for a demo — not a script error. Production scripts should handle this explicitly.

SCRIPT="$(dirname "$0")/dirlist.sh"
PATH_ARG="${1:-/tmp}"

# Make dirlist.sh executable if it isn't already
chmod +x "$SCRIPT"

# ─── pretty printer ────────────────────────────────────────────────────────────

hr()      { printf '\n%s\n' "$(printf '─%.0s' {1..70})"; }
header()  { hr; printf '\n  %s\n\n' "$*"; }
cmd()     { printf '  \033[1;36m$\033[0m %s\n' "$*"; }
note()    { printf '  \033[33m↳ %s\033[0m\n' "$*"; }
result()  { printf '  \033[32mResult:\033[0m %s\n' "$*"; }

# ─── experiments ──────────────────────────────────────────────────────────────

header "EXPERIMENT 1 — Raw output, no pipe"
echo
printf "  CORRECT MODE (stdout only — what a pipe would receive):\n"
cmd "./dirlist.sh $PATH_ARG 2>/dev/null"
note "stderr is redirected to /dev/null so you can see what stdout alone contains."
note "Only directory paths. No [INFO] lines. This is the clean data stream."
echo
"$SCRIPT" "$PATH_ARG" 2>/dev/null | head -4
echo "  ..."
echo
printf "  CORRECT MODE (what you actually see in a real terminal — both streams):\n"
note "Without a redirect, your terminal receives BOTH stdout and stderr."
note "stderr ([INFO] lines) still appears — it just travels on fd 2, not fd 1."
note "stderr ≠ invisible. It means 'bypasses pipes', not 'suppressed'."
echo
"$SCRIPT" "$PATH_ARG" 2>&1 | head -6
echo "  ..."
echo
printf "  WRONG MODE (stdout only — what a pipe would receive):\n"
cmd "./dirlist.sh --wrong-output $PATH_ARG 2>/dev/null"
note "[INFO] lines are on stdout in wrong mode, so they appear here too."
note "A pipe consumer like wc -l or grep will receive this polluted stream."
echo
"$SCRIPT" --wrong-output "$PATH_ARG" 2>/dev/null | head -6
echo "  ..."
echo
note "The problem only surfaces when you pipe — see Experiment 2."


header "EXPERIMENT 2 — Pipe to wc -l (count lines)"
echo
printf "  CORRECT: only directory paths reach wc -l\n"
cmd "./dirlist.sh $PATH_ARG | wc -l"
note "[INFO] and [WARN] lines go to your terminal via stderr — wc never sees them."
correct_count=$("$SCRIPT" "$PATH_ARG" 2>/dev/null | wc -l | tr -d ' ')
result "$correct_count directories"
echo

printf "  WRONG: [INFO] lines pollute the count\n"
cmd "./dirlist.sh --wrong-output $PATH_ARG | wc -l"
note "Every [INFO] and [WARN] line is counted as a directory. Count is inflated."
wrong_count=$("$SCRIPT" --wrong-output "$PATH_ARG" 2>/dev/null | wc -l | tr -d ' ')
result "$wrong_count lines  ← includes log lines, not just directories"
echo
printf "  \033[31mDifference: %d phantom lines from log noise\033[0m\n" \
    $(( wrong_count - correct_count ))


header "EXPERIMENT 3 — Pipe to grep (filter paths)"
echo
printf "  CORRECT: grep only sees clean data\n"
cmd "./dirlist.sh $PATH_ARG | grep -c '.'"
note "grep receives only directory paths. Every match is a real directory."
correct_grep=$("$SCRIPT" "$PATH_ARG" 2>/dev/null | grep -c '.' || true)
result "$correct_grep matches (all real directories)"
echo

printf "  WRONG: grep also matches [INFO] lines\n"
cmd "./dirlist.sh --wrong-output $PATH_ARG | grep -c '.'"
note "grep matches [INFO] lines too. Your 'grep lib' or 'grep ^/' behaves unexpectedly."
wrong_grep=$("$SCRIPT" --wrong-output "$PATH_ARG" 2>/dev/null | grep -c '.' || true)
result "$wrong_grep matches (inflated — log lines matched)"


header "EXPERIMENT 4 — Suppress stderr entirely (silence the voice)"
echo
cmd "./dirlist.sh $PATH_ARG 2>/dev/null | wc -l"
note "2>/dev/null redirects stderr to /dev/null — you silence the diagnostic voice."
note "stdout (the data) is unaffected. Useful in scripts where you don't want log noise."
silent_count=$("$SCRIPT" "$PATH_ARG" 2>/dev/null | wc -l | tr -d ' ')
result "$silent_count directories  (no [INFO] clutter, same data)"


header "EXPERIMENT 5 — Capture stderr separately (log to file)"
echo
LOGFILE="/tmp/dirlist_stderr_$$.log"
cmd "./dirlist.sh $PATH_ARG 2>$LOGFILE | wc -l"
note "2>file redirects stderr to a log file. stdout still flows to the pipe."
note "This is how real programs separate structured output from operational logs."
"$SCRIPT" "$PATH_ARG" 2>"$LOGFILE" | wc -l | tr -d ' ' | xargs -I{} echo "  Result: {} directories"
echo
printf "  Log file contents (%s):\n" "$LOGFILE"
cat "$LOGFILE" | sed 's/^/    /'
rm -f "$LOGFILE"


header "EXPERIMENT 6 — Merge stderr INTO stdout (2>&1)"
echo
cmd "./dirlist.sh $PATH_ARG 2>&1 | wc -l"
note "2>&1 merges stderr INTO stdout. Now wc -l sees everything — same as wrong mode."
note "Use this intentionally (e.g. capturing all output to a log) but never accidentally."
merged_count=$("$SCRIPT" "$PATH_ARG" 2>&1 | wc -l | tr -d ' ')
result "$merged_count lines  (directories + log lines merged)"


header "EXPERIMENT 7 — Exit codes"
echo
note "Exit codes let callers and pipelines know whether a program succeeded."
note "GNU convention: 0 = success  |  1 = runtime error  |  2 = usage error"
echo

printf "  SUCCESS — correct invocation:\n"
cmd "./dirlist.sh $PATH_ARG >/dev/null 2>&1; echo \$?"
"$SCRIPT" "$PATH_ARG" >/dev/null 2>&1; ec=$?
result "exit $ec  — success"
echo

printf "  USAGE ERROR (exit 2) — no path argument:\n"
cmd "./dirlist.sh"
note "Wrong invocation. Error message goes to stderr. Caller gets exit 2."
"$SCRIPT" 2>&1 >/dev/null | sed 's/^/  /'
ec=${PIPESTATUS[0]}
result "exit $ec  — usage error (fix the call)"
echo

printf "  RUNTIME ERROR (exit 1) — path does not exist:\n"
cmd "./dirlist.sh /no/such/path"
note "Valid invocation, bad input. Exit 1 signals a runtime failure."
"$SCRIPT" /no/such/path 2>&1 >/dev/null | sed 's/^/  /'
ec=${PIPESTATUS[0]}
result "exit $ec  — runtime error (fix the input)"
echo

note "Callers branch on exit code: 0=proceed, 1=retry or log, 2=fix the invocation."
note "Use 'set -o pipefail' in calling scripts so pipeline failures are not swallowed."


header "SUMMARY"
cat <<'EOF'

  ┌─────────────────────────────────────────────────────────────────────┐
  │  stdout (fd 1)  =  DATA your program produces                       │
  │                    → consumed by pipes, redirects, downstream tools  │
  │                                                                       │
  │  stderr (fd 2)  =  Your program's VOICE                             │
  │                    → logs, progress, warnings, errors                │
  │                    → flows straight to the terminal, bypasses pipes  │
  │                                                                       │
  │  exit code      =  Your program's VERDICT                           │
  │                    → 0  success                                      │
  │                    → 1  runtime error (bad input, file not found)    │
  │                    → 2  usage error (wrong/missing arguments)        │
  ├─────────────────────────────────────────────────────────────────────┤
  │  Redirect cheatsheet:                                                │
  │    2>/dev/null   silence stderr                                      │
  │    2>file.log    save stderr to a file                               │
  │    2>&1          merge stderr into stdout (careful!)                 │
  │    1>/dev/null   silence stdout (useful when you only want logs)     │
  └─────────────────────────────────────────────────────────────────────┘

EOF
hr
