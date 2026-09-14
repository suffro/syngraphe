/**
 * The `--dry-run` guarantee, held for every mutating command at once.
 *
 * A dry run runs the same planner as the real command and performs no
 * repository mutations: it does not modify repository contents or Git state.
 * The repository is deliberately dirty — untracked, staged and unstaged
 * changes — so that anything touching the index or Git's view of the worktree
 * has something observable to change.
 */

import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { after, describe, it } from "node:test";
import { CURRENT_STATE_PATH } from "../src/templates/context.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

type Fixture = "uninitialized" | "initialized";

const mutatingCommands: { fixture: Fixture; args: string[] }[] = [
  { fixture: "uninitialized", args: ["init"] },
  { fixture: "uninitialized", args: ["init", "--scope", "packages/api"] },
  { fixture: "initialized", args: ["truth", "new", "domain-model"] },
  { fixture: "initialized", args: ["decision", "new", "use-postgres"] },
  { fixture: "initialized", args: ["state", "new", "migration"] },
  { fixture: "initialized", args: ["history", "new", "migration-outcome"] },
  { fixture: "initialized", args: ["state", "archive", "phase-one"] },
];

async function dirtyRepository(fixture: Fixture): Promise<TempRepo> {
  const repo = await TempRepo.create({
    "README.md": "# Project\n",
    "AGENTS.md": "# Project\n\nHouse rules.\n",
    "packages/api/index.ts": "export {};\n",
  });
  after(() => repo.cleanup());
  if (fixture === "initialized") {
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(CURRENT_STATE_PATH, "# Current State\n\n## Current focus\n\nPhase one.\n");
  }
  await repo.commitAll("baseline");

  await repo.write("untracked.txt", "never added\n");
  await repo.write("README.md", "# Project\n\nStaged change.\n");
  await repo.git(["add", "README.md"]);
  await repo.write("README.md", "# Project\n\nStaged change.\n\nUnstaged change.\n");
  return repo;
}

/** Staged or moved-aside files, anywhere below the root, `.git` included. */
async function syngrapheTemporaries(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true });
  return entries.filter((entry) => path.basename(entry).startsWith(".syngraphe-"));
}

describe("--dry-run performs no repository mutations", () => {
  for (const { fixture, args } of mutatingCommands) {
    for (const json of [false, true]) {
      const argv = [...args, "--dry-run", ...(json ? ["--json"] : [])];

      it(`syngraphe ${argv.join(" ")}`, async () => {
        const repo = await dirtyRepository(fixture);
        const tree = await repo.snapshot();
        const git = await repo.gitSnapshot();

        const result = await runCli(repo, argv);

        assert.equal(result.code, 0, result.stderr);
        // An empty plan would say nothing about whether apply was skipped.
        if (json) assert.ok(JSON.parse(result.stdout).operations.length > 0, result.stdout);
        else assert.match(result.stdout, /^(CREATE|PATCH)$/m);
        assert.deepEqual(await repo.snapshot(), tree);
        assert.deepEqual(await repo.gitSnapshot(), git);
        assert.deepEqual(await syngrapheTemporaries(repo.root), []);
      });
    }
  }
});
