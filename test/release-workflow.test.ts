import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { parse } from "yaml";

interface Step {
  uses?: string;
  run?: string;
  name?: string;
}

async function workflow(): Promise<{
  on: { push: { tags: string[] } };
  permissions: Record<string, string>;
  jobs: Record<string, { permissions: Record<string, string>; steps: Step[] }>;
}> {
  return parse(
    await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8"),
  );
}

describe("npm release workflow", () => {
  it("runs only for version tags, never for Action tags", async () => {
    const { on } = await workflow();
    assert.deepEqual(Object.keys(on), ["push"]);
    assert.deepEqual(on.push.tags, ["v*.*.*"]);
  });

  it("grants the OIDC token to the publishing job only", async () => {
    const { permissions, jobs } = await workflow();
    assert.deepEqual(permissions, { contents: "read" });
    assert.deepEqual(jobs.publish?.permissions, { contents: "read", "id-token": "write" });
  });

  it("verifies everything CI verifies before publishing", async () => {
    const steps = (await workflow()).jobs.publish?.steps ?? [];
    const publish = steps.findIndex((step) => step.name === "Publish");
    assert.ok(publish > 0, "a Publish step is required");
    for (const command of [
      "npm ci --ignore-scripts",
      "npm run action:check",
      "npm run typecheck",
      "npm run lint",
      "npm run build",
      "npm test",
      "npm run package:check",
    ]) {
      const index = steps.findIndex((step) => step.run === command);
      assert.ok(index >= 0 && index < publish, `${command} must run before publishing`);
    }
    const guard = steps.findIndex((step) => step.run?.includes("does not match package.json"));
    assert.ok(guard >= 0 && guard < publish, "the tag/version guard must run before publishing");
  });

  it("pins every third-party action to a full commit SHA", async () => {
    for (const step of (await workflow()).jobs.publish?.steps ?? []) {
      if (step.uses) assert.match(step.uses, /^actions\/[a-z-]+@[0-9a-f]{40}$/);
    }
  });
});
