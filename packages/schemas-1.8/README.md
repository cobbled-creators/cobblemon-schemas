# @cobbled-creators/cobblemon-schemas 1.8

JSON Schemas for **Cobblemon 1.8** datapack and resource pack files, prebuilt for
[`@cobbled-creators/cobblemon-validator`](https://www.npmjs.com/package/@cobbled-creators/cobblemon-validator),
plus indexes of everything Cobblemon 1.8 ships and types for Showdown move and ability files.

Each Cobblemon version has its own release line of this package:

| Cobblemon | Install |
|---|---|
| 1.8 | `npm i @cobbled-creators/cobblemon-schemas@~1.8.0` |
| 1.7 | `npm i @cobbled-creators/cobblemon-schemas@~1.7.0` |

Pin with `~`, not `^`: the minor version is the Cobblemon version, so `^1.7.0` would upgrade you to
1.8's schemas. To use several versions at once, install each under an npm alias:

```json
"cobblemon-schemas-1.7": "npm:@cobbled-creators/cobblemon-schemas@~1.7.0",
"cobblemon-schemas-1.8": "npm:@cobbled-creators/cobblemon-schemas@~1.8.0"
```

## Validating

This package is data only. Validate with the engine:

```bash
npm i @cobbled-creators/cobblemon-validator
```

```js
import { loadEngine, readPack, validatePack } from '@cobbled-creators/cobblemon-validator/node';

const engine = await loadEngine({ schemas: '@cobbled-creators/cobblemon-schemas' }); // or an alias: 'cobblemon-schemas-1.8'
validatePack(readPack('path/to/pack'), engine);
```

See the [engine's README](https://www.npmjs.com/package/@cobbled-creators/cobblemon-validator) for
the browser setup (`bundle.json` + `validators.mjs`) and error positions.

## What's in it

- `schemas/<type>/schema.json`: the schemas, listed in `schemas/index.json`.
- `bundle.json` and `validators.mjs`: the prebuilt bundle the engine loads. The validators are
  self-contained and typed (`validators.d.mts`).
- `indexes/data.json` (`speciesIds`, `dexEntryIds`) and `indexes/assets.json` (`poserIds`,
  `modelIds`, `animationGroupNames`, `textureIds`, `langKeys`): Cobblemon's own content, read from
  the `cobblemon.baseline` tag in `package.json`. Use them to tell a reference to stock content
  (`cobblemon:bulbasaur`) from a typo without a copy of Cobblemon.
- `types/indexes.d.ts`: `CobblemonDataIndex` and `CobblemonAssetsIndex`, the shape of the indexes.
- `types/moves.d.ts` and `types/abilities.d.ts`: TypeScript types for Showdown move and ability files
  (`data/<namespace>/moves/*.ts`, `data/<namespace>/abilities/*.ts`).

```ts
import data from '@cobbled-creators/cobblemon-schemas/indexes/data.json' with { type: 'json' };
import type { CobblemonDataIndex } from '@cobbled-creators/cobblemon-schemas/types/indexes.d.ts';
import type { MoveData } from '@cobbled-creators/cobblemon-schemas/types/moves.d.ts';

new Set((data as CobblemonDataIndex).speciesIds).has('cobblemon:bulbasaur'); // true
```

## License

MIT. Part of [cobblemon-schemas](https://github.com/cobbled-creators/cobblemon-schemas). The
schemas started out in [cobblemon-addon-vscode](https://github.com/ppVon/cobblemon-addon-vscode).
Not affiliated with Cobblemon, Mojang or Microsoft.
