export type DocumentCategory = "truth" | "decision" | "state" | "history";

export const DOCUMENT_DIRECTORIES: Record<DocumentCategory, string> = {
  truth: ".context/truth",
  decision: ".context/decisions",
  state: ".context/state",
  history: ".context/history",
};

export function documentTemplate(category: DocumentCategory, title: string): string {
  const headings: Record<DocumentCategory, readonly string[]> = {
    truth: [],
    decision: ["Context", "Decision", "Alternatives considered", "Consequences"],
    state: ["Current focus", "Recent relevant changes", "Next", "Blockers"],
    history: ["Summary", "Outcome", "Follow-up"],
  };
  const sections = headings[category];
  if (sections.length === 0) return `# ${title}\n`;
  return `# ${title}\n\n${sections.map((heading) => `## ${heading}\n`).join("\n")}`;
}
