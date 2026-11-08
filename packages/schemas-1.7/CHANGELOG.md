# Changelog

## 1.7.2

- Error messages for integer ranges (`intRange`, `intRangeString`, such as a spawn's `level`) and for
  identifiers, resource locations and tags now say what format is expected, with an example, through
  `x-errorMessage` annotations. They show with `@cobbled-creators/cobblemon-validator` 0.2.0 or
  later; 0.1.0 ignores them and shows its generic messages.

## 1.7.1

**Breaking:** the validator moved to its own package,
[`@cobbled-creators/cobblemon-validator`](https://www.npmjs.com/package/@cobbled-creators/cobblemon-validator).
This package is now the schemas, indexes, types and prebuilt bundle only: there's no main entry
point, no `/node` and no `cobblemon-schemas` command. Install the validator next to it and call
`loadEngine({ schemas: '@cobbled-creators/cobblemon-schemas' })`, or an alias such as
`'cobblemon-schemas-1.7'`. The README's "Migrating from 1.8.0 / 1.7.0" maps every old import to its
new home. 1.7 now gets the same validator as 1.8, so it also gains everything in the validator's
changelog: error ranges, grouped `required` errors and Node 22 support.

- `dist/bundle.json` has a `formatVersion` (1) and its `package` is `{ name, version }`, so the
  validator can tell which bundles it reads. `validators.mjs` no longer imports anything: the one ajv
  helper it used is copied in, so this package has no dependencies. `validators.d.mts` declares it.

Cobblemon's default content indexes and the move and ability types, moved over from
cobblemon-addon-vscode so consumers don't need their own copy. Like the schemas, they're versioned
with Cobblemon.

- `indexes/data.json` and `indexes/assets.json`: the ids of Cobblemon's own species, dex entries,
  posers, models, animations, textures and lang keys, read from the 1.7.3 tag (`npm run indexes`).
  `types/indexes.d.ts` has `CobblemonDataIndex` and `CobblemonAssetsIndex`, which describe them.
- `types/moves.d.ts` and `types/abilities.d.ts`: types for Showdown move and ability files, matching
  the Showdown build Cobblemon 1.7.3 bundles. `ActiveMove.status` is a `StatusCode`, like
  `MoveData.status`, so the file type-checks.

## 1.7.0 (2026-11-06)

First release of the Cobblemon 1.7 schemas. Copied from cobblemon-addon-vscode 0.10.1 (commit
8d1bbf9), the last extension release for Cobblemon 1.7. Cobblemon's own data validates with no errors
at 1.7.0, 1.7.1, 1.7.2 and 1.7.3.
