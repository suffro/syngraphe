# Changelog

All notable changes to the `syngraphe` npm package are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). From 1.0.0 the project follows
[Semantic Versioning](https://semver.org/); the
[compatibility policy](https://syngraphe.dev/reference/compatibility) states what that covers.

The GitHub Action is versioned separately, with `action-v*` tags. Its releases are listed on the
[GitHub releases page](https://github.com/suffro/syngraphe/releases).

Entries before 1.0.0 were reconstructed from the Git history and the published packages when this
file was started.

## [Unreleased]

### Added

- Managed bodies declare a body revision in their first line:
  `<!-- Managed by Syngraphe (revision 1). Do not edit this block manually. -->`. A block that
  declares a revision newer than the running Syngraphe knows is no longer reported as a manual edit:
  - `check` reports the new warnings `AGENT007` and `CLAUDE007`;
  - `init` leaves the block unchanged, because replacing it would be a downgrade.
- `CLAUDE.md` blocks written by earlier versions are recognised as outdated (`CLAUDE006`) and
  updated by `init`, as `AGENTS.md` blocks already were.
- Documentation:
  - a [compatibility and versioning](https://syngraphe.dev/reference/compatibility) policy;
  - a [programmatic API](https://syngraphe.dev/reference/api) reference listing every export of
    the package.
- The package includes this changelog.

### Changed

- The canonical `AGENTS.md` and `CLAUDE.md` bodies now carry the revision line. See the upgrade
  notes below.
- The Node.js support policy is now explicit. The floor stays at 22.18. Support for a Node.js major
  ends in a minor release after upstream end of life, announced one minor release ahead.

### Upgrading from 0.x

- Run `syngraphe init` once after upgrading. Until then `check` reports `AGENT006` and `CLAUDE006`
  warnings, and `init` changes only the text between the markers.
- Upgrade every Syngraphe that checks the repository at the same time, including CI jobs and the
  GitHub Action. A 0.4.x CLI, or an Action older than this release, reports `AGENT002` "modified
  manually" on blocks written by this version, because it predates body revisions.

## [0.4.1] - 2026-09-20

### Added

- `syngraphe init --policy` and `syngraphe policy add` seed an optional `AGENT-POLICY.md` at the
  repository root.
  - It is a seed, not a managed file: it is written once and never compared or checked afterwards.
  - `policy add` refuses to replace an existing file. `--force` replaces it.
- Managed blocks can be outdated. A block holding a body an earlier Syngraphe published is
  reported as the new warning `AGENT006` (or `CLAUDE006`) instead of as drift, and `init` updates it
  in place.

### Changed

- The `AGENTS.md` managed body gained a line pointing at `AGENT-POLICY.md`. The line is written
  whether or not the file exists. The next `init` rewrites existing blocks in place.

## [0.4.0] - 2026-09-14

### Added

- `syngraphe truth new` and `syngraphe truth list`. `truth` is now a document category alongside
  `decision`, `state` and `history`.
- `--dry-run --json` on `init`, the document `new` commands and `state archive`. It emits a stable,
  content-free plan JSON payload. `--json` without `--dry-run` is a usage error.

### Changed

- Patches are verified when they are published. The file is moved aside and compared before the new
  content is linked into place, so an edit made after the plan was built is kept and the run fails.
- Managed files are patched only when their bytes decode exactly as UTF-8. Otherwise `init`
  reports a conflict, and `check` reports `AGENT005` or `CLAUDE005`.
- `status` counts only regular Markdown files.
- A `.context/` without a declared protocol is treated as Syngraphe's only when its whole top level
  is the standard layout with at least one standard document.
- Parent directories are rechecked during staging, publication and cleanup. A detected directory
  swap stops the operation. This mitigates hostile directory swaps but does not eliminate them; see
  the safety model.

### Fixed

- `LINK001` compares letter case exactly on every platform. It also reports broken symlinked
  references and ones that resolve outside the repository.
- Markdown link destinations that contain parentheses are parsed correctly.

## [0.3.0] - 2026-09-12

### Fixed

- New files are created exclusively. Two concurrent runs creating the same file can no longer
  overwrite each other; the second run fails instead.

## [0.2.0] - 2026-09-10

### Added

- `syngraphe stats`, with `--json` and an advisory `--budget`. It reports bytes, words, estimated
  tokens, large documents and exact duplicates.
- `decision`, `state` and `history` commands with `new` and `list`, plus `state archive`, which
  copies current state into history before resetting it.
- `--scope` selects an independent context in a nested directory. `--all` on `status`, `check` and
  `stats` reports every discovered context. Scoped `AGENTS.md` blocks get their own body.

## [0.1.1] - 2026-09-09

### Added

- The manifest declares `"protocol": "repository-context"`. A manifest naming another protocol is
  treated as unrelated (`CTX003`).
- `MANIFEST005`, a warning for a manifest without a `protocol`.

### Changed

- `LINK001` treats inline code as prose. Only `.md` references are checked there, and directories
  are ignored.

## 0.1.0 - 2026-09-04

0.1.0 was published from a working tree whose sources were not yet committed. The registry records
`gitHead` `834bb9f`, and the sources arrived ten minutes later in `b7ed7f5`. No commit is exactly
this release.

### Added

- The first release: `syngraphe init` (with `--dry-run`), `syngraphe status`, and `syngraphe check`
  (with `--json` and `--strict`).
- The `.context/` schema v1 and its templates.
- Managed blocks in `AGENTS.md` and `CLAUDE.md`.
- The deterministic check registry, with codes `CTX001`–`CTX003`, `MANIFEST001`–`MANIFEST004`,
  `AGENT001`–`AGENT005`, `CLAUDE001`–`CLAUDE005`, `LINK001`, `STATE001` and `STATE002`.
- Exit codes `0`–`4`.
- The `syngraphe` and `syg` executables.

[Unreleased]: https://github.com/suffro/syngraphe/compare/032f990...HEAD
[0.4.1]: https://github.com/suffro/syngraphe/compare/f2f250f...032f990
[0.4.0]: https://github.com/suffro/syngraphe/compare/a3f71fe...f2f250f
[0.3.0]: https://github.com/suffro/syngraphe/compare/cb553e5...a3f71fe
[0.2.0]: https://github.com/suffro/syngraphe/compare/c278002...cb553e5
[0.1.1]: https://github.com/suffro/syngraphe/compare/b7ed7f5...c278002
