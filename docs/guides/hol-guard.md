---
title: HOL Guard integration
description: Enable HOL Guard's Syngraphe extension and review context changes while keeping inspections and dry runs automatic.
order: 7
---

# HOL Guard integration

<div class="syg-integration-catalog">
  <a
    class="syg-integration-badge"
    href="https://hol.org/guard/extensions/command.syngraphe"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="View the Syngraphe extension in HOL Guard's official catalog (opens in a new tab)."
  >
    <img class="syg-integration-badge__logo" src="/static/png/hol-guard-mark.png" alt="" width="28" height="28" />
    <span class="syg-integration-badge__text">
      <span class="syg-integration-badge__name">HOL Guard</span>
      <span class="syg-integration-badge__caption">Official extension listing</span>
    </span>
    <svg class="syg-integration-badge__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  </a>
</div>

Syngraphe gives coding agents shared repository context. [HOL Guard](https://hol.org/guard)
reviews agent actions before they run. Its `command.syngraphe` extension recognizes context
changes made through both `syngraphe` and `syg`, so you can inspect a plan before an agent applies it.

The extension ships with HOL Guard and was included in
[HOL Guard 3.17.2](https://hol.org/guard/releases/v3.17.2). It is an **External opt-in** extension:
installing Guard does not activate it. A local administrator must enable it on the device.

## Install and connect Guard to your agent

Install Syngraphe using the [installation guide](/getting-started/installation). For direct CLI
use, a global installation provides both executable names:

```bash
npm install -g syngraphe
```

HOL Guard's [installation instructions](https://github.com/hashgraph-online/hol-guard#install-hol-guard)
offer a Python installation through `pipx`, requiring Python 3.10 or newer:

```bash
pipx install hol-guard
hol-guard init
```

Follow the first-run wizard to configure protection for the coding agent you use. The wizard asks
before making setup changes. Check the installation and inspect the shipped extension:

```bash
hol-guard --version
hol-guard status
hol-guard command extensions command.syngraphe --json
```

For an existing installation, use `hol-guard update` if the extension is unavailable.

Guard must be connected to the agent's execution path. For example, HOL Guard documents this
explicit Codex setup:

```bash
hol-guard install codex
hol-guard run codex --dry-run
hol-guard run codex
```

After configuring Codex, diagnose its integration:

```bash
hol-guard doctor codex
```

Use the [agent support matrix](https://github.com/hashgraph-online/hol-guard/blob/main/docs/guard/harness-support.md)
for your agent's integration and coverage. Protection applies at the execution points that
integration supports; installing Guard alone does not intercept every command in an ordinary terminal.

## Enable the Syngraphe extension

In Guard's local dashboard, open **Modules → Protection Center** and locate
**Syngraphe repository context protection** (`command.syngraphe`). Use its **Change settings**
flow to enable the external extension on this device and complete the local approval step.
Keep the covered operations at their recommended review treatment.

Inspect the module and its effective permission settings from the CLI:

```bash
hol-guard command controls show command.syngraphe
hol-guard command controls patterns --tool command.syngraphe
```

The extension catalog describes shipped coverage; the controls describe the device's effective
settings. See Guard's
[Local Extensions and protection settings](https://github.com/hashgraph-online/hol-guard/blob/main/docs/guard/managed-controls-local-extensions.md)
for the settings and approval flow.

## What gets reviewed

With the extension enabled and its recommended settings, these operations contribute a review
requirement:

| Operation | Examples | Repository effect |
| --- | --- | --- |
| Initialize context | `syngraphe init`, `syngraphe init --policy` | Creates context and agent bootstrap files, updates an older managed body, and optionally creates `AGENT-POLICY.md`. |
| Create an agent policy | `syngraphe policy add`, `syngraphe policy add --force` | Creates the root policy file; `--force` replaces an existing one. |
| Create a context document | `syngraphe truth new domain-model`, `syg decision new use-postgres`, `syngraphe state new migration`, `syngraphe history new release-notes` | Writes a document in the selected context. |
| Archive current state | `syngraphe state archive phase-one` | Creates a history document and resets the selected context's `state/current.md`. |

Read-only commands such as `status`, `check`, `stats`, document `list` commands, help and version
queries do not trigger these mutation rules. A valid `--dry-run` is the safe counterpart of each
covered mutation, including `init --policy` and `policy add --force`.

`--scope <path>` selects an existing Git-root-relative directory and keeps the same classification
for commands that support it. `policy add` always targets the Git root and rejects `--scope`.
See the [CLI reference](/reference/cli) for valid flags and arguments.

These are the extension's classifications. Guard retains the final decision: another matching
rule, device setting or managed restriction can still require review or block the command.
A dry run in one segment does not clear other actions in a compound shell command.
The coverage is defined in HOL Guard's
[canonical Syngraphe extension source](https://github.com/hashgraph-online/hol-guard/blob/main/contributions/command-sources/command.syngraphe.json).

## Inspect, then apply

From a Git working tree where Syngraphe has already been initialized (`syngraphe init`), ask the
protected agent to preview the change first:

```bash
syngraphe decision new use-postgres --title "Use PostgreSQL" --dry-run --json
```

Syngraphe runs the same planner as the real operation and changes neither repository contents nor
Git state. `--json` renders a content-free plan; on mutating commands it requires `--dry-run`.
It does not make a real write automatic on its own.

Read the plan, then ask the agent to apply the same change:

```bash
syngraphe decision new use-postgres --title "Use PostgreSQL"
```

Guard evaluates the real mutation and routes it through review according to the active policy.
Resolve the request through the agent's supported approval interface or Guard's local approval
center. Once applied, check the repository context:

```bash
syngraphe check
```

To inspect Guard's decision separately, use its explanation command:

```bash
hol-guard command explain 'syngraphe decision new use-postgres --dry-run --json'
hol-guard command explain 'syngraphe decision new use-postgres'
```

These commands evaluate the supplied command text without executing it or creating an approval.
If a mutation receives no Syngraphe review, check the installed catalog, the local opt-in setting,
and the agent integration. For other decisions, inspect the matching rules and effective settings.
See [HOL Guard's command inspection guidance](https://github.com/hashgraph-online/hol-guard#understand-a-paused-command).
