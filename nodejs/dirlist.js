#!/usr/bin/env node
/**
 * dirlist.js — Recursively list directories under a given path.
 *
 * Demonstrates three approaches to stdout vs stderr in Node.js:
 *
 *   DEFAULT          console.log() for data, console.error() for diagnostics
 *   --use-logging    winston logger for diagnostics (the preferred production approach)
 *   --wrong-output   everything via console.log() — breaks pipe consumers
 *
 * Node.js-specific insight:
 *   Unlike Python's print(), console.error() already routes to stderr by default.
 *   The mistake in Node.js is using console.log() for EVERYTHING (data AND diagnostics).
 *   process.stdout.write() and process.stderr.write() are the lower-level primitives
 *   that console.log/error are built on top of.
 *
 * Usage:
 *   node dirlist.js [--use-logging] [--wrong-output] <path>
 *
 * Examples:
 *   node dirlist.js /tmp
 *   node dirlist.js --use-logging /tmp
 *   node dirlist.js /tmp | wc -l
 *   node dirlist.js --wrong-output /tmp | wc -l      ← broken count
 */

const fs   = require('fs');
const path = require('path');

// ── logging setup (winston) ───────────────────────────────────────────────────
//
// winston transports define WHERE log output goes.
// By default we point it at process.stderr — correct behaviour, bypasses pipes.
// Swap the transport (e.g. to a file) without touching any log call site.

const winston = require('winston');

// PROG: the script's own name, included in every diagnostic line.
// In a pipeline, diagnostics from multiple programs share the same terminal —
// the name prefix is what lets you tell them apart.
const PROG = path.basename(process.argv[1]);

// Exit codes — GNU convention
// 0 = success | 1 = runtime error | 2 = usage/argument error
const EXIT_OK    = 0;
const EXIT_ERR   = 1;
const EXIT_USAGE = 2;

const log = winston.createLogger({
  level: 'debug',
  format: winston.format.printf(({ level, message }) =>
    `[${level.toUpperCase()}]  ${PROG}: ${message}`
  ),
  transports: [
    new winston.transports.Stream({ stream: process.stderr }),  // correct: stderr
  ],
});


// ── emit helpers ──────────────────────────────────────────────────────────────

// Correct: data goes to stdout via console.log() (which wraps process.stdout.write)
const emit      = (p) => console.log(p);

// Wrong: data AND diagnostics all go through console.log() → stdout
const emitWrong = (p) => console.log(p);


// ── diagnostic helpers (console-based) ───────────────────────────────────────

// Correct: console.error() writes to stderr by default — no extra work needed.
// This is the key Node.js advantage over Python's print().
const info  = (msg) => console.error(`[INFO]  ${PROG}: ${msg}`);
const warn  = (msg) => console.error(`[WARN]  ${PROG}: ${msg}`);

// Wrong: console.log() writes to stdout — pollutes pipe consumers.
const infoWrong = (msg) => console.log(`[INFO]  ${PROG}: ${msg}`);
const warnWrong = (msg) => console.log(`[WARN]  ${PROG}: ${msg}`);


// ── recursive directory walk ──────────────────────────────────────────────────

function* walkDirs(root) {
  // fs.readdirSync with { withFileTypes: true } avoids a second stat() call per entry
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;  // silently skip unreadable directories
  }

  // Sort for deterministic output
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    yield full;
    yield* walkDirs(full);
  }
}


// ── core logic ────────────────────────────────────────────────────────────────

function scan(root, { wrongOutput, useLogging }) {
  // Pick the right diagnostic functions based on mode
  let logInfo, logWarn;

  if (useLogging) {
    // winston: .info() and .warn() both go to stderr via the configured transport.
    // You never reference a file descriptor — the transport layer owns that.
    logInfo = (msg) => log.info(msg);
    logWarn = (msg) => log.warn(msg);
  } else if (wrongOutput) {
    // Wrong console mode: diagnostics go to stdout alongside data.
    logInfo = infoWrong;
    logWarn = warnWrong;
  } else {
    // Correct console mode: console.error() routes to stderr automatically.
    logInfo = info;
    logWarn = warn;
  }

  const suffix = wrongOutput ? ' (WRONG MODE)' : '';
  logInfo(`Starting directory scan${suffix}: ${root}`);

  let dirCount  = 0;
  let skipCount = 0;

  for (const dir of walkDirs(root)) {
    const basename = path.basename(dir);

    // Simulate a permission-denied scenario, same as the bash and Python versions
    if (basename === 'private') {
      logWarn(`Permission denied (simulated): ${dir}`);
      skipCount++;
      continue;
    }

    emit(dir);
    dirCount++;
  }

  logInfo(`Done. Found ${dirCount} directories, skipped ${skipCount}.`);
}


// ── argument parsing ──────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const wrongOutput = args.includes('--wrong-output');
const useLogging  = args.includes('--use-logging');
const searchPath  = args.find((a) => !a.startsWith('--'));

if (!searchPath) {
  // Usage error: wrong/missing arguments → stderr + exit 2
  process.stderr.write(`[ERROR] ${PROG}: Usage: node dirlist.js [--use-logging] [--wrong-output] <path>\n`);
  process.exit(EXIT_USAGE);
}

if (!fs.existsSync(searchPath) || !fs.statSync(searchPath).isDirectory()) {
  // Runtime error: valid invocation but bad input → stderr + exit 1
  process.stderr.write(`[ERROR] ${PROG}: Not a directory: ${searchPath}\n`);
  process.exit(EXIT_ERR);
}

scan(searchPath, { wrongOutput, useLogging });
