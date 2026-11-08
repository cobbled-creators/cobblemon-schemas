# Changelog

## 1.8.1

**Breaking:** the validator moved to its own package,
[`@cobbled-creators/cobblemon-validator`](https://www.npmjs.com/package/@cobbled-creators/cobblemon-validator).
This package is now the schemas, indexes, types and prebuilt bundle only: there's no main entry
point, no `/node` and no `cobblemon-schemas` command. Install the validator next to it and call
`loadEngine({ schemas: '@cobbled-creators/cobblemon-schemas' })`. The README's "Migrating from 1.8.0 /
1.7.0" maps every old import to its new home. The validator's own changes since 1.8.0 (error ranges,
grouped `required` errors, Node 22) are in its changelog.

- `dist/bundle.json` has a `formatVersion` (1) and its `package` is `{ name, version }`, so the
  validator can tell which bundles it reads. `validators.mjs` no longer imports anything: the one ajv
  helper it used is copied in, so this package has no dependencies. `validators.d.mts` declares it.

Cobblemon's default content indexes and the move and ability types, moved over from
cobblemon-addon-vscode so consumers don't need their own copy. Like the schemas, they're versioned
with Cobblemon.

- `indexes/data.json` and `indexes/assets.json`: the ids of Cobblemon's own species, dex entries,
  posers, models, animations, textures and lang keys. They're read from the 1.8.2 tag
  (`npm run indexes`) rather than the development commit the extension used, which adds 59 posers
  and drops a few models and textures that aren't in 1.8.2. `types/indexes.d.ts` has
  `CobblemonDataIndex` and `CobblemonAssetsIndex`, which describe them.
- `types/moves.d.ts` and `types/abilities.d.ts`: types for Showdown move and ability files.
  `ActiveMove.status` is now a `StatusCode`, like `MoveData.status`, so the file type-checks.

## 1.8.0 (2026-11-06)

First release as its own package. The schemas were copied from cobblemon-addon-vscode (extension
0.11.0, commit 3f13889), with these fixes:

- Spawn pool files accept `"type": "empty"` spawns, which don't need an `id`. Cobblemon 1.8.2's own
  `0000_empty.json` uses them.
- Spawn bait effects no longer require `value`. Some stock berries leave it out.
- Bedrock posers accept `profilePokedexScale`, `profilePokedexTranslation`, `profileSummaryScale` and
  `profileSummaryTranslation`.
