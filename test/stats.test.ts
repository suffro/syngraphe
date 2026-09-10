import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { after, describe, it } from "node:test";
import { Repository } from "../src/core/repository.ts";
import { inspectStats } from "../src/inspectors/stats.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

async function initialized() {
  const repo = await TempRepo.create();
  after(() => repo.cleanup());
  await runCli(repo, ["init"]);
  return repo;
}

describe("context statistics", () => {
  it("measures UTF-8 bytes and words, separates history and never writes", async () => {
    const repo = await initialized();
    await repo.write(".context/truth/unicode.md", "caffè 世界\n");
    await repo.write(".context/history/done.md", "done\n");
    await repo.write(".context/attachment.bin", "binary\0data");
    const before = await repo.snapshot();
    const result = await runCli(repo, ["stats", "--json"]);
    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    const file = report.documents.find((file: { path: string }) =>
      file.path.endsWith("unicode.md"),
    );
    assert.equal(file.bytes, Buffer.byteLength("caffè 世界\n"));
    assert.equal(file.words, 2);
    assert.equal(file.estimatedTokens, Math.ceil(file.bytes / 4));
    assert.equal(
      report.total.bytes,
      [...before]
        .filter(([file]) => file.startsWith(".context/"))
        .reduce((sum, [, content]) => sum + Buffer.byteLength(content), 0),
    );
    assert.equal(report.total.bytes, report.active.bytes + report.history.bytes);
    assert.equal(report.history.markdownFiles, 2);
    assert.equal(report.total.files, 10);
    assert.equal((await runCli(repo, ["stats", "--json"])).stdout, result.stdout);
    assert.deepEqual(await repo.snapshot(), before);
  });

  it("reports exceeded budgets, large documents and exact duplicate groups as advisory", async () => {
    const repo = await initialized();
    const content = "Long document. ".repeat(1000);
    await repo.write(".context/truth/large.md", content);
    await repo.write(".context/history/copy.md", content);
    const result = await runCli(repo, ["stats", "--budget", "1", "--json"]);
    assert.equal(result.code, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.overBudget, true);
    assert.deepEqual(report.largeDocuments, [
      ".context/history/copy.md",
      ".context/truth/large.md",
    ]);
    assert.deepEqual(report.duplicates, [[".context/history/copy.md", ".context/truth/large.md"]]);
    const human = await runCli(repo, ["stats"]);
    assert.match(human.stdout, /Exact duplicate groups: 1/);
    assert.match(human.stdout, /not a model tokenizer/);
  });

  it("does not follow symlinks or include files outside the context", async () => {
    const repo = await initialized();
    await repo.write("outside.md", "secret\n");
    await repo.link("../../outside.md", ".context/truth/link.md");
    const report = await inspectStats(Repository.atRoot(repo.root));
    assert.deepEqual(report.skipped, [".context/truth/link.md"]);
    assert.equal(report.total.files, 7);
  });

  it("validates budgets and rejects absent or unrelated contexts", async () => {
    const repo = await TempRepo.create();
    after(() => repo.cleanup());
    for (const budget of ["0", "-1", "1.5", "NaN", "9007199254740992"]) {
      assert.equal((await runCli(repo, ["stats", "--budget", budget])).code, 2);
    }
    assert.equal((await runCli(repo, ["stats"])).code, 1);
    await repo.write(".context/foreign.txt", "other tool\n");
    assert.equal((await runCli(repo, ["stats"])).code, 1);
  });
  it("compares exact bytes even when Markdown contains invalid UTF-8", async () => {
    const repo = await initialized();
    await writeFile(repo.path(".context/truth/a.md"), Buffer.from([0x80]));
    await writeFile(repo.path(".context/truth/b.md"), Buffer.from([0x81]));
    const report = await inspectStats(Repository.atRoot(repo.root));
    assert.deepEqual(report.duplicates, []);
    assert.equal(report.documents.find((file) => file.path.endsWith("/a.md"))?.bytes, 1);
    assert.equal(
      (await inspectStats(Repository.atRoot(repo.root), report.total.estimatedTokens)).overBudget,
      false,
    );
  });

  it("reports a directory manifest as invalid instead of an internal failure", async () => {
    const repo = await initialized();
    await repo.remove(".context/manifest.json");
    await repo.makeDirectory(".context/manifest.json");
    assert.equal((await runCli(repo, ["stats"])).code, 1);
    const check = await runCli(repo, ["check", "--json"]);
    assert.equal(check.code, 1);
    assert.equal(
      JSON.parse(check.stdout).findings.some(
        (finding: { code: string }) => finding.code === "MANIFEST002",
      ),
      true,
    );
  });
});
