You are starting a new open-source developer tool called Syngraphe.

Syngraphe is a lightweight, Git-native repository-context system for keeping project knowledge correct, current, reviewable, versioned, human-readable, and consumable by AI coding agents.

The main philosophy is:

* the repository context belongs to the repository, not to Syngraphe;
* Git provides history and versioning;
* Markdown is the primary human/agent-readable format;
* Syngraphe is only the tooling that initializes, validates, and later helps maintain that context;
* the repository must remain fully understandable and usable even if Syngraphe is not installed;
* the deterministic core must work offline and without AI;
* AI support will come later and must stay optional.

## Scope for this first implementation

Build **Syngraphe v0.1 only**.

Do NOT implement semantic AI analysis, `doctor`, `update`, `reconcile`, MCP, vector databases, cloud services, direct AI providers, GitHub Actions, hooks, background services, or other speculative features yet.

The first usable CLI should expose:

```bash
syngraphe init
syngraphe init --dry-run

syngraphe status

syngraphe check
syngraphe check --json
syngraphe check --strict
```

The priority is:

**minimum complexity, very clean architecture, strong safety, and easy future extension.**

---

# 1. Technology

Use:

* TypeScript
* Node.js
* ESM
* Commander for CLI parsing
* Node native APIs wherever possible
* `node:test` + `node:assert` for tests
* Biome for linting/formatting

Avoid unnecessary dependencies.

Do not introduce:

* simple-git
* inquirer
* chalk
* ora
* lodash
* glob libraries
* validation frameworks
* ORM/database packages

unless there is a strong concrete reason.

Use `execFile()` rather than shell command strings when invoking Git.

Target a modern Node LTS baseline.

---

# 2. Core repository protocol

On initialization, Syngraphe creates:

```text
.context/
├── manifest.json
├── index.md
│
├── truth/
│   ├── architecture.md
│   └── conventions.md
│
├── state/
│   └── current.md
│
├── decisions/
│   └── README.md
│
└── history/
    └── README.md
```

Keep the generated templates intentionally small.

Do not turn them into long questionnaires.

Suggested `manifest.json`:

```json
{
  "schemaVersion": 1,
  "layout": "standard"
}
```

Do not add timestamps, machine IDs, current model names, current agent names, or other noisy metadata.

---

# 3. Context model

Syngraphe distinguishes context by lifecycle.

## Truth

Stable current repository facts:

* architecture
* conventions
* domain concepts
* important constraints
* invariants

## State

Volatile current work:

* current focus
* recent relevant changes
* next steps
* blockers

## Decisions

Important architectural or technical decisions and their rationale.

For v0.1 this is only a Markdown directory. Do not implement a full ADR manager.

## History

Old or superseded operational context that should remain available without being part of the default active context.

---

# 4. Default templates

`.context/index.md` should act as a router into the repository context.

Use something minimal along these lines:

```md
# Repository Context

This directory contains the canonical shared context for this repository.

## Always relevant

- `truth/architecture.md` — current system architecture.
- `state/current.md` — current project state and active work.

## When relevant

- `truth/conventions.md` — repository conventions.
- `decisions/` — significant technical and architectural decisions.

## Historical

- `history/` — completed, historical, or superseded operational context.
```

`truth/architecture.md`:

```md
# Architecture

## Overview

## Major components

## Data flow

## External systems

## Important constraints
```

`truth/conventions.md`:

```md
# Conventions

## Repository conventions

## Development workflow

## Important rules
```

`state/current.md`:

```md
# Current State

## Current focus

## Recent relevant changes

## Next

## Blockers
```

Keep the README files in `decisions/` and `history/` similarly concise.

---

# 5. AGENTS.md integration

`AGENTS.md` is the canonical bootstrap entry point for coding agents.

Syngraphe must be extremely conservative when modifying it.

If `AGENTS.md` does not exist:

* create it;
* add the Syngraphe managed block.

If it already exists:

* never replace existing content;
* never reformat the entire file;
* never reorder user-authored content;
* insert a Syngraphe managed block only.

Managed block:

```md
<!-- syngraphe:start version="1" -->
<!-- Managed by Syngraphe. Do not edit this block manually. -->

This repository maintains shared project context in `.context/`.

Before substantial work, read `.context/index.md` and the relevant context documents.
Keep repository context aligned with significant repository changes.
If Syngraphe is available, run `syngraphe check` before completing substantial work.

<!-- syngraphe:end -->
```

Do not add a `##` heading around it.

Placement rules:

1. if the file begins with a top-level `# Heading`, place the block immediately after that heading;
2. otherwise place the block at the beginning;
3. preserve all remaining content exactly as much as practical.

Syngraphe owns only text between its markers.

Everything outside them is user-owned.

---

# 6. Managed block behavior

Implement managed block manipulation as a reusable generic subsystem, independent from `AGENTS.md`.

Suggested pure operations:

```ts
findManagedBlock()
insertManagedBlock()
replaceManagedBlock()
removeManagedBlock()
validateManagedBlock()
```

Important behavior:

* initialization must be idempotent;
* duplicate managed blocks must be detected;
* manually modified managed blocks must NOT be silently overwritten;
* instead report drift/conflict;
* do not modify anything outside managed markers.

Do not store unnecessary hashes in the repository unless they become genuinely necessary.

If expected managed content differs from the existing block, treat it as drift and report it.

---

# 7. Agent integration architecture

Create an extensible agent-integration abstraction.

Something conceptually like:

```ts
interface AgentIntegration {
  id: string;
  displayName: string;

  detect(repo: Repository): Promise<AgentDetection>;

  inspect(repo: Repository): Promise<AgentIntegrationState>;

  planIntegration(repo: Repository): Promise<IntegrationPlan>;
}
```

Use a registry, not scattered conditionals.

Example:

```ts
const integrations: AgentIntegration[] = [
  claudeIntegration,
  cursorIntegration,
  codexIntegration
];
```

Adding a new agent later should ideally require:

* one new adapter module;
* registration;
* tests.

Do not let agent-specific logic leak into core repository code.

---

# 8. Claude integration

Claude-specific support should be only a compatibility shim.

If `CLAUDE.md` does not exist, create:

```md
<!-- syngraphe:start version="1" -->
<!-- Managed by Syngraphe. Do not edit this block manually. -->
@AGENTS.md
<!-- syngraphe:end -->
```

If `CLAUDE.md` already exists:

* preserve all existing content;
* insert only the managed import block;
* never replace Claude-specific user instructions.

If `CLAUDE.md` already imports `AGENTS.md` correctly, leave it alone.

If it is already a valid symlink to `AGENTS.md`, leave it alone.

---

# 9. Cursor and Codex integration

Treat both as native consumers of `AGENTS.md` for v0.1.

Do not create redundant files.

If `.cursor/rules/` or other vendor-specific configuration exists:

* detect it if useful for status output;
* leave it untouched.

Syngraphe is not a universal rule transpiler.

---

# 10. Explicit non-goal: do not become Rulesync

Do not implement translation or synchronization of:

* hooks
* permissions
* MCP configs
* subagents
* skills
* vendor-specific commands
* editor-specific capabilities

Syngraphe only manages shared repository context and its integrity.

Vendor-specific features remain vendor-specific.

---

# 11. Repository abstraction

Create a clean `Repository` abstraction that discovers the Git root and exposes repository-relative operations.

All write operations must remain inside the Git repository root.

Be careful with:

* `..`
* absolute paths
* symlinks
* path traversal

Do not follow unsafe symlinks outside the repository when modifying files.

---

# 12. Git abstraction

Create a very small Git wrapper using the system Git executable.

Conceptually:

```ts
interface GitClient {
  root(): Promise<string>;
  status(): Promise<GitStatus>;
  diff(base?: string): Promise<string>;
  lastModified(path: string): Promise<GitTimestamp | null>;
}
```

Do not introduce libgit or simple-git.

---

# 13. Plan/apply architecture

Any command that modifies the repository must separate:

```text
inspection
↓
planning
↓
display
↓
apply
```

Never combine inspection and writing into one opaque function.

Define reusable planned operations, for example:

```ts
type FileOperation =
  | {
      type: "create";
      path: string;
      contents: string;
    }
  | {
      type: "patch";
      path: string;
      before: string;
      after: string;
    };
```

`syngraphe init` must first build an initialization plan.

Then:

```ts
renderPlan(plan)
```

Then apply the exact plan.

This architecture should later be reusable by future commands like `update`, `reconcile`, repair operations, and schema migrations.

---

# 14. `syngraphe init --dry-run`

Implement this from the beginning.

Example output style:

```text
Syngraphe initialization plan

CREATE
  .context/manifest.json
  .context/index.md
  .context/truth/architecture.md
  .context/truth/conventions.md
  .context/state/current.md
  .context/decisions/README.md
  .context/history/README.md

PATCH
  AGENTS.md
    + Syngraphe repository-context bootstrap

  CLAUDE.md
    + @AGENTS.md compatibility import

UNCHANGED
  .cursor/rules/

No files were modified.
```

Do not overdesign terminal rendering.

Plain, clean output is enough.

---

# 15. Existing `.context/`

Never overwrite an existing `.context/` blindly.

Detect at least:

```text
valid Syngraphe context
partial Syngraphe context
unsupported Syngraphe schema
unknown unrelated .context directory
```

For an unrelated existing `.context/` directory:

* abort safely;
* explain the conflict;
* make no destructive assumptions.

---

# 16. Filesystem writes

Centralize filesystem modification.

Do not scatter direct write calls throughout command modules.

Use a small filesystem layer that supports safe complete-file writes, ideally via temporary file + rename where practical.

The priority is to avoid leaving user files partially written.

---

# 17. `syngraphe status`

This is read-only, very fast, offline, and deterministic.

It should summarize:

```text
Syngraphe

Context
  schema          v1
  layout          standard

Knowledge
  architecture    present
  conventions     present
  current state   present
  decisions       3
  history         2

Agents
  AGENTS.md       ready
  Claude          ready
  Cursor          native
  Codex           native

Integrity
  0 errors
  1 warning
```

Do not invoke AI.

Do not modify files.

Do not access the network.

---

# 18. Check framework

Build an extensible deterministic check registry.

Suggested interface:

```ts
interface Check {
  id: string;
  category: CheckCategory;

  run(context: CheckContext): Promise<Finding[]>;
}
```

Suggested finding shape:

```ts
interface Finding {
  code: string;
  severity: "error" | "warning" | "info";
  category: string;

  message: string;

  file?: string;
  line?: number;

  details?: string;
}
```

Use stable finding codes from the beginning.

Examples:

```text
CTX001
CTX002
MANIFEST001
AGENT001
AGENT002
LINK001
STATE001
```

Do not expose unstable internal implementation names in the codes.

---

# 19. Initial deterministic checks

For v0.1 implement only reliable checks such as:

* `.context/manifest.json` exists;
* manifest JSON is valid;
* schema version is supported;
* expected core context files exist;
* `.context/index.md` references valid files;
* local Markdown links/references resolve;
* no duplicate Syngraphe managed blocks;
* AGENTS.md managed block is valid;
* managed block was not manually altered;
* Claude import state is correct;
* obvious partial initialization problems;
* current state is not completely empty;
* freshness warning based on Git history.

Do not overclaim semantic correctness.

---

# 20. Freshness

Freshness warnings must be conservative.

For example:

```text
STATE001 warning

.context/state/current.md has not changed in 47 days.

This may be intentional. Review whether it still reflects
the current repository state.
```

Do not say:

```text
ERROR: context is stale
```

just because a file is old.

Age is only a signal.

---

# 21. `syngraphe check`

Human-readable mode:

```bash
syngraphe check
```

Example:

```text
Syngraphe context integrity

✓ manifest
✓ context structure
✓ internal references
✓ AGENTS.md
✓ Claude integration

WARN STATE001
.context/state/current.md has not changed in 47 days.

1 warning
```

---

# 22. JSON output

Implement:

```bash
syngraphe check --json
```

Use a stable machine-readable shape:

```json
{
  "version": 1,
  "ok": false,
  "findings": [
    {
      "code": "LINK001",
      "severity": "error",
      "file": ".context/index.md",
      "line": 12,
      "message": "Referenced file does not exist"
    }
  ]
}
```

This will later support CI and integrations.

---

# 23. Strict mode

Default:

```text
errors → non-zero exit
warnings → report only
```

With:

```bash
syngraphe check --strict
```

warnings that are intended to be strict-capable may also fail the command.

Keep the logic simple and explicit.

---

# 24. Exit codes

Define stable exit codes early.

Suggested:

```text
0 = success
1 = context integrity failure
2 = invalid CLI usage
3 = unsupported Syngraphe context schema
4 = internal Syngraphe failure
```

Document them.

---

# 25. Testing requirements

This tool modifies user repositories, so filesystem behavior is critical.

Use temporary repositories in integration tests.

At minimum test:

```text
empty Git repo

repo with no AGENTS.md

repo with AGENTS.md + H1

repo with AGENTS.md without H1

repo with existing CLAUDE.md

repo with CLAUDE.md already importing AGENTS.md

repo with valid Claude symlink

repo with Syngraphe managed block

repo with manually modified Syngraphe managed block

repo with duplicate managed blocks

repo with CRLF

repo without final newline

repo with unrelated existing .context/

repo with broken context links

repo with unsupported schema version
```

---

# 26. Mandatory idempotency test

Explicitly test:

```text
snapshot A
   ↓
syngraphe init
   ↓
snapshot B
   ↓
syngraphe init
   ↓
snapshot C

assert B === C
```

This is a core product invariant.

---

# 27. Mandatory preservation test

For `AGENTS.md`:

```text
original file
    ↓
syngraphe init
    ↓
remove only Syngraphe managed block
    ↓
remaining content must equal original
```

Do the same for `CLAUDE.md`.

The test should prove that Syngraphe is additive and does not modify user-authored content outside its managed region.

---

# 28. `--dry-run` tests

The dry-run must use the exact same generated plan as the real operation.

Test that:

* the plan is correct;
* no repository files change.

Do not create a separate fake implementation path for dry-run.

---

# 29. Code organization

Prefer a structure approximately like:

```text
src/
├── cli/
├── commands/
├── core/
├── managed/
├── agents/
│   └── integrations/
├── checks/
├── inspectors/
├── templates/
└── index.ts
```

Do not create future-only modules just to match a diagram.

Create directories only as functionality is implemented.

However, maintain clean dependency direction:

```text
CLI
↓
commands
↓
core/services
↓
filesystem/Git
```

Agent integrations and checks should be plugins/registries consumed by commands, not hardcoded throughout the core.

---

# 30. Future architecture constraints

Do not implement these yet, but avoid architectural decisions that would make them difficult later:

```text
syngraphe doctor --agent claude
syngraphe doctor --agent codex

syngraphe update
syngraphe reconcile
```

Future semantic reasoning will use installed coding agents through an `AgentRunner` abstraction.

There will be no `--provider` in the initial design.

Do not implement direct OpenAI/Anthropic/Gemini API support now.

Future conceptual distinction:

```text
AgentIntegration
→ how an agent discovers repository context

AgentRunner
→ how Syngraphe asks an installed agent to perform semantic analysis
```

Keep these concerns separate if/when the second one is introduced.

---

# 31. Explicitly do not implement destructive removal yet

There will eventually be a destructive command such as:

```bash
syngraphe remove-context
```

or a similarly explicit name.

Do NOT call it `uninstall`.

Do NOT implement it in v0.1.

When it is implemented later, it must:

* show exactly what will be removed;
* preserve all user-authored content outside managed blocks;
* treat `.context/` as potentially containing valuable human-authored data;
* require a very explicit confirmation phrase.

For now only keep this as a documented future constraint.

---

# 32. README

Create a concise initial README explaining:

1. what Syngraphe is;
2. why repository context should live inside the repository;
3. that it is shared between humans and coding agents;
4. that Git provides history/versioning;
5. that Markdown remains usable without Syngraphe;
6. how to install;
7. basic usage;
8. current v0.1 scope;
9. non-goals.

Do not oversell semantic AI capabilities that do not exist yet.

Do not call Syngraphe an “AI memory platform”.

A good positioning sentence is:

> Syngraphe keeps repository context versioned, current, and understandable by both humans and coding agents.

---

# 33. License

Use Apache-2.0.

Add:

```text
LICENSE
```

and set:

```json
"license": "Apache-2.0"
```

in `package.json`.

---

# 34. Package and executable naming

Use:

```text
project: Syngraphe
repository: syngraphe
npm package: syngraphe
binary: syngraphe
```

CLI examples:

```bash
syngraphe init
syngraphe status
syngraphe check
```

---

# 35. Implementation sequence

Implement in this order:

1. initialize TypeScript/ESM package;
2. configure `syngraphe` binary;
3. implement `syngraphe --help`;
4. implement Git-root discovery;
5. define context schema v1;
6. add minimal context templates;
7. implement repository/filesystem abstraction;
8. implement generic managed-block parser and patcher;
9. add managed-block tests;
10. implement AGENTS.md integration;
11. define `AgentIntegration`;
12. implement integration registry;
13. implement Claude integration;
14. implement Cursor/Codex native detection;
15. implement initialization-plan types;
16. implement plan rendering;
17. implement `--dry-run`;
18. implement safe plan application;
19. implement `syngraphe init`;
20. add idempotency tests;
21. add preservation tests;
22. define check/finding types;
23. implement check registry;
24. implement manifest/context checks;
25. implement AGENTS/Claude checks;
26. implement internal reference checks;
27. implement conservative freshness checks;
28. implement `syngraphe check`;
29. implement `--json`;
30. implement `--strict`;
31. implement `syngraphe status`;
32. clean README/documentation;
33. run the tool against several realistic temporary repos;
34. stop at v0.1.

Do not proceed into semantic AI functionality in this first development pass.

---

# 36. Definition of done for v0.1

I should be able to take an existing Git repository and run:

```bash
syngraphe init
```

and get:

* a clean `.context/`;
* a safe managed bootstrap in `AGENTS.md`;
* minimal Claude compatibility if required;
* no loss of existing content;
* no unnecessary vendor files;
* deterministic/idempotent behavior;
* a completely inspectable `git diff`.

Then:

```bash
syngraphe check
```

must detect real structural/integrity problems.

And if the Syngraphe executable disappears afterward, the repository must still retain a completely understandable and usable context system through:

```text
AGENTS.md
.context/
Markdown
Git history
```

The architectural invariant is:

```text
Syngraphe implements the repository-context protocol.
```

Never:

```text
The repository-context protocol depends on Syngraphe.
```

Start by inspecting the empty repository and then implement the project incrementally according to this plan.

Prefer small, focused modules and tests over large abstractions.

If a design choice is not necessary for v0.1, do not implement it yet.

---

Rispondi in italiano, in maniera super semplice e corta, se voglio dettagli te li chiedo