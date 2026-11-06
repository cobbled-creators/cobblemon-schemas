# Changelog

## 1.8.1

Cobblemon's default content indexes and the move and ability types, moved over from
cobblemon-addon-vscode so consumers don't need their own copy. Like the schemas, they're versioned
with Cobblemon.

- `indexes/data.json` and `indexes/assets.json`: the ids of Cobblemon's own species, dex entries,
  posers, models, animations, textures and lang keys. They're read from the 1.8.2 tag
  (`npm run indexes`) rather than the development commit the extension used, which adds 59 posers
  and drops a few models and textures that aren't in 1.8.2. `CobblemonDataIndex` and
  `CobblemonAssetsIndex` describe them.
- `types/moves.d.ts` and `types/abilities.d.ts`: types for Showdown move and ability files.
  `ActiveMove.status` is now a `StatusCode`, like `MoveData.status`, so the file type-checks.

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

## 1.8.0 (2026-11-06)

First release as its own package. The schemas were copied from cobblemon-addon-vscode (extension
0.11.0, commit 3f13889), with these fixes:

- Spawn pool files accept `"type": "empty"` spawns, which don't need an `id`. Cobblemon 1.8.2's own
  `0000_empty.json` uses them.
- Spawn bait effects no longer require `value`. Some stock berries leave it out.
- Bedrock posers accept `profilePokedexScale`, `profilePokedexTranslation`, `profileSummaryScale` and
  `profileSummaryTranslation`.
