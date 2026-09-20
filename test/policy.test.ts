/**
 * `AGENT-POLICY.md`: seeded on request, owned by the repository afterwards.
 *
 * The file is deliberately not a managed one, so these tests care about two
 * things: that Syngraphe creates it only when asked, and that it never
 * destroys an existing one without `--force` spelled out.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { POLICY_CONTENTS, POLICY_FILE } from "../src/templates/policy.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

async function repoWith(files: Record<string, string> = {}): Promise<TempRepo> {
  const repo = await TempRepo.create(files);
  after(() => repo.cleanup());
  return repo;
}

const EDITED = "# AGENT-POLICY.md\n\nOur own rules.\n";

describe("agent operating policy", () => {
  it("is not created by a plain init", async () => {
    const repo = await repoWith();

    assert.equal((await runCli(repo, ["init"])).code, 0);

    assert.equal(await repo.exists(POLICY_FILE), false);
  });

  it("is seeded at the repository root by init --policy", async () => {
    const repo = await repoWith();

    const result = await runCli(repo, ["init", "--policy"]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(await repo.read(POLICY_FILE), POLICY_CONTENTS);
  });

  it("is seeded by policy add", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);

    const result = await runCli(repo, ["policy", "add"]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(await repo.read(POLICY_FILE), POLICY_CONTENTS);
  });

  it("keeps an existing policy when init --policy runs again", async () => {
    const repo = await repoWith({ [POLICY_FILE]: EDITED });

    const result = await runCli(repo, ["init", "--policy"]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(await repo.read(POLICY_FILE), EDITED);
    assert.match(result.stdout, /UNCHANGED[\s\S]*AGENT-POLICY\.md/);
  });

  it("never lets the optional policy stop init, whatever is already there", async () => {
    const repo = await repoWith({ "agent-policy.md": EDITED });

    const result = await runCli(repo, ["init", "--policy"]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /UNCHANGED[\s\S]*agent-policy\.md\s+\(already present\)/);
    assert.equal(await repo.read("agent-policy.md"), EDITED);
  });

  it("refuses to replace an existing policy without --force", async () => {
    const repo = await repoWith({ [POLICY_FILE]: EDITED });
    assert.equal((await runCli(repo, ["init"])).code, 0);
    const before = await repo.snapshot();

    const result = await runCli(repo, ["policy", "add"]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /CONFLICTS[\s\S]*already exists[\s\S]*--force/);
    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("replaces an edited policy with --force", async () => {
    const repo = await repoWith({ [POLICY_FILE]: EDITED });
    assert.equal((await runCli(repo, ["init"])).code, 0);

    const result = await runCli(repo, ["policy", "add", "--force"]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(await repo.read(POLICY_FILE), POLICY_CONTENTS);
  });

  /** The one dry run the shared invariant test cannot reach: --force over real content. */
  it("leaves an existing policy alone under --force --dry-run", async () => {
    const repo = await repoWith({ [POLICY_FILE]: EDITED });
    assert.equal((await runCli(repo, ["init"])).code, 0);
    const before = await repo.snapshot();

    const result = await runCli(repo, ["policy", "add", "--force", "--dry-run"]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /^PATCH$/m);
    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("writes nothing when --force finds the current template", async () => {
    const repo = await repoWith({ [POLICY_FILE]: POLICY_CONTENTS });
    assert.equal((await runCli(repo, ["init"])).code, 0);

    const result = await runCli(repo, ["policy", "add", "--force"]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /UNCHANGED/);
    assert.doesNotMatch(result.stdout, /^CREATE|^PATCH/m);
  });

  /**
   * On a case-insensitive filesystem the two spellings are one file; on a
   * case-sensitive one, creating the second spelling would give the repository
   * two policies, only one of which every other platform can see.
   */
  it("refuses a file that differs from the policy only by case", async () => {
    const repo = await repoWith({ "agent-policy.md": EDITED });
    assert.equal((await runCli(repo, ["init"])).code, 0);
    const before = await repo.snapshot();

    const result = await runCli(repo, ["policy", "add", "--force"]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /CONFLICTS[\s\S]*differs from AGENT-POLICY\.md only by case/);
    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("refuses to write a second policy inside a scope", async () => {
    const repo = await repoWith({ "packages/api/index.ts": "export {};\n" });
    assert.equal((await runCli(repo, ["init"])).code, 0);
    assert.equal((await runCli(repo, ["init", "--scope", "packages/api"])).code, 0);

    const result = await runCli(repo, ["policy", "add", "--scope", "packages/api"]);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /belongs to the repository root/);
    assert.equal(await repo.exists("packages/api/AGENT-POLICY.md"), false);
  });
});
