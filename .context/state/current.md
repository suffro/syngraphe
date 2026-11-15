# Current State

## Current focus

Syngraphe 1.0.0 is released, and the [compatibility policy](../../docs/reference/compatibility.md)
now applies to every change. No feature work is in progress.

- npm: `latest` is 1.0.0, published with provenance through `release.yml`. `next` still points at
  `1.0.0-rc.1`.
- Action: `action-v1.2.0` was built from the same commit as 1.0.0 (`91daa2b`), and `action-v1`
  points there.

How it was planned, decided, verified and released is recorded in `history/release-1-0.md`. The
procedure for the next release is `truth/releasing.md`.

## Recent relevant changes

- 1.0.0 on 2026-11-15:
  - managed bodies declare a revision (`AGENT007`/`CLAUDE007` for newer blocks; see decision 0009);
  - API and compatibility reference pages;
  - a Node 22.18.0 CI job;
  - trusted publishing;
  - `CHANGELOG.md`.
- `action-v1.1.0` and `action-v1.2.0` were released on 2026-11-15. The first fixed the
  `AGENT002` that the 1.0.0 Action reported on repositories initialized by CLI 0.4.1.
- The state before the 1.0 work is preserved in `history/pre-1-0-state.md`.

## Next

- Maintainer: tick Marketplace publication in the GitHub release editor for `action-v1.2.0`. There
  is no API for it, and it was never done for `action-v1.0.0` or `action-v1.1.0` either.
- Maintainer, optional: `npm dist-tag add syngraphe@1.0.0 next`, so `next` is not older than
  `latest`.
- The maintainer's repositories that already use Syngraphe still carry 0.x blocks. They report
  `AGENT006`/`CLAUDE006` warnings until `syngraphe init` runs with 1.0.0 and the result is committed.
- Still open: request re-indexing of the docs home page in Search Console so Google refreshes its
  cached favicon.
- Later candidates, none started: `doctor`, `update`, `reconcile`, per-check suppression, explicit
  destructive removal. Under the compatibility policy, each new check arrives as a warning.

## Blockers

None.
