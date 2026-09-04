---
title: JSON output
description: The shape of syngraphe check --json, field by field, and what is guaranteed about it.
order: 5
---

# JSON output

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
    },
    {
      "code": "STATE002",
      "severity": "warning",
      "category": "state",
      "file": ".context/state/current.md",
      "message": "Current state contains only headings.",
      "details": "Describe the current focus so the file is useful to humans and agents."
    }
  ]
}
```

The payload is printed to standard output and nothing else is, so it can be piped directly into
`jq` without filtering.

## Top level

| Field      | Type    | Meaning                                                                 |
| ---------- | ------- | ----------------------------------------------------------------------- |
| `version`  | number  | The shape of this payload. Currently `1`.                               |
| `ok`       | boolean | Whether the run succeeded — `true` exactly when the exit code is `0`.    |
| `findings` | array   | Every finding, in the order the checks produced them.                   |

`ok` respects `--strict`: the same repository with the same findings reports `ok: true` under a
default run and `ok: false` under `--strict`, because `ok` describes the outcome of the run, not an
abstract verdict on the repository. Read `severity` if you want the verdict independent of flags.

## A finding

| Field      | Type   | Always present | Meaning                                                        |
| ---------- | ------ | -------------- | -------------------------------------------------------------- |
| `code`     | string | yes            | The stable identifier, e.g. `LINK001`. See [checks](/reference/checks). |
| `severity` | string | yes            | `error`, `warning` or `info`.                                  |
| `category` | string | yes            | `manifest`, `structure`, `references`, `agents` or `state`.    |
| `file`     | string | no             | Repository-relative path the finding is about.                 |
| `line`     | number | no             | 1-based line, when the finding points at one.                  |
| `message`  | string | yes            | One sentence stating the problem.                              |
| `details`  | string | no             | Additional context or the suggested fix.                       |

Optional fields are **omitted**, never `null`. Key order is stable in the emitted JSON, though no
consumer should depend on it.

## Stability

- `version` changes only when the payload shape changes. New optional fields are additive and do not
  bump it; a removed or re-typed field would.
- Codes are never renumbered or reused for a different meaning. A code may stop being emitted; it
  will never come back meaning something else.
- `message` and `details` are human-readable text and may be reworded. Match on `code`, never on
  message text.

## Recipes

```bash
# Errors only.
syngraphe check --json | jq '[.findings[] | select(.severity == "error")]'

# Fail on a specific code, ignore the rest.
syngraphe check --json | jq -e '[.findings[] | select(.code == "AGENT002")] | length == 0'

# Group by category.
syngraphe check --json | jq 'group_by(.category) | map({(.[0].category): length}) | add'

# GitHub Actions annotations.
syngraphe check --json | jq -r '
  .findings[]
  | "::\(if .severity == "error" then "error" else "warning" end) file=\(.file // ""),line=\(.line // 1)::\(.code) \(.message)"
'
```

Because the codes are stable, excluding a check that is not yet actionable in your repository is a
filter on one code rather than a reason to stop running the command.

## Exit code and payload together

The payload never replaces the exit code; it explains it.

| Exit | Payload                                                            |
| ---- | ------------------------------------------------------------------ |
| `0`  | `ok: true`. Findings may still be present as warnings.             |
| `1`  | `ok: false`, with at least one error — or a warning under `--strict`. |
| `3`  | `ok: false`, including a `MANIFEST003` finding.                    |
| `2`  | No payload: the command never ran. The message goes to stderr.     |

## Programmatic alternative

If you are already in Node, skip the parsing:

```ts
import { Repository, createCheckContext, runChecks } from "syngraphe";

const repository = await Repository.open(process.cwd());
const run = await runChecks(await createCheckContext(repository));

console.log(run.errors, run.warnings, run.findings);
```

`runChecks` returns the same findings, plus the per-check results the human renderer uses.
