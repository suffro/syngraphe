import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { promisify } from "node:util";
import { parse } from "yaml";
import { readOptions } from "../action/src/options.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

const exec = promisify(execFile);

async function runBundle(repo: TempRepo, inputs: Record<string, string> = {}) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "syngraphe-action-test-"));
  after(() => rm(temp, { recursive: true, force: true }));
  const bundle = path.join(temp, "index.cjs");
  // Run away from the action source and node_modules: this is the published runtime artifact.
  await copyFile(new URL("../action/dist/index.cjs", import.meta.url), bundle);
  const output = path.join(temp, "output.txt");
  const summary = path.join(temp, "summary.md");
  await writeFile(output, "");
  await writeFile(summary, "");
  const env = {
    ...process.env,
    GITHUB_WORKSPACE: repo.root,
    RUNNER_TEMP: temp,
    GITHUB_OUTPUT: output,
    GITHUB_STEP_SUMMARY: summary,
  };
  for (const key of Object.keys(env))
    if (key.startsWith("INPUT_")) delete env[key as keyof typeof env];
  for (const [key, value] of Object.entries(inputs))
    Object.assign(env, { [`INPUT_${key.toUpperCase()}`]: value });
  let code = 0;
  let stdout = "";
  try {
    stdout = (await exec(process.execPath, [bundle], { cwd: repo.root, env })).stdout;
  } catch (error) {
    const failure = error as { code: number; stdout: string };
    code = failure.code;
    stdout = failure.stdout;
  }
  const outputText = await readFile(output, "utf8");
  const outputs: Record<string, string> = {};
  // Toolkit uses random delimiters; parse exactly those written to the runner output file.
  const lines = outputText.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const match = /^([^<]+)<<(.+)$/.exec(lines[index] ?? "");
    if (!match) continue;
    const values: string[] = [];
    while (++index < lines.length && lines[index] !== match[2]) values.push(lines[index] ?? "");
    outputs[match[1] ?? ""] = values.join("\n");
  }
  return { code, stdout, outputs, summary: await readFile(summary, "utf8"), temp };
}

describe("bundled GitHub Action", () => {
  it("has valid metadata and consistent default inputs", async () => {
    const metadata = parse(await readFile(new URL("../action.yml", import.meta.url), "utf8"));
    assert.equal(metadata.runs.using, "node24");
    assert.equal(metadata.runs.main, "action/dist/index.cjs");
    const names = new Set<string>();
    const defaults = readOptions((name) => {
      names.add(name);
      assert.equal(typeof metadata.inputs[name]?.default, "string", name);
      return metadata.inputs[name].default;
    });
    assert.deepEqual([...names].sort(), Object.keys(metadata.inputs).sort());
    assert.deepEqual(
      defaults,
      readOptions(() => ""),
    );
    assert(metadata.outputs["report-path"]);
  });

  it("runs standalone with outputs, summary and report while preserving the checkout", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());
    await runCli(repo, ["init"]);
    const before = await repo.snapshot();
    const result = await runBundle(repo, { command: "check-and-stats" });
    assert.equal(result.code, 0, result.stdout);
    const metadata = parse(await readFile(new URL("../action.yml", import.meta.url), "utf8"));
    assert.deepEqual(Object.keys(result.outputs).sort(), Object.keys(metadata.outputs).sort());
    assert.equal(result.outputs.ok, "true");
    assert.equal(result.outputs.warnings, "1");
    assert.match(result.stdout, /::warning .*STATE002/);
    assert.match(result.summary, /\*\*Passed\*\*/);
    const reportPath = result.outputs["report-path"];
    assert(reportPath);
    assert(reportPath.startsWith(result.temp));
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.version, 1);
    assert.equal(report.scopes[0].stats.total.files, 7);
    assert.deepEqual(await repo.snapshot(), before);
  });

  it("writes outputs and the report before failing, and allows report-only findings", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());
    await runCli(repo, ["init"]);
    const failed = await runBundle(repo, { strict: "true" });
    assert.equal(failed.code, 1);
    assert.equal(failed.outputs["exit-code"], "1");
    assert.equal(failed.outputs.ok, "false");
    assert(failed.outputs["report-path"]);
    const advisory = await runBundle(repo, {
      strict: "true",
      "fail-on-error": "false",
      annotations: "false",
      summary: "false",
    });
    assert.equal(advisory.code, 0);
    assert.equal(advisory.outputs.ok, "false");
    assert.doesNotMatch(advisory.stdout, /::warning|::error/);
    assert.equal(advisory.summary, "");
  });

  it("escapes workflow commands derived from untrusted repository content", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());
    await runCli(repo, ["init"]);
    await repo.write(
      ".context/manifest.json",
      JSON.stringify({ protocol: "foreign\n::error::injected", schemaVersion: 1 }),
    );
    const result = await runBundle(repo);
    assert.equal(result.code, 1);
    assert.doesNotMatch(result.stdout, /^::error::injected/m);
    assert.match(result.stdout, /%0A::error::injected/);
  });

  it("fails invalid input even in report-only mode without touching the checkout", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());
    const result = await runBundle(repo, { command: "init", "fail-on-error": "false" });
    assert.equal(result.code, 1);
    assert.equal(result.outputs["exit-code"], "2");
    assert.equal(result.outputs["report-path"], undefined);
    assert.equal((await repo.snapshot()).size, 0);
  });
  it("caps annotations without dropping findings from the report", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());
    await runCli(repo, ["init"]);
    const result = await runBundle(repo, { "max-annotations": "0" });
    assert.equal(result.code, 0);
    assert.doesNotMatch(result.stdout, /::warning/);
    assert.match(result.stdout, /Additional annotations omitted: 1/);
    const reportPath = result.outputs["report-path"];
    assert(reportPath);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.scopes[0].check.findings[0].code, "STATE002");
  });

  it("has a read-only CI matrix that exercises the Action before dependency installation", async () => {
    const workflow = parse(
      await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
    );
    assert.deepEqual(workflow.permissions, { contents: "read" });
    assert.deepEqual(workflow.jobs.verify.strategy.matrix.os, [
      "ubuntu-latest",
      "macos-latest",
      "windows-latest",
    ]);
    const steps: { uses?: string; run?: string }[] = workflow.jobs.verify.steps;
    assert(
      steps.findIndex((step) => step.uses === "./") <
        steps.findIndex((step) => step.run?.startsWith("npm ci")),
    );
    for (const step of steps)
      if (step.uses && step.uses !== "./")
        assert.match(step.uses, /^actions\/[a-z-]+@[0-9a-f]{40}$/);
    assert(steps.some((step) => step.run === "npm run action:check"));
  });
});
