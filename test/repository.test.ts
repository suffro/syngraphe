import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { Repository } from "../src/core/repository.ts";
import { TempRepo } from "./helpers/repo.ts";

async function repository(): Promise<{ repo: TempRepo; repository: Repository }> {
  const repo = await TempRepo.create();
  after(() => repo.cleanup());
  return { repo, repository: Repository.atRoot(repo.root) };
}

describe("Repository path safety", () => {
  it("resolves repository-relative paths", async () => {
    const { repo, repository: target } = await repository();
    assert.equal(target.resolve(".context/index.md"), repo.path(".context/index.md"));
  });

  it("rejects paths that escape the repository root", async () => {
    const { repository: target } = await repository();
    assert.throws(() => target.resolve("../outside.md"), /escapes the repository root/);
    assert.throws(() => target.resolve(".context/../../outside.md"), /escapes the repository root/);
  });

  it("rejects absolute paths", async () => {
    const { repository: target } = await repository();
    assert.throws(() => target.resolve("/etc/passwd"), /outside repository control/);
  });

  it("refuses to write through a symlinked directory", async () => {
    const { repo, repository: target } = await repository();
    await repo.makeDirectory("real");
    await repo.link("real", "linked");

    await assert.rejects(
      () => target.write("linked/notes.md", "content\n"),
      /Refusing to write through a symlink/,
    );
    assert.equal(await repo.exists("real/notes.md"), false);
  });

  it("refuses to overwrite a symlinked file", async () => {
    const { repo, repository: target } = await repository();
    await repo.write("real.md", "original\n");
    await repo.link("real.md", "linked.md");

    await assert.rejects(
      () => target.write("linked.md", "replaced\n"),
      /Refusing to write through a symlink/,
    );
    assert.equal(await repo.read("real.md"), "original\n");
  });

  it("writes complete files without leaving temporary files behind", async () => {
    const { repo, repository: target } = await repository();
    await target.write("nested/deep/file.md", "content\n");

    assert.equal(await repo.read("nested/deep/file.md"), "content\n");
    const entries = [...(await repo.snapshot()).keys()];
    assert.deepEqual(entries, ["nested/deep/file.md"]);
  });
});
