# Managed-block padding is unconditionally reversible

## Decision

`insertManagedBlock` adds exactly one blank line **before** the block whenever content precedes it,
and never adds one after it. `removeManagedBlock` removes the block lines and that single separator.

## Why

Insertion must be exactly invertible: the preservation guarantee is that removing the Syngraphe
block from a file it patched returns the original bytes. Padding that is added conditionally — "add
a blank line only if the neighbour is not blank" — cannot be undone, because removal cannot tell an
inserted blank line from a user-authored one.

Making the leading separator unconditional removes the ambiguity. Omitting the trailing one avoids
the double blank line the symmetric rule would leave in the common `# Heading` + blank + body
layout; the spacing that followed the insertion point in the original file simply follows the block
instead.

## Rejected alternatives

- **Symmetric padding on both sides.** Reversible, but leaves a double blank line after the block in
  most real files.
- **Collapsing blank runs on removal.** Loses the original spacing in files that had none after the
  heading.
- **Storing a hash of the block or its padding.** Adds repository noise for a problem that a
  stricter insertion rule solves outright.
