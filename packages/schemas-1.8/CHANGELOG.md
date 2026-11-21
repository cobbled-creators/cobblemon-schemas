# Changelog

## 1.8.3 (2026-11-21)

`required` and the allowed properties now follow how Cobblemon 1.8.2 actually loads each file.

- A property is `required` only if Cobblemon fails without it, at load, when syncing to players or
  when the entry is used. A property Cobblemon fills in when it's missing is optional, with a
  `default` giving the value Cobblemon uses. For example, a species needs only `baseStats`, and a
  form needs nothing: every form property falls back to the species.
- Newly required, because Cobblemon crashes without them: `obtainMethods` (tms), `displayName`
  (starters), the dialogue input `type`, `riding.behaviours.<style>.key`, berry growth-factor
  `range` and `specific_biome` `biome`, and the ride_settings fields that the ride code reads with no
  fallback.
- Properties Cobblemon never reads are gone. Examples: species `aspects` and `battleOnly`,
  `hitbox.fixed`, the old `riding.behaviour` and `riding.stats`, form `eggCycles`, cosmetic `item`
  (Cobblemon reads `consumedItem`), dialogue `timeout.delay` (Cobblemon reads `duration`), and
  `party_pools` `id`. With `@cobbled-creators/cobblemon-validator` 0.3.0 or later such keys are
  warnings, not errors.
- Form `baseFriendship` is `_baseFriendship`, the key Cobblemon 1.8.2 actually reads.
- Keys and shapes Cobblemon accepts that were rejected now validate. Examples: berry `flavor` and
  `color`, `#tag` seasoning and bait items, starter `order`, `play_sound` options, a single
  action-effect keyframe, and plain text-component dialogue lines.
- Shapes that crash Cobblemon are rejected. Examples: the `{min, max}` form of `intRange`, an inline
  NPC class in a spawn, lowercase `variableDefinition` types, and `npcLevels` written as anything
  but `"a-b"`.

## 1.8.2 (2026-11-08)

- `types/moves.d.ts` and `types/abilities.d.ts` are generated from the Showdown bundled with Cobblemon
  1.8.2 (cable-mc/cobblemon-showdown `a8d097d`) and list every callback it declares, with its signature
  and a one-line description: 504 callback names across moves, conditions and abilities. Move, condition and ability
  objects no longer accept any `on…` key, so a typo such as `onHitt` is an error that suggests `onHit`.
- `ConditionData` is `PokemonConditionData | SideConditionData | FieldConditionData`, as in Showdown,
  and accepts `name` and `counterMax`. `AbilityData.condition` is a `ConditionData`.
- `MoveData` and `AbilityData` are interfaces rather than intersections. `abilities.d.ts` now has the
  same declarations as `moves.d.ts`, so ability callbacks are typed (they were `this: any`).
- Removed `GenericMoveCallback`, `GenericConditionCallback`, the eight `…MoveCallback` types,
  `AbilityCallback`, `AbilityCallbackValue` and `AbilityConditionData`. Use `CommonHandlers['ResultMove']`
  and friends, or `MoveData['onHit']`.
- The files type-check with only `lib.es5.d.ts` again: `Choice.switchIns` and `Battle.hints` no longer
  use `Set`. `AnyObject`, `EffectState`, `Battle.runEvent` and `singleEvent` use `any` as Showdown does, and
  `Pokemon.addVolatile` and `Battle.getAtSlot` have Showdown's return types. Callbacks written like
  Showdown's own no longer fail to type-check because of them.
- Error messages for integer ranges (`intRange`, `intRangeString`, such as a spawn's `level`) and for
  identifiers, resource locations and tags now say what format is expected, with an example, through
  `x-errorMessage` annotations. They show with `@cobbled-creators/cobblemon-validator` 0.2.0 or
  later; 0.1.0 ignores them and shows its generic messages.

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
