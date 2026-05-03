#!/usr/bin/env node
/**
 * demo.js — Side-by-side demonstration of stdout vs stderr in Node.js.
 *
 * Aligns with demo.sh / demo.py for experiments 1–2 and 4–7; experiment 3 is the Node
 * lesson (console vs winston) instead of Bash's grep pipe — see README.md.
 * Highlights Node.js-specific behaviour:
 *   - console.log()  → stdout
 *   - console.error() → stderr (already correct, unlike Python's print())
 *   - process.stdout.write() / process.stderr.write() — lower-level primitives
 *   - winston logger — transport-based routing
 *
 * Usage:
 *   node demo.js [path]    (defaults to /tmp)
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');

const SCRIPT   = path.join(__dirname, 'dirlist.js');
const PATH_ARG = process.argv[2] || '/tmp';
const NODE     = process.execPath;


// ── display helpers ───────────────────────────────────────────────────────────

const hr     = ()      => console.log('\n' + '─'.repeat(70));
const header = (title) => { hr(); console.log(`\n  ${title}\n`); };
const cmd    = (c)     => console.log(`  \x1b[1;36m$\x1b[0m ${c}`);
const note   = (t)     => console.log(`  \x1b[33m↳ ${t}\x1b[0m`);
const result = (t)     => console.log(`  \x1b[32mResult:\x1b[0m ${t}`);

function run(args, { mergeStderr = false } = {}) {
  const r = spawnSync(NODE, [SCRIPT, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', mergeStderr ? 'pipe' : 'ignore'],
  });
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  return mergeStderr ? stdout + stderr : stdout;
}

function countLines(text) {
  return text.split('\n').filter((l) => l.trim()).length;
}

function firstLines(text, n = 4) {
  return text.split('\n').filter((l) => l.trim()).slice(0, n)
    .map((l) => `    ${l}`).join('\n');
}


// ── experiments ───────────────────────────────────────────────────────────────

header('EXPERIMENT 1 — Raw output, no pipe');

console.log('\n  CORRECT (console mode) — stdout only, what a pipe would receive:');
cmd(`node dirlist.js ${PATH_ARG} 2>/dev/null`);
note('console.log() → stdout. console.error() → stderr. No extra work needed.');
note('Suppressing stderr isolates the clean data stream.');
console.log(firstLines(run([PATH_ARG])));
console.log('    ...');

console.log('\n  CORRECT (console mode) — full terminal view (both streams):');
note('Without a redirect, your terminal receives both fd 1 and fd 2.');
note('console.error() lines still appear — they just bypass pipes.');
console.log(firstLines(run([PATH_ARG], { mergeStderr: true }), 6));
console.log('    ...');

console.log('\n  CORRECT (winston mode) — stdout only:');
cmd(`node dirlist.js --use-logging ${PATH_ARG} 2>/dev/null`);
note('winston routes log.info() and log.warn() to stderr via its transport.');
note('No stream argument needed at the call site — the transport owns routing.');
console.log(firstLines(run(['--use-logging', PATH_ARG])));
console.log('    ...');

console.log('\n  WRONG MODE — stdout only:');
cmd(`node dirlist.js --wrong-output ${PATH_ARG} 2>/dev/null`);
note('[INFO] lines written via console.log() land on stdout — pipe consumers see them.');
console.log(firstLines(run(['--wrong-output', PATH_ARG]), 6));
console.log('    ...');


header('EXPERIMENT 2 — Pipe to wc -l (count lines)');

const correctCount = countLines(run([PATH_ARG]));
const logCount     = countLines(run(['--use-logging', PATH_ARG]));
const wrongCount   = countLines(run(['--wrong-output', PATH_ARG]));

console.log('\n  CORRECT (console mode):');
cmd(`node dirlist.js ${PATH_ARG} | wc -l`);
note('console.error() lines go to stderr — wc -l never sees them.');
result(`${correctCount} directories`);

console.log('\n  CORRECT (winston mode):');
cmd(`node dirlist.js --use-logging ${PATH_ARG} | wc -l`);
note('Same result — winston transport routes diagnostics to stderr regardless.');
result(`${logCount} directories`);

console.log('\n  WRONG MODE:');
cmd(`node dirlist.js --wrong-output ${PATH_ARG} | wc -l`);
note('Every [INFO] line is counted. Count is inflated.');
result(`${wrongCount} lines  ← includes log lines`);

console.log();
console.log(`  \x1b[31mDifference: ${wrongCount - correctCount} phantom lines from log noise\x1b[0m`);


header('EXPERIMENT 3 — console.error() vs console.log(): the Node.js advantage');

console.log();
note('Unlike Python\'s print(), console.error() ALREADY routes to stderr.');
note('The mistake in Node.js is using console.log() for everything.');
note('process.stdout.write() and process.stderr.write() are the low-level primitives');
note('that console.log/error are built on top of.');
console.log(`
  The four primitives:

    process.stdout.write(data + '\\n')   // raw stdout — what console.log wraps
    process.stderr.write(msg  + '\\n')   // raw stderr — what console.error wraps
    console.log(data)                    // stdout  ✓  data
    console.error(msg)                   // stderr  ✓  diagnostic (already correct!)

  Wrong approach — console.log() for everything:

    console.log(data)          // stdout  ✓
    console.log('[INFO] ...')  // stdout  ✗  should be console.error()
    console.log('[WARN] ...')  // stdout  ✗  should be console.error()

  Correct console approach:

    console.log(data)            // stdout  ✓  data
    console.error('[INFO] ...')  // stderr  ✓  diagnostic
    console.error('[WARN] ...')  // stderr  ✓  warning

  Winston approach (preferred for production):

    const log = winston.createLogger({
      transports: [new winston.transports.Stream({ stream: process.stderr })],
    });

    console.log(data)    // data  → stdout  ✓
    log.info('...')      // diag  → stderr  ✓  transport handles routing
    log.warn('...')      // warn  → stderr  ✓  transport handles routing
    log.error('...')     // error → stderr  ✓  swap transport = change destination
`);
note('With winston you also get level filtering, structured JSON output,');
note('and transport swapping (file, HTTP, cloud) without touching call sites.');


header('EXPERIMENT 4 — Suppress stderr (2>/dev/null)');

const silentCount = countLines(run([PATH_ARG]));
console.log();
cmd(`node dirlist.js ${PATH_ARG} 2>/dev/null | wc -l`);
note('Silences all diagnostic output. Data stream is unaffected.');
note('Works identically for both console and winston modes.');
result(`${silentCount} directories  (no [INFO] clutter)`);


header('EXPERIMENT 5 — Capture stderr to a file (2>file)');

const os  = require('os');
const fs  = require('fs');
const tmp = require('path').join(os.tmpdir(), `dirlist_${process.pid}.log`);

const r = spawnSync(NODE, [SCRIPT, '--use-logging', PATH_ARG], {
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', fs.openSync(tmp, 'w')],
});
const fileCount = countLines(r.stdout);

console.log();
cmd(`node dirlist.js --use-logging ${PATH_ARG} 2>${tmp} | wc -l`);
note('stderr goes to a log file. stdout still flows to the pipe unaffected.');
note('With winston, swap to a File transport in code and skip the shell redirect.');
result(`${fileCount} directories`);
console.log();
console.log(`  Log file (${tmp}):`);
fs.readFileSync(tmp, 'utf8').split('\n').filter(Boolean)
  .forEach((l) => console.log(`    ${l}`));
fs.unlinkSync(tmp);


header('EXPERIMENT 6 — Merge stderr into stdout (2>&1)');

const mergedCount = countLines(run([PATH_ARG], { mergeStderr: true }));
console.log();
cmd(`node dirlist.js ${PATH_ARG} 2>&1 | wc -l`);
note('2>&1 merges stderr into stdout. wc -l counts everything.');
note('Same result as --wrong-output. Use intentionally, never accidentally.');
result(`${mergedCount} lines  (directories + log lines merged)`);


header('EXPERIMENT 7 — Exit codes');

console.log();
note('Exit codes let callers and pipelines know whether a program succeeded.');
note('GNU convention: 0 = success  |  1 = runtime error  |  2 = usage error');
console.log();

// Helper: run script, return { stdout, stderr, exitCode }
const runWithEc = (args) => {
  const r = spawnSync(NODE, [SCRIPT, ...args], { encoding: 'utf8' });
  return { stdout: r.stdout || '', stderr: r.stderr || '', exitCode: r.status };
};

console.log('  SUCCESS — correct invocation:');
cmd(`node dirlist.js ${PATH_ARG} >/dev/null 2>&1; echo $?`);
const { exitCode: successEc } = runWithEc([PATH_ARG]);
result(`exit ${successEc}  — success`);

console.log();
console.log('  USAGE ERROR (exit 2) — no path argument:');
cmd('node dirlist.js');
note('Missing required argument. Error goes to stderr. Caller gets exit 2.');
const { stderr: usageErr, exitCode: usageEc } = runWithEc([]);
usageErr.trim().split('\n').forEach((l) => console.log(`    ${l}`));
result(`exit ${usageEc}  — usage error (fix the call)`);

console.log();
console.log('  RUNTIME ERROR (exit 1) — path does not exist:');
cmd('node dirlist.js /no/such/path');
note('Valid invocation, bad input. process.exit(EXIT_ERR) exits 1.');
const { stderr: runtimeErr, exitCode: runtimeEc } = runWithEc(['/no/such/path']);
runtimeErr.trim().split('\n').forEach((l) => console.log(`    ${l}`));
result(`exit ${runtimeEc}  — runtime error (fix the input)`);

console.log();
note('Callers branch on exit code: 0=proceed, 1=retry or log, 2=fix the invocation.');


header('SUMMARY');

console.log(`
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Node.js stdout/stderr routing                                       │
  │                                                                       │
  │  console.log(data)              → stdout  ✓  data                   │
  │  console.error(msg)             → stderr  ✓  diagnostic (built-in!) │
  │  process.stdout.write(data)     → stdout  ✓  raw primitive           │
  │  process.stderr.write(msg)      → stderr  ✓  raw primitive           │
  │  log.info/warn/error(msg)       → stderr  ✓  diagnostic (winston)   │
  │                                                                       │
  │  console.log(msg) for diagnos.  → stdout  ✗  wrong — pollutes pipes │
  ├─────────────────────────────────────────────────────────────────────┤
  │  Exit codes (GNU convention)                                         │
  │    0   success                                                        │
  │    1   runtime error (file not found, bad input, etc.)               │
  │    2   usage error  (wrong/missing arguments)                        │
  ├─────────────────────────────────────────────────────────────────────┤
  │  Why prefer winston over console.error()?                            │
  │                                                                       │
  │  • Transport layer: swap file, HTTP, or cloud with zero call changes │
  │  • Level filtering: silence debug in prod without touching code      │
  │  • Structured JSON output: machine-parseable logs out of the box     │
  │  • console.error() is fine for small scripts; winston for anything   │
  │    that runs in production or needs log aggregation                  │
  └─────────────────────────────────────────────────────────────────────┘
`);
hr();
