/**
 * The documentation site's Markdown surface.
 *
 * Two modules derive a page's Markdown twin from its route — `docs/.vitepress/llms.mjs` writes the
 * file, `docs/functions/_middleware.js` serves it — and nothing but this test says they agree. A
 * twin written where nothing looks for it is a file nobody will ever read, and that failure is
 * silent: the site still builds and the page still renders.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markdownFileFor, routeOf } from "../docs/.vitepress/llms.mjs";
import { markdownPathFor, prefersMarkdown } from "../docs/functions/_middleware.js";

describe("prefersMarkdown", () => {
  it("accepts an explicit request for Markdown", () => {
    assert.equal(prefersMarkdown("text/markdown"), true);
    assert.equal(prefersMarkdown("text/html, text/markdown;q=0.9"), true);
    assert.equal(prefersMarkdown("TEXT/MARKDOWN"), true);
  });

  it("ignores a browser's catch-all", () => {
    assert.equal(prefersMarkdown("text/html,application/xhtml+xml,*/*;q=0.8"), false);
    assert.equal(prefersMarkdown("*/*"), false);
    assert.equal(prefersMarkdown(""), false);
    assert.equal(prefersMarkdown(null), false);
  });

  it("honours a zero quality value as a refusal", () => {
    assert.equal(prefersMarkdown("text/markdown;q=0"), false);
  });
});

describe("markdownPathFor", () => {
  it("maps pages to their twin", () => {
    assert.equal(markdownPathFor("/"), "/index.md");
    assert.equal(markdownPathFor("/guides/"), "/guides.md");
    assert.equal(markdownPathFor("/reference/cli"), "/reference/cli.md");
  });

  it("refuses paths that are assets rather than pages", () => {
    assert.equal(markdownPathFor("/llms.txt"), null);
    assert.equal(markdownPathFor("/reference/cli.md"), null);
    assert.equal(markdownPathFor("/static/svg/logo-dark.svg"), null);
  });
});

describe("the two derivations agree", () => {
  const sources = [
    "index.md",
    "guides/index.md",
    "reference/cli.md",
    "concepts/design-decisions.md",
  ];

  for (const relativePath of sources) {
    it(`agrees on ${relativePath}`, () => {
      const route = routeOf(relativePath);
      // The generator writes a path relative to the output directory; the middleware asks for the
      // same file as an absolute request path.
      assert.equal(`/${markdownFileFor(route)}`, markdownPathFor(route));
    });
  }
});
