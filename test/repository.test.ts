import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createTextFileExclusive } from "../src/core/fs.ts";
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

describe("Repository exclusive creation", () => {
  it("creates a missing file and reports the destination as taken afterwards", async () => {
    const { repo, repository: target } = await repository();

    assert.equal(await target.create("nested/deep/new.md", "first\n"), true);
    assert.equal(await repo.read("nested/deep/new.md"), "first\n");

    assert.equal(await target.create("nested/deep/new.md", "second\n"), false);
    assert.equal(await repo.read("nested/deep/new.md"), "first\n");
    assert.deepEqual([...(await repo.snapshot()).keys()], ["nested/deep/new.md"]);
  });

  it("refuses a destination that is not a regular file rather than replacing it", async () => {
    const { repo, repository: target } = await repository();
    await repo.write("real.md", "original\n");
    await repo.link("real.md", "linked.md");
    await repo.makeDirectory("folder");

    await assert.rejects(
      () => target.create("linked.md", "replaced\n"),
      /Refusing to write through a symlink/,
    );
    assert.equal(await repo.read("real.md"), "original\n");
    assert.equal(await target.create("folder", "replaced\n"), false);
  });

  it("gives exactly one winner when many creates race for one path", async () => {
    const { repo, repository: target } = await repository();
    const writers = Array.from({ length: 16 }, (_, index) => `writer ${index}\n`);

    // The assertion holds under every possible interleaving: exclusivity comes
    // from the filesystem, not from the order the promises happen to resume in.
    const results = await Promise.all(writers.map((body) => target.create("contested.md", body)));

    assert.equal(results.filter(Boolean).length, 1);
    const published = await repo.read("contested.md");
    assert.equal(published, writers[results.indexOf(true)]);
    assert.deepEqual([...(await repo.snapshot()).keys()], ["contested.md"]);
  });

  it("still gives exactly one winner on filesystems without hard links", async () => {
    const { repo } = await repository();
    const noHardLinks = async (): Promise<void> => {
      throw Object.assign(new Error("hard links unsupported"), { code: "EPERM" });
    };
    const writers = Array.from({ length: 8 }, (_, index) => `writer ${index}\n`);

    const results = await Promise.all(
      writers.map((body) => createTextFileExclusive(repo.path("fallback.md"), body, noHardLinks)),
    );

    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await repo.read("fallback.md"), writers[results.indexOf(true)]);
    assert.deepEqual([...(await repo.snapshot()).keys()], ["fallback.md"]);
  });
});
