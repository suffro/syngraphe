import path from "node:path";
import { SyngrapheError } from "./errors.ts";
import { EXIT_USAGE } from "./exit-codes.ts";
import { listGitFiles } from "./git.ts";
import { type ReadOnlyRepository, Repository } from "./repository.ts";

/** Discover nonempty contexts from tracked and unignored files, never traversing dependencies. */
export async function discoverScopes(repository: ReadOnlyRepository): Promise<Repository[]> {
  const root = Repository.atRoot(repository.gitRoot);
  const names = new Set<string>();
  if ((await root.kind(".context")) !== "missing") names.add(".");
  for (const file of await listGitFiles(root.root)) {
    const parts = file.split("/");
    const index = parts.indexOf(".context");
    if (index < 0) continue;
    const name = parts.slice(0, index).join("/") || ".";
    if (names.has(name)) continue;
    // File names are Git-relative, but candidates may contain a symlink or nested repository.
    if ((await root.kind(name)) === "missing") continue;
    const scope = await root.inScope(name);
    if ((await scope.kind(".context")) !== "missing") names.add(name);
  }
  if (names.size === 0) names.add(".");
  const scopes: Repository[] = [];
  for (const name of [...names].sort()) scopes.push(await root.inScope(name));
  return scopes;
}

export async function selectRepositories(
  cwd: string,
  options: { scope?: string; all?: boolean },
): Promise<Repository[]> {
  if (options.all && options.scope !== undefined) {
    throw new SyngrapheError("--all and --scope cannot be used together.", EXIT_USAGE);
  }
  const root = await Repository.open(cwd);
  if (options.all) return discoverScopes(root);
  return [await root.inScope(options.scope ?? ".")];
}

/**
 * Resolve a document reference within the Git tree, including shared parent context.
 *
 * Links are followed only to find out where a reference really leads: a broken
 * one, or one whose target is outside the Git root, does not resolve.
 */
export async function referenceExists(
  repository: ReadOnlyRepository,
  candidate: string,
): Promise<boolean> {
  const root = Repository.atRoot(repository.gitRoot);
  const relative = path.relative(root.root, path.resolve(repository.root, candidate));
  if (escapes(relative)) return false;
  // realpath follows every link on the way, final or intermediate, and fails on a broken one.
  const target = await root.realPath(relative);
  const realRoot = await root.realPath(".");
  if (target === null || realRoot === null) return false;
  if (escapes(path.relative(realRoot, target))) return false;

  // realpath alone accepts wrong case on macOS/Windows. Check the spelling of
  // every entry, including symlink names, so a passing reference is portable.
  // macOS may expose decomposed Unicode names; that is not a case difference.
  let parent = ".";
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    const entries = await root.list(parent);
    if (!entries?.some((entry) => entry.normalize("NFC") === segment.normalize("NFC"))) {
      return false;
    }
    parent = path.join(parent, segment);
  }
  return true;
}

function escapes(relative: string): boolean {
  return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

/** Select exactly one scope for a mutating command. */
export async function selectRepository(cwd: string, scope = "."): Promise<Repository> {
  return (await Repository.open(cwd)).inScope(scope);
}
