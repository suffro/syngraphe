import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { runCli, TempRepo } from "./helpers/repo.ts";

async function repoWith(files: Record<string, string> = {}): Promise<TempRepo> {
  const repo = await TempRepo.create(files);
  after(() => repo.cleanup());
  return repo;
}

describe("syngraphe status", () => {
  it("reports an uninitialized repository without failing", async () => {
    const repo = await repoWith();

    const result = await runCli(repo, ["status"]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /status\s+not initialized/);
    assert.match(result.stdout, /Run `syngraphe init`/);
  });

  it("summarizes an initialized repository", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(".context/decisions/0001-use-markdown.md", "# Use Markdown\n");
    await repo.write(".context/decisions/0002-git-native.md", "# Git native\n");
    await repo.write(".context/history/2024-migration.md", "# Migration\n");

    const result = await runCli(repo, ["status"]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /schema\s+v1/);
    assert.match(result.stdout, /layout\s+standard/);
    assert.match(result.stdout, /architecture\s+present/);
    assert.match(result.stdout, /decisions\s+2/);
    assert.match(result.stdout, /history\s+1/);
    assert.match(result.stdout, /AGENTS\.md\s+ready/);
    assert.match(result.stdout, /Claude\s+ready/);
    assert.match(result.stdout, /Cursor\s+native/);
    assert.match(result.stdout, /Codex\s+native/);
    assert.match(result.stdout, /0 errors/);
    assert.match(result.stdout, /1 warning/);
  });

  it("does not modify the repository", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    const before = await repo.snapshot();

    await runCli(repo, ["status"]);

    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("reports an agent that is not configured", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.remove("CLAUDE.md");

    const result = await runCli(repo, ["status"]);

    assert.match(result.stdout, /Claude\s+not configured/);
  });
});
