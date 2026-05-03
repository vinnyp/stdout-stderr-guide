#!/usr/bin/env bash
#
# dirlist.sh — Recursively list directories under a given path.
#
# This script is designed to teach the difference between stdout and stderr.
#
# KEY RULE:
#   stdout (fd 1) = your program's DATA — what downstream programs consume
#   stderr (fd 2) = your program's VOICE — logs, progress, warnings, errors
#
# When you pipe output to another program (`| wc -l`, `| grep`, etc.),
# only stdout is piped. stderr flows straight to your terminal, uninterrupted.
#
# Usage:
#   ./dirlist.sh [--wrong-output] <path>
#
# Flags:
#   --wrong-output   Deliberately breaks the stdout/stderr separation so
#                    you can see what goes wrong when piped downstream.
#
# Examples (run these after reading the script):
#   ./dirlist.sh /tmp
#   ./dirlist.sh /tmp | wc -l
#   ./dirlist.sh --wrong-output /tmp | wc -l      ← broken: count includes noise
#   ./dirlist.sh /tmp | grep -c lib
#   ./dirlist.sh --wrong-output /tmp | grep -c lib ← broken: grep matches log lines too

set -euo pipefail

# ─── helpers ──────────────────────────────────────────────────────────────────

# PROG: the script's own name, used to identify itself in every diagnostic line.
# In a pipeline, multiple programs write to the same terminal simultaneously —
# without a name prefix you cannot tell which program produced which message.
PROG="$(basename "$0")"

# log_info: human-facing progress messages → stderr
# They will appear on the terminal but will NOT be piped downstream.
log_info() {
    echo "[INFO]  $PROG: $*" >&2
}

# log_warn: non-fatal warnings → stderr
log_warn() {
    echo "[WARN]  $PROG: $*" >&2
}

# Exit codes — GNU convention
# Programs communicate outcome to callers via exit codes. The shell, pipelines,
# and scripts all inspect $? to decide what to do next.
#   0 = success
#   1 = runtime error   (bad input, file not found, permission denied, etc.)
#   2 = usage error     (wrong arguments, unknown flags, missing required input)
#
# Keeping 1 and 2 distinct lets callers branch: "did I call this wrong (2),
# or did something go wrong at runtime (1)?" — grep, diff, ls all follow this.

# log_usage_error: incorrect invocation → stderr, then exit 2.
# Use when the caller passed wrong/missing arguments.
log_usage_error() {
    echo "[ERROR] $PROG: $*" >&2
    exit 2
}

# log_error: runtime failure → stderr, then exit 1.
# Use when arguments are valid but something went wrong during execution.
log_error() {
    echo "[ERROR] $PROG: $*" >&2
    exit 1
}

# emit: the actual data your program produces → stdout
# Downstream programs (wc, grep, awk, sort …) will receive exactly these lines.
emit() {
    echo "$1"
}

# wrong_emit: the WRONG way — mixes data and diagnostics on stdout.
# When piped, the consumer receives both directory paths AND log noise.
wrong_emit() {
    echo "$1"        # data lands on stdout ✓ …but so does everything else below
}
wrong_log_info() {
    echo "[INFO]  $PROG: $*" # ← stdout instead of stderr — WRONG stream, right identity
}
wrong_log_warn() {
    echo "[WARN]  $PROG: $*" # ← stdout instead of stderr — WRONG stream, right identity
}

# ─── argument parsing ─────────────────────────────────────────────────────────

WRONG_OUTPUT=false
SEARCH_PATH=""

for arg in "$@"; do
    case "$arg" in
        --wrong-output) WRONG_OUTPUT=true ;;
        --help|-h)
            sed -n '2,/^set/p' "$0" | grep '^#' | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        -*) log_usage_error "Unknown flag: $arg" ;;
        *)  SEARCH_PATH="$arg" ;;
    esac
done

[[ -z "$SEARCH_PATH" ]] && log_usage_error "Usage: $0 [--wrong-output] <path>"
[[ -d "$SEARCH_PATH" ]] || log_error "Not a directory: $SEARCH_PATH"

# ─── main logic ───────────────────────────────────────────────────────────────

if [[ "$WRONG_OUTPUT" == true ]]; then

    # ══════════════════════════════════════════════════════════════════════════
    # WRONG MODE — everything goes to stdout
    # ══════════════════════════════════════════════════════════════════════════
    #
    # Run:  ./dirlist.sh --wrong-output /tmp | wc -l
    #
    # You will get a count that is HIGHER than the real directory count
    # because [INFO] and [WARN] lines are being counted too.
    #
    # Run:  ./dirlist.sh --wrong-output /tmp | grep "^/"
    #
    # You will miss some directories because [INFO] lines pollute the stream
    # and a strict "starts with /" filter will silently drop them — or
    # worse, a looser filter will accidentally match log text.

    wrong_log_info "Starting directory scan (WRONG MODE): $SEARCH_PATH"
    wrong_log_info "Timestamp: $(date)"

    dir_count=0
    skipped_count=0

    while IFS= read -r -d '' dir; do
        # Simulate a permission-denied scenario for dirs named "private"
        if [[ "$(basename "$dir")" == "private" ]]; then
            wrong_log_warn "Permission denied (simulated): $dir"
            (( skipped_count++ )) || true
            continue
        fi
        wrong_emit "$dir"
        (( dir_count++ )) || true
    done < <(find "$SEARCH_PATH" -mindepth 1 -type d -print0 2>/dev/null)

    wrong_log_info "Done. Emitted $dir_count directories, skipped $skipped_count."
    wrong_log_info "──────────────────────────────────────────────"
    wrong_log_info "Pipe this to 'wc -l' and count the extra lines!"

else

    # ══════════════════════════════════════════════════════════════════════════
    # CORRECT MODE — data on stdout, diagnostics on stderr
    # ══════════════════════════════════════════════════════════════════════════
    #
    # Run:  ./dirlist.sh /tmp | wc -l
    #
    # The [INFO] lines appear on your terminal (via stderr) but are NOT
    # counted by wc — you get the exact number of directories.
    #
    # Run:  ./dirlist.sh /tmp | grep "^/"
    #
    # Only real paths flow through. Log noise never enters the pipe.

    log_info "Starting directory scan: $SEARCH_PATH"
    log_info "Timestamp: $(date)"

    dir_count=0
    skipped_count=0

    while IFS= read -r -d '' dir; do
        if [[ "$(basename "$dir")" == "private" ]]; then
            log_warn "Permission denied (simulated): $dir"
            (( skipped_count++ )) || true
            continue
        fi
        emit "$dir"
        (( dir_count++ )) || true
    done < <(find "$SEARCH_PATH" -mindepth 1 -type d -print0 2>/dev/null)

    log_info "Done. Found $dir_count directories, skipped $skipped_count."

fi
