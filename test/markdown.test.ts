import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractLocalReferences } from "../src/core/markdown.ts";

describe("Markdown link destinations", () => {
  for (const [markdown, target] of [
    ["[x](truth/domain(v2).md)", "truth/domain(v2).md"],
    ["[x](truth/domain(v(2)).md#section)", "truth/domain(v(2)).md"],
    ['[x](truth/domain(v2).md "Title (v2)")', "truth/domain(v2).md"],
    ["[x](truth/domain\\(v2\\).md 'Title')", "truth/domain(v2).md"],
    ["[x](<truth/domain (v2).md> (Title))", "truth/domain (v2).md"],
    ["[x](truth/domain.md (Title))", "truth/domain.md"],
  ]) {
    it(`extracts ${markdown}`, () => {
      assert.deepEqual(extractLocalReferences(markdown ?? ""), [{ target, line: 1, kind: "link" }]);
    });
  }

  it("does not turn malformed links into truncated paths", () => {
    for (const line of [
      "[x](truth/domain(v2.md)",
      "[x](<truth/domain.md)",
      '[x](file.md "title)',
    ]) {
      assert.deepEqual(extractLocalReferences(line), [], line);
    }
  });

  it("keeps subsequent links, images, anchors and external links independent", () => {
    assert.deepEqual(
      extractLocalReferences(
        "[x](a(b).md) ![y](img(v2).png) [z](last.md) [a](#top) [w](https://example.com/a(b))",
      ),
      ["a(b).md", "img(v2).png", "last.md"].map((target) => ({ target, line: 1, kind: "link" })),
    );
  });
});
