---
title: Exit codes
description: The five exit codes, what causes each one, and how to handle them in a script.
order: 6
---

# Exit codes

Exit codes are a contract: values are never reused and never change meaning.

| Code | Name                       | Meaning                                                |
| ---- | -------------------------- | ------------------------------------------------------ |
| `0`  | success                    | The command did what it was asked to do.               |
| `1`  | context integrity failure  | The repository context is not in a valid state.        |
| `2`  | invalid CLI usage          | The command could not run as invoked.                  |
| `3`  | unsupported context schema | The context declares a schema this build cannot read.  |
| `4`  | internal failure           | A bug in Syngraphe.                                    |

## `0` — success

- `init` applied its plan, completed a `--dry-run`, or found nothing to do.
- `status` always exits `0`; it reports rather than judges.
- `check` found no errors — and no warnings, when `--strict` was passed.

## `1` — context integrity failure

Something about the repository context is wrong and a human has to decide what to do.

- `check` found at least one error, or a warning under `--strict`.
- `init` built a plan containing conflicts: a hand-edited managed block, duplicate blocks,
  unbalanced markers, or a file that cannot be managed safely. Nothing was written.
- `init` found a `.context/` that is not a Syngraphe context, or a manifest that does not parse.

## `2` — invalid CLI usage

The command never really started.

- Not inside a Git repository.
- An unknown command, an unknown option, or a missing argument.
- A path that cannot be written safely — outside the repository root, or through a symlink.

`--help` and `--version` are successful outcomes and exit `0`.

## `3` — unsupported context schema

`.context/manifest.json` declares a `schemaVersion` this build does not support, so nothing else it
could report about the context would be trustworthy.

Emitted by both `init` and `check`, and it takes precedence over `1` in `check`. The fix is to
upgrade Syngraphe — never to lower the number in the manifest, which changes the declaration without
changing the files.

## `4` — internal failure

An unexpected error escaped a command. Syngraphe prints `Internal Syngraphe failure.` and the stack
trace.

This is a bug. The stack trace and the output of `syngraphe check --json` are what a
[report](https://github.com/suffro/syngraphe/issues) needs.

## Handling them in a script

```bash
#!/usr/bin/env bash
set -euo pipefail

if syngraphe check --strict; then
  echo "context ok"
else
  case $? in
    1) echo "context needs attention"; exit 1 ;;
    3) echo "upgrade syngraphe: this repository uses a newer context schema"; exit 1 ;;
    *) echo "syngraphe could not run"; exit 1 ;;
  esac
fi
```

Distinguishing `3` is the one that pays off: it is the only code whose fix is on the tooling side
rather than in the repository.
