# Reference: exit codes and shell redirects

Quick lookups for scripting. For **history, rules, and experiments**, see [guide.md](guide.md). For **links and citations**, see [bibliography.md](bibliography.md).

---

## Exit codes

Exit codes are the third leg of the I/O contract, alongside stdout and stderr. A program that exits `0` after printing an error to stderr has still failed — and pipelines, scripts, and agents that check `$?` will be misled.

### The GNU convention

This is what `grep`, `diff`, `ls`, `curl`, and many Unix tools follow — and what this project uses. It aligns with the broader idea that callers can branch on exit status while treating stdout as the successful **data** channel when status is zero:

| Code | Meaning | When to use |
|---|---|---|
| `0` | Success | Everything worked. Output on stdout is valid. |
| `1` | Runtime error | Invocation was correct but something failed — file not found, permission denied, unexpected input. |
| `2` | Usage error | Wrong or missing arguments, unknown flags. The caller needs to fix the invocation, not the input. |

The `1` vs `2` distinction is what lets automation branch correctly: a `2` means "don't retry, fix the call"; a `1` might mean "log and retry with different input."

### The `sysexits.h` standard

For reference, BSD Unix defines a more granular set of codes in `/usr/include/sysexits.h`, used by some system tools and C programs. They run from `64–78`:

| Code | Name | Meaning |
|---|---|---|
| 64 | `EX_USAGE` | Command line usage error |
| 65 | `EX_DATAERR` | Input data was wrong format |
| 66 | `EX_NOINPUT` | Input file not found or unreadable |
| 70 | `EX_SOFTWARE` | Internal software error |
| 74 | `EX_IOERR` | I/O error |
| 77 | `EX_NOPERM` | Permission denied |
| 78 | `EX_CONFIG` | Configuration error |

These are well-specified but less universally known outside of C/BSD tooling. For most scripts and general-purpose programs, the simpler GNU `0/1/2` convention is the right choice — it is what people expect, what shells interpret, and what CI systems check.

### What to avoid

The shell reserves `126`–`128` for its own use (`126` = not executable, `127` = command not found, `128+N` = terminated by signal N). Scripts should not use these codes themselves to avoid ambiguity.

---

## Redirect cheatsheet

| Stream | Action | Redirect | Effect |
|---|---|---|---|
| stderr | Silence | `2>/dev/null` | Discard all stderr |
| stderr | Save | `2>file.log` | Write stderr to file (overwrite) |
| stderr | Append | `2>>file.log` | Append stderr to file |
| stderr | Merge into stdout | `2>&1` | Route stderr to wherever stdout currently goes |
| stdout | Silence | `1>/dev/null` | Discard all stdout |
| stdout | Save | `1>file` | Write stdout to file (overwrite) |
| stdout | Append | `1>>file` | Append stdout to file |
| stdout | Merge into stderr | `1>&2` | Route stdout to wherever stderr currently goes |
| both | Silence | `>/dev/null 2>&1` | Discard everything |
| both | Save | `>file 2>&1` | Write everything to file |
| both | Pipe | `2>&1 \| cmd` | Send both streams into a pipeline |

### The order-of-evaluation gotcha

Redirections are evaluated left to right, and each one resolves to wherever the target stream points **at that moment** — not at the end. This catches everyone eventually:

```bash
# WRONG — stderr still goes to the terminal
some-cmd 2>&1 >file

# What actually happens, step by step:
#   2>&1   → stderr is pointed at stdout's current destination: the terminal
#   >file  → stdout is now pointed at file
# Result: stdout → file, stderr → terminal  (not what you wanted)


# CORRECT — both streams go to the file
some-cmd >file 2>&1

# What actually happens, step by step:
#   >file  → stdout is pointed at file
#   2>&1   → stderr is pointed at stdout's current destination: file
# Result: stdout → file, stderr → file  ✓
```

The rule: **redirect stdout first, then point stderr at it.** If you write `2>&1` before `>file`, stderr locks on to the terminal before stdout has been moved.
