/**
 * Build-time generation of the site's Markdown surface: `/llms.txt`, `/llms-full.txt`, and one
 * Markdown twin per page.
 *
 * A model answering a question about Syngraphe arrives with a budget: it fetches two or three URLs,
 * not twenty-five. `robots.txt` only says what it may read, which is not the same as saying what is
 * worth reading. These files do that, following the convention at https://llmstxt.org:
 * `/llms.txt` is the map — every page, in sidebar order, with the one-line description its
 * frontmatter already carries — and `/llms-full.txt` is the territory, the same pages' Markdown in
 * one document.
 *
 * Everything is derived from the pages VitePress actually built and from the sidebar that orders
 * them, so a new page joins by existing rather than by being remembered. The only hand-written part
 * is the header below, which states what the project is — the one thing no page's frontmatter says.
 *
 * A static file in `public/` was the alternative, and it is wrong the first time someone renames a
 * page.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Pages seen by `transformPageData`, keyed by normalised route. */
const pages = new Map();

/** The home page renders a Vue component and carries no prose, so it is nobody's reading. */
const HOME_ROUTE = "/";

/** `guides/index.md` → `/guides/`, `reference/cli.md` → `/reference/cli`. Matches the clean URLs
 *  the site serves and the entries VitePress writes into sitemap.xml. */
export function routeOf(relativePath) {
  const path = relativePath.replace(/\.md$/, "");
  if (path === "index") return HOME_ROUTE;
  if (path.endsWith("/index")) return `/${path.slice(0, -"index".length)}`;
  return `/${path}`;
}

/** Trailing slashes differ between a sidebar link and a built route; comparisons use this form. */
const key = (route) => (route.length > 1 ? route.replace(/\/$/, "") : route);

/** Called for every page during the build. Returns the route so the caller can reuse it. */
export function recordPage(pageData) {
  const route = routeOf(pageData.relativePath);
  pages.set(key(route), {
    route,
    relativePath: pageData.relativePath,
    title: pageData.title ?? route,
    description: (pageData.description ?? "").trim(),
  });
  return route;
}

/**
 * The Markdown twin of a page, at the page's own path with `.md` appended.
 * `functions/_middleware.js` derives the same path from a request, and the two derivations have to
 * agree — a twin written where nothing looks for it is a file nobody will ever read.
 */
export function markdownFileFor(route) {
  return route === HOME_ROUTE ? "index.md" : `${route.replace(/\/$/, "").slice(1)}.md`;
}

/** Group the built pages by sidebar section, in sidebar order. Anything the sidebar does not
 *  mention still ships, under `Optional` — the spec's word for "skip this if context is short". */
function group(sidebar) {
  const used = new Set();
  const sections = [];

  for (const entry of sidebar) {
    const items = [];
    for (const route of routesOf(entry)) {
      const page = pages.get(route);
      if (page && !used.has(route)) {
        used.add(route);
        items.push(page);
      }
    }
    if (items.length) sections.push({ title: entry.text, items });
  }

  const rest = [...pages.entries()]
    .filter(([route, page]) => !used.has(route) && page.route !== HOME_ROUTE)
    .map(([, page]) => page)
    .sort((a, b) => a.route.localeCompare(b.route));
  if (rest.length) sections.push({ title: "Optional", items: rest });

  return sections;
}

function routesOf(node, into = []) {
  if (node.link) into.push(key(node.link));
  for (const item of node.items ?? []) routesOf(item, into);
  return into;
}

/** What the project is, said once. The version is read from package.json and threaded in rather
 *  than typed here, where it would be wrong one release later. */
function header(version) {
  return [
    "# Syngraphe",
    "",
    "> Syngraphe keeps repository context versioned, current, and understandable by both humans and",
    "> coding agents. It creates a small `.context/` directory of Markdown describing a repository,",
    "> points every coding agent at it through `AGENTS.md`, and checks that the result stays intact.",
    "",
    `- Version ${version}, context schema version 1. Apache-2.0, vendor-neutral, open source.`,
    "- Commands: `syngraphe init` (with `--dry-run`), `syngraphe status`, `syngraphe check` (with `--json` and `--strict`). The binary is also installed as `syg`.",
    "- The context is committed Markdown, split by lifecycle: `truth/` (architecture, conventions), `state/` (current work), `decisions/`, `history/`.",
    "- Deterministic and offline: no network calls, no AI, no account. Stable finding codes and exit codes for CI.",
    "- Syngraphe owns only the text between its own markers in `AGENTS.md` and `CLAUDE.md`; everything else is preserved byte for byte, and a hand-edited block is reported rather than overwritten.",
    "- Syngraphe is not a rule transpiler: it does not synchronize hooks, permissions, MCP configuration, subagents or skills between vendors.",
    "- Source and issues: https://github.com/suffro/syngraphe",
    "",
  ];
}

/** `/llms.txt` — the index. */
function renderIndex({ hostname, version, sidebar }) {
  const lines = [
    ...header(version),
    `Every page below, concatenated as one document: ${hostname}/llms-full.txt`,
    "",
    `Any single page is available as Markdown at its own path with \`.md\` appended, for example ${hostname}/reference/cli.md`,
    "",
  ];

  for (const section of group(sidebar)) {
    lines.push(`## ${section.title}`, "");
    for (const page of section.items) {
      const description = page.description ? `: ${page.description}` : "";
      lines.push(`- [${page.title}](${hostname}${page.route})${description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Reduce a page to what someone would read if the site were a text file.
 *
 * Markup carrying content is converted; markup carrying only presentation is dropped. Deleting a
 * wrapper's tags is never allowed to delete what it wrapped — that is the difference between a
 * plain-text page and a shorter one.
 *
 * Site-root links are made absolute for the same reason the file exists at all: `/reference/cli`
 * resolves against a page, and this text will be read somewhere that is not one.
 */
function toPlainMarkdown(source, hostname) {
  return source
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/\]\((\/[^)\s]*)\)/g, `](${hostname}$1)`)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/^[ \t]*<(?:HomePage|SubPagesList)\b[^>]*\/?>[ \t]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Every page but the home page opens with its own H1, and that heading is a better section title
 *  than the frontmatter's. Never emit both: two H1s in a row read as a formatting accident. */
function sectionOf(page, body, hostname) {
  const heading = body.match(/^# (.+)$/m);
  const title = heading && body.startsWith("# ") ? heading[1] : page.title;
  const text = body.startsWith("# ") ? body.slice(body.indexOf("\n") + 1).trimStart() : body;
  return [`# ${title}`, "", `Source: ${hostname}${page.route}`, "", text, ""];
}

/** `/llms-full.txt` — every page's Markdown, in the index's order, each under its own URL. */
async function renderFull({ hostname, version, sidebar, srcDir }) {
  const parts = [
    ...header(version),
    `The complete text of ${hostname}, generated at build time. Index: ${hostname}/llms.txt`,
    "",
  ];

  for (const section of group(sidebar)) {
    for (const page of section.items) {
      const source = await readFile(join(srcDir, page.relativePath), "utf8");
      // No `---` rule between pages: a horizontal rule after a line of text is a setext heading in
      // Markdown. The H1 and the Source line are the boundary.
      parts.push("", ...sectionOf(page, toPlainMarkdown(source, hostname), hostname));
    }
  }

  return parts.join("\n");
}

/** YAML is not forgiving of a colon or a quote in an unquoted scalar, and these descriptions carry
 *  both. Double-quoted with the two characters that matter escaped. */
const yamlString = (value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * One `.md` per page, so `Accept: text/markdown` has something true to return.
 *
 * The home page is the exception and gets the llms.txt index: it renders a Vue component rather
 * than prose, and the most useful Markdown a landing page can hand an agent is the map of
 * everything behind it.
 */
async function writePageFiles({ outDir, srcDir, hostname, index, siteDescription }) {
  let written = 0;

  for (const page of pages.values()) {
    const body =
      page.route === HOME_ROUTE
        ? index
        : toPlainMarkdown(await readFile(join(srcDir, page.relativePath), "utf8"), hostname);
    // The home page declares no description of its own — it is the one page whose subject is the
    // whole site, so the site's own description is the accurate answer rather than a stand-in.
    const description = page.description || siteDescription;

    const document = [
      "---",
      `title: ${yamlString(page.title)}`,
      ...(description ? [`description: ${yamlString(description)}`] : []),
      `source: ${hostname}${page.route}`,
      "context-schema-version: 1",
      "---",
      "",
      body,
      "",
    ].join("\n");

    const file = join(outDir, markdownFileFor(page.route));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, document);
    written += 1;
  }

  return written;
}

/** Write the generated Markdown surface into the built site. Called from `buildEnd`, so `outDir`
 *  already holds the rendered pages. */
export async function writeLlmsFiles({ outDir, srcDir, hostname, version, sidebar, siteDescription }) {
  const index = renderIndex({ hostname, version, sidebar });
  const full = await renderFull({ hostname, version, sidebar, srcDir });

  await Promise.all([
    writeFile(join(outDir, "llms.txt"), index),
    writeFile(join(outDir, "llms-full.txt"), full),
  ]);

  const twins = await writePageFiles({ outDir, srcDir, hostname, index, siteDescription });

  return {
    twins,
    indexed: group(sidebar).reduce((total, section) => total + section.items.length, 0),
    indexBytes: Buffer.byteLength(index),
    fullBytes: Buffer.byteLength(full),
  };
}
