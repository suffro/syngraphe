import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { planInitialization } from "../src/commands/init.ts";
import { Repository } from "../src/core/repository.ts";
import { removeManagedBlock, validateManagedBlock } from "../src/managed/block.ts";
import { AGENTS_MANAGED_BODY, CLAUDE_MANAGED_BODY } from "../src/templates/agents.ts";
import { CONTEXT_PROTOCOL, CONTEXT_TEMPLATES, MANIFEST_PATH } from "../src/templates/context.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

/** Create a repository that is removed when the test file finishes. */
async function repoWith(files: Record<string, string> = {}): Promise<TempRepo> {
  const repo = await TempRepo.create(files);
  after(() => repo.cleanup());
  return repo;
}

describe("syngraphe init", () => {
  it("initializes an empty repository", async () => {
    const repo = await repoWith();
    const result = await runCli(repo, ["init"]);

    assert.equal(result.code, 0, result.stderr);
    for (const template of CONTEXT_TEMPLATES) {
      assert.equal(await repo.read(template.path), template.contents, template.path);
    }
    assert.equal(
      validateManagedBlock(await repo.read("AGENTS.md"), AGENTS_MANAGED_BODY).status,
      "valid",
    );
    assert.equal(
      validateManagedBlock(await repo.read("CLAUDE.md"), CLAUDE_MANAGED_BODY).status,
      "valid",
    );
  });

  it("writes a manifest that declares the protocol", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);

    assert.deepEqual(JSON.parse(await repo.read(MANIFEST_PATH)), {
      protocol: CONTEXT_PROTOCOL,
      schemaVersion: 1,
      layout: "standard",
    });
  });

  it("places the block after a top-level heading and preserves the rest", async () => {
    const original = "# Project\n\nHouse rules.\n\n## Details\n\n- one\n- two\n";
    const repo = await repoWith({ "AGENTS.md": original });

    assert.equal((await runCli(repo, ["init"])).code, 0);

    const patched = await repo.read("AGENTS.md");
    const lines = patched.split("\n");
    assert.equal(lines[0], "# Project");
    assert.equal(lines[2], '<!-- syngraphe:start version="1" -->');
    assert.equal(removeManagedBlock(patched), original, "user content must be preserved exactly");
  });

  it("places the block at the top when there is no heading and preserves the rest", async () => {
    const original = "House rules.\n\nMore rules.\n";
    const repo = await repoWith({ "AGENTS.md": original });

    assert.equal((await runCli(repo, ["init"])).code, 0);

    const patched = await repo.read("AGENTS.md");
    assert.ok(patched.startsWith('<!-- syngraphe:start version="1" -->'));
    assert.equal(removeManagedBlock(patched), original);
  });

  it("preserves CRLF line endings", async () => {
    const original = "# Project\r\n\r\nHouse rules.\r\n";
    const repo = await repoWith({ "AGENTS.md": original });

    assert.equal((await runCli(repo, ["init"])).code, 0);

    const patched = await repo.read("AGENTS.md");
    assert.ok(!/(?<!\r)\n/.test(patched), "line endings must stay CRLF");
    assert.equal(removeManagedBlock(patched), original);
  });

  it("preserves a missing final newline", async () => {
    const original = "# Project\n\nHouse rules.";
    const repo = await repoWith({ "AGENTS.md": original });

    assert.equal((await runCli(repo, ["init"])).code, 0);

    const patched = await repo.read("AGENTS.md");
    assert.ok(!patched.endsWith("\n"));
    assert.equal(removeManagedBlock(patched), original);
  });

  it("preserves existing CLAUDE.md content", async () => {
    const original = "# Claude\n\nClaude-specific instructions.\n";
    const repo = await repoWith({ "CLAUDE.md": original });

    assert.equal((await runCli(repo, ["init"])).code, 0);

    const patched = await repo.read("CLAUDE.md");
    assert.equal(validateManagedBlock(patched, CLAUDE_MANAGED_BODY).status, "valid");
    assert.equal(removeManagedBlock(patched), original);
  });

  it("leaves a CLAUDE.md that already imports AGENTS.md alone", async () => {
    const original = "# Claude\n\n@AGENTS.md\n\nExtra notes.\n";
    const repo = await repoWith({ "CLAUDE.md": original });

    const result = await runCli(repo, ["init"]);

    assert.equal(result.code, 0);
    assert.equal(await repo.read("CLAUDE.md"), original);
    assert.match(result.stdout, /CLAUDE\.md\s+\(CLAUDE\.md already imports AGENTS\.md\.\)/);
  });

  it("leaves a CLAUDE.md symlinked to AGENTS.md alone", async () => {
    const repo = await repoWith({ "AGENTS.md": "# Project\n" });
    await repo.link("AGENTS.md", "CLAUDE.md");

    assert.equal((await runCli(repo, ["init"])).code, 0);

    const snapshot = await repo.snapshot();
    assert.equal(snapshot.get("CLAUDE.md"), "<symlink>", "the symlink must survive");
    assert.equal(
      validateManagedBlock(await repo.read("AGENTS.md"), AGENTS_MANAGED_BODY).status,
      "valid",
    );
  });

  it("leaves vendor configuration untouched and reports it", async () => {
    const rule = "always be nice\n";
    const repo = await repoWith({ ".cursor/rules/base.mdc": rule });

    const result = await runCli(repo, ["init"]);

    assert.equal(result.code, 0);
    assert.equal(await repo.read(".cursor/rules/base.mdc"), rule);
    assert.match(result.stdout, /UNCHANGED[\s\S]*\.cursor\/rules\//);
  });

  it("is idempotent", async () => {
    const repo = await repoWith({ "AGENTS.md": "# Project\n\nHouse rules.\n" });

    assert.equal((await runCli(repo, ["init"])).code, 0);
    const afterFirst = await repo.snapshot();

    const second = await runCli(repo, ["init"]);
    const afterSecond = await repo.snapshot();

    assert.equal(second.code, 0);
    assert.deepEqual([...afterSecond.entries()], [...afterFirst.entries()]);
  });

  it("refuses to touch a manually modified managed block", async () => {
    const repo = await repoWith({ "AGENTS.md": "# Project\n" });
    assert.equal((await runCli(repo, ["init"])).code, 0);

    await repo.write("AGENTS.md", (await repo.read("AGENTS.md")).replace("`.context/`", "`.ctx/`"));
    const before = await repo.snapshot();

    const result = await runCli(repo, ["init"]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /CONFLICTS[\s\S]*modified manually/);
    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("refuses to act on duplicate managed blocks", async () => {
    const repo = await repoWith({ "AGENTS.md": "# Project\n" });
    assert.equal((await runCli(repo, ["init"])).code, 0);

    const patched = await repo.read("AGENTS.md");
    await repo.write("AGENTS.md", `${patched}\n${patched}`);
    const before = await repo.snapshot();

    const result = await runCli(repo, ["init"]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /2 Syngraphe blocks/);
    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("aborts on an unrelated .context directory", async () => {
    const repo = await repoWith({ ".context/notes.txt": "unrelated data\n" });
    const before = await repo.snapshot();

    const result = await runCli(repo, ["init"]);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /not a Syngraphe repository context/);
    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("aborts on a .context directory belonging to another protocol", async () => {
    const repo = await repoWith({
      [MANIFEST_PATH]: '{ "protocol": "acme-context", "schemaVersion": 1 }\n',
      ".context/notes.txt": "unrelated data\n",
    });
    const before = await repo.snapshot();

    const result = await runCli(repo, ["init"]);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /declares protocol "acme-context"/);
    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("aborts on an unsupported schema version", async () => {
    const repo = await repoWith({
      [MANIFEST_PATH]: '{ "schemaVersion": 99, "layout": "standard" }\n',
    });
    const before = await repo.snapshot();

    const result = await runCli(repo, ["init"]);

    assert.equal(result.code, 3);
    assert.match(result.stderr, /schema version 99/);
    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("completes a partial context without touching existing files", async () => {
    const custom = "# Repository Context\n\nHand written router.\n";
    const repo = await repoWith({ ".context/index.md": custom });

    const result = await runCli(repo, ["init"]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(await repo.read(".context/index.md"), custom);
    assert.equal(await repo.exists(MANIFEST_PATH), true);
  });
});

describe("syngraphe init --dry-run", () => {
  it("reports the plan and changes nothing", async () => {
    const repo = await repoWith({ "AGENTS.md": "# Project\n" });
    const before = await repo.snapshot();

    const result = await runCli(repo, ["init", "--dry-run"]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Syngraphe initialization plan/);
    assert.match(result.stdout, /No files were modified\./);
    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("uses the same plan the real run applies", async () => {
    const repo = await repoWith({ "AGENTS.md": "# Project\n" });
    const repository = Repository.atRoot(repo.root);
    const plan = await planInitialization(repository);

    assert.equal((await runCli(repo, ["init", "--dry-run"])).code, 0);
    assert.equal((await runCli(repo, ["init"])).code, 0);

    for (const operation of plan.operations) {
      const expected = operation.type === "create" ? operation.contents : operation.after;
      assert.equal(await repo.read(operation.path), expected, operation.path);
    }
    assert.equal(
      plan.operations.length,
      CONTEXT_TEMPLATES.length + 2,
      "context files + AGENTS.md + CLAUDE.md",
    );
  });
});
