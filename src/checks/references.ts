import path from "node:path";
import { extractLocalReferences } from "../core/markdown.ts";
import type { Repository } from "../core/repository.ts";
import { CONTEXT_DIRECTORY } from "../templates/context.ts";
import type { Check, Finding } from "./types.ts";

/** Local paths referenced from context documents actually exist. */
export const referencesCheck: Check = {
  id: "internal-references",
  label: "internal references",
  category: "references",

  async run(context) {
    const findings: Finding[] = [];
    const inspection = context.context;
    if (inspection.status === "absent" || inspection.status === "unrelated") return findings;

    const repository = context.repository;
    const documents = await listMarkdownFiles(repository, CONTEXT_DIRECTORY);

    for (const document of documents) {
      const contents = await repository.read(document);
      if (contents === null) continue;

      const directory = path.posix.dirname(document);
      for (const reference of extractLocalReferences(contents)) {
        if (await resolves(repository, directory, reference.target, reference.kind)) continue;
        findings.push({
          code: "LINK001",
          severity: "error",
          category: "references",
          file: document,
          line: reference.line,
          message: `Referenced path does not exist: ${reference.target}`,
        });
      }
    }

    return findings;
  },
};

/**
 * Markdown links resolve relative to the document, as Markdown requires.
 *
 * Inline-code references are prose, and prose names a document the way a reader would: sometimes
 * relative to the document, sometimes from the repository root, and — inside `.context/` — very
 * often relative to the context root, because that is how `index.md` names its own siblings. A
 * decision record or an archived note writing `truth/architecture.md` means the same file
 * `index.md` means, so all three are accepted before calling a reference broken.
 */
async function resolves(
  repository: Repository,
  directory: string,
  target: string,
  kind: "link" | "code",
): Promise<boolean> {
  const candidates = [path.posix.normalize(path.posix.join(directory, target))];
  if (kind === "code") {
    candidates.push(
      path.posix.normalize(target),
      path.posix.normalize(path.posix.join(CONTEXT_DIRECTORY, target)),
    );
  }

  for (const candidate of candidates) {
    if (candidate.startsWith("..")) continue;
    if ((await repository.kind(candidate)) !== "missing") return true;
  }
  return false;
}

async function listMarkdownFiles(repository: Repository, directory: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await repository.list(directory);
  if (entries === null) return found;

  for (const entry of entries) {
    const child = path.posix.join(directory, entry);
    const kind = await repository.kind(child);
    // Symlinks are not followed: they may leave the repository.
    if (kind === "directory") found.push(...(await listMarkdownFiles(repository, child)));
    else if (kind === "file" && entry.endsWith(".md")) found.push(child);
  }

  return found;
}
