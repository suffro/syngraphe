import type { Output } from "../cli/output.ts";
import { EXIT_SUCCESS, type ExitCode } from "../core/exit-codes.ts";
import type { Repository } from "../core/repository.ts";
import { type ContextStats, inspectStats, LARGE_DOCUMENT_TOKENS } from "../inspectors/stats.ts";

export function renderStats(stats: ContextStats): string {
  const lines = [
    "Syngraphe context statistics",
    "",
    `Scope: ${stats.scope}`,
    "",
    "                       Files       Bytes       Words    Est. tokens",
  ];
  for (const [label, values] of [
    ["Total", stats.total],
    ["Active (non-history)", stats.active],
    ["History", stats.history],
  ] as const) {
    lines.push(
      `${label.padEnd(23)}${String(values.files).padStart(5)}${String(values.bytes).padStart(12)}${String(values.words).padStart(12)}${String(values.estimatedTokens).padStart(15)}`,
    );
  }
  lines.push(
    "",
    `Token estimate: ${stats.tokenEstimate}; not a model tokenizer or actual prompt size.`,
    `Budget: ${stats.budget} estimated tokens (${stats.overBudget ? "exceeded" : "within budget"}).`,
    "",
    "Largest Markdown documents",
  );
  for (const document of stats.documents.slice(0, 10)) {
    lines.push(`  ${document.path}  ${document.bytes} bytes, ~${document.estimatedTokens} tokens`);
  }
  lines.push(
    "",
    `Large documents (>${LARGE_DOCUMENT_TOKENS} estimated tokens): ${stats.largeDocuments.length}`,
  );
  for (const file of stats.largeDocuments) lines.push(`  ${file}`);
  lines.push(`Exact duplicate groups: ${stats.duplicates.length}`);
  for (const group of stats.duplicates) lines.push(`  ${group.join(" = ")}`);
  if (stats.skipped.length) lines.push(`Skipped non-regular paths: ${stats.skipped.join(", ")}`);
  lines.push(
    "",
    "Bloat signals are advisory. Review large files and duplicates; archive completed state when useful.",
  );
  return lines.join("\n");
}

export async function runStats(options: {
  repository: Repository;
  output: Output;
  json: boolean;
  budget?: number;
}): Promise<ExitCode> {
  const stats = await inspectStats(options.repository, options.budget);
  options.output.write(options.json ? JSON.stringify(stats, null, 2) : renderStats(stats));
  return EXIT_SUCCESS;
}
