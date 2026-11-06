import fs from 'node:fs';
import path from 'node:path';
import { loadEngine, packageRoot } from '../src/node.mjs';

export const SPECIES_SCHEMA = 'schemas/species/schema.json';

export const TESTMON = JSON.parse(fs.readFileSync(path.join(packageRoot, 'test', 'fixtures', 'testmon.species.json'), 'utf8'));

export const TESTMON_WITH_UNKNOWN_PROPERTY = { ...TESTMON, notARealField: true };

export const indexedSchemas = new Set(
  JSON.parse(fs.readFileSync(path.join(packageRoot, 'schemas', 'index.json'), 'utf8')).schemas.map((entry) => entry.path),
);

export const bundledEngine = await loadEngine();
export const liveEngine = await loadEngine({ live: true });
