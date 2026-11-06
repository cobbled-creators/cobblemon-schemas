import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cobblemon, packageRoot } from '../src/node.mjs';

const read = (name) => JSON.parse(fs.readFileSync(path.join(packageRoot, 'indexes', name), 'utf8'));
const indexes = { 'data.json': read('data.json'), 'assets.json': read('assets.json') };

test('the indexes were read from the Cobblemon version the package targets', () => {
  for (const [name, index] of Object.entries(indexes)) {
    assert.equal(index.cobblemon, cobblemon.baseline, `${name} is from ${index.cobblemon}; run npm run indexes`);
    assert.match(index.revision, /^[0-9a-f]{40}$/, name);
  }
});

test('every index list is non-empty, sorted and has no duplicates', () => {
  for (const [name, index] of Object.entries(indexes)) {
    for (const [key, ids] of Object.entries(index).filter(([, value]) => Array.isArray(value))) {
      assert.ok(ids.length > 0, `${name} ${key} is empty`);
      assert.deepEqual(ids, [...new Set(ids)].sort(), `${name} ${key} is not sorted and unique`);
    }
  }
});

test('the indexes list stock content', () => {
  const { 'data.json': data, 'assets.json': assets } = indexes;
  assert.ok(data.speciesIds.includes('cobblemon:bulbasaur'));
  assert.ok(data.dexEntryIds.includes('cobblemon:bulbasaur'));
  assert.ok(assets.poserIds.includes('cobblemon:bulbasaur'));
  assert.ok(assets.modelIds.includes('cobblemon:bulbasaur_male.geo'));
  assert.ok(assets.animationGroupNames.includes('bulbasaur'));
  assert.ok(assets.textureIds.includes('cobblemon:textures/pokemon/0001_bulbasaur/bulbasaur.png'));
  assert.ok(assets.langKeys.includes('cobblemon.species.bulbasaur.name'));
});
