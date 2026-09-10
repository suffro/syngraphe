# A bundled GitHub Action over the existing core

## Decision

Ship a JavaScript Action from root `action.yml`, with a committed Node 24 CommonJS bundle in
`action/dist/`. Canonical adapter sources in `action/src/` use the existing check registry, check
exit-code policy, scope discovery and stats inspector. No alternate checks or CLI shell wrapper.

The adapter adds workflow-specific value: file/line annotations, bounded job summaries, a versioned
JSON report in runner temp, output counts, report-only validation and an optional per-scope token
budget gate. Operational faults remain failures. Full reports are files rather than step outputs,
which have size limits. Users can upload reports through their own artifact step.

The Action calls no GitHub APIs, takes no token and executes no scripts from the inspected checkout.
Inputs select only read-only operations. Paths remain within the runner workspace and selected Git
root. The toolkit escapes workflow-command data; summaries escape repository-derived HTML.

`@actions/core`, `esbuild` and `yaml` are development dependencies; the npm CLI keeps its existing
runtime dependency graph. Esbuild bundles all runtime imports except Node built-ins and emits
third-party license notices. `action:check` compares a fresh build without rewriting committed
artifacts. LF attributes keep comparisons portable.

The CI matrix first runs the committed Action before installing dependencies, then checks bundle
consistency, types, lint and tests on Ubuntu, macOS and Windows. A release must explicitly publish a
commit/tag containing both metadata and bundle; no version tag or Marketplace listing is implied.

## Rationale

A thin `npx` wrapper would add little capability and make each workflow depend on package retrieval.
Bundling uses the same core while making the Action independent of npm installation at runtime.
Pinning the Action commit also pins its implementation, unlike a separate CLI-version input.

A composite shell Action would require more OS-specific quoting and runtime setup. The JavaScript
runner gives one implementation across supported runners, with no user-controlled shell fragments.

Automatic PR comments, checkout, artifact uploads and package mutation are outside the Action's
responsibility. Workflow authors control those steps and permissions explicitly. Annotation and
summary limits affect display only; all findings remain in the JSON report.
