# Current State

## Current focus

Releasing 1.0.0. The plan, the maintainer's decisions (D1–D5) and per-phase progress are in
`state/release-1-0.md`. The CLI is at 0.4.1 on npm. The Action is at `action-v1.1.0`, released on
2026-11-15, and `action-v1` was moved to the same commit, `c5d5b2f`.

## Recent relevant changes

- The state as it stood before the 1.0 work is preserved in `history/pre-1-0-state.md`.
- The two finished task briefs moved from `state/` to `history/`: the truth commands and plan JSON
  brief, and the HOL Guard extension brief.
- Verified on 2026-11-15:
  - hosted CI passes on Ubuntu, macOS and Windows for `c5d5b2f`;
  - `syngraphe.dev` serves the docs and `/favicon.ico`.
- Verified on 2026-11-15 by running the bundles locally against fixture repositories:
  - the published `action-v1` bundle reports `AGENT002` on any repository initialized by CLI 0.4.1;
  - the bundle at `c5d5b2f` does not.
  Phase 1 fixed it. The bundle read back from the moved `action-v1` tag passes the 0.4.1 fixture
  (exit 0).
- 1.0 work in the working tree, uncommitted (see the plan for the full list):
  - managed body revisions with `AGENT007`/`CLAUDE007`
    (`decisions/0009-managed-bodies-declare-a-revision.md`);
  - API and compatibility reference pages, with a test that keeps the API page equal to the exports;
  - a Node 22.18.0 CI job;
  - `prepack` and `package:check`;
  - `CHANGELOG.md`;
  - the trusted-publishing release workflow and `truth/releasing.md`.
  This repository's own `AGENTS.md` and `CLAUDE.md` blocks are already at body revision 1.

## Next

- Maintainer: tick Marketplace publication in the GitHub release editor for `action-v1.1.0`. It
  has no API, and it is still pending for `action-v1.0.0` too.
- Commit the 1.0 work once the maintainer asks, and confirm the new CI jobs pass on hosted runners.
- Maintainer: configure the npm trusted publisher (see `truth/releasing.md`) before the rc tag.
- Phase 5: `1.0.0-rc.1`, trying it on repositories the maintainer chooses, then 1.0.0 together with
  `action-v1.2.0`.
- Still open from before: request re-indexing of the docs home page in Search Console so Google
  refreshes its cached favicon.
- Later candidates, none started: `doctor`, `update`, `reconcile`, per-check suppression, explicit
  destructive removal.

## Blockers

None. Tags, publishing and releases wait for explicit approval.
