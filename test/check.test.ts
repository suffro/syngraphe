import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createCapturedOutput } from "../src/cli/output.ts";
import { runCheck } from "../src/commands/check.ts";
import { Repository } from "../src/core/repository.ts";
import { CURRENT_STATE_PATH, INDEX_PATH, MANIFEST_PATH } from "../src/templates/context.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

interface JsonFinding {
  code: string;
  severity: string;
  category: string;
  file?: string;
  line?: number;
  message: string;
  details?: string;
}

interface JsonReport {
  version: number;
  ok: boolean;
  findings: JsonFinding[];
}

async function repoWith(files: Record<string, string> = {}): Promise<TempRepo> {
  const repo = await TempRepo.create(files);
  after(() => repo.cleanup());
  return repo;
}

/** Run the check command directly, so age-based checks get a fixed instant. */
async function check(
  repo: TempRepo,
  options: { strict?: boolean; now?: Date } = {},
): Promise<{ code: number; report: JsonReport }> {
  const output = createCapturedOutput();
  const code = await runCheck({
    repository: Repository.atRoot(repo.root),
    output,
    json: true,
    strict: options.strict ?? false,
    ...(options.now ? { now: options.now } : {}),
  });
  return { code, report: JSON.parse(output.stdout) as JsonReport };
}

function codes(report: JsonReport): string[] {
  return report.findings.map((finding) => finding.code);
}

describe("syngraphe check", () => {
  it("reports an uninitialized repository", async () => {
    const repo = await repoWith();
    const { code, report } = await check(repo);

    assert.equal(code, 1);
    assert.equal(report.ok, false);
    assert.deepEqual(codes(report), ["CTX001"]);
  });

  it("passes on a freshly initialized repository", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);

    const { code, report } = await check(repo);

    assert.equal(code, 0);
    assert.equal(report.ok, true);
    // The template state file is intentionally empty; that is a warning, not an error.
    assert.deepEqual(codes(report), ["STATE002"]);
  });

  it("fails on warnings in strict mode", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);

    const { code, report } = await check(repo, { strict: true });

    assert.equal(code, 1);
    assert.equal(report.ok, false);
  });

  it("does not modify the repository", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    const before = await repo.snapshot();

    await check(repo);

    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
  });

  it("detects a missing context file", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.remove(CURRENT_STATE_PATH);

    const { code, report } = await check(repo);

    assert.equal(code, 1);
    assert.ok(codes(report).includes("CTX002"));
    assert.equal(
      report.findings.find((finding) => finding.code === "CTX002")?.file,
      CURRENT_STATE_PATH,
    );
  });

  it("detects a broken reference and points at the line", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(INDEX_PATH, "# Repository Context\n\nSee [gone](truth/gone.md).\n");

    const { code, report } = await check(repo);
    const finding = report.findings.find((entry) => entry.code === "LINK001");

    assert.equal(code, 1);
    assert.equal(finding?.file, INDEX_PATH);
    assert.equal(finding?.line, 3);
  });

  it("accepts the references in the generated index", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);

    const { report } = await check(repo);

    assert.ok(!codes(report).includes("LINK001"), JSON.stringify(report.findings));
  });

  it("still catches a broken reference written as inline code", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(".context/decisions/0001-choice.md", "# Choice\n\nSee `truth/gone.md`.\n");

    const { code, report } = await check(repo);

    assert.equal(code, 1);
    assert.ok(codes(report).includes("LINK001"));
  });

  it("accepts a context-relative reference from a nested document", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    // `truth/architecture.md` from `history/` means what `index.md` means by it.
    await repo.write(".context/history/note.md", "# Note\n\nSuperseded `truth/architecture.md`.\n");

    const { report } = await check(repo);

    assert.ok(!codes(report).includes("LINK001"), JSON.stringify(report.findings));
  });

  it("does not treat a bare file extension as a reference", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(".context/decisions/0001-format.md", "# Format\n\nOnly `.md` is checked.\n");

    const { code, report } = await check(repo);

    assert.equal(code, 0);
    assert.ok(!codes(report).includes("LINK001"), JSON.stringify(report.findings));
  });

  it("does not treat a directory named in prose as a reference", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(
      ".context/truth/conventions.md",
      "# Conventions\n\nVendor rules in `.cursor/rules/` are not used here, and neither is `src/`.\n",
    );

    const { code, report } = await check(repo);

    assert.equal(code, 0);
    assert.ok(!codes(report).includes("LINK001"), JSON.stringify(report.findings));
  });

  it("reports an invalid manifest", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(MANIFEST_PATH, "{ not json\n");

    const { code, report } = await check(repo);

    assert.equal(code, 1);
    assert.ok(codes(report).includes("MANIFEST002"));
  });

  it("treats a manifest declaring another protocol as an unrelated directory", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(MANIFEST_PATH, '{ "protocol": "acme-context", "schemaVersion": 1 }\n');

    const { code, report } = await check(repo);
    const finding = report.findings.find((entry) => entry.code === "CTX003");

    assert.equal(code, 1);
    assert.match(finding?.details ?? "", /declares protocol "acme-context"/);
    // Identity is settled before the schema, so no manifest finding is added.
    assert.ok(
      !codes(report).some((entry) => entry.startsWith("MANIFEST")),
      JSON.stringify(report.findings),
    );
  });

  it("does not adopt another tool's .context because its manifest parses", async () => {
    const repo = await repoWith({
      [MANIFEST_PATH]: '{ "schemaVersion": 1, "layout": "standard" }\n',
      ".context/notes.txt": "unrelated data\n",
    });

    const { code, report } = await check(repo);

    assert.equal(code, 1);
    assert.ok(codes(report).includes("CTX003"), JSON.stringify(report.findings));
  });

  it("warns when the manifest declares no protocol", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(MANIFEST_PATH, '{ "schemaVersion": 1, "layout": "standard" }\n');

    const { code, report } = await check(repo);
    const finding = report.findings.find((entry) => entry.code === "MANIFEST005");

    // A warning, not an error: the context is still recognisable by its shape.
    assert.equal(code, 0);
    assert.equal(finding?.severity, "warning");
    assert.equal(finding?.file, MANIFEST_PATH);
  });

  it("exits with the schema code on an unsupported schema version", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(MANIFEST_PATH, '{ "schemaVersion": 99, "layout": "standard" }\n');

    const { code, report } = await check(repo);

    assert.equal(code, 3);
    assert.ok(codes(report).includes("MANIFEST003"));
  });

  it("reports a manually modified AGENTS.md block", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write("AGENTS.md", (await repo.read("AGENTS.md")).replace("`.context/`", "`.ctx/`"));

    const { code, report } = await check(repo);
    const finding = report.findings.find((entry) => entry.code === "AGENT002");

    assert.equal(code, 1);
    assert.equal(finding?.severity, "error");
    assert.equal(finding?.file, "AGENTS.md");
  });

  it("reports duplicate AGENTS.md blocks", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    const patched = await repo.read("AGENTS.md");
    await repo.write("AGENTS.md", `${patched}\n${patched}`);

    const { code, report } = await check(repo);

    assert.equal(code, 1);
    assert.ok(codes(report).includes("AGENT003"));
  });

  it("warns when a used agent has no integration", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.remove("CLAUDE.md");
    await repo.makeDirectory(".claude");

    const { code, report } = await check(repo);
    const finding = report.findings.find((entry) => entry.code === "CLAUDE001");

    assert.equal(code, 0, "a missing optional integration is not an error");
    assert.equal(finding?.severity, "warning");
  });

  it("stays quiet about agents the repository does not use", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.remove("CLAUDE.md");

    const { report } = await check(repo);

    assert.ok(!codes(report).includes("CLAUDE001"));
  });

  it("warns about a CLAUDE.md symlink that bypasses AGENTS.md", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.remove("CLAUDE.md");
    await repo.write("OTHER.md", "# Other\n");
    await repo.link("OTHER.md", "CLAUDE.md");

    const { code, report } = await check(repo);
    const finding = report.findings.find((entry) => entry.code === "CLAUDE005");

    assert.equal(code, 0);
    assert.equal(finding?.severity, "warning");
  });

  it("warns conservatively about a stale current state", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(CURRENT_STATE_PATH, "# Current State\n\n## Current focus\n\nShipping v0.1.\n");

    const now = new Date();
    const old = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
    await repo.commitAll("context", { date: old });
    await repo.write("src.txt", "later work\n");
    await repo.commitAll("work", { date: now.toISOString() });

    const { code, report } = await check(repo, { now });
    const finding = report.findings.find((entry) => entry.code === "STATE001");

    assert.equal(code, 0, "age is a signal, never an error");
    assert.equal(finding?.severity, "warning");
    assert.match(finding?.message ?? "", /has not changed in 100 days/);
  });

  it("does not warn about freshness when the repository has not moved on", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(CURRENT_STATE_PATH, "# Current State\n\n## Current focus\n\nShipping v0.1.\n");

    const now = new Date();
    const old = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
    await repo.commitAll("everything", { date: old });

    const { report } = await check(repo, { now });

    assert.ok(!codes(report).includes("STATE001"));
  });

  it("emits a stable JSON shape", async () => {
    const repo = await repoWith();
    const result = await runCli(repo, ["check", "--json"]);
    const report = JSON.parse(result.stdout) as JsonReport;

    assert.equal(result.code, 1);
    assert.equal(report.version, 1);
    assert.equal(report.ok, false);
    assert.equal(report.findings.length, 1);
    assert.deepEqual(Object.keys(report.findings[0] ?? {}), [
      "code",
      "severity",
      "category",
      "file",
      "message",
      "details",
    ]);
  });

  it("renders human-readable output", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);

    const result = await runCli(repo, ["check"]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Syngraphe context integrity/);
    assert.match(result.stdout, /✓ manifest/);
    assert.match(result.stdout, /✓ AGENTS\.md/);
    assert.match(result.stdout, /WARN STATE002/);
    assert.match(result.stdout, /1 warning/);
  });
});
