---
title: Nested contexts and monorepos
description: Keep shared repository knowledge at the root and package-specific context beside the code it describes.
order: 6
---

# Nested contexts and monorepos

Use the root context for architecture, conventions and decisions shared by the repository. Give a
package its own context when it has enough independent knowledge and ongoing work to justify one.
Each context uses the same schema v1; there is no workspace manifest to keep in sync.

For existing package directories:

```bash
syngraphe init
syngraphe init --scope packages/api --dry-run
syngraphe init --scope packages/api
syngraphe init --scope packages/web

syngraphe decision new database_choice --scope packages/api
syngraphe check --scope packages/api
syngraphe stats --scope packages/api
syngraphe status --all
syngraphe check --all --strict
syngraphe stats --all --json
```

`--scope` always names an existing directory **relative to the Git root**, even when the command is
launched from a package subdirectory. Without it, the root context is selected as before. There is
no implicit nearest-context lookup. `init` writes only inside its selected scope, including the
local `AGENTS.md` and Claude import shim; it never initializes parent or sibling contexts.

A nested context can exist without a root context. Adding a root context is useful when knowledge
is shared, but is not a requirement for package checks.

## Shared and local knowledge

The scoped `AGENTS.md` block explicitly tells readers that paths are relative to its directory, to
read ancestor context as well, and to select the same directory with `--scope` when checking.
The root bootstrap remains unchanged. Syngraphe validates the local bootstrap and context; it does
not merge Markdown, resolve conflicting prose, or enforce how an editor loads inherited agent files.

Write shared rules once at the root and keep local details in the package. Link from the local index
to relevant parent documents when the relationship should be explicit. Markdown links resolve
relative to their document and may reach parent or sibling context **inside the same Git tree**.
Inline-code document references try document-relative, scope-relative, local-context-relative and
then Git-root-relative paths. References cannot escape the Git tree.

Freshness uses commits affecting the selected scope. An unrelated sibling change does not make
package state stale. Root checks do not recursively check other scopes; use `--all` for that.

## What `--all` discovers

`status`, `check` and `stats` accept `--all`, mutually exclusive with `--scope`. They report contexts
in deterministic Git-relative path order, with `.` identifying the root.

Discovery uses Git's tracked files and untracked files not excluded by standard ignore rules.
A `.context` path visible there identifies its containing scope; the actual directory and context
are then inspected. The root `.context` is also inspected directly. This includes incomplete or
foreign `.context` directories so they are reported rather than silently skipped.

Ignored untracked contexts, empty nested directories, and nested Git repositories/submodules are
not traversed. Use `--scope` for an ignored or empty context; run Syngraphe inside a separate Git
repository to operate on it. Deleted tracked scopes are omitted. If nothing is discovered, the
root is reported as uninitialized instead of returning an empty success.

All-scope checks fail if any scope fails. Unsupported schemas take precedence (exit `3`); otherwise
integrity errors and strict warnings produce exit `1`. Status remains informational. Stats reports
separate totals for each scope, without merging documents or double-counting nested contexts.
The JSON envelope is documented in [JSON output](/reference/json-output).

## Boundaries

Scopes cannot escape the Git root, pass through symlinks, point inside `.context` or `.git`, or
belong to a different Git repository. Plans retain scope-relative paths and writes recheck every
ancestor from the Git root before applying. A context's files and metadata stay in its own scope;
no package-manager dependency or workspace configuration is needed.
