# AGENTS.md

Operational instructions for AI coding agents working in this repository.
Read this before implementing anything.

Before planning a multi-step or expensive task, or before delegating to subagents, read
`AGENT-POLICY.md`.

---

## Project context

Before changing code, establish what this repository actually is from tracked sources such as:

- `README*` and contributor documentation;
- package or build manifests;
- architecture and design documents;
- CI configuration;
- existing tests and nearby implementation code.

Do not invent missing architecture, commands, terminology, or guarantees. When documentation and
code disagree, investigate the mismatch instead of silently choosing one.

## Hard rules

1. **Preserve existing contracts.** Public APIs, file formats, wire formats, schemas, CLI behaviour,
   generated artefacts and compatibility guarantees must not change accidentally.
2. **Follow the repository's architecture.** Extend existing patterns before introducing parallel
   abstractions, duplicate implementations, new dependency systems, or alternate execution paths.
3. **Do not weaken validation to make a task pass.** A failing guard is evidence to understand, not
   an obstacle to remove.
4. **Keep changes scoped.** Do not refactor unrelated code, rename unrelated concepts, or clean up
   nearby files unless the task requires it.
5. **Respect determinism where the repository relies on it.** Avoid timestamps, randomness,
   unstable iteration order, environment-dependent output, or other per-run variation unless the
   design explicitly requires it.
6. **Preserve provenance.** Never fabricate versions, revisions, build metadata, test results, or
   generated state.
7. **Verify, never trust.** Inputs crossing a trust boundary should be validated using the checks the
   project already defines: hashes, signatures, schemas, size limits, path safety, type checks, or
   equivalent mechanisms.

## Safety

Treat destructive, public, expensive, credential-related, or irreversible actions as consequential.

- Read back the exact command, arguments and target before running it.
- Confirm the target is the intended repository, branch, directory, registry, environment or
  account.
- Verify the result immediately afterwards.
- Ask before an irreversible action unless the user explicitly requested that exact action in the
  current session.
- Never expose, print, log, commit or transmit secrets, private keys, access tokens or credentials.
- Do not bypass a safety check merely because it blocks progress.

Typical consequential actions include publishing, pushing release tags, force-pushing, rewriting
history, deleting data recursively, rotating credentials, modifying production resources, and any
action that spends the user's money.

## Repository continuity

- **Durable project knowledge belongs in tracked repository documentation.** Agent-local memory is a
  convenience, not the sole source for information another contributor needs to continue the work.
- Update relevant documentation when behaviour, architecture, commands, public interfaces or user
  expectations change.
- Keep changelogs or release notes consistent with the repository's existing process.
- When generated files mirror canonical sources, edit the canonical source and regenerate the copy.
  Do not hand-edit generated output unless the repository explicitly says to.

## Naming and terminology

- Reuse the repository's established vocabulary exactly where it has semantic meaning.
- Do not introduce synonyms for core concepts without a reason.
- Treat identifier casing, filenames, command names, schema keys and wire strings as functional when
  they are part of a contract.
- Never perform broad mechanical renames without reading each affected class of occurrence first.

## Architecture rules

- Identify the canonical source of truth before editing duplicated or generated structures.
- Prefer one contract with multiple verified implementations over multiple independent definitions.
- Preserve existing dependency-injection, process, filesystem, network and test seams.
- Keep CLI or UI layers thin when the repository already separates interaction from domain logic.
- Prefer existing standard-library or repository utilities before adding dependencies or parallel
  helpers.
- Avoid new dependencies unless they provide clear value and fit the repository's dependency policy.
- Preserve trust ordering: validation should happen before execution, mutation, publication or other
  consequential use of external input.

## Repository layout

Do not assume a universal layout. Inspect the repository and identify at least:

- implementation/source directories;
- tests and fixtures;
- generated files and their generators;
- scripts and developer tooling;
- documentation;
- build output and cache directories;
- package manifests and lockfiles;
- configuration and CI files.

When the layout changes materially, update this file if future agents would otherwise be misled.

## Conventions

Match the surrounding repository unless this file or the user explicitly says otherwise.

- **Language:** follow the language used by code comments, developer documentation and user-facing
  output in the repository.
- **Comments:** explain non-obvious decisions and rejected alternatives; do not generate commentary
  noise.
- **DRY:** reuse existing helpers and abstractions before creating another implementation.
- **Errors:** follow the project's established error and exit conventions.
- **Formatting:** use the configured formatter and linter rather than hand-formatting around them.
- **Commits:** follow the repository's commit conventions; do not add AI/tool attribution unless the
  repository explicitly requires it.

## Build / test / run

Discover commands from the repository itself instead of guessing them. Check the relevant manifest,
contributor guide, task runner, Makefile, CI workflow or package scripts.

Use the smallest verification ladder that can provide meaningful evidence:

1. Run focused tests for the code being changed when available.
2. Run the main unit/integration suite for significant changes.
3. Run formatter, linter, static analysis or type checks when the affected code is covered by them.
4. Regenerate derived files when their canonical source changes, then verify there is no drift.
5. Build documentation when documentation or public API references change.
6. Validate package/distribution contents when packaging metadata or exported surfaces change.
7. Run cross-language or cross-component conformance checks when one contract has several
   implementations.
8. Treat network-heavy, large, production-like or costly builds as expensive actions; do not trigger
   them casually.

If a documented command no longer exists, read the current configuration, use the command the
repository now defines, and update stale documentation when appropriate.

## Cross-platform and environment-sensitive paths

When code touches filesystem layout, subprocesses, packaging, native binaries, path handling,
permissions or environment discovery, consider every platform and environment the repository claims
to support.

Tests running on one host may not cover:

- path separators and executable layout;
- case sensitivity;
- shell differences;
- permissions and symlink behaviour;
- architecture-specific or accelerator-specific paths;
- local-vs-CI configuration;
- installed-vs-bundled toolchains;
- online-vs-offline execution.

Where a target cannot be executed locally, inspect the affected path explicitly and state what could
not be verified.

## Testing conventions

- **Exercise behaviour, not only imports.** A module loading successfully does not prove its main path
  works.
- Prefer tests that assert observable guarantees over implementation details.
- **Prove a new guard can fail.** When practical, break what it protects, observe the expected failure,
  then restore the valid state.
- Keep tests isolated: do not let them unexpectedly reach the network, external services, user data,
  or directories outside their temporary workspace.
- Add regression coverage for defects when the failure mode can reasonably be reproduced.
- Never report a test as passing unless it was actually run and its result observed.

## Boundaries — do not touch casually

Unless the task explicitly requires it, avoid modifying:

- generated files instead of their canonical sources;
- vendored or mirrored artefacts;
- golden fixtures or wire-format snapshots;
- lockfiles when dependencies are not changing;
- secrets, credentials, signing material or private configuration;
- build output, caches and temporary state;
- unrelated release metadata;
- compatibility shims or frozen identifiers whose purpose is unclear.

If a suspicious value looks obsolete but may be part of a compatibility contract, investigate before
"cleaning" it.
