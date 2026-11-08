# @cobbled-creators/cobblemon-validator

Validates Cobblemon datapack and resource pack files. It works out which schema a pack file uses,
validates it, and reports one plain error per problem, with line numbers.

The schemas aren't in this package. They're in
[`@cobbled-creators/cobblemon-schemas`](https://www.npmjs.com/package/@cobbled-creators/cobblemon-schemas),
which has one release line per Cobblemon version. Install the engine plus the schemas for the
Cobblemon version you target:

```bash
npm i @cobbled-creators/cobblemon-validator @cobbled-creators/cobblemon-schemas@~1.8.0
```

Pin the schemas with `~`, not `^`: their minor version is the Cobblemon version, so `^1.7.0` would
upgrade you to 1.8's schemas. To use several Cobblemon versions at once, install each under an npm
alias and create one engine per version:

```json
"cobblemon-schemas-1.7": "npm:@cobbled-creators/cobblemon-schemas@~1.7.0",
"cobblemon-schemas-1.8": "npm:@cobbled-creators/cobblemon-schemas@~1.8.0"
```

The engine is on 0.x, so a breaking change bumps its minor version, and a `^` range on it only takes
patches of that minor version.

## Node

```js
import { loadEngine, readPack, validatePack } from '@cobbled-creators/cobblemon-validator/node';

const engine = await loadEngine({ schemas: '@cobbled-creators/cobblemon-schemas' });
engine.cobblemon;                                     // { version: '1.8', minecraft: '1.21.1', baseline: '1.8.2' }
engine.resolve('data/mypack/species/foo.json');      // 'schemas/species/schema.json'
engine.check('data/mypack/species/foo.json', value); // { schema, errors: [{ pointer, keyword, params, message, defaultMessage? }] }

validatePack(readPack('path/to/pack'), engine);
// [{ file, schema, errors: [{ kind: 'syntax' | 'schema', message, pointer,
//                             line, column, offset, length, endLine, endColumn }] }]

const engine17 = await loadEngine({ schemas: 'cobblemon-schemas-1.7' });
const engine18 = await loadEngine({ schemas: 'cobblemon-schemas-1.8' });
```

`schemas` is required. It can be:

- a package name or alias, resolved the way an import would be from `from` (default: the working
  directory). In a library, pass `from: import.meta.url` so your own dependencies are found;
- a path to the package directory, or to its `package.json` (relative paths resolve against
  `from`), or a `file:` URL;
- the result of `resolveSchemaPackage(...)`, which also gives you the package's `root` directory;
- an already imported `{ bundle, validators }` (see "Browser and bundlers").

By default the engine loads the package's prebuilt validators from `dist/`. `loadEngine({ schemas,
live: true })` compiles the package's `schemas/` with ajv instead. That's useful when you're
editing a schema.

Errors have a `code`: `ERR_COBBLEMON_SCHEMAS_NOT_FOUND`, `ERR_COBBLEMON_NOT_SCHEMA_PACKAGE`,
`ERR_COBBLEMON_BUNDLE_MISSING` (no `dist/`, and not `live`), `ERR_COBBLEMON_BUNDLE_FORMAT` (a schema
package this engine can't read: install the latest of both), `ERR_COBBLEMON_BUNDLE_MISMATCH` or, with
`live: true`, `ERR_COBBLEMON_ANNOTATION` (an invalid `x-errorMessage` in the schemas).

Missing required properties at the same place are one error, `Missing required properties: 'name',
'height'.`, with every name in `params.missingProperties` (and the first in `params.missingProperty`).
Pass `{ groupRequired: false }` to `engine.validate` or `engine.check` to get one error per property
instead. `validatePack` always groups.

A union whose alternatives all reject a value is one error too: `Expected an integer, a string matching
^-?\d+(?:--?\d+)?$, or an object.`, or `Missing one of these properties: 'spawnablePositionType',
'context'.` Its `keyword` is `oneOf` or `anyOf`.

`message` is the most helpful text the engine has. Where the schema package has an `x-errorMessage`
for the error, written by its collaborators, `message` is that, and `defaultMessage` has the engine's
built-in message. Show `message`, and `defaultMessage` as detail if you like:

```js
// { pointer: ['spawns', 0, 'level'], keyword: 'oneOf', params: { passingSchemas: null },
//   message: `'level' takes a whole number (5), a range ("5-32") or {"min": 5, "max": 32}, not "5 to 32".`,
//   defaultMessage: 'Expected an integer, a string matching ^-?\\d+(?:--?\\d+)?$, or an object.' }
```

## Error positions

Error positions are 1-based `line`/`column`, plus `offset`/`length` into the text (without any byte
order mark) and an exclusive `endLine`/`endColumn`. To place errors from `engine.check` in an editor,
parse the file with `parseJson` and pass each error to `locateError`. It returns the same range
`validatePack` reports: the key of an unknown property or of an object or array, or the value
otherwise.

```js
import { locateError, parseJson } from '@cobbled-creators/cobblemon-validator';

const parsed = parseJson(text);
parsed.syntaxErrors;                          // [{ message, line, column, offset, length, endLine, endColumn }]
parsed.locate(['stats', 'hp']);               // range of the value
parsed.locate(['stats', 'hp'], { key: true }); // range of the key; array elements and the root fall back to the value
engine.validate(schema, parsed.value).map((error) => ({ ...error, ...locateError(parsed, error) }));
```

## Browser and bundlers

The main entry point has no Node APIs, and each schema package's validators are precompiled and
self-contained (no `eval`, no imports), so this works under a strict Content-Security-Policy:

```js
import { SchemaEngine } from '@cobbled-creators/cobblemon-validator';
import bundle from '@cobbled-creators/cobblemon-schemas/bundle.json' with { type: 'json' };
import * as validators from '@cobbled-creators/cobblemon-schemas/validators.mjs';

const engine = SchemaEngine.fromBundle(bundle, validators);
```

With several versions, import each alias's `bundle.json` and `validators.mjs` and share the one
`SchemaEngine` class.

## License

MIT. Part of [cobblemon-schemas](https://github.com/cobbled-creators/cobblemon-schemas). Not
affiliated with Cobblemon, Mojang or Microsoft.
