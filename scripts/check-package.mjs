// Verify what `npm publish` would upload, without publishing or building anything.
//
// Run it after `npm run build`. Lifecycle scripts are skipped on purpose: a missing `dist/` has to
// fail here rather than be rebuilt silently, because that is the state this check exists to catch.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// Spawning npm through its own CLI script avoids the shell that `npm.cmd` needs on Windows.
const npmCli = process.env.npm_execpath;
assert(npmCli, "Run this through `npm run package:check`, which provides npm_execpath.");

const output = execFileSync(
  process.execPath,
  [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts"],
  { cwd: root, encoding: "utf8" },
);
// npm 10 and 11 print an array of packages; npm 12 prints an object keyed by package name.
const parsed = JSON.parse(output);
const [pack] = Array.isArray(parsed) ? parsed : Object.values(parsed);
assert(pack?.files, "npm pack --json returned no file list.");
const files = new Set(pack.files.map((file) => file.path));

const required = [
  "package.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/cli/bin.js",
];
for (const path of required)
  assert(files.has(path), `Package is missing ${path}; run npm run build.`);

const forbidden = ["src/", "test/", "action/", "docs/", "scripts/", ".context/", ".github/"];
for (const path of files)
  for (const prefix of forbidden)
    assert(!path.startsWith(prefix), `Package must not contain ${path}.`);

const bin = await readFile(new URL("../dist/cli/bin.js", import.meta.url), "utf8");
assert(bin.startsWith("#!/usr/bin/env node\n"), "dist/cli/bin.js must start with a node shebang.");

console.log(`Package ${pack.name}@${pack.version} contains ${files.size} files, as expected.`);
