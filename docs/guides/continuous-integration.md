---
title: Continuous integration
description: Running syngraphe check in CI — exit codes, strict mode, JSON output, and what is worth failing a build over.
order: 4
---

# Continuous integration

`syngraphe check` is built for this: offline, deterministic, read-only, with stable exit codes and a
versioned JSON payload. No network access, no state, no cache.

## The minimal job

::: code-group

```yaml [GitHub Actions]
name: context
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          # Freshness compares commit dates, so the check needs real history.
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx syngraphe check
```

```yaml [GitLab CI]
context:
  image: node:22
  script:
    - npx syngraphe check
```

```bash [any runner]
npx syngraphe check
```

:::

Syngraphe does not ship a GitHub Action, and deliberately so: the command is one line, and a wrapper
would add a release surface without adding capability.

## `fetch-depth` matters

The freshness check (`STATE001`) compares the last commit that touched `.context/state/current.md`
with the repository's most recent commit. With a shallow clone, one or both of those dates may be
missing — in which case the check stays silent rather than guessing.

Silence is the safe failure here, but if you want freshness reported in CI, fetch full history.

## Choosing what fails the build

| Command                        | Fails on                            |
| ------------------------------ | ----------------------------------- |
| `syngraphe check`              | errors only                         |
| `syngraphe check --strict`     | errors **and** warnings             |

Errors are structural: a missing context file, a broken reference, a hand-edited managed block, an
invalid manifest. These are unambiguous, and failing on them is safe from day one.

Warnings are judgement calls: a stale state document, an empty one, an unknown layout, a Claude
integration that is missing while Claude is clearly in use. Turning them into failures with
`--strict` is a good habit *once the context is real* — enabling it on an empty context just teaches
the team to ignore a red build.

A reasonable progression: `check` on every push from day one, `check --strict` once
`state/current.md` has actual content.

## Exit codes

| Code | Meaning                              | Typical cause                                        |
| ---- | ------------------------------------ | ---------------------------------------------------- |
| `0`  | success                              | no errors (and no warnings under `--strict`)          |
| `1`  | context integrity failure            | at least one error finding                            |
| `2`  | invalid CLI usage                    | unknown flag, or not run inside a Git repository      |
| `3`  | unsupported Syngraphe context schema | the manifest declares a schema this build cannot read |
| `4`  | internal Syngraphe failure           | a bug — please report it                              |

Exit code 3 is worth handling separately in a pipeline: it means the repository's context is newer
than the Syngraphe running against it, so the fix is to upgrade the tool, not to change the
repository. See [exit codes](/reference/exit-codes).

## Machine-readable output

```bash
syngraphe check --json
```

```json
{
  "version": 1,
  "ok": false,
  "findings": [
    {
      "code": "LINK001",
      "severity": "error",
      "category": "references",
      "file": ".context/index.md",
      "line": 12,
      "message": "Referenced path does not exist: truth/gone.md"
    }
  ]
}
```

`ok` reflects the outcome of the run, so it respects `--strict`. `version` describes the payload
shape and changes only when the shape does. Full description in
[JSON output](/reference/json-output).

Useful shapes:

```bash
# Fail the job only on a specific code, and report the rest.
syngraphe check --json | jq -e '[.findings[] | select(.code == "AGENT002")] | length == 0'

# Turn findings into GitHub Actions annotations.
syngraphe check --json | jq -r '
  .findings[]
  | "::\(if .severity == "error" then "error" else "warning" end) file=\(.file // ""),line=\(.line // 1)::\(.code) \(.message)"
'
```

Because the codes are stable, a check that is not yet actionable in your repository can be excluded
by code rather than by turning the whole command off.

## Pre-commit and local hooks

Syngraphe installs no hooks and never will — a tool that writes into `.git/hooks` on install is a
tool that surprises people. If you want one, add it yourself:

```bash
# .git/hooks/pre-commit
npx syngraphe check || exit 1
```

Or via your existing hook manager. The command is the same everywhere.

## Reviewing the context in pull requests

The most valuable place to enforce this is not CI but review. `.context/` shows up in the diff like
any other file, so a pull request that changes the architecture and leaves
`truth/architecture.md` untouched is visible without any tooling at all.

CI catches the structural failures; review catches the semantic ones. Syngraphe is honest about
which of the two it can do.
