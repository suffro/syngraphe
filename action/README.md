# Syngraphe GitHub Action

The root `action.yml` provides a bundled Node 24 Action with `check`, `stats` and `check-and-stats`.
It supports explicit scopes or monorepo discovery, strict mode, report-only validation, token
budgets, file/line annotations, job summaries and a JSON report under the runner temporary directory.

See the [full Action reference](../docs/reference/github-action.md) for every input, output,
failure policy and workflow example. The [CI workflow](../.github/workflows/ci.yml) exercises
`uses: ./` before installing dependencies on Linux, macOS and Windows.

Canonical implementation: `src/` in this directory, reusing the repository's core checks and
inspectors. Regenerate `dist/` with `npm run action:build`; verify it with `npm run action:check`.
Never edit generated files manually. The bundle includes third-party license notices.

Action releases use `action-vMAJOR.MINOR.PATCH` with a corresponding `action-vMAJOR` compatibility
tag, independently of the npm CLI. Both metadata and bundle must be present at the tagged commit.
See the canonical reference for the release process and complete examples.
