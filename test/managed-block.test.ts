import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findManagedBlock,
  insertManagedBlock,
  removeManagedBlock,
  renderManagedBlock,
  replaceManagedBlock,
  validateManagedBlock,
} from "../src/managed/block.ts";

const BODY = "<!-- Managed by Syngraphe. Do not edit this block manually. -->\n@AGENTS.md";

describe("findManagedBlock", () => {
  it("reports an absent block", () => {
    assert.deepEqual(findManagedBlock("# Title\n\nText.\n"), { status: "absent" });
  });

  it("finds a single block and its body", () => {
    const content = insertManagedBlock("# Title\n\nText.\n", BODY);
    const lookup = findManagedBlock(content);
    assert.equal(lookup.status, "found");
    if (lookup.status !== "found") return;
    assert.equal(lookup.block.version, "1");
    assert.equal(lookup.block.body, BODY);
  });

  it("detects duplicate blocks", () => {
    const once = insertManagedBlock("# Title\n", BODY);
    const twice = `${once}\n${renderManagedBlock(BODY)}\n`;
    const lookup = findManagedBlock(twice);
    assert.equal(lookup.status, "duplicate");
    if (lookup.status !== "duplicate") return;
    assert.equal(lookup.blocks.length, 2);
  });

  it("detects an unterminated block", () => {
    const lookup = findManagedBlock('# Title\n\n<!-- syngraphe:start version="1" -->\nbody\n');
    assert.deepEqual(lookup, { status: "malformed", reason: "unterminated", line: 3 });
  });

  it("detects an end marker without a start marker", () => {
    const lookup = findManagedBlock("# Title\n\n<!-- syngraphe:end -->\n");
    assert.deepEqual(lookup, { status: "malformed", reason: "unexpected-end", line: 3 });
  });
});

describe("validateManagedBlock", () => {
  it("accepts the exact expected body", () => {
    const content = insertManagedBlock("# Title\n", BODY);
    assert.equal(validateManagedBlock(content, BODY).status, "valid");
  });

  it("reports a manually modified block as drift", () => {
    const content = insertManagedBlock("# Title\n", BODY).replace("@AGENTS.md", "@OTHER.md");
    assert.equal(validateManagedBlock(content, BODY).status, "drift");
  });

  it("reports an unknown marker version", () => {
    const content = '<!-- syngraphe:start version="9" -->\nbody\n<!-- syngraphe:end -->\n';
    assert.equal(validateManagedBlock(content, BODY).status, "unsupported-version");
  });
});

describe("insertManagedBlock", () => {
  it("places the block after a leading top-level heading", () => {
    const content = insertManagedBlock("# Title\n\nText.\n", BODY);
    const lines = content.split("\n");
    assert.equal(lines[0], "# Title");
    assert.equal(lines[1], "");
    assert.equal(lines[2], '<!-- syngraphe:start version="1" -->');
  });

  it("places the block at the top when there is no leading heading", () => {
    const content = insertManagedBlock("Text.\n", BODY);
    assert.ok(content.startsWith('<!-- syngraphe:start version="1" -->'));
    assert.ok(content.endsWith("Text.\n"));
  });

  it("does not treat a lower-level heading as a title", () => {
    const content = insertManagedBlock("## Section\n", BODY);
    assert.ok(content.startsWith('<!-- syngraphe:start version="1" -->'));
  });

  it("creates content for an empty file", () => {
    const content = insertManagedBlock("", BODY);
    assert.equal(validateManagedBlock(content, BODY).status, "valid");
    assert.ok(content.endsWith("\n"));
  });

  it("preserves CRLF line endings", () => {
    const original = "# Title\r\n\r\nText.\r\n";
    const content = insertManagedBlock(original, BODY);
    assert.ok(!/(?<!\r)\n/.test(content), "every newline must stay CRLF");
    assert.equal(validateManagedBlock(content, BODY).status, "valid");
  });

  it("preserves a missing final newline", () => {
    const content = insertManagedBlock("# Title\n\nText.", BODY);
    assert.ok(!content.endsWith("\n"));
    assert.equal(validateManagedBlock(content, BODY).status, "valid");
  });

  it("refuses to insert a second block", () => {
    const content = insertManagedBlock("# Title\n", BODY);
    assert.throws(() => insertManagedBlock(content, BODY));
  });
});

describe("removeManagedBlock", () => {
  const originals = [
    "# Title\n\nText.\n",
    "# Title\nText.\n",
    "Text without heading.\n",
    "# Title\n\nText.",
    "# Title\r\n\r\nText.\r\n",
    "# Title\n\n## Section\n\n- item\n- item\n",
    "",
  ];

  for (const original of originals) {
    it(`is the exact inverse of insertion for ${JSON.stringify(original)}`, () => {
      const inserted = insertManagedBlock(original, BODY);
      assert.equal(removeManagedBlock(inserted), original);
    });
  }
});

describe("replaceManagedBlock", () => {
  it("replaces only the block body", () => {
    const original = "# Title\n\nText.\n";
    const inserted = insertManagedBlock(original, BODY);
    const replaced = replaceManagedBlock(inserted, "new body");
    assert.equal(validateManagedBlock(replaced, "new body").status, "valid");
    assert.equal(removeManagedBlock(replaced), original);
  });
});
