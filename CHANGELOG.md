# Changelog

## 1.7.1

Cobblemon's default content indexes and the move and ability types, moved over from
cobblemon-addon-vscode so consumers don't need their own copy. Like the schemas, they're versioned
with Cobblemon.

- `indexes/data.json` and `indexes/assets.json`: the ids of Cobblemon's own species, dex entries,
  posers, models, animations, textures and lang keys, read from the 1.7.3 tag (`npm run indexes`).
  `CobblemonDataIndex` and `CobblemonAssetsIndex` describe them.
- `types/moves.d.ts` and `types/abilities.d.ts`: types for Showdown move and ability files, matching
  the Showdown build Cobblemon 1.7.3 bundles. `ActiveMove.status` is a `StatusCode`, like
  `MoveData.status`, so the file type-checks.

Error positions are now ranges, so editors can underline them without parsing the file again. The
existing `line` and `column` fields are unchanged.

- `parseJson(...).locate(pointer)` also returns `offset`, `length`, `endLine` and `endColumn`.
  `endLine`/`endColumn` is exclusive. `locate(pointer, { key: true })` locates the property's key
  instead of its value; array elements and the root have no key, so they fall back to the value.
- Syntax errors and `validatePack` errors have the same span fields. A syntax error at the end of
  the file can have `length` 0.
- `locateError(parsed, error)` returns the span `validatePack` uses for a schema error, so other
  tools can underline the same text as the CLI: the key of an unknown property or of an object or
  array, or the value otherwise. For object and array errors the reported line and column now point
  at the key instead of the opening bracket.

The package now supports Node 22 (`engines.node` is `>=22`, was `>=24`), so installing it in a
Node 22 project such as the VS Code extension no longer warns about the engine. CI tests on Node 22
and 24.

Missing required properties at the same pointer are now one error instead of one each, so a nearly
empty species file gets one error rather than one per field, and the CLI and editors read the same.

- The message lists every name, without truncating:
  `Missing required properties: 'primaryType', 'maleRatio', 'height'.` With one name it's unchanged.
- Every `required` error has `params.missingProperties`, the missing names in order.
  `params.missingProperty` is still set, to the first of them.
- `engine.validate` and `engine.check` take `{ groupRequired: false }` to get one error per property,
  as before. `validatePack` and the CLI always group.

## 1.7.0 (2026-11-06)

First release of the Cobblemon 1.7 schemas. Copied from cobblemon-addon-vscode 0.10.1 (commit
8d1bbf9), the last extension release for Cobblemon 1.7. Cobblemon's own data validates with no errors
at 1.7.0, 1.7.1, 1.7.2 and 1.7.3.
