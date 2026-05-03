# Bibliography: resources and works cited

**[Resources](#resources)** — manuals and tutorials for going deeper when building or debugging.

**[Works cited](#works-cited)** — formal attribution for claims used in the [README](../README.md), [guide](guide.md), and [reference](reference.md).

---

## Resources

These links explain *mechanisms* (how Bash applies redirections, how libc buffers streams, how to configure Python or Node). Use them when implementing or debugging — not as competing “style guides.” Items that are also cited academically appear in both sections when the *purpose* differs (e.g. BashFAQ as a tutorial here vs a citation there).

### Shell and POSIX utilities

- **[GNU Bash Manual — Redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html)** — Authoritative description of how Bash parses `>`, `>>`, `2>`, `2>&1`, here-documents, and moving file descriptors. Read this when the [redirect cheatsheet](reference.md#redirect-cheatsheet) is not enough or when behaviour differs between interactive shells and scripts.

- **[Greg’s Wiki — BashFAQ/002](https://mywiki.wooledge.org/BashFAQ/002)** — Practical patterns: capturing stdout in a variable, avoiding subshell pitfalls, and understanding why naive redirects fail. Essential when wiring demos into larger Bash automation.

- **[The Open Group — `cat` utility](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/cat.html)** — POSIX text for a utility whose **standard output** is “conventional output.” Useful background for what “primary output of the command” means in formal specs (compare with stderr for diagnostics on the [stderr](https://pubs.opengroup.org/onlinepubs/9699919799/functions/stderr.html) page).

### Streams, buffering, and behaviour

- **[Why stdout is faster than stderr? (Orhun)](https://blog.orhun.dev/stdout-vs-stderr/)** — Short article on buffering defaults and write paths in typical libc setups. Helps explain intermittent “delayed” stdout lines when piping or redirecting to files, and why stderr often feels more “immediate” on a terminal.

### Python

- **[Python — Logging HOWTO](https://docs.python.org/3/howto/logging.html)** — How to route `logging` to stderr, set levels and handlers, and avoid spraying diagnostics on stdout by accident. Pairs directly with the Python demo’s `--use-logging` mode.

### Node.js

- **[Node.js — `process.stdout` / `process.stderr`](https://nodejs.org/api/process.html#processstdout)** — Official API reference for the streams behind `console.log` / `console.error`. Use when tuning encoding, buffering, or attaching transports (e.g. Winston) without guessing behaviour.

### Teaching-oriented redirection primer

- **[Seneca Polytechnic — Redirections and read/write to files](https://pressbooks.senecapolytechnic.ca/uli101/chapter/week-5-redirections-and-read-read-to-files/)** — Introductory chapter with exercises and diagrams. Good if you are onboarding someone who has never seen `2>` or `2>&1` and needs a slower walkthrough than this repo’s experiment ladder.

---

## Works cited

References are listed for attribution and further reading. URLs were verified as of the documentation update; if a link moves, search by title and publisher.

### Standards and canonical specifications

- **IEEE / The Open Group.** *The Open Group Base Specifications Issue 7, 2018 edition* (IEEE Std 1003.1-2017). Defines the standard streams: stdin for conventional input, stdout for conventional output, stderr for diagnostic output (including buffering expectations). Stream definitions: [stdin, stdout, stderr](https://pubs.opengroup.org/onlinepubs/9699919799/functions/stderr.html).

### GNU Project

- **GNU Project.** *GNU Coding Standards.* Section “Standards for Command Line Interfaces” (programs should support `--help` and `--version`; CLI consistency). [Command-Line Interfaces](https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces.html).
- **GNU Project.** *GNU Coding Standards.* Section “Formatting Error Messages” (noninteractive error message shape; usage messages capitalized, etc.). [Errors](https://www.gnu.org/prep/standards/html_node/Errors.html).

### Shell and tooling style guides

- **Google.** *Google Shell Style Guide.* Error reporting and separation from normal output (stderr). [Shell Style Guide](https://google.github.io/styleguide/shellguide.html).
- **GreyCat et al.** *Greg’s Wiki — BashFAQ/002: How can I redirect the output of a command to a variable?* Bash redirection and subshell behaviour (widely used reference for shell I/O). [BashFAQ/002](https://mywiki.wooledge.org/BashFAQ/002).

### Essays, methodology, and historical discussion

- **McIlroy, Doug.** Introduction and commentary in *A Research UNIX Reader: Annotated Excerpts from the Programmer’s Manual, 1971–1986* (Bell Laboratories). Primary-source discussion of diagnostics on standard output before stderr, pipes, and the introduction of standard error; the quotation in [README — The origin](../README.md#the-origin-why-stderr-exists-at-all) is taken from McIlroy’s introduction.

- **Twelve-Factor App.** *Logs* — treat logs as event streams; export to stdout (and let the environment route). [12factor.net/logs](https://12factor.net/logs). *(Contrast with CLI pipeline discipline in [guide.md — How this relates to logs as streams](guide.md#how-this-relates-to-logs-as-streams-twelve-factor-app).)*

### Community Q&A (illustrative practice, not normative standards)

- **Kusalananda et al.** “When to use standard error stream in command-line application?” *Unix & Linux Stack Exchange*, 12 Jan. 2017. [Discussion](https://unix.stackexchange.com/questions/336983/when-to-use-standard-error-stream-in-command-line-application).

- **Szonye et al.** “Do progress reports / logging information belong on stderr or stdout?” *Unix & Linux Stack Exchange*, 21 Dec. 2016. [Discussion](https://unix.stackexchange.com/questions/331611/do-progress-reports-logging-information-belong-on-stderr-or-stdout).

- **Various authors.** “What are the conventions for stdout/stderr messages?” *Stack Overflow*, Feb. 2010. [Discussion](https://stackoverflow.com/questions/7977852/what-are-the-conventions-for-stdout-stderr-messages) (includes `--help` / usage stream conventions often cited alongside GNU practice).

- **jk., Stephen Kitt et al.** “What was the point of separating stdout and stderr?” *Retrocomputing Stack Exchange*, 28 Jun. 2019. Historical context for distinct streams. [Discussion](https://retrocomputing.stackexchange.com/questions/11499/what-was-the-point-of-separating-stdout-and-stderr).
