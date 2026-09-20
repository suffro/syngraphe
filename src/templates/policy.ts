/**
 * The optional `AGENT-POLICY.md` starting point.
 *
 * Unlike the managed blocks, this is a seed and not a managed contract:
 * Syngraphe writes it once, on request, and never compares, patches or checks
 * it again. Every repository is expected to edit it.
 *
 * It lives at the repository root, beside `AGENTS.md`, because it is an
 * instruction to the agent rather than a fact about the repository, and
 * `.context/` holds facts. Keeping it out of `.context/` also keeps it out of
 * the context token budget `syngraphe stats` reports.
 */

export const POLICY_FILE = "AGENT-POLICY.md";

export const POLICY_CONTENTS = `# AGENT-POLICY.md

How an AI coding agent should work in this repository: planning, delegation, consequential actions,
and long-running processes.

This file is deliberately separate from \`AGENTS.md\`. That file holds durable repository facts,
invariants, conventions and verification commands worth keeping in context during implementation.
This one holds process rules that mainly matter for multi-step, costly or operationally risky work.

Nothing here overrides \`AGENTS.md\`, the user's explicit instructions, or higher-priority rules.

---

## Rule zero — start simple

Use the least complex approach that solves the task. Reading a few files and making one focused edit
is often the whole job. Every extra layer — a formal plan, delegation, repeated review, another tool
or another abstraction — adds latency, cost and failure surface, and should be justified by the task.

Do not add steps "for completeness" when a smaller process already gives sufficient evidence.

## Repository-specific instructions take precedence

Before acting, check for more specific instructions, documentation, conventions, or scoped
\`AGENTS.md\` files relevant to the files being changed.

Repository-specific instructions take precedence over these defaults. Do not apply a general rule
mechanically when the repository defines a more specific workflow.

## Task-specific execution checklists

For tasks involving multiple dependent steps, meaningful risk, or substantial exploration, keep a
**living checklist** while working.

A useful checklist captures, as needed:

- prerequisites and current state;
- the exact file, command, target and inputs;
- the expected change;
- what counts as success evidence;
- known risks and dependencies;
- failure and stop conditions;
- rollback or cleanup;
- authorization, cost or irreversible-action boundaries.

Refresh the checklist before materially complex steps. Add discoveries and defects as they appear.

**Mark an item complete only from concrete evidence** — for example a passing test, generated
artefact, hash, diff, observed state transition or successful build. Do not infer completion merely
because a neighbouring step worked.

When a defect appears, record its root cause when known, the regression coverage it needs, and any
cleanup required before attempting another expensive action.

Keep the checklist proportional to the work. It is an execution aid, not repetitive commentary.

## Consequential actions

For destructive, irreversible, public, credential-related or expensive actions:

1. **Never act from memory or name inference.** Read back the exact command, arguments and target.
2. Confirm they match the intended operation.
3. Run the action only with the required authorization.
4. **Verify the result immediately** by checking the resulting state or identity.
5. Stop on any mismatch.
6. If the action is irreversible and the user has not explicitly requested it in the current session,
   ask first.

Examples include publishing, pushing release tags, force-pushing, rewriting history, rotating keys or
credentials, deleting data recursively, changing production infrastructure, and spending the user's
money.

## Long-running processes

- **Do not waste user credits or context on repetitive polling.** Builds, downloads, CI jobs,
  environment solves, migrations and similar tasks may take a long time.
- Avoid verbose watch commands or repeated status calls that inject unchanged output into context.
- Prefer a completion signal or a quiet wait when the environment supports one.
- If polling is unavoidable, check only after a meaningful interval and avoid repeatedly reporting
  unchanged state.
- Report real transitions: actionable progress, failure, completion, or something requiring a
  decision.
- Stop loops that are not converging instead of continuing indefinitely.

## Delegation and subagents

- **Default to a single linear agent** for writing, editing and debugging code.
- **Do not run parallel agents that write to the same codebase.** Concurrent writers can make
  incompatible implicit decisions about naming, structure, error handling and architecture.
- Delegate sequentially when multiple writing passes are truly useful, handing over the relevant
  context and current state.
- Subagents are most useful for broad read-only work: locating code across many files, gathering
  context, comparing independent areas, or answering a question that would otherwise require many
  serial reads.
- A task being large is not, by itself, a reason to delegate it. Width and separability matter more.
- Cap iterations. If a delegated or iterative loop is not converging after a few passes, stop and
  report what was tried and what remains unresolved.

## Verification is the gate

- Run **proportionate verification** after significant steps, using the cheapest reliable check that
  provides the needed evidence.
- Prefer targeted verification first: affected tests, type checks, linting, focused builds or direct
  behavioural checks. Broaden verification only when the change or evidence warrants it.
- Reserve expensive full-suite verification for points where it materially increases confidence,
  especially before completion.
- A guard that has never been observed failing may still be unproven. When safe, local, reversible
  and reasonably cheap, exercise its failure path once, confirm the expected failure, then restore
  the valid state. Never do this against production or consequential external state merely to prove
  the guard.
- Report outcomes exactly as observed. If a test fails, state that it failed and preserve the useful
  failure information. If a step was skipped, state which one and why.
- Do not describe work as complete merely because the implementation was written.
`;
