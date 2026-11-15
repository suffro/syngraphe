# Managed bodies declare a revision

## Context

`SUPERSEDED_AGENTS_BODIES` lets a build recognise every body published before it. It cannot
recognise bodies published after it. When 0.4.1 added the `AGENT-POLICY.md` line, the published
Action (`action-v1`, built from 0.3-era core) reported every repository initialized by 0.4.1 as
`AGENT002` "modified manually" and failed the job. This was reproduced on 2026-11-15 by running that
bundle against a fixture repository. After 1.0 every canonical body change would repeat this for
anyone pinned to an older CLI or Action, and the message would be false: nobody edited anything.

## Decision

Every canonical body declares `MANAGED_BODY_REVISION` in its notice line:

```md
<!-- Managed by Syngraphe (revision 1). Do not edit this block manually. -->
```

The revision is global and is bumped whenever any canonical body changes. The previous bodies are
appended to `SUPERSEDED_AGENTS_BODIES` or `SUPERSEDED_CLAUDE_BODIES` in the same change.

A block whose body would be drift, but declares a revision higher than the build knows, is
`newer`:

- `check` reports `AGENT007` or `CLAUDE007` as a warning;
- `init` plans it as unchanged and never downgrades it.

The detection is injected into `inspectManagedFile` as a predicate, so `src/managed/` still knows
nothing about the notice format. `src/templates/agents.ts` owns that format.

Revision 1 is the first revision ever declared. All bodies from 0.1.0 to 0.4.1 declare none. They
keep the old notice verbatim through `UNREVISIONED_NOTICE`, and `test/managed-revision.test.ts` pins
them as literals read from the published npm tarballs.

## Alternatives considered

- **An attribute on the start marker.** Released parsers match the marker exactly, so a block
  carrying `revision="…"` would read as an orphan end marker (`AGENT004`) to every one of them.
- **Bumping the marker `version`.** That attribute means the block format. An unknown value is a
  conflict (`AGENT005`), which is an error, and it would conflate format with wording.
- **A stored content hash.** It was rejected earlier as diff noise; see the managed-blocks
  reference.
- **Only a better drift message plus a release-train rule.** It is cheaper, but pinned users would
  still get an error, and the message could only guess between an edit and version skew.

## Consequences

- Adding the revision is itself a body change. CLI 0.4.x and Action ≤ v1.1 report `AGENT002` on
  blocks written by 1.0, so the Action must be released from the same commit as the CLI, and the
  changelog carries an upgrade note.
- Existing `CLAUDE.md` blocks become `outdated` (`CLAUDE006`) once, until `init` runs.
- Raising the number by hand makes an edited block read as newer. That takes a deliberate edit, so
  it is documented rather than prevented.
