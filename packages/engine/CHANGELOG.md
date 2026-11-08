# Changelog

## 0.2.0

Clearer error messages, and room for schema packages to add their own (#13).

- Schema packages can annotate their schemas with `x-errorMessage`, a message written by someone who
  knows the file format, saying what's wrong and how to fix it. Where one applies, it's the error's
  `message`, and the engine's built-in message moves to the new `defaultMessage`. Otherwise
  `defaultMessage` is absent. Annotations reach the prebuilt validators as part of the schemas, so
  `bundle.json` and its `formatVersion` are unchanged. Older engines ignore them, and older schema
  packages simply have none. The repo README's "Error messages" explains how to write them.
- `loadSchemas`, and so `compileBundle`, `buildSchemaPackage` and `loadEngine({ live: true })`,
  reject an annotation that can never apply or that uses an unknown placeholder, with code
  `ERR_COBBLEMON_ANNOTATION` and every problem in `error.problems`.
- A union whose alternatives all reject a value's shape is one error, not one per alternative:
  `Expected an integer, a string matching ^-?\d+(?:--?\d+)?$, or an object.` instead of three
  errors such as `Expected type 'integer'.` and `Expected type 'object'.`.
- A union of single required properties is one error that asks for one of them:
  `Missing one of these properties: 'spawnablePositionType', 'context'.`, not "missing all of them".
- Bounds, lengths, item counts and patterns have plain messages instead of ajv's: `Must be at least
  1.` instead of `must be >= 1`, `Must not be empty.`, `"zero" doesn't match the expected format …`.
- An unknown property or enum value that's a near miss of an allowed one says so: `Unknown property
  'basestats'. Did you mean 'baseStats'?` An enum list cut at 8 values says how many more there are.
- Fixed: in a union picked by `type`, such as a spawn's `pokemon` / `pokemon-herd` / `npc` / `empty`,
  a mistake in the shared part (a spawn without `spawnablePositionType` or `context`) also reported
  every other branch's requirements: `'herdablePokemon'`, `'npcClass'`, `Value must be "npc".` and so
  on. Now only the branch the file's `type` names is reported.

Messages change for the cases above, and unions give fewer errors. Neither `keyword`, `params` nor
`pointer` changes for the errors that remain.

## 0.1.0

First release as its own package. Up to `@cobbled-creators/cobblemon-schemas` 1.8.0 and 1.7.0, the
engine shipped inside each schema package, one copy per Cobblemon version. Now there's one engine
for every version, and the schema packages are data only. The repo README's "Migrating from 1.8.0 /
1.7.0" maps every old import to its new home.

How it differs from the engine in 1.8.0 / 1.7.0:

- `loadEngine` takes the schema package to use: `loadEngine({ schemas })`, where `schemas` is a
  package name or npm alias (`'cobblemon-schemas-1.8'`), a path, a `file:` URL, or an already imported
  `{ bundle, validators }`. Names resolve from `from` (default: the working directory). Pass `from:
  import.meta.url` in a library. Call it once per Cobblemon version to validate against several.
- `resolveSchemaPackage(schemas, { from })` returns `{ name, version, root, cobblemon }`. It replaces
  the `packageRoot`, `schemaRoot` and `cobblemon` exports. `loadSchemas(dir)` needs the package's
  `schemas/` folder.
- `SchemaEngine.fromBundle` checks the bundle's `formatVersion` and rejects formats it doesn't read
  (`ERR_COBBLEMON_BUNDLE_FORMAT`), including the bundles of `@cobbled-creators/cobblemon-schemas`
  1.8.0 and 1.7.0. It also checks that the validators match the bundle (`ERR_COBBLEMON_BUNDLE_MISMATCH`).
  Engines have a `schemaPackage` (`{ name, version }`) next to `cobblemon`.
- A schema package without `dist/` is an error (`ERR_COBBLEMON_BUNDLE_MISSING`) instead of silently
  being compiled. Pass `live: true` to compile it.
- `compileBundle` and `buildSchemaPackage` build a schema package's `dist/`.
- No `cobblemon-schemas` command for now. `validatePack(readPack(dir), engine)` does what it did.
- `CobblemonDataIndex` and `CobblemonAssetsIndex` moved to the schema packages
  (`types/indexes.d.ts`), because they differ by Cobblemon version.

Also new since 1.8.0 / 1.7.0:

Error positions are now ranges, so editors can underline them without parsing the file again. The
existing `line` and `column` fields are unchanged.

- `parseJson(...).locate(pointer)` also returns `offset`, `length`, `endLine` and `endColumn`.
  `endLine`/`endColumn` is exclusive. `locate(pointer, { key: true })` locates the property's key
  instead of its value; array elements and the root have no key, so they fall back to the value.
- Syntax errors and `validatePack` errors have the same span fields. A syntax error at the end of
  the file can have `length` 0.
- `locateError(parsed, error)` returns the span `validatePack` uses for a schema error, so other
  tools can underline the same text: the key of an unknown property or of an object or array, or
  the value otherwise. For object and array errors the reported line and column now point at the
  key instead of the opening bracket.

Missing required properties at the same pointer are now one error instead of one each, so a nearly
empty species file gets one error rather than one per field.

- The message lists every name, without truncating:
  `Missing required properties: 'primaryType', 'maleRatio', 'height'.` With one name it's unchanged.
- Every `required` error has `params.missingProperties`, the missing names in order.
  `params.missingProperty` is still set, to the first of them.
- `engine.validate` and `engine.check` take `{ groupRequired: false }` to get one error per property,
  as before. `validatePack` always groups.

Node 22 is supported (`engines.node` is `>=22`), so installing it in a Node 22 project such as the VS
Code extension doesn't warn about the engine. CI tests on Node 22 and 24.
