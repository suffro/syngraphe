import path from "node:path";
import { SyngrapheError } from "./errors.ts";
import { EXIT_USAGE } from "./exit-codes.ts";
import { listGitFiles } from "./git.ts";
import { Repository } from "./repository.ts";

/** Discover nonempty contexts from tracked and unignored files, never traversing dependencies. */
export async function discoverScopes(repository: Repository): Promise<Repository[]> {
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

/** Resolve a document reference within the Git tree, including shared parent context. */
export async function referenceExists(repository: Repository, candidate: string): Promise<boolean> {
  const root = Repository.atRoot(repository.gitRoot);
  const relative = path.relative(root.root, path.resolve(repository.root, candidate));
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return false;
  }
  return (await root.kind(relative)) !== "missing";
}

/** Select exactly one scope for a mutating command. */
export async function selectRepository(cwd: string, scope = "."): Promise<Repository> {
  return (await Repository.open(cwd)).inScope(scope);
}
