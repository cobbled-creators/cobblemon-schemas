# cobblemon-schemas

JSON Schemas for Cobblemon datapack and resource pack files, and a validator that works out which
schema a pack file uses, validates it, and reports one plain error per problem, with line numbers.

This repo publishes two kinds of package:

| Package | What it is | Folder |
|---|---|---|
| [`@cobbled-creators/cobblemon-validator`](packages/engine) | The engine: schema resolution, validation, error messages and positions. Works with any Cobblemon version. | `packages/engine` |
| [`@cobbled-creators/cobblemon-schemas`](packages/schemas-1.8) `~1.8.0` | The schemas for Cobblemon 1.8, prebuilt for the engine, plus indexes of Cobblemon's own content and move/ability types. | `packages/schemas-1.8` |
| [`@cobbled-creators/cobblemon-schemas`](packages/schemas-1.7) `~1.7.0` | The same for Cobblemon 1.7. | `packages/schemas-1.7` |

The schema package's version follows Cobblemon: 1.8.x is Cobblemon 1.8, 1.7.x is Cobblemon 1.7. The
newest line is npm's `latest`. Older lines are under a `cobblemon-<x.y>` dist-tag.

## Use

Install the engine plus the schemas for your Cobblemon version, pinned with `~` (`^1.7.0` would
upgrade you to 1.8's schemas):

```bash
npm i @cobbled-creators/cobblemon-validator @cobbled-creators/cobblemon-schemas@~1.8.0
```

```js
import { loadEngine, readPack, validatePack } from '@cobbled-creators/cobblemon-validator/node';

const engine = await loadEngine({ schemas: '@cobbled-creators/cobblemon-schemas' });
validatePack(readPack('path/to/pack'), engine);
```

To support several Cobblemon versions, install each under an npm alias and create one engine per
version:

```json
"cobblemon-schemas-1.7": "npm:@cobbled-creators/cobblemon-schemas@~1.7.0",
"cobblemon-schemas-1.8": "npm:@cobbled-creators/cobblemon-schemas@~1.8.0"
```

```js
const engine17 = await loadEngine({ schemas: 'cobblemon-schemas-1.7' });
const engine18 = await loadEngine({ schemas: 'cobblemon-schemas-1.8' });
```

The [engine's README](packages/engine/README.md) covers the whole API, error positions and the
browser/bundler setup. The [schema package's README](packages/schemas-1.8/README.md) covers the
indexes and types.

## Migrating from 1.8.0 / 1.7.0

Up to 1.8.0 and 1.7.0, `@cobbled-creators/cobblemon-schemas` contained the engine too. From 1.8.1
and 1.7.1 on, it's only the schemas, indexes, types and prebuilt bundle, and the engine is
`@cobbled-creators/cobblemon-validator`. The new engine can't read 1.8.0's or 1.7.0's bundle. Use it
with 1.8.1 / 1.7.1 or later.

| Before | After |
|---|---|
| `import { SchemaEngine, parseJson, locateError, validatePack, … } from '@cobbled-creators/cobblemon-schemas'` | the same names from `@cobbled-creators/cobblemon-validator` |
| `loadEngine()` from `@cobbled-creators/cobblemon-schemas/node` | `loadEngine({ schemas: '@cobbled-creators/cobblemon-schemas' })` from `@cobbled-creators/cobblemon-validator/node` (or an alias such as `'cobblemon-schemas-1.8'`) |
| `loadEngine({ live: true })` | `loadEngine({ schemas, live: true })` |
| `readPack`, `validatePack` from `…/node` | unchanged, from `@cobbled-creators/cobblemon-validator/node` |
| `loadSchemas()` | `loadSchemas(path.join(resolveSchemaPackage(schemas).root, 'schemas'))` |
| `packageRoot`, `schemaRoot`, `cobblemon` from `…/node` | `resolveSchemaPackage(schemas).root` and `.cobblemon`, or `engine.cobblemon` |
| `CobblemonDataIndex`, `CobblemonAssetsIndex` from the main entry | `@cobbled-creators/cobblemon-schemas/types/indexes.d.ts` |
| `…/bundle.json`, `…/validators.mjs`, `…/schemas/*`, `…/indexes/*`, `…/types/*` | unchanged, still on `@cobbled-creators/cobblemon-schemas`. `bundle.json` now has a `formatVersion`, and its `package` is `{ name, version }` |
| `npx @cobbled-creators/cobblemon-schemas validate <pack>` | removed for now. Use `validatePack(readPack(dir), await loadEngine({ schemas }))` |

## Development

There's one npm workspace, `packages/engine`. The schema packages all share the name
`@cobbled-creators/cobblemon-schemas`, which npm doesn't allow for workspaces. Since they have no
dependencies, they're plain folders that the root scripts build and test.

```bash
npm ci
npm test                               # the engine's tests, then every schema package built and checked
node scripts/test.mjs --package 1.7    # one package (engine, 1.7, schemas-1.7 or a path); also `npm test` inside a package
npm run build                          # builds every schema package's dist/
npm run baseline -- --package 1.8      # schema errors in Cobblemon's own data at that package's cobblemon.baseline tag
npm run indexes -- --package 1.8       # rewrites that package's indexes/ from Cobblemon at its cobblemon.baseline tag
npm run types -- --package 1.8         # rewrites that package's types/moves.d.ts and abilities.d.ts from the Showdown in that tag
```

`--all` works for `baseline`, `indexes` and `types` too. All three read a clone of
[cable-mc/cobblemon](https://gitlab.com/cable-mc/cobblemon): `--cobblemon <path>`, else
`$COBBLEMON_CHECKOUT`, else `../cable/cobblemon` or `../cobblemon` next to this repo. Run `npm run
indexes` and `npm run types` whenever a package's `cobblemon.baseline` changes: the build fails until you do.

The engine's tests are in `packages/engine/test` and run against a tiny fixture schema package. The
schema packages are data, so they have no tests. Building one is its check: the build compiles every
schema with the engine, and it fails if the package's folder, version and baseline disagree, if an
indexed schema has no validator, or if the indexes or types are from another Cobblemon tag. It then loads the
result with the engine. CI builds every schema package, so an engine change can't break one unnoticed.

### Move and ability types

A schema package's `types/moves.d.ts` and `types/abilities.d.ts` are generated, and both hold the
same declarations. `npm run types` takes the Showdown that Cobblemon bundles at the package's
baseline tag (`data/cobblemon/showdown.zip`, a build of
[cable-mc/cobblemon-showdown](https://gitlab.com/cable-mc/cobblemon-showdown)) and recovers its
TypeScript from the source maps. It copies Showdown's callback interfaces (`MoveEventMethods`,
`EventMethods`, `PokemonEventMethods`, …, `ConditionData`, `AbilityEventMethods`) as they're
declared, and adds them after the package's hand-written `types-src/support.d.ts` (`Battle`,
`Pokemon`, `CommonHandlers`, `MoveData`'s fields and so on). To change the types, edit those
inputs, not the output:

- `types-src/support.d.ts`, for anything that isn't a Showdown callback. The files must type-check
  with only `lib.es5.d.ts`, so no `Set`, `Map` or `Promise`. Callbacks in `HitEffect`, `MoveData`
  and `AbilityData` must match Showdown's.
- `scripts/callback-descriptions.json`, for the one-line JSDoc each callback gets. It's keyed by
  event, so `ModifyAtk` describes `onModifyAtk`, and `prefixes` turns that into `onFoeModifyAtk`,
  `onSourceModifyAtk` and the rest. `ordering` covers `…Priority`, `…Order` and `…SubOrder`.
  `members` overrides a name, or `Interface.name` where a name means different things in
  different places.

`npm run types` writes nothing unless the result type-checks on its own (`noLib` plus
`lib.es5.d.ts`, the extension's settings) and Showdown's own `data/moves.ts`, `abilities.ts` and
`conditions.ts` type-check against it, ignoring callback bodies. The build can't rerun that, because CI
has no Cobblemon clone. Instead it checks that each file's `@generated` header names the baseline tag
and the current inputs, and that the file hasn't been edited since. It also checks that the files
type-check alone, that a misspelt `onHitt` or `onStrat` gets a "Did you mean", that every callback has
a description, and that no description is unused.

### Error messages

The engine reports one plain message per schema error. Where a generic message isn't enough, add an
`x-errorMessage` to the schema object whose rule fails, saying what's wrong and how to fix it:

```jsonc
"x-errorMessage": "'{property}' takes … not {value}."                 // any error from this object
"x-errorMessage": { "minimum": "…", "pattern": "…", "oneOf": "…" }    // by keyword
"x-errorMessage": { "additionalProperties": { "walk": "Move 'walk' into 'moving'.", "*": "…" } }
```

- A string, or a `oneOf`/`anyOf` entry, on an object with a union turns the union's failures into
  one error with that message.
- For `required` and `additionalProperties`, the entry can map property names to messages, with
  `"*"` for the rest. A missing property with its own message isn't merged with the others.
- Messages can use `{property}` (the field's name), `{value}` (what the file has, as JSON) and,
  per keyword, ajv's params: `{limit}`, `{pattern}`, `{allowedValues}`, `{missingProperty}`,
  `{missingProperties}`, `{additionalProperty}` and so on. Other `{` are literal, so JSON examples
  need no escaping.
- Annotate shared `$defs` rather than each use: `_shared/defs/ranges.schema.json` has examples. An
  `x-errorMessage` next to a `$ref` never applies, because the errors come from the referenced
  schema, so annotate that schema instead.

The build rejects annotations that can never apply (a keyword or name the object doesn't have, or a
`$ref` next to it) and unknown placeholders. The engine falls back to its built-in message wherever
there's no annotation, and keeps that in `defaultMessage` where there is one.

### Adding a Cobblemon version

1. Copy the newest folder, for example `packages/schemas-1.8` to `packages/schemas-1.9`. Leave out
   `dist/`, and start its `CHANGELOG.md` afresh.
2. In its `package.json`, set `version` to `1.9.0` and the `cobblemon` block to the new version,
   Minecraft version and baseline tag. Update `repository.directory`, the description and the README.
3. `npm run indexes -- --package 1.9`, then `npm run baseline -- --package 1.9`. Fix the schemas until
   the baseline is clean. Run `npm run types -- --package 1.9`, and update `types-src/support.d.ts` or
   `scripts/callback-descriptions.json` if Showdown changed.
4. Update the examples in `types/indexes.d.ts` if they changed, then run `npm test`.

CI picks the new folder up by itself, and the new line becomes `latest` when it's published.

### Releasing

Push a tag. `.github/workflows/publish.yml` runs every package's tests, then publishes the tagged
package with npm provenance:

- `engine-v0.1.0` publishes `packages/engine` (dist-tag `latest`, or `next` for a prerelease).
- `schemas-v1.8.1` publishes `packages/schemas-1.8`: `latest` if it's the newest Cobblemon line,
  otherwise `cobblemon-1.8`.

The tag has to match the package's `version`. `node scripts/release.mjs <tag>` shows what a tag
would publish.

## License

MIT. The schemas started out in [cobblemon-addon-vscode](https://github.com/ppVon/cobblemon-addon-vscode).
Not affiliated with Cobblemon, Mojang or Microsoft.
