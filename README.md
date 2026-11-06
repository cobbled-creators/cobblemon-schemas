# @cobbled-creators/cobblemon-schemas

JSON Schemas for Cobblemon datapack and resource pack files, and a small validator: it works out
which schema a pack file uses, validates it, and reports one plain error per problem, with line
numbers.

Each Cobblemon version has its own release line:

| Cobblemon | Install | Branch |
|---|---|---|
| 1.8 | `npm i @cobbled-creators/cobblemon-schemas@~1.8.0` | `main` |
| 1.7 | `npm i @cobbled-creators/cobblemon-schemas@~1.7.0` | `cobblemon/1.7` |

Pin with `~`, not `^`: the minor version is the Cobblemon version, so `^1.7.0` would upgrade you to
1.8's schemas. To use several versions at once, use npm aliases:

```json
"cobblemon-schemas-1.8": "npm:@cobbled-creators/cobblemon-schemas@~1.8.0",
"cobblemon-schemas-1.7": "npm:@cobbled-creators/cobblemon-schemas@~1.7.0"
```

## Use

Node:

```js
import { loadEngine, readPack, validatePack } from '@cobbled-creators/cobblemon-schemas/node';

const engine = await loadEngine();
engine.resolve('data/mypack/species/foo.json');      // 'schemas/species/schema.json'
engine.check('data/mypack/species/foo.json', value); // { schema, errors: [{ pointer, keyword, params, message }] }

validatePack(readPack('path/to/pack'), engine);
// [{ file, schema, errors: [{ kind: 'syntax' | 'schema', message, pointer,
//                             line, column, offset, length, endLine, endColumn }] }]
```

Error positions are 1-based `line`/`column`, plus `offset`/`length` into the text (without any byte
order mark) and an exclusive `endLine`/`endColumn`. To place errors from `engine.check` in an editor,
parse the file with `parseJson` and pass each error to `locateError`. It returns the same range
`validatePack` reports: the key of an unknown property or of an object or array, or the value
otherwise.

```js
import { locateError, parseJson } from '@cobbled-creators/cobblemon-schemas';

const parsed = parseJson(text);
parsed.syntaxErrors;                          // [{ message, line, column, offset, length, endLine, endColumn }]
parsed.locate(['stats', 'hp']);               // range of the value
parsed.locate(['stats', 'hp'], { key: true }); // range of the key; array elements and the root fall back to the value
engine.validate(schema, parsed.value).map((error) => ({ ...error, ...locateError(parsed, error) }));
```

Browser: the main entry point has no Node APIs, and the validators are precompiled (no `eval`), so it
works under a strict Content-Security-Policy.

```js
import { SchemaEngine } from '@cobbled-creators/cobblemon-schemas';
import bundle from '@cobbled-creators/cobblemon-schemas/bundle.json' with { type: 'json' };
import * as validators from '@cobbled-creators/cobblemon-schemas/validators.mjs';

const engine = SchemaEngine.fromBundle(bundle, validators);
```

The schemas themselves are at `@cobbled-creators/cobblemon-schemas/schemas/<type>/schema.json`, listed in
`schemas/index.json`.

CLI, run on the pack folder (the one holding `data/` and `assets/`):

```bash
npx @cobbled-creators/cobblemon-schemas validate path/to/pack   # --json for machine-readable output; exits 1 on errors
```

## Development

```bash
npm install
npm test           # builds dist/ and runs the tests
npm run baseline   # lists schema errors in Cobblemon's own data at package.json's cobblemon.baseline tag
```

## License

MIT. The schemas started out in [cobblemon-addon-vscode](https://github.com/ppVon/cobblemon-addon-vscode).
Not affiliated with Cobblemon, Mojang or Microsoft.
