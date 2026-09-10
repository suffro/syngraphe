import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { readOptions } from "../action/src/options.ts";
import {
  annotationsFor,
  collectReport,
  openCheckout,
  renderSummary,
} from "../action/src/report.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

function options(inputs: Record<string, string | undefined> = {}) {
  return readOptions((name) => inputs[name] ?? "");
}

async function initialized() {
  const repo = await TempRepo.create();
  after(() => repo.cleanup());
  assert.equal((await runCli(repo, ["init"])).code, 0);
  return repo;
}

describe("GitHub Action", () => {
  it("validates inputs without accepting shell commands or silently ignoring contradictory modes", () => {
    assert.equal(options().command, "check");
    for (const input of [
      { command: "init" },
      { command: "check; echo injected" },
      { all: "yes" },
      { budget: "0" },
      { budget: "9007199254740992" },
      { "max-annotations": "1001" },
      { all: "true", scope: "." },
      { "fail-on-budget": "true" },
      { command: "stats", strict: "true" },
    ])
      assert.throws(() => options(input), /must be|mutually exclusive|requires/);
    assert.equal(options({ "max-annotations": "0" }).maxAnnotations, 0);
  });

  it("preserves CLI findings and strict policy, including report-only validation", async () => {
    const repo = await initialized();
    const before = await repo.snapshot();
    const cli = await runCli(repo, ["check", "--json"]);
    const report = await collectReport(repo.root, options());
    assert.equal(report.ok, true);
    assert.equal(report.warnings, 1);
    assert.equal(report.shouldFail, false);
    assert.deepEqual(report.scopes[0]?.check?.findings, JSON.parse(cli.stdout).findings);
    const strict = await collectReport(repo.root, options({ strict: "true" }));
    assert.equal(strict.exitCode, 1);
    assert.equal(strict.shouldFail, true);
    const advisory = await collectReport(
      repo.root,
      options({ strict: "true", "fail-on-error": "false" }),
    );
    assert.equal(advisory.exitCode, 1);
    assert.equal(advisory.ok, false);
    assert.equal(advisory.shouldFail, false);
    assert.deepEqual(await repo.snapshot(), before);
  });

  it("combines check and stats and keeps the budget gate independent from fail-on-error", async () => {
    const repo = await initialized();
    const report = await collectReport(
      repo.root,
      options({ command: "check-and-stats", budget: "1" }),
    );
    assert.equal(report.budgetExceeded, true);
    assert.equal(report.ok, true);
    assert.equal(report.shouldFail, false);
    assert(report.bytes > 0);
    assert(report.estimatedTokens > 1);
    assert.equal(report.scopes[0]?.stats?.total.files, 7);
    const gated = await collectReport(
      repo.root,
      options({
        command: "stats",
        budget: "1",
        "fail-on-budget": "true",
        "fail-on-error": "false",
      }),
    );
    assert.equal(gated.exitCode, 1);
    assert.equal(gated.shouldFail, true);
    assert.equal(gated.errors, 0);
    assert.equal(gated.scopes[0]?.check, undefined);
  });

  it("keeps partial results and schema precedence across monorepo contexts", async () => {
    const repo = await initialized();
    await repo.makeDirectory("packages/api");
    await runCli(repo, ["init", "--scope", "packages/api"]);
    await repo.write(
      "packages/api/.context/manifest.json",
      '{"protocol":"repository-context","schemaVersion":999}',
    );
    const report = await collectReport(
      repo.root,
      options({ command: "check-and-stats", all: "true", strict: "true" }),
    );
    assert.equal(report.scopes.length, 2);
    assert.equal(report.exitCode, 3);
    assert.equal(report.failureCount, 1);
    assert.equal(report.scopes[1]?.failures[0]?.phase, "stats");
    assert(report.scopes[0]?.stats);
    assert.equal(report.scopes[1]?.stats, undefined);
    assert.equal(report.shouldFail, true);
  });

  it("maps scoped annotations back to a checkout nested in GITHUB_WORKSPACE", async () => {
    const repo = await initialized();
    // The workspace may contain several independent checkouts.
    const workspace = repo.path("..");
    const directory = repo.root.split(/[\\/]/).at(-1);
    assert(directory);
    await repo.makeDirectory("packages/api");
    await runCli(repo, ["init", "--scope", "packages/api"]);
    await repo.write("packages/api/.context/truth/links.md", "[broken](missing.md)\n");
    const report = await collectReport(
      workspace,
      options({ "working-directory": directory, scope: "packages/api" }),
    );
    const annotation = annotationsFor(report).find((finding) => finding.title === "LINK001");
    assert.equal(annotation?.file, `${directory}/packages/api/.context/truth/links.md`);
    assert.equal(annotation?.line, 1);
    assert.equal(report.scopes.length, 1);
    assert.equal(report.scopes[0]?.scope, "packages/api");
  });

  it("rejects workspaces, checkout paths and scopes that cross trust boundaries", async () => {
    const repo = await initialized();
    await repo.makeDirectory("subdir");
    await repo.link("subdir", "alias");
    for (const directory of ["../outside", repo.root, "missing", "alias"]) {
      await assert.rejects(
        () => openCheckout(repo.root, directory),
        /inside GITHUB_WORKSPACE|existing checkout|symlink/,
      );
    }
    await assert.rejects(() => openCheckout(repo.path("subdir"), "."), /outside GITHUB_WORKSPACE/);
    await assert.rejects(
      () => collectReport(repo.root, options({ scope: "../outside" })),
      /inside the Git repository/,
    );
  });

  it("never suppresses unsafe-path failures in report-only mode", async () => {
    const repo = await initialized();
    await repo.link("architecture.md", ".context/truth/linked.md");
    await repo.remove(".context/truth/conventions.md");
    await repo.link("architecture.md", ".context/truth/conventions.md");
    const report = await collectReport(
      repo.root,
      options({ command: "stats", "fail-on-error": "false" }),
    );
    assert.equal(report.exitCode, 2);
    assert.equal(report.shouldFail, true);
    assert.equal(report.failureCount, 1);
  });

  it("escapes repository text in summaries and prioritizes errors for annotations", async () => {
    const repo = await initialized();
    const report = await collectReport(repo.root, options());
    const scope = report.scopes[0];
    assert(scope?.check);
    scope.scope = "<script>alert(1)</script>|\nforged table";
    scope.check.findings.push({
      code: "LINK001",
      severity: "error",
      category: "references",
      message: "<img src=x>\n::error::injected",
    });
    const summary = renderSummary(report);
    assert.doesNotMatch(summary, /<script>|<img src=x>/);
    assert.match(summary, /&lt;script&gt;/);
    assert.match(summary, /&#124;/);
    assert.equal(annotationsFor(report)[0]?.title, "LINK001");
  });
});
