/**
 * Minimal Markdown reference extraction.
 *
 * Only what the reference check needs: local links and inline-code paths. This
 * is not a Markdown parser and does not try to be one — the goal is to catch
 * obviously broken pointers without inventing semantic claims.
 */

export type ReferenceKind = "link" | "code";

export interface MarkdownReference {
  /** The referenced path, without anchor or link title. */
  target: string;
  /** 1-based line number of the reference. */
  line: number;
  kind: ReferenceKind;
}

const LINK_PATTERN = /\[[^\]\n]*\]\(([^)\n]+)\)/g;
const INLINE_CODE_PATTERN = /`([^`\n]+)`/g;

/**
 * Extract references that point at repository-local paths.
 *
 * Inline-code references are only reported when they look like a path (they
 * end with `.md` or `/`), because inline code is also used for commands and
 * identifiers.
 */
export function extractLocalReferences(markdown: string): MarkdownReference[] {
  const references: MarkdownReference[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;

  for (const [index, line] of lines.entries()) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const lineNumber = index + 1;

    for (const match of line.matchAll(LINK_PATTERN)) {
      const target = cleanLinkTarget(match[1] ?? "");
      if (isLocalPath(target)) references.push({ target, line: lineNumber, kind: "link" });
    }

    for (const match of line.matchAll(INLINE_CODE_PATTERN)) {
      const raw = (match[1] ?? "").trim();
      if (!looksLikePath(raw)) continue;
      const target = stripAnchor(raw);
      if (isLocalPath(target)) references.push({ target, line: lineNumber, kind: "code" });
    }
  }

  return references;
}

function cleanLinkTarget(raw: string): string {
  let target = raw.trim();
  // Drop an optional link title: (path "Title")
  const titleMatch = /^(\S+)\s+["'(].*$/.exec(target);
  if (titleMatch?.[1]) target = titleMatch[1];
  if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
  return stripAnchor(target);
}

function stripAnchor(target: string): string {
  const hash = target.indexOf("#");
  return hash === -1 ? target : target.slice(0, hash);
}

/**
 * Inline code is prose, so only a document reference counts: something ending in `.md`.
 *
 * Directory paths used to qualify too, and that was wrong in both directions. It caught almost
 * nothing real — a missing context directory is already reported by the structure check — while
 * flagging every directory a document merely talks about, including hypothetical ones such as
 * `.cursor/rules/` in a repository that uses neither.
 *
 * Markdown links are unaffected: a link is unambiguously a pointer, so it is checked whatever it
 * points at.
 */
function looksLikePath(value: string): boolean {
  if (value.includes(" ")) return false;
  const target = stripAnchor(value);
  if (!target.endsWith(".md")) return false;
  // A bare `.md` is documentation naming the extension, not a document.
  const basename = target.slice(target.lastIndexOf("/") + 1);
  return basename.length > ".md".length;
}

function isLocalPath(target: string): boolean {
  if (target === "") return false;
  if (target.startsWith("#")) return false;
  if (target.startsWith("/")) return false;
  if (target.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return false;
  return true;
}
