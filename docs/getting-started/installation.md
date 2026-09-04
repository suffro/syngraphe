---
title: Installation
description: Requirements, install options, and how to verify that Syngraphe runs.
order: 3
---

# Installation

## Requirements

| Requirement | Version    | Why                                                                 |
| ----------- | ---------- | ------------------------------------------------------------------- |
| Node.js     | ≥ 22.18    | The CLI is ESM and uses modern Node built-ins.                      |
| Git         | any recent | Used to locate the repository root and to read commit dates.        |

Syngraphe runs on macOS, Linux and Windows. It makes no network calls at runtime.

## Install

::: code-group

```bash [global]
npm install -g syngraphe
```

```bash [one-off]
npx syngraphe status
```

```bash [project dev dependency]
npm install --save-dev syngraphe
```

:::

A project-local install is worth considering if you want CI and every contributor to run the same
version: the binary is then available as `npx syngraphe` inside the project without a global
install.

## The `syg` shorthand

Installing provides two command names for the same executable: `syngraphe` and the shorter `syg`.

```bash
syg init
syg check
```

They are interchangeable. The documentation uses `syngraphe` throughout, because that is the name
the tool is published and referred to under.

## Verify

```bash
syngraphe --version
syngraphe --help
```

`--help` lists the three commands and their flags:

```text
Usage: syngraphe [options] [command]

Keeps repository context versioned, current, and understandable by both humans
and coding agents.

Options:
  -v, --version    output the version number
  -h, --help       display help for command

Commands:
  init [options]   Create the repository context and the agent bootstrap files.
  status           Summarize the repository context. Read-only and offline.
  check [options]  Run the deterministic context integrity checks.
  help [command]   display help for command
```

## Where it may be run

Every command must run inside a Git working tree. Syngraphe locates the repository root with
`git rev-parse --show-toplevel` and refuses to run outside one:

```text
Not inside a Git repository.
Syngraphe stores repository context in the repository itself, so it must run inside a Git working tree.
```

That is [exit code 2](/reference/exit-codes). Commands can be run from any subdirectory: paths are
always resolved against the repository root, never against the working directory.

## What it will and will not touch

Syngraphe writes only inside the Git root, only complete files, and never through a symlink. On a
first run in a repository, that means `.context/`, `AGENTS.md` and `CLAUDE.md` — and nothing else.
See the [safety model](/concepts/safety-model) for the guarantees in full.

## Next

- [Quickstart](/getting-started/quickstart) — a first run, start to finish.
