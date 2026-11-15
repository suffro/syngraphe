import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = path.join(ROOT, "src", "index.ts");
const API_PAGE = path.join(ROOT, "docs", "reference", "api.md");

/**
 * Every name the package entry point exports, values and types alike.
 *
 * Asking the compiler rather than importing the module is what makes type-only
 * exports visible: they are part of the public surface but absent at runtime.
 */
function exportedNames(): string[] {
  const program = ts.createProgram([ENTRY], {
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
  });
  const source = program.getSourceFile(ENTRY);
  assert.ok(source, "the entry point must be part of the program");
  const symbol = program.getTypeChecker().getSymbolAtLocation(source);
  assert.ok(symbol, "the entry point must be a module");
  return program
    .getTypeChecker()
    .getExportsOfModule(symbol)
    .map((entry) => entry.name)
    .sort();
}

/** The names in the first column of the reference page's export tables. */
async function documentedNames(): Promise<string[]> {
  const page = await readFile(API_PAGE, "utf8");
  const names = [...page.matchAll(/^\| `([A-Za-z_$][\w$]*)` \|/gm)].map((match) => match[1] ?? "");
  assert.equal(new Set(names).size, names.length, "a name is documented twice");
  return names.sort();
}

describe("public API surface", () => {
  it("documents exactly what the package exports", async () => {
    const exported = exportedNames();
    const documented = await documentedNames();

    const undocumented = exported.filter((name) => !documented.includes(name));
    const phantom = documented.filter((name) => !exported.includes(name));
    assert.deepEqual(undocumented, [], "exported but missing from docs/reference/api.md");
    assert.deepEqual(phantom, [], "documented in docs/reference/api.md but not exported");
    assert.ok(exported.length > 0);
  });
});
