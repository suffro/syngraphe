# Release 1.0.0 plan

## Status

Proposed on 2026-11-15 against `main` at `c5d5b2f` and approved the same day. Decisions taken by
the maintainer:

- D1: Option B, a declared body revision.
- D2: **not** the recommendation. The code is the source of truth: exports stay as they are and the
  docs are brought to match them (see the D2 section and Phase 2.2).
- D3, D4, D5: as recommended. The repositories for the rc are chosen at Phase 5.

Every ⚠ step still waits for its own explicit approval.

## Outcome

**Released on 2026-11-15.** This plan is complete and archived. Commits on `main`, in order:

| Commit | Content |
| --- | --- |
| `5f48eb9` | body revisions |
| `7bf233e` | release pipeline and changelog |
| `c7c3264` | API and compatibility docs |
| `19b7804` | state archive |
| `f4cfbb8` | `1.0.0-rc.1` |
| `91daa2b` | `1.0.0` |

- `action-v1.1.0` was released at `c5d5b2f`, then `action-v1.2.0` at `91daa2b`. `action-v1` follows
  the latter.
- npm `1.0.0-rc.1` (`next`) and `1.0.0` (`latest`) were both published by `release.yml` through
  trusted publishing.
  - Read back from the registry: `gitHead` equals the tagged commit, and SLSA v1 provenance is
    present.
  - `npm audit signatures` verified the registry signatures and the attestation.
  - The installed 1.0.0 reports this repository clean.
  - The registry needed a few minutes after each publish before it served the tarball.
- Hosted CI passed on all four jobs, including Node 22.18.0, for `19b7804`, `f4cfbb8` and `91daa2b`.
- **Release candidate.** The published rc was run against six of the maintainer's repositories
  already initialized with Syngraphe, using local clones with nothing pushed:
  - it added only the expected `AGENT006`/`CLAUDE006` warnings;
  - `init` changed only text between markers and was idempotent on a second run;
  - every check came back clean afterwards, except one pre-existing `STATE001`.
  - Skew behaved as documented:
    - CLI 0.4.1 and `action-v1.1.0` report `AGENT002` on 1.0-written blocks;
    - a revision-2 block gives `AGENT007` and `init` leaves it unchanged;
    - a 0.4.0 monorepo with a nested scope upgrades cleanly.
- Left to the maintainer:
  - Marketplace publication for the Action releases;
  - optionally pointing `next` at 1.0.0, since `npm dist-tag` needs a logged-in maintainer.

## Progress

The record kept while the work was in progress.

- **Phase 1:** done, except the Marketplace checkbox, which is the maintainer's.
  - Evidence: the bundle at `c5d5b2f` is clean on a 0.4.1 fixture, reports `AGENT006` (warning,
    exit 0) on a 0.4.0 fixture, and is clean on this repository. The old `action-v1` bundle
    reported `AGENT002` on the 0.4.1 fixture.
  - The annotated `action-v1.1.0` tag and its GitHub Release were published at `c5d5b2f`, which
    had green CI.
  - `action-v1` was force-moved there from `9b86b8b`. Read back with `git ls-remote`, its bundle
    passes the 0.4.1 fixture.
  - The exact-tag examples in the docs now name `action-v1.1.0`.
- **Phase 2:**
  - 2.1 is done. The new guards were observed failing first. The superseded-body literals were read
    from the npm tarballs of 0.1.0, 0.4.0 and 0.4.1, and a mutation of one entry made the test fail.
  - 2.2 is done. The API page was added, and the surface test caught a real gap (`inspectContext`
    was undocumented) before passing.
  - 2.3 is done. All 239 tests passed locally on Node 22.18.0, using the official binary with its
    SHA-256 checked.
  - 2.4 is done.
- **Phase 3:**
  - 3.1–3.4 are done. `package:check` handles both the array JSON of npm 10/11 and the object JSON
    of npm 12, and a missing `dist/` was observed failing it.
  - `repository.url` and `bugs.url` now use the GitHub login's spelling, `suffro`, because the npm
    provenance check compares the URL with the repository.
- **Phase 4:**
  - 4.1 is done. The README list already had `policy add`; the scope page did not. The "two Git
    commands" design decision was out of date, since there are three with `ls-files`, and is
    corrected.
  - 4.2 is done. Active context went from 21,250 to 15,604 estimated tokens. This plan, at about
    3,980, is the only `state/` document above 2,000 until 4.3. The HOL Guard brief was renamed to a
    lowercase stem when it moved.
- **Found along the way:** 0.1.0 was published before its sources were committed; its registry
  `gitHead` is `834bb9f`. The changelog says so, and no `v0.1.0` tag will be created.
- **Local verification:**
  - lint, typecheck and build are clean;
  - 244 tests pass;
  - `action:check` reports no drift;
  - `package:check` passes;
  - `docs:build` passes;
  - built `check --all` is clean.

  The hosted CI jobs, including the new Node 22.18.0 one, have not run yet.

1.0.0 adds no new features. It marks the point where the CLI, finding codes, exit codes, JSON shapes,
schema v1, the managed-block format and the documented programmatic API become a semver promise. The
work is to close the gaps in that promise (Phase 2), make releases reproducible (Phase 3), and leave
the repository coherent (Phase 4), then release through a candidate (Phase 5). Phase 1 fixes a
defect users can hit today and ships independently.

## Evidence

Collected on 2026-11-15; rerun anything that matters before acting on it.

- The released Action is broken for repositories initialized by CLI 0.4.1. The bundle at
  `action-v1` (`9b86b8b`) was run locally against this repository and reported `AGENT002` "The
  Syngraphe block in AGENTS.md was modified manually", exit 1. Its core predates the
  `AGENT-POLICY.md` line in the canonical body; the bundle on `main` already knows that body and
  `AGENT006`. Action sources (`action.yml`, `action/src/`, `scripts/`) are unchanged since the tag;
  24 core commits are not released in any Action. CI cannot see this because it runs `uses: ./`.
- Root cause: a checker older than the writer reports an unknown body as drift (error), and its
  `init` refuses to touch it. Every future canonical body change repeats this for anyone pinned to an
  older CLI or Action.
- `src/index.ts` exports about 50 symbols, including writers (`applyPlan`, the `Repository` write
  methods), the CLI's `run*` roots and `export *` of the context templates. Nothing in the repository
  imports it, so no test holds the surface. Programmatic use is documented in three reference pages:
  CLI commands, JSON output and managed blocks.
- `engines` declares Node `>=22.18.0`; CI runs Node 24 only. Node 22 reaches upstream end of life on
  2027-04-30.
- npm 0.1.0–0.4.1 were published by hand. There are no `v*` Git tags, no GitHub Releases and no
  changelog for the CLI; release-note items have accumulated under Next in `state/current.md`.
  `npm pack` without a prior build produces a three-file package, because `prepublishOnly` does not
  run on `pack`.
- `syngraphe stats`: 21,250 active estimated tokens against the 8,000 advisory budget. `state/`
  holds two finished briefs (adding-truth-commands, about 5,300 tokens; HOL-extension, about 2,900,
  which describes work in another repository). `state/current.md` says hosted CI is unconfirmed;
  the last eight runs passed on Ubuntu, macOS and Windows.
- "v0.1" wording remains in the README ("Scope of v0.1") and in the scope-and-non-goals,
  safety-model, design-decisions, troubleshooting and context-schema pages.

## Decisions needed

**D1 — Forward compatibility of managed bodies.**

- **Option B (recommended): a declared body revision.** Every canonical body states its revision in
  the notice line, for example
  `<!-- Managed by Syngraphe (revision 2). Do not edit this block manually. -->`. A body declaring a
  revision higher than the running build knows gets a new `newer` state: `check` reports new codes
  `AGENT007` / `CLAUDE007` as **warnings** ("written by a newer Syngraphe; upgrade to validate it"),
  and `init` leaves the block unchanged and never downgrades it. The marker line stays exactly as it
  is, because an extra attribute would make every released parser see an orphan end marker
  (`AGENT004`).
  - Cost: this is the last body change old checkers cannot recognise. CLI 0.4.x and Action ≤ v1.1
    will report `AGENT002` on blocks written by 1.0. The mitigation is an Action release from the
    same commit on the same day, plus an upgrade note.
  - The Claude body changes too. It gets its first superseded entry, so existing repositories see
    one `CLAUDE006` warning until they run `init`.
  - Raising the revision number by hand makes a hand edit look newer instead of drifted. That takes
    deliberate effort, so documenting it is enough.
- **Option A (minimal): no format change.** The drift message says "modified manually, or written
  by a newer Syngraphe than X", and a release-train rule (Phase 3.4) keeps the Action current.
  Pinned users still get an error.
- **Rejected:** storing a hash, which the managed-blocks reference already rejects as diff noise;
  and bumping the marker `version`, which means block format and maps to a conflict.

**D2 — Public API surface.**

- **Decided:** keep every current export unchanged. The docs describe the actual surface, and a
  test keeps the two identical. The documented surface is what semver covers. What follows is the
  rejected recommendation, kept for the record.
- **Rejected recommendation:** the stable surface is what the docs show; everything else is removed while the
  0.x → 1.0 boundary still allows it. The proposed stable set:
  - `Repository` with only `open`, `atRoot`, `inScope`, `root`, `gitRoot` and `scope` in the
    declarations. Other members are marked `@internal` and dropped from `.d.ts` with `stripInternal`.
  - `createCheckContext`, `runChecks`, `CHECK_JSON_VERSION`, and the `Finding`, `Severity`, `Check`
    and `CheckContext` types.
  - `planInitialization`, `planDocument`, `listDocuments`, `DocumentCategory`, and the `Plan` and
    `FileOperation` types.
  - `planToJson`, `PLAN_JSON_VERSION` and the `PlanJson*` types.
  - `inspectStats`, `DEFAULT_TOKEN_BUDGET`, `LARGE_DOCUMENT_TOKENS` and the stats types.
  - `discoverScopes`.
  - The pure managed-block functions and `MANAGED_BLOCK_VERSION`.
  - The exit-code constants and `ExitCode`.
  - `SyngrapheError`.
  - `CONTEXT_SCHEMA_VERSION` and `CONTEXT_PROTOCOL`.
- **Proposed removals:** `main`, `Output`, `runCheck`, `runInit`, `runDocument`, `runStats`,
  `runStatus`, `applyPlan`, `emptyPlan`, `renderPlan`, `agentIntegrations`, `checks`, the agent
  integration types, `inspectContext`, `inspectManagedFile`, `planManagedFile`, and the rest of the
  template `export *`.
- The final list is fixed when the documented examples compile against the built declarations
  (see 2.2).
- **Alternative:** keep everything and declare the programmatic API outside semver for 1.x.

**D3 — Node support.**

- **Recommended:** keep `>=22.18.0`, add a Node 22.18.0 CI job, and state the policy: support for a
  Node major ends in a minor release after upstream end of life, announced one minor ahead.
- **Alternative:** require `>=24` from 1.0, which gives Node 24 support until 2028-04.

**D4 — Changelog depth.**

- **Recommended:** Keep a Changelog format, with one summarized section per published version
  0.1.0–0.4.1 reconstructed from Git history.
- **Alternative:** start at 1.0.0.
- `v0.x` Git tags are not backfilled unless rebuilding the version commit reproduces the published
  tarball contents; anything less would fabricate provenance.

**D5 — Release candidate.**

- **Recommended:** publish 1.0.0-rc.1 under the `next` dist-tag and try it on real repositories you
  choose before 1.0.0. The rc is also the first run of the new publish workflow.

## Phase 1 — Repair the published Action

1. Confirm CI is green on the commit to tag, which will be the latest `main`.
2. Regression evidence from that commit's bundle:
   - a repository carrying the 0.4.1 body is clean;
   - one carrying the 0.4.0 body reports `AGENT006` as a warning and exits 0;
   - this repository is clean.
   Scratch scripts stay out of the repository.
3. ⚠ Create the annotated tag `action-v1.1.0` and its GitHub Release. It is a minor release:
   `AGENT006`/`CLAUDE006` and the reference-check fixes reach the Action, and inputs and outputs are
   unchanged.
4. ⚠ Move `action-v1` to the same commit. This force-updates a public tag.
5. You tick Marketplace publication in the release editor, because no API exists for it. Then verify
   the public listing separately.
6. After the tag exists, update the exact-tag examples in the README and the Action and CI docs, and
   update `state/current.md`.

Done when `git ls-remote --tags origin` shows both tags on the commit and the bundle read from the
tag reports this repository clean.

## Phase 2 — Contracts

**2.1 Managed-body forward compatibility (per D1, Option B).**

- Code:
  - `src/templates/agents.ts`: add the revision to the notice and append the current bodies to the
    superseded lists. Claude gets its own list.
  - `src/managed/block.ts`: revision parsing and the `newer` state.
  - `src/managed/file.ts`: the message, and an unchanged plan entry for `newer`.
  - `src/checks/agents.ts` and the Claude integration: the two new warning codes.
- Docs and context: the README check table, the checks and managed-blocks reference pages, and a new
  decision record (0009).
- Tests, each new guard observed failing first:
  - a newer body is a warning;
  - `init` stays a no-op over a newer body;
  - a hand edit at the current revision is still drift;
  - every superseded body is still outdated.
- Regenerate the Action bundle.

**2.2 Public API (per D2 as decided).**

- `src/index.ts` is not changed.
- Add an API reference page that lists every export, values and types, grouped by purpose. The
  existing programmatic sections link to it.
- Guard: a test reads the export names of `src/index.ts` through the TypeScript compiler and
  requires them to equal the names the page lists, in both directions.

**2.3 Node floor (per D3).**

- Add a Node 22.18.0 job (Ubuntu) to `.github/workflows/ci.yml`, alongside the existing three-OS
  Node 24 matrix.
- Fix any incompatibility it finds. If the fix is not small, escalate D3.

**2.4 Compatibility and versioning page.**

- Add a new reference page under the docs, a sidebar entry in `docs/.vitepress/config.mts`, and a
  README link. `test/docs-markdown.test.ts` must stay green.
- What semver covers:
  - commands and flags;
  - finding codes, which are never reused;
  - exit codes;
  - each JSON version;
  - schema v1 and the manifest;
  - the marker format and the body-migration rule (superseded bodies are append-only, plus D1);
  - the documented API;
  - the Node policy.
- How checks evolve:
  - a new check ships in a minor release only as a warning;
  - adding an error, or promoting a warning to an error, is major;
  - correcting a check to its documented meaning is a fix and is called out in the changelog.
- How the Action relates to the CLI: its major follows its own inputs and outputs, and it is
  released from the same commit whenever core behaviour changes.
- What semver does not cover:
  - human-readable text;
  - the advisory defaults (the 8,000 budget and the 2,000 large-document threshold). Their
    classification is confirmed while writing the page.

## Phase 3 — Release process

**3.1 Changelog (per D4).**

- Add CHANGELOG.md at the root and list it in `files`.
- The 1.0.0 entry absorbs every pending release-note item from `state/current.md`.
- It gets an explicit upgrade section covering:
  - the `AGENTS.md` and `CLAUDE.md` block rewrite on the next `init`;
  - the documented programmatic API becoming part of the semver promise;
  - the Node policy.

**3.2 Packaging.**

- `prepack` replaces `prepublishOnly`.
- A CI step runs `npm pack --dry-run --json` and asserts that `dist/cli/bin.js`, `dist/index.js`
  and `dist/index.d.ts` are included, and that `test/` and `action/` are not.

**3.3 Publish workflow.**

- Add `.github/workflows/release.yml`.
- Trigger: push of tags matching `v*.*.*`.
- Permissions: `contents: read` and `id-token: write`.
- Actions are pinned by SHA, as in `ci.yml`.
- Steps:
  1. run the full verification ladder;
  2. fail unless the tag equals the `package.json` version;
  3. run `npm publish` through npm trusted publishing, which gives provenance, adding `--tag next`
     when the version has a prerelease part.
- You do one manual step: configure the trusted publisher for this repository and workflow on
  npmjs.com, and then preferably disallow token publishing.
- At implementation time, check the current npm documentation for the npm CLI version trusted
  publishing requires.

**3.4 Release procedure as a truth document**, linked from `index.md`. It covers:

- the version bump and changelog;
- the release-train rule: when `git diff --quiet <last action tag> HEAD -- src/` fails, an Action
  release from the same commit is required;
- tagging;
- the verification commands;
- the manual Marketplace step.

## Phase 4 — Coherence and dogfooding

**4.1 Replace the "v0.1" wording.**

- Read each occurrence; this is not a mechanical rename.
- In the README, retitle "Scope of v0.1" and complete its list, which lacks `policy add`.
- Wording that is historically accurate stays historical.

**4.2 Archive the finished briefs.**

- Move adding-truth-commands and HOL-extension from `state/` to `history/` with `git mv`. The truth
  commands shipped in 0.4.0, and the HOL Guard extension was merged on 2026-10-02.
- Preserve and reset current state with `syngraphe state archive`, then rewrite
  `state/current.md` briefly and correct the stale CI claim.
- Target: no `state/` document above 2,000 estimated tokens. Report the resulting active total
  honestly. Getting under 8,000 would mean trimming decisions or architecture, which this plan does
  not do.

**4.3 When 1.0.0 is out, move this plan to `history/`.**

## Phase 5 — Release

**5.1 Release candidate.**

- Version `1.0.0-rc.1`, committed in the existing style, with the changelog entry and green CI.
- ⚠ Push the tag `v1.0.0-rc.1`; the workflow publishes it under `next`.
- Verify:
  - `npm view syngraphe dist-tags`: `latest` is still 0.4.1 and `next` is the rc;
  - provenance is shown;
  - `npx syngraphe@next --version`.
- Repositories trying the rc pin the Action to the rc commit SHA. `action-v1` would otherwise report
  `AGENT002` on rc-written blocks.

**5.2 Dogfood on the repositories you choose.** Check the upgrade paths:

- 0.4.0 body → `AGENT006` → `init` → clean;
- 0.4.1 body → the same;
- an rc-written block under `action-v1.1.0` → `AGENT002` (expected and documented);
- a newer-revision fixture → `AGENT007` warning.

Fix any friction found and cut rc.2 if needed.

**5.3 1.0.0.**

- Bump the version and date the changelog.
- ⚠ Create `action-v1.2.0` from the same commit and move `action-v1`.
- ⚠ Push the tag `v1.0.0`; the workflow publishes it under `latest`.
- ⚠ Create the GitHub Release from the changelog section.
- Verify:
  - the npm version, dist-tags and provenance;
  - the docs site shows 1.0;
  - the published CLI runs `check --all` clean on this repository.

## Verification ladder

Run for each code change:

- `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`;
- `npm run action:build`, then `npm run action:check`;
- `npm run docs:build` when docs change;
- `node dist/cli/bin.js check --all` and `stats` on this repository.

Hosted CI must be green on all three operating systems and on the Node 22.18 job before any tag.

## Approval points and boundaries

- ⚠ marks consequential steps, and each one waits for explicit approval: every tag push or move,
  npm publish and GitHub Release.
- You do the trusted-publisher configuration and the Marketplace checkbox yourself.
- Commits and pushes to `main` happen only when asked.
- Out of scope for 1.0: `doctor`, `update`, `reconcile`, per-check suppression, destructive removal,
  new agent integrations. All can arrive in 1.x minors without breaking the promise.

## Blockers

None. Waiting for approval and answers to D1–D5.
