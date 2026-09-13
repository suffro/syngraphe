import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { after, describe, it } from "node:test";
import { planDocument } from "../src/commands/documents.ts";
import { applyPlan } from "../src/core/plan.ts";
import { Repository } from "../src/core/repository.ts";
import { CONTEXT_TEMPLATES, CURRENT_STATE_PATH } from "../src/templates/context.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

async function initialized() {
  const repo = await TempRepo.create();
  after(() => repo.cleanup());
  assert.equal((await runCli(repo, ["init"])).code, 0);
  return repo;
}

describe("document commands", () => {
  for (const [category, directory] of [
    ["truth", "truth"],
    ["decision", "decisions"],
    ["state", "state"],
    ["history", "history"],
  ] as const) {
    it(`creates and lists ${category} documents with honest dry-run`, async () => {
      const repo = await initialized();
      const before = await repo.snapshot();
      const args = [category, "new", "my_note.md", "--title", "My note"];
      const dry = await runCli(repo, [...args, "--dry-run"]);
      assert.equal(dry.code, 0, dry.stderr);
      assert.match(dry.stdout, /CREATE/);
      assert.deepEqual(await repo.snapshot(), before);
      const result = await runCli(repo, args);
      assert.equal(result.code, 0, result.stderr);
      const file = `.context/${directory}/my_note.md`;
      const contents = await repo.read(file);
      assert.match(contents, /^# My note\n/);
      if (category === "truth") assert.equal(contents, "# My note\n");
      const list = await runCli(repo, [category, "list"]);
      assert.equal(list.code, 0);
      assert.match(list.stdout, /my_note.md/);
      assert.doesNotMatch(list.stdout, /README.md/);
      const snapshot = await repo.snapshot();
      assert.equal((await runCli(repo, args)).code, 1);
      assert.equal((await runCli(repo, [category, "new", "MY_NOTE"])).code, 1);
      assert.deepEqual(await repo.snapshot(), snapshot);
    });
  }

  it("lists every top-level regular truth document in filename order", async () => {
    const repo = await initialized();
    assert.equal((await runCli(repo, ["truth", "new", "zeta"])).code, 0);
    assert.equal((await runCli(repo, ["truth", "new", "alpha"])).code, 0);
    assert.equal(await repo.read(".context/truth/zeta.md"), "# zeta\n");
    await repo.write(".context/truth/notes.txt", "not Markdown\n");
    await repo.write(".context/truth/README.md", "excluded\n");
    await repo.makeDirectory(".context/truth/directory.md");
    await repo.link("architecture.md", ".context/truth/link.md");

    const result = await runCli(repo, ["truth", "list"]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(
      result.stdout,
      [
        ".context/truth/alpha.md",
        ".context/truth/architecture.md",
        ".context/truth/conventions.md",
        ".context/truth/zeta.md",
        "",
      ].join("\n"),
    );
  });

  it("does not overwrite core truth documents or case-only collisions", async () => {
    const repo = await initialized();
    const architecture = await repo.read(".context/truth/architecture.md");
    const before = await repo.snapshot();

    assert.equal((await runCli(repo, ["truth", "new", "architecture"])).code, 1);
    assert.equal((await runCli(repo, ["truth", "new", "ARCHITECTURE"])).code, 1);
    assert.equal(await repo.read(".context/truth/architecture.md"), architecture);
    assert.deepEqual(await repo.snapshot(), before);
  });

  it("rejects unsafe and nonportable filenames and multiline titles without writes", async () => {
    const repo = await initialized();
    const before = await repo.snapshot();
    for (const name of [
      "../escape",
      "/absolute",
      "nested/file",
      "a\\b",
      "README",
      "CON",
      "bad.md.md",
      ".",
      "a".repeat(121),
    ]) {
      const result = await runCli(repo, ["truth", "new", name]);
      assert.equal(result.code, 2, `${name}: ${result.stderr}`);
    }
    assert.equal((await runCli(repo, ["state", "new", "note", "--title", "line\nbreak"])).code, 2);
    assert.deepEqual(await repo.snapshot(), before);
  });

  it("archives current state byte for byte and resets it only after dry-run", async () => {
    const repo = await initialized();
    const current = "# Current State\r\n\r\nUser-owned state with no final newline";
    await repo.write(CURRENT_STATE_PATH, current);
    const before = await repo.snapshot();
    assert.equal((await runCli(repo, ["state", "archive", "completed", "--dry-run"])).code, 0);
    assert.deepEqual(await repo.snapshot(), before);
    const result = await runCli(repo, ["state", "archive", "completed"]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(await repo.read(".context/history/completed.md"), current);
    assert.equal(
      await repo.read(CURRENT_STATE_PATH),
      CONTEXT_TEMPLATES.find((f) => f.path === CURRENT_STATE_PATH)?.contents,
    );
    await repo.write(CURRENT_STATE_PATH, "New user work\n");
    assert.equal((await runCli(repo, ["state", "archive", "completed"])).code, 1);
    assert.equal(await repo.read(CURRENT_STATE_PATH), "New user work\n");
  });

  it("rejects stale archive plans before creating history", async () => {
    const repo = await initialized();
    const repository = Repository.atRoot(repo.root);
    const plan = await planDocument(repository, "history", "snapshot", { archive: true });
    await repo.write(CURRENT_STATE_PATH, "Changed since planning\n");
    await assert.rejects(() => applyPlan(repository, plan), /changed since/);
    assert.equal(await repo.exists(".context/history/snapshot.md"), false);
  });

  it("rejects symlinked destinations before any archive operation", async () => {
    const repo = await initialized();
    const repository = Repository.atRoot(repo.root);
    const plan = await planDocument(repository, "history", "snapshot", { archive: true });
    const before = await repo.read(CURRENT_STATE_PATH);
    await repo.remove(".context/history");
    await repo.makeDirectory("elsewhere");
    await repo.link("../elsewhere", ".context/history");
    await assert.rejects(() => applyPlan(repository, plan), /symlink/);
    assert.equal(await repo.read(CURRENT_STATE_PATH), before);
    assert.equal(await repo.exists("elsewhere/snapshot.md"), false);
  });

  it("requires initialized supported context", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());
    assert.equal((await runCli(repo, ["decision", "new", "note"])).code, 1);
    assert.equal((await runCli(repo, ["decision", "list"])).code, 1);
    assert.equal((await repo.snapshot()).size, 0);
    await runCli(repo, ["init"]);
    await repo.write(
      ".context/manifest.json",
      '{"protocol":"repository-context","schemaVersion":999}',
    );
    assert.equal((await runCli(repo, ["history", "new", "note"])).code, 3);
  });
  it("refuses to archive invalid UTF-8 instead of silently changing source bytes", async () => {
    const repo = await initialized();
    await writeFile(repo.path(CURRENT_STATE_PATH), Buffer.from([0x80]));
    const result = await runCli(repo, ["state", "archive", "invalid"]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /valid UTF-8/);
    assert.equal(await repo.exists(".context/history/invalid.md"), false);
    assert.deepEqual(
      await Repository.atRoot(repo.root).readBytes(CURRENT_STATE_PATH),
      Buffer.from([0x80]),
    );
  });
});
