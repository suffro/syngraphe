---
title: Compatibility and versioning
description: What the semver promise covers from 1.0.0, how checks may evolve, and what is not covered.
order: 9
---

# Compatibility and versioning

Syngraphe follows [Semantic Versioning](https://semver.org/) from 1.0.0. Only a major release may
break a contract on this page. A minor release adds things, and a patch release fixes them. Releases
before 1.0.0 made no such promise, but 1.0.0 still recognises everything they wrote.

## What is covered

**Commands.** Command names, flags and what they mean, and both executable names, `syngraphe` and
`syg`.

**Exit codes.** `0` to `4` never change meaning. See [exit codes](/reference/exit-codes).

**Finding codes.**

- Codes are never renumbered or reused.
- A code may stop being emitted. It never comes back meaning something else.
- Severities are covered too; see [how checks evolve](#how-checks-evolve).

**JSON output.**

- Each payload carries its own `version`; see [JSON output](/reference/json-output).
- New optional fields are added without a version bump.
- Removing or retyping a field bumps that payload's version, and that only happens in a major
  release.

**The context schema.**

- Schema v1 and its manifest fields are covered.
- A context written by any 1.x release is valid for every later 1.x release.
- A new schema version arrives only in a major release.

**Managed blocks.**

- The marker format, `version="1"`, is covered.
- Every 1.x release recognises every body an earlier release wrote, and reports it as outdated
  (`AGENT006`, `CLAUDE006`) instead of as an edit.
- A canonical body may change in a minor release. Each change raises the
  [body revision](/reference/managed-blocks#body-revisions), so an older 1.x build reports the new
  body as `AGENT007` or `CLAUDE007`, a warning, until it is upgraded.

**The programmatic API.**

- Every export listed in the [programmatic API](/reference/api) is covered, with its documented
  signature.
- Removing an export, or changing a signature incompatibly, is a major release.
- New exports, optional parameters and optional fields are minor.
- Adding a member to a status or kind union the API returns is also minor. Code that switches over
  one should keep a default branch.
- Only the package entry point is public. Its `exports` map blocks deep imports.

**Node.js.**

- The supported range is the `engines` field of the package, currently Node.js 22.18 or newer.
- Support for a Node.js major ends in a minor release after that major reaches upstream end of life.
  The changelog announces it at least one minor release ahead.
- Node.js 22 reaches upstream end of life on 30 April 2027.

## How checks evolve

The checks are what CI fails on, so their evolution has its own rules:

- A new check or a new finding code arrives in a minor release only as a **warning**.
- Adding a new error, or promoting a warning to an error, is a **major** release.
- Fixing a check so it does what its documentation says is a fix, in a patch or minor release. Such a
  fix can make a repository that used to pass report a real problem, so the changelog calls out every
  one of them.
- The `message` and `details` text may be reworded in any release. Match on `code`.

## What is not covered

- **Human-readable output.** That covers terminal text, plan rendering, job summaries and finding
  messages.
- **Advisory defaults.** The 8,000 estimated-token budget and the 2,000-token large-document
  threshold are advisory. A minor release may change them, with a changelog entry. The statistics
  payload always states the estimate it used.
- **Seeded content.** What `init`, `policy add` and the document commands write into new files can
  improve in any release. Existing files are never rewritten, apart from the text between managed
  markers.
- **Anything not exported** from the package entry point.

## The GitHub Action

The Action has its own versions: `action-vMAJOR.MINOR.PATCH`, plus an `action-vMAJOR` tag that moves
to each compatible release.

- Its major version covers its inputs, outputs and report file.
- Its findings follow the CLI rules above, because it bundles the same core.
- Every CLI release that changes core behaviour ships an Action release from the same commit, so
  `action-v1` does not lag behind the CLI. A workflow pinned to an exact tag or commit keeps its old
  core, and reports `AGENT007` once the CLI writes a newer body.

Keep the Syngraphe that checks a repository at least as new as the one that writes it, both locally
and in CI. A newer checker understands everything an older writer produced. The reverse holds only
as far as the warnings above.
