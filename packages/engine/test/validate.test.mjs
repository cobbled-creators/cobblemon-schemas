import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaEngine, validatePack } from '../src/index.mjs';
import { loadEngine } from '../src/node.mjs';
import { FIXTURE_SPECIES, installFixture, TESTMON } from './helpers.mjs';

const { root } = installFixture();
const engine = await loadEngine({ schemas: root });

test('pack files resolve to the schema that covers them, and other files to nothing', () => {
  const entries = [
    'schemas/_shared/common.schema.json',
    'schemas/species/schema.json',
    'schemas/mechanics/potions.schema.json',
    'schemas/bedrock_posers/schema.json',
    'schemas/bedrock_pokemon_resolvers/schema.json',
  ].map((path) => ({ path }));
  entries.push({ path: 'schemas/best_spawner_config/schema.json', dataPath: 'spawning/best-spawner-config.json' });
  const index = new SchemaEngine({ entries, validators: {} });

  const expected = {
    'data/mypack/species/custom/foo.json': 'schemas/species/schema.json',
    'data/cobblemon/spawning/best-spawner-config.json': 'schemas/best_spawner_config/schema.json',
    'data/cobblemon/mechanics/potions.json': 'schemas/mechanics/potions.schema.json',
    'assets/cobblemon/bedrock/pokemon/posers/0001_bulbasaur/bulbasaur.json': 'schemas/bedrock_posers/schema.json',
    'assets/mypack/bedrock/pokemon/resolvers/0001_bulbasaur/0_bulbasaur_base.json': 'schemas/bedrock_pokemon_resolvers/schema.json',
  };
  for (const [file, schema] of Object.entries(expected)) assert.equal(index.resolve(file), schema, file);

  const uncovered = ['pack.mcmeta', 'data/minecraft/recipe/foo.json', 'data/cobblemon/mechanics/unknown.json', 'data/cobblemon/_shared/common.json', 'assets/cobblemon/lang/en_us.json', 'data/cobblemon/foo.json'];
  for (const file of uncovered) assert.equal(index.resolve(file), undefined, file);
});

test('check resolves and validates, with one plain error per problem', () => {
  assert.deepEqual(engine.check('data/x/species/a.json', TESTMON), { schema: FIXTURE_SPECIES, errors: [] });
  assert.deepEqual(engine.check('data/x/species/a.json', { ...TESTMON, extra: true }), {
    schema: FIXTURE_SPECIES,
    errors: [{ pointer: [], keyword: 'additionalProperties', params: { additionalProperty: 'extra' }, message: "Unknown property 'extra'." }],
  });
  assert.deepEqual(engine.check('data/x/nothing/a.json', { ...TESTMON, extra: true }), { schema: null, errors: [] });
});

test('missing required properties at one pointer are one error, unless groupRequired: false', () => {
  const [grouped, ...rest] = engine.validate(FIXTURE_SPECIES, { name: 'x' });
  assert.deepEqual(rest, []);
  assert.deepEqual(grouped.params.missingProperties, ['primaryType', 'height', 'baseStats']);
  assert.equal(grouped.params.missingProperty, 'primaryType');
  assert.equal(grouped.message, "Missing required properties: 'primaryType', 'height', 'baseStats'.");

  const ungrouped = engine.check('data/x/species/a.json', { name: 'x' }, { groupRequired: false }).errors;
  assert.deepEqual(ungrouped.map((error) => [error.params.missingProperties, error.message]), [
    [['primaryType'], "Missing required property 'primaryType'."],
    [['height'], "Missing required property 'height'."],
    [['baseStats'], "Missing required property 'baseStats'."],
  ]);
});

test('grouping is per pointer and leaves other errors, and their order, alone', () => {
  const { name, height, ...value } = { ...TESTMON, baseStats: {}, extra: true, catchRate: 'x' };
  const grouped = engine.validate(FIXTURE_SPECIES, value);
  assert.deepEqual(grouped.map((error) => [error.pointer, error.keyword, error.params.missingProperties]), [
    [[], 'required', ['name', 'height']],
    [[], 'additionalProperties', undefined],
    [['catchRate'], 'type', undefined],
    [['baseStats'], 'required', ['hp', 'attack', 'defence']],
  ]);
  const others = (errors) => errors.filter((error) => error.keyword !== 'required');
  assert.deepEqual(others(grouped), others(engine.validate(FIXTURE_SPECIES, value, { groupRequired: false })));
});

test('the built validators and live ajv agree', async () => {
  const live = await loadEngine({ schemas: root, live: true });
  for (const value of [TESTMON, { ...TESTMON, extra: true }, {}, { ...TESTMON, name: '', baseStats: { hp: 'x' } }]) {
    assert.deepEqual(engine.validate(FIXTURE_SPECIES, value), live.validate(FIXTURE_SPECIES, value));
  }
});

test('validatePack checks only covered files, and positions syntax and schema errors', () => {
  const text = JSON.stringify({ ...TESTMON, extra: true }, null, 2).replace(/\n}$/, ',\n  // note\n}');
  const results = validatePack(new Map([
    ['pack.mcmeta', '{'],
    ['data/mypack/species/testmon.json', text],
    ['data/mypack/not_a_registry/x.json', '{'],
  ]), engine);
  assert.deepEqual(results.map((result) => result.file), ['data/mypack/species/testmon.json']);

  const [trailingComma, unknownProperty] = results[0].errors;
  assert.deepEqual([trailingComma.kind, trailingComma.message], ['syntax', 'Trailing comma.']);
  assert.equal(text.slice(trailingComma.offset, trailingComma.offset + trailingComma.length), ',');
  assert.equal(unknownProperty.kind, 'schema');
  assert.equal(text.slice(unknownProperty.offset, unknownProperty.offset + unknownProperty.length), '"extra"');
  assert.match(text.split('\n')[unknownProperty.line - 1], /"extra"/);
});
