# The manifest declares the protocol

## Decision

`.context/manifest.json` carries a `protocol` field, added to schema v1 rather than to a new schema
version:

```json
{
  "protocol": "repository-context",
  "schemaVersion": 1,
  "layout": "standard"
}
```

The value names the contract, not the tool, and carries no version of its own.

A directory is a repository context when its manifest declares that protocol. Where the field is
absent, the previous shape-based test decides — and `MANIFEST005` asks for the line to be added.
A manifest declaring some other protocol makes the directory `unrelated`, which `init` refuses to
touch and `check` reports as `CTX003`.

Identity is settled before version: `protocol` is read before `schemaVersion`.

## Why

`.context/` is a deliberately generic name, and that is the point — the context belongs to the
repository, not to Syngraphe. Renaming it to `.syg.context/` would buy uniqueness by conceding the
opposite. The way to survive a shared name is to stop identifying the directory by its name.

The old classification had a real hole. Without a manifest, a `.context/` was recognised by whether
it contained an entry of the standard layout. With a manifest, nothing was checked but
`schemaVersion` — so another tool's `.context/manifest.json` that happened to carry a numeric
`schemaVersion` was classified `valid` or `partial`, and `init` would have written into a directory
that was never Syngraphe's.

Reading `protocol` before `schemaVersion` matters for the message, not only the classification. A
foreign manifest declaring `schemaVersion: 7` would otherwise produce `MANIFEST003` and exit code 3,
telling the user to upgrade Syngraphe over a file Syngraphe is not entitled to interpret.

Overwriting v1 instead of introducing v2 was deliberate: v0.1.0 was published the same day, so there
is no meaningful installed base to migrate, and a schema version that exists only to add an identity
field would be a migration everyone pays for and nobody benefits from. The fallback keeps the few
manifests written by v0.1.0 working, so nothing published breaks.

## Rejected alternatives

- **Renaming the directory** to `.syg.context/` or `.syngraphe/`. It contradicts the project's own
  claim that the repository stays usable without Syngraphe, and closes the door on another
  implementation of the protocol reading the same directory. See
  `../../docs/concepts/design-decisions.md`.
- **`"protocol": "repository-context/1"`.** A second version number to keep in agreement with
  `schemaVersion`, with no rule for what to do when they disagree.
- **`"protocol": "syngraphe"`.** Names the writer rather than the contract, which reintroduces the
  vendor lock the directory name avoids.
- **Schema v2.** A migration on day one, for a field the fallback already handles.
- **Treating a missing `protocol` as an error.** It would hard-fail repositories initialized by
  v0.1.0, and `init` deliberately never rewrites an existing file, so the tool could not even offer
  the fix it demanded.
- **A configurable context path.** The escape hatch if a real collision is ever reported, but it
  makes "agents always know where to look" optional, which is most of the value.
