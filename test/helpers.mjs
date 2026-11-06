import fs from 'node:fs';
import path from 'node:path';
import { loadEngine, packageRoot } from '../src/node.mjs';

export const SPECIES_SCHEMA = 'schemas/species/schema.json';

export const TESTMON = JSON.parse(fs.readFileSync(path.join(packageRoot, 'test', 'fixtures', 'testmon.species.json'), 'utf8'));

export const TESTMON_WITH_UNKNOWN_PROPERTY = {
  ...TESTMON,
  behaviour: { ...TESTMON.behaviour, moving: { ...TESTMON.behaviour.moving, fireImmune: true } },
};

export const bundledEngine = await loadEngine();
export const liveEngine = await loadEngine({ live: true });
