# Releasing

## Two release streams

- **npm CLI.** A `vX.Y.Z` tag triggers `.github/workflows/release.yml`. The workflow:
  1. checks that the tag equals the `package.json` version and points at a commit on `main`;
  2. requires npm 11.5.1 or newer;
  3. runs everything CI runs;
  4. publishes through npm trusted publishing (OIDC), with no stored token. npm attaches provenance
     automatically.

  A prerelease (`vX.Y.Z-rc.N`) goes to the `next` dist-tag; anything else goes to `latest`.
- **GitHub Action.** An annotated `action-vX.Y.Z` tag, the moving `action-vMAJOR` tag, a GitHub
  Release, and Marketplace publication ticked by hand in the release editor. The procedure is in the
  Action reference under docs. Action tags never match the npm workflow's `v*.*.*` filter.

The semver promise both streams keep is in the compatibility reference page. `CHANGELOG.md` covers
the npm package only.

## Release-train rule

When `src/` has changed since the last Action tag, the Action is released from the same commit as
the CLI. When a canonical managed body changed (`MANAGED_BODY_REVISION` was bumped), this is
mandatory. Otherwise `action-vMAJOR` users see the new body as `AGENT002` (before revisions) or
`AGENT007`.

```bash
# Exit status 1 means an Action release is due.
git diff --quiet "$(git describe --tags --abbrev=0 --match 'action-v*.*.*')" HEAD -- src/
```

## CLI release, step by step

1. Move the `[Unreleased]` entries in `CHANGELOG.md` under `## [X.Y.Z] - YYYY-MM-DD`, and update
   the compare links at the bottom.
2. Run `npm version X.Y.Z --no-git-tag-version`, then commit `package.json`, `package-lock.json`
   and `CHANGELOG.md` with the bare version as the message (`X.Y.Z`), as earlier version commits do.
3. Push to `main` and wait for CI to pass on every job.
4. ⚠ Tag the commit with an annotated `vX.Y.Z` and push the tag. This needs explicit approval
   because it publishes.
5. Verify:
   - `npm view syngraphe@X.Y.Z version gitHead`, where `gitHead` must equal the tagged commit;
   - `npm view syngraphe dist-tags`;
   - the provenance badge on the npm page;
   - `npx syngraphe@X.Y.Z --version`.
6. ⚠ Create the GitHub Release:
   `gh release create vX.Y.Z --verify-tag --title "Syngraphe X.Y.Z" --notes-file <changelog section>`.
   Add `--prerelease` for an rc.
7. Apply the release-train rule.

For a release candidate, run the published rc against real contexts before the final tag. Good
candidates are the maintainer's public repositories that already use Syngraphe, such as
`scrollcase`, `desktopr`, `decguard` and `decport`. Work on local clones and push nothing. Compare
`check --all` before and after `init`, confirm that `git diff` only touches text between markers,
and confirm that a second `init` changes nothing.

After a publish, the registry can take a few minutes before it serves the tarball. A 404 in that
window is not a failed release; the workflow log line `+ syngraphe@X.Y.Z` is.

Never retarget an exact version tag and never republish a version. A broken release is fixed by the
next one.

## One-time setup on npmjs.com (maintainer only)

- Add a trusted publisher with:
  - provider: GitHub Actions;
  - user: `suffro`;
  - repository: `syngraphe`;
  - workflow: `release.yml`;
  - no environment.

  All fields are case-sensitive. `repository.url` in `package.json` must name the same repository,
  which is why it uses the login's lowercase spelling.
- Then select "Require two-factor authentication and disallow tokens". Trusted publishing keeps
  working.
- Requirements, read from npm's trusted-publishers documentation on 2026-11-15: npm CLI 11.5.1 or
  newer, Node.js 22.14 or newer, and a GitHub-hosted runner.
