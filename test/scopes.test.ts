import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { main } from "../src/cli/main.ts";
import { createCapturedOutput } from "../src/cli/output.ts";
import { Repository } from "../src/core/repository.ts";
import { discoverScopes } from "../src/core/scopes.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

async function monorepo() {
  const repo = await TempRepo.create();
  after(() => repo.cleanup());
  await repo.makeDirectory("packages/api/src");
  await repo.makeDirectory("packages/web");
  return repo;
}

describe("nested contexts and monorepos", () => {
  it("preserves default Git-root selection from a subdirectory", async () => {
    const repo = await monorepo();
    const output = createCapturedOutput();
    assert.equal(await main(["init"], { cwd: repo.path("packages/api/src"), output }), 0);
    assert.equal(await repo.exists(".context/manifest.json"), true);
    assert.equal(await repo.exists("packages/api/.context/manifest.json"), false);
  });

  it("initializes only the chosen scope and retains dry-run and idempotency", async () => {
    const repo = await monorepo();
    await runCli(repo, ["init"]);
    const before = await repo.snapshot();
    assert.equal((await runCli(repo, ["init", "--scope", "packages/api", "--dry-run"])).code, 0);
    assert.deepEqual(await repo.snapshot(), before);
    const result = await runCli(repo, ["--scope", "packages/api", "init"]);
    assert.equal(result.code, 0, result.stderr);
    for (const [file, content] of before) assert.equal(await repo.read(file), content);
    assert.equal(await repo.exists("packages/api/.context/manifest.json"), true);
    assert.match(await repo.read("packages/api/AGENTS.md"), /\.context\/index.md/);
    assert.match(await repo.read("packages/api/AGENTS.md"), /--scope/);
    assert.match(await repo.read("packages/api/AGENTS.md"), /ancestor directories/);
    assert.equal((await runCli(repo, ["check", "--scope", "packages/api"])).code, 0);
    const snapshot = await repo.snapshot();
    assert.equal((await runCli(repo, ["init", "--scope", "packages/api"])).code, 0);
    assert.deepEqual(await repo.snapshot(), snapshot);
    const output = createCapturedOutput();
    assert.equal(
      await main(["decision", "new", "local", "--scope", "packages/api"], {
        cwd: repo.path("packages/api/src"),
        output,
      }),
      0,
      output.stderr,
    );
    assert.equal(await repo.exists("packages/api/.context/decisions/local.md"), true);
    assert.equal(await repo.exists(".context/decisions/local.md"), false);
    assert.equal(
      (await runCli(repo, ["decision", "list", "--scope", "packages/api"])).stdout.trim(),
      ".context/decisions/local.md",
    );
    assert.equal(
      (await runCli(repo, ["state", "archive", "done", "--scope", "packages/api"])).code,
      0,
    );
    assert.equal(await repo.exists("packages/api/.context/history/done.md"), true);
  });

  it("checks local and shared references without allowing paths outside Git", async () => {
    const repo = await monorepo();
    await runCli(repo, ["init"]);
    await runCli(repo, ["init", "--scope", "packages/api"]);
    await repo.write("shared.md", "Shared information\n");
    await repo.write(
      "packages/api/.context/truth/links.md",
      "[Parent](../../../../.context/index.md)\n`shared.md`\n[Invalid](../../../../../../missing.md)\n",
    );
    const result = await runCli(repo, ["check", "--scope", "packages/api", "--json"]);
    assert.equal(result.code, 1);
    const links = JSON.parse(result.stdout).findings.filter(
      (finding: { code: string }) => finding.code === "LINK001",
    );
    assert.equal(links.length, 1);
    assert.match(links[0].message, /missing.md/);
  });

  it("discovers untracked contexts, ignores dependencies and handles deleted tracked scopes", async () => {
    const repo = await monorepo();
    await runCli(repo, ["init"]);
    await runCli(repo, ["init", "--scope", "packages/web"]);
    await repo.commitAll("initial contexts");
    await repo.remove("packages/web");
    await runCli(repo, ["init", "--scope", "packages/api"]);
    await repo.write(".gitignore", "node_modules/\n");
    await repo.write("node_modules/foreign/.context/index.md", "ignored\n");
    const scopes = await discoverScopes(Repository.atRoot(repo.root));
    assert.deepEqual(
      scopes.map((scope) => scope.scope),
      [".", "packages/api"],
    );
  });

  it("aggregates checks and stats in stable envelopes and preserves single-check JSON", async () => {
    const repo = await monorepo();
    await runCli(repo, ["init"]);
    await runCli(repo, ["init", "--scope", "packages/api"]);
    const single = JSON.parse((await runCli(repo, ["check", "--json"])).stdout);
    assert.deepEqual(Object.keys(single).sort(), ["findings", "ok", "version"]);
    const check = await runCli(repo, ["check", "--all", "--json", "--strict"]);
    assert.equal(check.code, 1);
    const report = JSON.parse(check.stdout);
    assert.equal(report.ok, false);
    assert.deepEqual(
      report.scopes.map((scope: { scope: string }) => scope.scope),
      [".", "packages/api"],
    );
    const stats = JSON.parse((await runCli(repo, ["stats", "--all", "--json"])).stdout);
    assert.equal(stats.scopes.length, 2);
    assert.equal(stats.scopes[0].result.total.files, 7);
    const status = await runCli(repo, ["status", "--all"]);
    assert.match(status.stdout, /Scope: packages\/api/);
    await repo.write(
      "packages/api/.context/manifest.json",
      '{"protocol":"repository-context","schemaVersion":999}',
    );
    assert.equal((await runCli(repo, ["check", "--all", "--json"])).code, 3);
    const failedStats = await runCli(repo, ["stats", "--all", "--json"]);
    assert.equal(failedStats.code, 3);
    assert.equal(JSON.parse(failedStats.stdout).scopes[1].result.exitCode, 3);
  });

  it("keeps freshness scoped to the package's Git activity", async () => {
    const repo = await monorepo();
    await runCli(repo, ["init", "--scope", "packages/api"]);
    await repo.write("packages/api/.context/state/current.md", "Current package state\n");
    await repo.commitAll("package context", { date: "2020-01-01T00:00:00Z" });
    await repo.write("unrelated.txt", "root-only activity\n");
    await repo.commitAll("root activity", { date: "2020-06-01T00:00:00Z" });
    const result = await runCli(repo, ["check", "--scope", "packages/api", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(
      JSON.parse(result.stdout).findings.some(
        (finding: { code: string }) => finding.code === "STATE001",
      ),
      false,
    );
  });

  it("rejects escaping, missing, symlinked and other-Git scopes and conflicting flags", async () => {
    const repo = await monorepo();
    await repo.link("api", "packages/alias");
    await repo.git(["init", "-q", "packages/web"]);
    const before = await repo.snapshot();
    for (const scope of [
      "../escape",
      "/absolute",
      "missing",
      "packages/alias",
      "packages/web",
      "packages\\api",
      ".git",
      ".context",
    ]) {
      const result = await runCli(repo, ["init", "--scope", scope]);
      assert.equal(result.code, 2, `${scope}: ${result.stderr}`);
    }
    assert.equal((await runCli(repo, ["check", "--all", "--scope", "."])).code, 2);
    assert.deepEqual(await repo.snapshot(), before);
  });
  it("supports package-only repositories and reports missing root when nothing is discovered", async () => {
    const repo = await monorepo();
    const empty = await runCli(repo, ["check", "--all", "--json"]);
    assert.equal(empty.code, 1);
    assert.equal(JSON.parse(empty.stdout).scopes[0].scope, ".");
    await runCli(repo, ["init", "--scope", "packages/api"]);
    const check = await runCli(repo, ["check", "--all", "--json"]);
    assert.equal(check.code, 0);
    assert.deepEqual(
      JSON.parse(check.stdout).scopes.map((entry: { scope: string }) => entry.scope),
      ["packages/api"],
    );
  });
});
