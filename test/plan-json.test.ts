import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { Plan } from "../src/core/plan.ts";
import { PLAN_JSON_VERSION, planToJson } from "../src/core/plan-json.ts";
import { CURRENT_STATE_PATH } from "../src/templates/context.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

async function initialized(): Promise<TempRepo> {
  const repo = await TempRepo.create();
  after(() => repo.cleanup());
  assert.equal((await runCli(repo, ["init"])).code, 0);
  return repo;
}

describe("dry-run plan JSON", () => {
  it("projects a deliberate versioned public shape without internal file contents", () => {
    const plan: Plan = {
      operations: [
        { type: "create", path: "new.md", contents: "PRIVATE_CREATE" },
        {
          type: "patch",
          path: "existing.md",
          before: "PRIVATE_BEFORE",
          after: "PRIVATE_AFTER",
          summary: "Update the managed section",
        },
      ],
      unchanged: [{ path: ".context/", reason: "already initialized" }],
      conflicts: [{ path: null, message: "Repository conflict", details: null }],
    };

    assert.deepEqual(planToJson(plan, "packages/api"), {
      version: PLAN_JSON_VERSION,
      ok: false,
      scope: "packages/api",
      operations: [
        { type: "create", path: "new.md" },
        { type: "patch", path: "existing.md", summary: "Update the managed section" },
      ],
      unchanged: [{ path: ".context/", reason: "already initialized" }],
      conflicts: [{ message: "Repository conflict" }],
    });
  });

  it("emits only parseable JSON for init and leaves the repository unchanged", async () => {
    const repo = await TempRepo.create({ "AGENTS.md": "# Existing project\n" });
    after(() => repo.cleanup());
    const before = await repo.snapshot();

    const result = await runCli(repo, ["init", "--dry-run", "--json"]);
    const report = JSON.parse(result.stdout);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.ok(result.stdout.endsWith("\n"));
    assert.equal(report.version, PLAN_JSON_VERSION);
    assert.equal(report.ok, true);
    assert.equal(report.scope, ".");
    assert.ok(
      report.operations.some(
        (operation: { type: string; path: string }) =>
          operation.type === "create" && operation.path === ".context/manifest.json",
      ),
    );
    assert.ok(
      report.operations.some(
        (operation: { type: string; path: string }) =>
          operation.type === "patch" && operation.path === "AGENTS.md",
      ),
    );
    assert.doesNotMatch(result.stdout, /Syngraphe initialization plan|\nCREATE\n|No files were/);
    assert.deepEqual(await repo.snapshot(), before);
  });

  for (const [category, directory] of [
    ["truth", "truth"],
    ["decision", "decisions"],
    ["state", "state"],
    ["history", "history"],
  ] as const) {
    it(`emits a no-write create plan for ${category} new`, async () => {
      const repo = await initialized();
      const before = await repo.snapshot();

      const result = await runCli(repo, [category, "new", "machine-note", "--dry-run", "--json"]);
      const report = JSON.parse(result.stdout);

      assert.equal(result.code, 0, result.stderr);
      assert.deepEqual(report, {
        version: PLAN_JSON_VERSION,
        ok: true,
        scope: ".",
        operations: [{ type: "create", path: `.context/${directory}/machine-note.md` }],
        unchanged: [],
        conflicts: [],
      });
      assert.deepEqual(await repo.snapshot(), before);
    });
  }

  it("projects archive operations in apply order without exposing state content", async () => {
    const repo = await initialized();
    await repo.write(CURRENT_STATE_PATH, "# Current State\n\nVERY_PRIVATE_STATE_SENTINEL\n");
    const before = await repo.snapshot();

    const result = await runCli(repo, ["state", "archive", "completed", "--dry-run", "--json"]);
    const report = JSON.parse(result.stdout);

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(report.operations, [
      { type: "create", path: ".context/history/completed.md" },
      {
        type: "patch",
        path: ".context/state/current.md",
        summary: "Reset current state after preserving it in history",
      },
    ]);
    assert.doesNotMatch(result.stdout, /VERY_PRIVATE_STATE_SENTINEL/);
    assert.doesNotMatch(result.stdout, /"(?:contents|before|after)"/);
    assert.deepEqual(await repo.snapshot(), before);
  });

  it("emits a conflict plan as JSON and preserves the existing file", async () => {
    const repo = await initialized();
    assert.equal((await runCli(repo, ["decision", "new", "existing"])).code, 0);
    const before = await repo.snapshot();

    const result = await runCli(repo, ["decision", "new", "existing", "--dry-run", "--json"]);
    const report = JSON.parse(result.stdout);

    assert.equal(result.code, 1);
    assert.equal(report.ok, false);
    assert.deepEqual(report.operations, []);
    assert.deepEqual(report.conflicts, [
      {
        path: ".context/decisions/existing.md",
        message: "Document already exists; choose another name.",
      },
    ]);
    assert.doesNotMatch(result.stdout, /\nCREATE\n|\nCONFLICTS\n|No files were/);
    assert.deepEqual(await repo.snapshot(), before);
  });

  it("requires dry-run for JSON on every mutating command family", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());
    const empty = await repo.snapshot();
    const init = await runCli(repo, ["init", "--json"]);
    assert.equal(init.code, 2);
    assert.match(init.stderr, /--json requires --dry-run for mutating commands\./);
    assert.equal(init.stdout, "");
    assert.deepEqual(await repo.snapshot(), empty);

    assert.equal((await runCli(repo, ["init"])).code, 0);
    const initializedSnapshot = await repo.snapshot();
    for (const args of [
      ["truth", "new", "truth-note", "--json"],
      ["decision", "new", "decision-note", "--json"],
      ["state", "archive", "archive-note", "--json"],
    ]) {
      const result = await runCli(repo, args);
      assert.equal(result.code, 2, `${args.join(" ")}: ${result.stderr}`);
      assert.match(result.stderr, /--json requires --dry-run for mutating commands\./);
      assert.equal(result.stdout, "");
      assert.deepEqual(await repo.snapshot(), initializedSnapshot);
    }
  });

  it("reports the selected scope while keeping operation paths scope-relative", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());
    await repo.makeDirectory("packages/api");
    assert.equal((await runCli(repo, ["init", "--scope", "packages/api"])).code, 0);
    const before = await repo.snapshot();

    const result = await runCli(repo, [
      "truth",
      "new",
      "domain-model",
      "--scope",
      "packages/api",
      "--dry-run",
      "--json",
    ]);
    const report = JSON.parse(result.stdout);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(report.scope, "packages/api");
    assert.deepEqual(report.operations, [
      { type: "create", path: ".context/truth/domain-model.md" },
    ]);
    assert.deepEqual(await repo.snapshot(), before);
  });
});
