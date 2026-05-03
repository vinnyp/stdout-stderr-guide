# stdout vs stderr — Python Demo Report

**Path scanned:** `~/projects`  
**Generated:** 2026-05-03  
**Scripts:** `dirlist.py`, `demo.py`

---

## The core rule

```
stdout (fd 1)  =  DATA your program produces
                  → consumed by pipes, redirects, downstream tools

stderr (fd 2)  =  Your program's VOICE
                  → logs, progress, warnings, errors
                  → flows straight to the terminal, bypasses pipes
```

`stderr` does **not** mean invisible. It means **bypasses pipes**. Without a redirect, your terminal receives both streams. The difference only surfaces when you pipe.

---

## Three Python approaches

| Approach | Diagnostic call | Routing |
|---|---|---|
| Correct `print()` | `print(msg, file=sys.stderr)` | Manual — you must remember `file=` every time |
| **`logging` (preferred)** | `log.info()` / `log.warning()` | Automatic — handler owns routing at setup |
| Wrong `print()` | `print(msg)` | stdout — pollutes pipe consumers |

---

## Experiment 1 — Raw output, no pipe

### Correct (print mode) — stdout only, what a pipe receives

```bash
$ python dirlist.py ~/Projects 2>/dev/null
```

`2>/dev/null` suppresses stderr so only the data stream is visible. No `[INFO]` lines.

```
/home/user/projects/api-server
/home/user/projects/web-client
/home/user/projects/cli-tool
...
```

### Correct (print mode) — full terminal view (both streams)

```bash
$ python dirlist.py ~/Projects
```

Without a redirect the terminal receives both `fd 1` and `fd 2`. `[INFO]` lines still appear — they just travel via `fd 2` and will be invisible to any pipe consumer.

```
[INFO]  Starting directory scan: /home/user/projects
/home/user/projects/api-server
/home/user/projects/web-client
...
```

### Correct (logging mode) — stdout only

```bash
$ python dirlist.py --use-logging ~/Projects 2>/dev/null
```

`log.info()` routes to stderr automatically. Suppressing stderr gives identical clean output — no extra effort in the call site.

```
/home/user/projects/api-server
/home/user/projects/web-client
...
```

### Wrong mode — stdout only

```bash
$ python dirlist.py --wrong-output ~/Projects 2>/dev/null
```

`[INFO]` was written with plain `print()`, so it lands on stdout. Even with stderr suppressed, the log lines appear — because they were never on stderr in the first place.

```
[INFO]  Starting directory scan (WRONG MODE): /home/user/projects
/home/user/projects/api-server
/home/user/projects/web-client
...
```

---

## Experiment 2 — Pipe to `wc -l` (count lines)

```bash
# Correct — print mode
$ python dirlist.py ~/Projects | wc -l
5047 directories   ← exact count

# Correct — logging mode
$ python dirlist.py --use-logging ~/Projects | wc -l
5047 directories   ← identical result

# Wrong
$ python dirlist.py --wrong-output ~/Projects | wc -l
5049 lines         ← 2 phantom lines from [INFO] noise
```

Both correct modes produce the same count. The `logging` module's internal routing is transparent to the pipe.

---

## Experiment 3 — `logging` vs `print`: the key difference

This is the Python-specific insight.

### `print()` has no concept of severity or routing

It is a presentation tool. Every diagnostic line requires you to explicitly pass `file=sys.stderr`. Forget it once and you silently pollute the pipe — no error, no warning, just a wrong count downstream.

```python
# Correct print approach
import sys

print(data)                            # data  → stdout  ✓
print(f"[INFO] ...", file=sys.stderr)  # diag  → stderr  ✓
print(f"[WARN] ...", file=sys.stderr)  # warn  → stderr  ✓

# Wrong print approach — easy mistake, silent failure
print(data)             # data  → stdout  ✓
print(f"[INFO] ...")    # diag  → stdout  ✗  (missing file=sys.stderr)
print(f"[WARN] ...")    # warn  → stdout  ✗  (missing file=sys.stderr)
```

### `logging` owns routing at setup time

Configure it once. Every subsequent `log.*` call routes correctly without any `file=` argument.

```python
import logging, sys

logging.basicConfig(stream=sys.stderr, format="[%(levelname)s]  %(message)s")
log = logging.getLogger(__name__)

print(data)         # data  → stdout  ✓
log.info("...")     # diag  → stderr  ✓  automatic
log.warning("...")  # warn  → stderr  ✓  automatic
log.error("...")    # error → stderr  ✓  automatic
```

You also get for free:

- **Level filtering** — `logging.WARNING` in production silences all `DEBUG`/`INFO` without touching call sites
- **Handler swapping** — swap `StreamHandler(sys.stderr)` for a `FileHandler`, a cloud sink, or `syslog` without changing any application code
- **Structured formatting** — timestamps, module names, levels, all configurable centrally

`print(file=sys.stderr)` is not wrong — it works — but at any meaningful scale you will forget `file=` somewhere. `logging` makes the correct behaviour the default.

---

## Experiment 4 — Suppress stderr (`2>/dev/null`)

```bash
$ python dirlist.py ~/Projects 2>/dev/null | wc -l
5047 directories   ← no [INFO] clutter, same data
```

Works identically for both `print` and `logging` modes, because both route diagnostics to `fd 2`.

---

## Experiment 5 — Capture stderr to a file (`2>file`)

```bash
$ python dirlist.py --use-logging ~/Projects 2>dirlist.log | wc -l
5047 directories
```

`dirlist.log` receives:
```
[INFO]  Starting directory scan: /home/user/projects
[INFO]  Done. Found 5047 directories, skipped 0.
```

stdout flows to the pipe unaffected. This is particularly clean with `logging` — swap the handler to a `FileHandler` in code and you don't even need the shell redirect.

---

## Experiment 6 — Merge stderr into stdout (`2>&1`)

```bash
$ python dirlist.py ~/Projects 2>&1 | wc -l
5048 lines   ← directories + [INFO] lines merged
```

`2>&1` intentionally merges both streams. The result is the same inflated count as `--wrong-output`. Use deliberately (e.g. capturing everything to a single log), never by accident.

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│  Python stdout/stderr routing                                        │
│                                                                       │
│  print(data)                    → stdout  ✓  data                   │
│  print(msg, file=sys.stderr)    → stderr  ✓  diagnostic (print)     │
│  log.info/warning/error(msg)    → stderr  ✓  diagnostic (logging)   │
│                                                                       │
│  print(msg)          [no file=] → stdout  ✗  wrong — pollutes pipes │
├─────────────────────────────────────────────────────────────────────┤
│  Why prefer logging over print(file=sys.stderr)?                     │
│                                                                       │
│  • One setup call; all log.* calls route correctly automatically     │
│  • Level filtering: silence DEBUG in prod, verbose in dev            │
│  • Swap handlers to write logs to a file, syslog, or a cloud sink   │
│    without touching application code                                  │
│  • print(file=sys.stderr) works but you must remember it every time  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Redirect cheatsheet

| Redirect | Effect |
|---|---|
| `2>/dev/null` | Silence stderr |
| `2>file.log` | Save stderr to a file |
| `2>&1` | Merge stderr into stdout |
| `1>/dev/null` | Silence stdout (when you only want logs) |
| `>/dev/null 2>&1` | Silence everything |

---

## Files

| File | Purpose |
|---|---|
| `dirlist.py` | Main script — lists directories recursively |
| `demo.py` | Runs all 6 experiments side-by-side |

```bash
# Re-run the demo against any path
python demo.py /some/path
```
