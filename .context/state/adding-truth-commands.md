Implement two related Syngraphe CLI improvements:

1. Add `truth new` / `truth list`, making `truth` a first-class document category alongside `decision`, `state`, and `history`.
2. Add stable machine-readable JSON output for dry-run plans of every mutating Syngraphe command.

Before changing anything, read `AGENTS.md` and the repository `.context/` documents and follow the existing architecture and conventions. Inspect the current implementation rather than introducing parallel abstractions.

Do not publish anything, create releases/tags, or bump the npm package version as part of this task.

The current release is 0.3.0 and the existing concurrency/no-overwrite safety work must remain intact.

\==================================================

1. FIRST-CLASS `truth` DOCUMENT COMMANDS
   \==================================================

Current document categories are:

- decision
- state
- history

Add:

- truth

The public CLI should support:
```arduino
syngraphe truth new <name>
syngraphe truth new <name> --title "Domain model"
syngraphe truth new <name> --dry-run
syngraphe truth list
```

All normal global behavior must continue to work:
```sql
syngraphe truth new domain-model --scope packages/api
syngraphe truth list --scope packages/api
```

Do not add `--all` to document commands.

### Directory

Truth documents live under:
```
.context/truth/
```

So:
```
syngraphe truth new domain-model
```

creates:
```
.context/truth/domain-model.md
```

### Existing truth documents

`truth list` must list all top-level regular Markdown documents under `.context/truth/`, including the existing core documents:
```bash
.context/truth/architecture.md
.context/truth/conventions.md
```

and any user-created documents.

Keep the same rules already used by the other document categories:

- filename-order output;
- only regular `.md` files;
- no symlinks;
- exclude `README.md` if one happens to exist;
- require an initialized and supported context;
- support selected repository scopes;
- preserve the existing exit-code model.

Do not special-case architecture.md or conventions.md.

### Filename and collision behavior

Reuse the current `planDocument` / document name validation logic.

Truth documents must therefore inherit the same properties as the other categories:

- portable ASCII filename stems;
- optional `.md` suffix;
- max current stem length;
- reject paths;
- reject Windows reserved names;
- reject README;
- case-insensitive collision detection even on case-sensitive hosts;
- no overwrite option;
- exclusive filesystem-level creation during apply.

For example:
```
syngraphe truth new architecture
```

must fail because `.context/truth/architecture.md` already exists.

And a concurrent pair of:
```
syngraphe truth new same-name
```

must inherit the existing exclusive-create guarantee. Do not create a separate write path for truth documents.

### Truth template

A generic truth document must intentionally be minimal.

Use:
```
# <title>
```

with the normal final newline.

Do NOT invent generic sections such as:
```
Facts
Constraints
Invariants
Context
```

A truth document may describe architecture, domain concepts, invariants, data models, security models, constraints, APIs, or something else entirely. Syngraphe should not pretend to know its semantic structure.

This is deliberately different from the existing decision/state/history templates.

Do not change the existing templates for decision, state, or history.

### Architecture

Prefer extending the current document abstraction rather than adding a separate truth implementation.

The current shape is approximately:
```scss
DocumentCategory
DOCUMENT_DIRECTORIES
documentTemplate()
planDocument()
listDocuments()
runDocument()
```

Extend that model cleanly.

`DocumentCategory` is already part of the public API, so adding `truth` is an additive public API change.

Update any exported types/functions as necessary without breaking existing imports.

\==================================================
2\. MACHINE-READABLE DRY-RUN PLAN JSON
======================================

Syngraphe already has an important invariant:
```rust
mutating command
    -> build Plan
    -> render Plan
    -> apply exactly that Plan
```

and `--dry-run` runs the same planner but stops before apply.

Expose that plan as stable machine-readable JSON.

This is intended primarily for coding agents, integrations, scripts, and future tooling that should not need to parse human terminal output.

### Supported commands

Add `--json` to the dry-run surface of every CURRENT mutating command:
```css
syngraphe init --dry-run --json

syngraphe truth new <name> --dry-run --json
syngraphe decision new <name> --dry-run --json
syngraphe state new <name> --dry-run --json
syngraphe history new <name> --dry-run --json

syngraphe state archive <name> --dry-run --json
```

Do not add JSON to `list` commands in this task.

`check` and `stats` already have their own independent JSON reports. Do not change those payloads.

Do not add `status --json` in this task.

### `--json` MUST require `--dry-run`

For mutating commands, this must be invalid:
```sql
syngraphe decision new foo --json
```

JSON plan output is specifically a side-effect-free planning interface.

Require:
```css
--dry-run --json
```

If `--json` is supplied without `--dry-run`:

- perform no writes;
- return the existing usage exit code (`2`);
- give a concise useful error on stderr;
- do not emit a partial JSON plan.

Use wording along the lines of:
```arduino
--json requires --dry-run for mutating commands.
```

Keep this rule consistent across `init`, all `new` commands, and `state archive`.

Do not silently turn `--json` into a dry-run. The user must explicitly request `--dry-run`.

### JSON must use the SAME plan

Absolutely do not create a second inspection/planning implementation for JSON.

The flow must remain:
```rust
build the ordinary Plan once
    -> human renderer OR JSON projection
    -> optionally apply that same Plan
```

For `--dry-run --json`, stop before apply exactly as normal `--dry-run` does.

There must be no difference in planning semantics between:
```
syngraphe init --dry-run
```

and:
```css
syngraphe init --dry-run --json
```

Only rendering differs.

\==================================================
PLAN JSON CONTRACT
==================

Introduce an independently versioned JSON contract for plans.

Use a dedicated version constant such as:
```ini
PLAN_JSON_VERSION = 1
```

Do not reuse CHECK\_JSON\_VERSION or the stats JSON version.

A root-scope example should look conceptually like:
```json
{
  "version": 1,
  "ok": true,
  "scope": ".",
  "operations": [
    {
      "type": "create",
      "path": ".context/truth/domain-model.md"
    }
  ],
  "unchanged": [],
  "conflicts": []
}
```

For a nested scope:
```arduino
{
  "version": 1,
  "ok": true,
  "scope": "packages/api",
  ...
}
```

### Top-level fields

Version 1 must contain:

- `version`

  - integer
  - currently `1`
  - versions the plan JSON shape only

- `ok`

  - boolean
  - true iff the plan contains no conflicts
  - this should correspond to whether the dry-run can succeed

- `scope`

  - Git-root-relative selected scope
  - `"."` at repository root

- `operations`

  - ordered array
  - preserve Plan operation order

- `unchanged`

  - ordered array
  - preserve Plan ordering

- `conflicts`

  - ordered array
  - preserve Plan ordering

Do not sort arrays independently if doing so would differ from the actual Plan.

### Operation projection

Do NOT serialize the internal Plan object blindly.

Internal plans contain file contents and patch before/after states. Those should NOT become part of the public CLI JSON contract.

A create should expose:
```json
{
  "type": "create",
  "path": ".context/decisions/use-postgres.md"
}
```

If the operation has a meaningful public summary, it may additionally expose:
```json
"summary": "..."
```

A patch should expose:
```json
{
  "type": "patch",
  "path": "AGENTS.md",
  "summary": "..."
}
```

Do NOT expose:

- `contents`
- `before`
- `after`
- complete file bodies
- raw current-state text
- user-authored file content

This is important both for keeping the contract small and for preventing a machine-readable dry-run from unexpectedly dumping repository context into logs.

The internal `Plan` type can retain all information required by `applyPlan`.

Create a deliberate public JSON projection.

### Unchanged entries

Project:
```json
{
  "path": ".context/",
  "reason": "already initialized"
}
```

### Conflicts

Project conflicts as:
```json
{
  "path": "...",
  "message": "...",
  "details": "..."
}
```

But optional values should be OMITTED rather than emitted as null.

For a repository-level conflict with no path:
```json
{
  "message": "..."
}
```

not:
```csharp
{
  "path": null,
  ...
}
```

Likewise omit `details` when absent.

Follow the conventions already documented for Syngraphe's other public JSON formats: optional fields omitted, not null.

\==================================================
JSON OUTPUT BEHAVIOR
====================

When `--dry-run --json` is active:

stdout must contain ONLY the JSON payload plus the normal final newline.

Do NOT also print:

- the human plan title;
- `CREATE`;
- `PATCH`;
- `UNCHANGED`;
- `CONFLICTS`;
- `No files were modified.`;
- any explanatory prose.

The output must be directly usable as:
```arduino
syngraphe decision new foo --dry-run --json | jq .
```

Human dry-run output without `--json` must remain unchanged.

Normal non-dry-run output must remain unchanged.

### Conflicting plans

If a plan is successfully built but contains conflicts, JSON mode should still emit a valid plan payload:
```arduino
{
  "version": 1,
  "ok": false,
  ...
  "conflicts": [...]
}
```

and return the normal integrity failure exit code (`1`).

Do not fall back to human plan rendering in this case.

Avoid duplicating the same conflict as extra human prose on stdout.

If there is a fatal operational/usage condition that prevents a Plan from being produced at all, preserve the existing stderr + exit code behavior rather than inventing a fake JSON payload.

Examples include:

- invalid command usage;
- invalid filename;
- outside a Git repository;
- unsupported context schema before a plan can be produced;
- an unrelated `.context/` that causes planning to abort.

Do not change existing exit-code semantics merely to force every error into JSON.

\==================================================
IMPLEMENTATION SHAPE
====================

Keep the dependency direction and current architecture intact.

A reasonable shape would be to add a small plan JSON projection module near the existing plan renderer, for example conceptually:
```
src/core/plan-json.ts
```

with types/functions similar to:
```scss
PLAN_JSON_VERSION
PlanJsonReport
planToJson(...)
```

or equivalent naming consistent with the repository.

The important part is separation:
```scss
internal Plan
    -> renderPlan()       // human
    -> planToJson()       // stable machine projection
```

Do not put JSON formatting logic into filesystem code.

Do not duplicate plan-building logic inside CLI handlers.

Consider exporting the stable plan JSON constant/type/projection from `src/index.ts`, since `Plan` and `renderPlan` are already part of the programmatic public surface. Keep the public API small and deliberate.

\==================================================
CLI WIRING
==========

Update the existing Commander setup rather than creating a parallel command tree.

The document group should become conceptually:
```
truth
decision
state
history
```

with `new` and `list` for all four.

`state` alone still gets `archive`.

For all `new` commands add:
```css
--dry-run
--json
```

For `state archive` add:
```css
--dry-run
--json
```

For `init` add:
```css
--dry-run
--json
```

Keep the CLI layer thin. Argument parsing belongs there, domain behavior does not.

Do not alter:
```
status
check
stats
```

except where shared types/imports genuinely require it.

\==================================================
SAFETY INVARIANTS THAT MUST NOT REGRESS
=======================================

The recent v0.3 concurrency fix is important.

Do not weaken or bypass:

- exclusive filesystem-level create behavior;
- `Repository.create`;
- atomic staging/publishing;
- stale-plan checks;
- patch before-content checks;
- symlink protection;
- Git-root path containment;
- case-insensitive document collision detection;
- plan/apply parity;
- no-overwrite behavior.

`truth new` must automatically benefit from the same exclusive create path as the other categories.

JSON dry-run must never call `applyPlan`.

No code path used solely for JSON output may perform filesystem writes.

\==================================================
TESTS: TRUTH COMMANDS
=====================

Extend the existing document tests rather than duplicating them where appropriate.

At minimum test:

1. `truth new` dry-run:

   - exit 0;
   - shows CREATE in human mode;
   - repository snapshot remains exactly unchanged.

2. Actual `truth new`:

   - creates `.context/truth/<name>.md`;
   - content is exactly the minimal truth template;
   - heading uses the requested/default title.

3. `truth list`:

   - includes `architecture.md`;
   - includes `conventions.md`;
   - includes new truth documents;
   - deterministic filename ordering;
   - ignores non-Markdown/non-regular entries according to current list behavior.

4. Collision:

   - `truth new architecture` fails;
   - case-only collision also fails;
   - original file is untouched.

5. Filename safety:

   - truth inherits existing invalid-name behavior.

6. Scope:

   - at least one focused test proves truth commands operate inside an explicit nested scope and not the repository root.

7. Concurrency:

   - do not duplicate the entire concurrency suite unnecessarily;
   - ensure the abstraction means truth uses the shared create path;
   - add a focused truth concurrency assertion only if needed to prove integration.

\==================================================
TESTS: PLAN JSON
================

Add focused regression tests for the public contract.

At minimum cover:

### init
```css
syngraphe init --dry-run --json
```

Assert:

- exit 0;
- stdout parses directly with JSON.parse;
- no human-rendered text surrounds it;
- `version === 1`;
- `ok === true`;
- `scope === "."`;
- expected create/patch operations are represented;
- repository snapshot is exactly unchanged.

### all document categories

Table-test:
```cpp
truth new
decision new
state new
history new
```

with:
```css
--dry-run --json
```

Assert:

- valid plan JSON;
- correct target directory/path;
- create operation;
- no writes.

### state archive

Set current state to recognizable content, then run:
```css
syngraphe state archive completed --dry-run --json
```

Assert:

- valid JSON;
- one create for history;
- one patch for current state;
- correct operation ordering;
- repository remains unchanged.

Most importantly, place a distinctive sentinel in current state, for example:
```
VERY_PRIVATE_STATE_SENTINEL
```

and assert that the JSON output DOES NOT contain it.

Also assert serialized output does not contain the internal field names:
```arduino
"contents"
"before"
"after"
```

This guards against accidentally exposing internal Plan data later.

### conflict

Create an existing document and run the same `new` command with:
```css
--dry-run --json
```

Assert:

- valid JSON is emitted;
- exit code is 1;
- `ok === false`;
- conflict is present;
- existing file is untouched;
- no human CREATE/CONFLICTS renderer text surrounds the JSON.

### invalid flag combination

For each mutating command family, or via a sufficiently representative shared test matrix, verify:
```
--json
```

without:
```
--dry-run
```

returns exit code 2 and performs zero writes.

Test at least:
```sql
init --json
truth new foo --json
decision new foo --json
state archive foo --json
```

Prefer a shared validation mechanism so future mutating commands do not accidentally diverge.

### nested scope

Test one:
```css
--scope packages/api ... --dry-run --json
```

and verify:
```json
"scope": "packages/api"
```

and scope-relative operation paths remain consistent with the rest of Syngraphe's output conventions.

\==================================================
PUBLIC JSON STABILITY
=====================

Treat this as a real public contract.

Document that:

- `PLAN_JSON_VERSION` is independent from check/stats JSON versions;
- version 1 is stable;
- adding optional fields may be additive;
- removing/retyping existing fields requires a version bump;
- consumers should match operation `type`, not human `summary` text;
- summaries/messages remain human-readable and may be reworded;
- paths are relative to the selected Syngraphe scope;
- no raw file contents are included.

Do not accidentally couple the JSON schema to internal TypeScript object structure.

\==================================================
DOCUMENTATION
=============

Update all documentation affected by these changes.

At minimum inspect and update:

- README.md
- docs/reference/cli.md
- docs/reference/json-output.md
- docs/guides/writing-the-context.md
- docs/concepts/scope-and-non-goals.md
- relevant `.context/truth/architecture.md`
- `.context/state/current.md`

Also search the repository for statements such as:
```javascript
decision/state/history support new/list
all three document categories
document categories
```

and update them to include truth where appropriate.

### README / CLI docs

Document examples such as:
```cpp
syngraphe truth new domain-model --title "Domain model"
syngraphe truth list
```

and:
```css
syngraphe decision new use-postgres --dry-run --json
syngraphe init --dry-run --json
```

Clearly state:

- all four categories support `new` and `list`;
- truth's generated document is intentionally only a top-level heading;
- mutating JSON output requires `--dry-run`;
- dry-run JSON never writes;
- JSON is a public plan projection and does not contain document contents.

### JSON reference

Add a dedicated section for plan JSON, separate from check JSON and stats JSON.

Include a real shape example and field table.

Do not describe it as the same version as another report.

\==================================================
CONTEXT/DOGFOODING
==================

Syngraphe uses its own `.context/`.

Update its repository context accurately as part of the same change.

At minimum:

- architecture should mention truth as a document category and the plan JSON projection;
- current state should record the new CLI surface and machine-readable dry-run support.

Do not invent decisions/history entries unless the change genuinely warrants them according to the repository's own conventions.

\==================================================
NO SCOPE CREEP
==============

Do NOT implement any of these in this task:

- status --json
- list --json
- doctor
- update
- reconcile
- remove-context
- semantic AI
- new agent integrations
- HOL Guard integration
- schema v2
- migration machinery
- automatic index editing
- truth semantic validation
- automatic content generation
- network functionality

Do not change the existing context schema version merely because a CLI helper was added. `truth/` already exists in schema v1.

Do not change managed bootstrap bytes unless this feature genuinely requires it. It should not.

\==================================================
VALIDATION
==========

After implementation run the repository's full validation surface, not only focused tests.

At minimum:
```arduino
npm test
npm run typecheck
npm run lint
npm run build
npm run action:check
npm run docs:build
```

Also run:
```sql
syngraphe check --all
```

using the locally built/current source path appropriate for the repository.

Exercise representative CLI behavior manually in temporary repositories, including:
```arduino
syngraphe truth new domain-model --dry-run
syngraphe truth new domain-model
syngraphe truth list

syngraphe init --dry-run --json
syngraphe decision new test --dry-run --json
syngraphe state archive snapshot --dry-run --json
```

Verify JSON can be parsed directly and no files change during dry runs.

If practical, verify that the new regression tests would fail or be absent in meaningful ways against the pre-change implementation rather than merely testing tautologies.

Do not weaken existing tests or validation rules to get a green run.

\==================================================
FINAL REPORT
============

When finished, report concisely:

1. implementation summary;
2. exact new CLI surface;
3. exact plan JSON v1 contract;
4. files changed;
5. tests added/updated;
6. whether any existing behavior changed;
7. all validation commands run and their exact outcomes;
8. any design choice or edge case I should review before release.

Do not publish, tag, release, or bump the package version.