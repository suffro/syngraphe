import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { main } from "../src/cli/main.ts";
import { createCapturedOutput } from "../src/cli/output.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

describe("syngraphe CLI", () => {
  it("is published under both command names", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { bin: Record<string, string> };

    // Both names are part of the published contract: `syg` is the shorthand.
    assert.deepEqual(Object.keys(manifest.bin).sort(), ["syg", "syngraphe"]);
    assert.equal(manifest.bin.syg, manifest.bin.syngraphe);
    assert.equal(manifest.bin.syngraphe, "dist/cli/bin.js");
  });

  it("prints help successfully", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());

    const result = await runCli(repo, ["--help"]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Usage: syngraphe/);
  });

  it("prints the version successfully", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());

    const result = await runCli(repo, ["--version"]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /^\d+\.\d+\.\d+/);
  });

  it("rejects an unknown command with the usage exit code", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());

    const result = await runCli(repo, ["frobnicate"]);

    assert.equal(result.code, 2);
  });

  it("rejects an unknown option with the usage exit code", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());

    const result = await runCli(repo, ["check", "--wat"]);

    assert.equal(result.code, 2);
  });

  it("refuses to run outside a Git repository", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "syngraphe-nogit-"));
    after(() => rm(directory, { recursive: true, force: true }));

    const output = createCapturedOutput();
    const code = await main(["status"], { output, cwd: directory });

    assert.equal(code, 2);
    assert.match(output.stderr, /Not inside a Git repository/);
  });
});
