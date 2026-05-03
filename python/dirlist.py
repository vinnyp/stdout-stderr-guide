#!/usr/bin/env python3
"""
dirlist.py — Recursively list directories under a given path.

Demonstrates three approaches to stdout vs stderr in Python:

  DEFAULT          print() for data, print(..., file=sys.stderr) for diagnostics
  --use-logging    logging module for diagnostics (the preferred production approach)
  --wrong-output   everything via plain print() — breaks pipe consumers

Usage:
    python dirlist.py [--use-logging] [--wrong-output] <path>

Examples:
    python dirlist.py /tmp
    python dirlist.py --use-logging /tmp
    python dirlist.py /tmp | wc -l
    python dirlist.py --wrong-output /tmp | wc -l      ← broken count
    python dirlist.py --use-logging --wrong-output /tmp | wc -l  ← also broken
"""

import argparse
import logging
import os
import sys
from pathlib import Path


# ── logging setup ─────────────────────────────────────────────────────────────
#
# logging.basicConfig() defaults to stderr (StreamHandler(sys.stderr)).
# That's the correct behaviour — log output bypasses pipes automatically.
#
# The format mirrors the [INFO] / [WARN] style from the bash version so the
# two scripts are easy to compare side-by-side.

# PROG: the script's own name, included in every diagnostic line.
# In a pipeline, diagnostics from multiple programs share the same terminal —
# the name prefix is what lets you tell them apart.
PROG = Path(sys.argv[0]).name

# Exit codes — GNU convention
# 0 = success | 1 = runtime error | 2 = usage/argument error
# Note: argparse already exits with 2 on bad arguments — no extra work needed.
EXIT_OK    = 0
EXIT_ERR   = 1
EXIT_USAGE = 2

logging.basicConfig(
    level=logging.DEBUG,
    format=f"[%(levelname)s]  {PROG}: %(message)s",
    stream=sys.stderr,          # explicit, but this is already the default
)
log = logging.getLogger(__name__)


# ── emit helpers ──────────────────────────────────────────────────────────────

def emit(path: str) -> None:
    """Write a directory path to stdout — the data stream."""
    print(path)                 # print() defaults to sys.stdout


def emit_wrong(path: str) -> None:
    """Write a directory path to stdout — same as emit(), shown for symmetry."""
    print(path)


# ── diagnostic helpers (print-based) ──────────────────────────────────────────

def info_print(msg: str) -> None:
    """Correct: diagnostic → stderr via file=sys.stderr."""
    print(f"[INFO]  {PROG}: {msg}", file=sys.stderr)


def warn_print(msg: str) -> None:
    """Correct: warning → stderr via file=sys.stderr."""
    print(f"[WARN]  {PROG}: {msg}", file=sys.stderr)


def info_wrong(msg: str) -> None:
    """Wrong: diagnostic → stdout (default). Pollutes pipe consumers."""
    print(f"[INFO]  {PROG}: {msg}")     # missing file=sys.stderr  ← the mistake


def warn_wrong(msg: str) -> None:
    """Wrong: warning → stdout. Same problem (wrong stream; still includes PROG for identity)."""
    print(f"[WARN]  {PROG}: {msg}")     # missing file=sys.stderr  ← the mistake


# ── core logic ────────────────────────────────────────────────────────────────

def scan(root: Path, wrong_output: bool, use_logging: bool) -> None:
    """Walk root recursively and emit every subdirectory."""

    # Pick the right diagnostic functions based on mode
    if use_logging:
        # logging module: .info() and .warning() both go to stderr by default.
        # You never have to think about file descriptors — the handler owns that.
        info  = log.info
        warn  = log.warning
    elif wrong_output:
        # Wrong print mode: diagnostics go to stdout alongside the data.
        info  = info_wrong
        warn  = warn_wrong
    else:
        # Correct print mode: diagnostics explicitly routed to stderr.
        info  = info_print
        warn  = warn_print

    suffix = " (WRONG MODE)" if wrong_output else ""
    info(f"Starting directory scan{suffix}: {root}")

    dir_count   = 0
    skip_count  = 0

    for dirpath, dirnames, _ in os.walk(root):
        # Sort for deterministic output (os.walk order is filesystem-dependent)
        dirnames.sort()

        for dirname in dirnames:
            full = os.path.join(dirpath, dirname)

            # Simulate a permission-denied scenario, same as the bash version
            if dirname == "private":
                warn(f"Permission denied (simulated): {full}")
                skip_count += 1
                dirnames.remove(dirname)   # don't recurse into it
                continue

            emit(full)
            dir_count += 1

    info(f"Done. Found {dir_count} directories, skipped {skip_count}.")


# ── argument parsing ──────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Recursively list directories. Demonstrates stdout vs stderr.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("path", help="Root directory to scan")
    parser.add_argument(
        "--wrong-output",
        action="store_true",
        help="Send all output (data + diagnostics) to stdout — breaks pipes",
    )
    parser.add_argument(
        "--use-logging",
        action="store_true",
        help="Use the logging module for diagnostics instead of print()",
    )
    return parser.parse_args()


# ── entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()

    root = Path(args.path)
    if not root.is_dir():
        # Runtime errors always go to stderr — even in wrong mode.
        # A crashed program's error message should never pollute a pipe.
        print(f"[ERROR] {PROG}: Not a directory: {root}", file=sys.stderr)
        sys.exit(EXIT_ERR)

    scan(root, wrong_output=args.wrong_output, use_logging=args.use_logging)


if __name__ == "__main__":
    main()
