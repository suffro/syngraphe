import { createHash } from "node:crypto";
import { SyngrapheError } from "../core/errors.ts";
import { EXIT_USAGE } from "../core/exit-codes.ts";
import type { Repository } from "../core/repository.ts";
import { requireContext } from "./usable-context.ts";

export const DEFAULT_TOKEN_BUDGET = 8000;
export const LARGE_DOCUMENT_TOKENS = 2000;

export interface SizeTotals {
  files: number;
  markdownFiles: number;
  bytes: number;
  words: number;
  estimatedTokens: number;
}

export interface DocumentSize {
  path: string;
  bytes: number;
  words: number;
  estimatedTokens: number;
}

export interface ContextStats {
  version: 1;
  scope: string;
  tokenEstimate: "ceil(UTF-8 bytes / 4) per Markdown file";
  budget: number;
  overBudget: boolean;
  total: SizeTotals;
  active: SizeTotals;
  history: SizeTotals;
  documents: DocumentSize[];
  largeDocuments: string[];
  duplicates: string[][];
  skipped: string[];
}

function emptyTotals(): SizeTotals {
  return { files: 0, markdownFiles: 0, bytes: 0, words: 0, estimatedTokens: 0 };
}

/** All regular files count toward bytes; only Markdown contributes words and estimated tokens. */
export async function inspectStats(
  repository: Repository,
  budget = DEFAULT_TOKEN_BUDGET,
): Promise<ContextStats> {
  if (!Number.isSafeInteger(budget) || budget <= 0) {
    throw new SyngrapheError("Token budget must be a positive safe integer.", EXIT_USAGE);
  }
  await requireContext(repository);
  const result: ContextStats = {
    version: 1,
    scope: repository.scope,
    tokenEstimate: "ceil(UTF-8 bytes / 4) per Markdown file",
    budget,
    overBudget: false,
    total: emptyTotals(),
    active: emptyTotals(),
    history: emptyTotals(),
    documents: [],
    largeDocuments: [],
    duplicates: [],
    skipped: [],
  };
  const hashes = new Map<string, string[]>();
  async function visit(directory: string): Promise<void> {
    for (const entry of (await repository.list(directory)) ?? []) {
      const file = `${directory}/${entry}`;
      const kind = await repository.kind(file);
      if (kind === "directory") {
        await visit(file);
        continue;
      }
      if (kind !== "file") {
        result.skipped.push(file);
        continue;
      }
      const bytes = await repository.size(file);
      const totals = file.startsWith(".context/history/") ? result.history : result.active;
      totals.files++;
      totals.bytes += bytes;
      if (!file.endsWith(".md")) continue;
      const raw = (await repository.readBytes(file)) ?? Buffer.alloc(0);
      const content = raw.toString("utf8");
      const words = content.match(/\S+/gu)?.length ?? 0;
      const estimatedTokens = Math.ceil(bytes / 4);
      totals.markdownFiles++;
      totals.words += words;
      totals.estimatedTokens += estimatedTokens;
      result.documents.push({ path: file, bytes, words, estimatedTokens });
      if (estimatedTokens > LARGE_DOCUMENT_TOKENS) result.largeDocuments.push(file);
      if (content.trim()) {
        const hash = createHash("sha256").update(raw).digest("hex");
        const paths = hashes.get(hash) ?? [];
        paths.push(file);
        hashes.set(hash, paths);
      }
    }
  }
  await visit(".context");
  for (const key of Object.keys(result.total) as (keyof SizeTotals)[]) {
    result.total[key] = result.active[key] + result.history[key];
  }
  result.overBudget = result.total.estimatedTokens > budget;
  result.duplicates = [...hashes.values()].filter((paths) => paths.length > 1);
  result.documents.sort(
    (a, b) => b.bytes - a.bytes || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
  );
  return result;
}
