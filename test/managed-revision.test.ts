import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createCapturedOutput } from "../src/cli/output.ts";
import { runCheck } from "../src/commands/check.ts";
import { Repository } from "../src/core/repository.ts";
import { insertManagedBlock, validateManagedBlock } from "../src/managed/block.ts";
import {
  AGENTS_MANAGED_BODY,
  agentsManagedBody,
  CLAUDE_MANAGED_BODY,
  declaredBodyRevision,
  MANAGED_BODY_REVISION,
  SUPERSEDED_AGENTS_BODIES,
  SUPERSEDED_CLAUDE_BODIES,
} from "../src/templates/agents.ts";
import { runCli, TempRepo } from "./helpers/repo.ts";

/**
 * Bodies the published packages write, read from the npm tarballs of 0.1.0,
 * 0.4.0 and 0.4.1. They are literals on purpose: the templates interpolate
 * shared constants, and these fixtures are what catches a change to one of
 * those constants silently rewording a body that is already in repositories.
 */
const LEGACY_NOTICE = "<!-- Managed by Syngraphe. Do not edit this block manually. -->";
const PUBLISHED_AGENTS_BODIES = {
  "0.1.0–0.4.0 root": `${LEGACY_NOTICE}

This repository maintains shared project context in \`.context/\`.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` before completing substantial work.`,
  "0.2.0–0.4.0 scoped": `${LEGACY_NOTICE}

This directory maintains its local project context in \`.context/\`.
Paths here are relative to the directory containing this AGENTS.md.
Read shared context in ancestor directories within this Git repository as well as this local context.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` with \`--scope\` set to this directory's path
relative to the Git root before completing substantial work.`,
  "0.4.1 root": `${LEGACY_NOTICE}

This repository maintains shared project context in \`.context/\`.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` before completing substantial work.
If \`AGENT-POLICY.md\` is present, read it before planning multi-step or expensive work.`,
  "0.4.1 scoped": `${LEGACY_NOTICE}

This directory maintains its local project context in \`.context/\`.
Paths here are relative to the directory containing this AGENTS.md.
Read shared context in ancestor directories within this Git repository as well as this local context.

Before substantial work, read \`.context/index.md\` and the relevant context documents.
Keep that context accurate: when a change makes it out of date, update it in the same change.
If Syngraphe is available, run \`syngraphe check\` with \`--scope\` set to this directory's path
relative to the Git root before completing substantial work.
If an \`AGENT-POLICY.md\` is present in this repository, read it before planning multi-step or
expensive work.`,
} as const;
const PUBLISHED_CLAUDE_BODY = `${LEGACY_NOTICE}\n@AGENTS.md`;

interface JsonReport {
  ok: boolean;
  findings: { code: string; severity: string; file?: string; line?: number; message: string }[];
}

async function repoWith(files: Record<string, string> = {}): Promise<TempRepo> {
  const repo = await TempRepo.create(files);
  after(() => repo.cleanup());
  return repo;
}

async function check(
  repo: TempRepo,
  strict = false,
): Promise<{ code: number; report: JsonReport }> {
  const output = createCapturedOutput();
  const code = await runCheck({
    repository: Repository.atRoot(repo.root),
    output,
    json: true,
    strict,
  });
  return { code, report: JSON.parse(output.stdout) as JsonReport };
}

/** A body exactly like the current one, except that it declares a later revision. */
function fromLaterRevision(body: string, revision = MANAGED_BODY_REVISION + 1): string {
  return body.replace(`(revision ${MANAGED_BODY_REVISION})`, `(revision ${revision})`);
}

describe("managed body revisions", () => {
  it("declares the current revision in every canonical body", () => {
    for (const body of [
      AGENTS_MANAGED_BODY,
      agentsManagedBody("packages/api"),
      CLAUDE_MANAGED_BODY,
    ]) {
      assert.equal(declaredBodyRevision(body), MANAGED_BODY_REVISION, body);
    }
  });

  it("reads no revision from a body published before revisions existed", () => {
    for (const body of [...Object.values(PUBLISHED_AGENTS_BODIES), PUBLISHED_CLAUDE_BODY]) {
      assert.equal(declaredBodyRevision(body), null, body);
    }
  });

  it("keeps every published body recognisable as outdated, verbatim", () => {
    for (const [release, body] of Object.entries(PUBLISHED_AGENTS_BODIES)) {
      assert.ok(SUPERSEDED_AGENTS_BODIES.includes(body), `missing published body: ${release}`);
      const content = insertManagedBlock("# Project\n", body);
      for (const expected of [AGENTS_MANAGED_BODY, agentsManagedBody("packages/api")]) {
        assert.equal(
          validateManagedBlock(content, expected, SUPERSEDED_AGENTS_BODIES).status,
          "outdated",
          release,
        );
      }
    }
    assert.ok(SUPERSEDED_CLAUDE_BODIES.includes(PUBLISHED_CLAUDE_BODY));
  });

  it("reports a body from a newer Syngraphe as a warning, not as drift", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write(
      "AGENTS.md",
      insertManagedBlock("# Project\n", fromLaterRevision(AGENTS_MANAGED_BODY)),
    );

    const { code, report } = await check(repo);

    assert.equal(code, 0);
    const finding = report.findings.find((entry) => entry.code === "AGENT007");
    assert.ok(finding, report.findings.map((entry) => entry.code).join(", "));
    assert.equal(finding.severity, "warning");
    assert.equal(finding.file, "AGENTS.md");
    assert.equal(finding.line, 3);
    assert.match(finding.message, /newer Syngraphe version/);
    assert.ok(!report.findings.some((entry) => entry.code === "AGENT002"));
    // Strict runs still fail: this build cannot vouch for the block.
    assert.equal((await check(repo, true)).code, 1);
  });

  it("still reports a hand edit at the current revision as drift", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    const edited = `${AGENTS_MANAGED_BODY}\nAlso read the wiki.`;
    await repo.write("AGENTS.md", insertManagedBlock("# Project\n", edited));

    const { code, report } = await check(repo);

    assert.equal(code, 1);
    assert.ok(report.findings.some((entry) => entry.code === "AGENT002"));
    assert.ok(!report.findings.some((entry) => entry.code === "AGENT007"));
  });

  it("never downgrades a newer block on init", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    const newer = insertManagedBlock("# Project\n", fromLaterRevision(AGENTS_MANAGED_BODY));
    await repo.write("AGENTS.md", newer);
    await repo.write("CLAUDE.md", insertManagedBlock("", fromLaterRevision(CLAUDE_MANAGED_BODY)));
    const before = await repo.snapshot();

    const result = await runCli(repo, ["init"]);

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual([...(await repo.snapshot()).entries()], [...before.entries()]);
    assert.match(result.stdout, /newer Syngraphe version/);
  });

  it("reports a newer CLAUDE.md block as a warning", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write("CLAUDE.md", insertManagedBlock("", fromLaterRevision(CLAUDE_MANAGED_BODY)));

    const { code, report } = await check(repo);

    assert.equal(code, 0);
    const finding = report.findings.find((entry) => entry.code === "CLAUDE007");
    assert.equal(finding?.severity, "warning");
  });

  it("updates a CLAUDE.md block an earlier Syngraphe wrote, after warning about it", async () => {
    const repo = await repoWith();
    assert.equal((await runCli(repo, ["init"])).code, 0);
    await repo.write("CLAUDE.md", insertManagedBlock("# Claude\n", PUBLISHED_CLAUDE_BODY));

    const before = await check(repo);
    assert.equal(before.code, 0);
    assert.equal(
      before.report.findings.find((entry) => entry.code === "CLAUDE006")?.severity,
      "warning",
    );

    const result = await runCli(repo, ["init"]);
    assert.equal(result.code, 0, result.stderr);
    const patched = await repo.read("CLAUDE.md");
    assert.equal(validateManagedBlock(patched, CLAUDE_MANAGED_BODY).status, "valid", patched);
    assert.ok(patched.startsWith("# Claude\n"));
  });
});
