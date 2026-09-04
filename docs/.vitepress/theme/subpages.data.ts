import { createContentLoader } from "vitepress";

/**
 * Every content page, minus the section landings that list them.
 *
 * `SubPagesList` filters this by the section it is rendered in, so a landing page never has to
 * repeat the links its own directory already contains.
 */
export default createContentLoader(["**/*.md", "!**/index.md"], {
  includeSrc: false,
  render: false,
  transform(raw) {
    return raw.map(({ url, frontmatter }) => ({
      url,
      title: frontmatter.title ?? url.split("/").filter(Boolean).pop() ?? url,
      description: frontmatter.description ?? "",
      // Declared per page so the cards follow the sidebar's reading order rather than the
      // filesystem's alphabet.
      order: typeof frontmatter.order === "number" ? frontmatter.order : 999,
    }));
  },
});
