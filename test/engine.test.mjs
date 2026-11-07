import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundledEngine, indexedSchemas, liveEngine, SPECIES_SCHEMA, TESTMON, TESTMON_WITH_UNKNOWN_PROPERTY } from './helpers.mjs';

test('pack files resolve to the schema that covers them, when this version has it', () => {
  const expected = {
    'data/mypack/species/custom/foo.json': SPECIES_SCHEMA,
    'data/cobblemon/species_additions/foo.json': 'schemas/species_additions/schema.json',
    'data/cobblemon/spawning/best-spawner-config.json': 'schemas/best_spawner_config/schema.json',
    'data/cobblemon/move_weights.json': 'schemas/move_weights/schema.json',
    'data/cobblemon/mechanics/potions.json': 'schemas/mechanics/potions.schema.json',
    'data/cobblemon/ride_settings/horse.json': 'schemas/ride_settings/horse.schema.json',
    'assets/cobblemon/bedrock/pokemon/posers/0001_bulbasaur/bulbasaur.json': 'schemas/bedrock_posers/schema.json',
    'assets/mypack/bedrock/pokemon/resolvers/0001_bulbasaur/0_bulbasaur_base.json': 'schemas/bedrock_pokemon_resolvers/schema.json',
  };
  for (const [file, schema] of Object.entries(expected)) {
    assert.equal(bundledEngine.resolve(file), indexedSchemas.has(schema) ? schema : undefined, file);
  }
});

test('files no schema covers resolve to nothing', () => {
  const uncovered = [
    'pack.mcmeta',
    'data/minecraft/recipe/foo.json',
    'data/cobblemon/mechanics/unknown.json',
    'assets/cobblemon/lang/en_us.json',
    'data/cobblemon/foo.json',
  ];
  for (const file of uncovered) assert.equal(bundledEngine.resolve(file), undefined, file);
});

test('a valid file has no errors', () => {
  assert.deepEqual(bundledEngine.validate(SPECIES_SCHEMA, TESTMON), []);
});

test('an invalid file gets one plain error per problem', () => {
  const errors = bundledEngine.validate(SPECIES_SCHEMA, TESTMON_WITH_UNKNOWN_PROPERTY);
  assert.deepEqual(errors.map((error) => [error.pointer, error.message]), [[[], "Unknown property 'notARealField'."]]);
});

test('check resolves and validates in one step', () => {
  const errors = bundledEngine.validate(SPECIES_SCHEMA, TESTMON_WITH_UNKNOWN_PROPERTY);
  assert.deepEqual(bundledEngine.check('data/x/species/a.json', TESTMON_WITH_UNKNOWN_PROPERTY), { schema: SPECIES_SCHEMA, errors });
  assert.deepEqual(bundledEngine.check('data/x/nothing/a.json', TESTMON_WITH_UNKNOWN_PROPERTY), { schema: null, errors: [] });
});

test('the precompiled bundle and live ajv agree', () => {
  for (const value of [TESTMON, TESTMON_WITH_UNKNOWN_PROPERTY, {}, { ...TESTMON, abilities: 'nope' }]) {
    assert.deepEqual(bundledEngine.validate(SPECIES_SCHEMA, value), liveEngine.validate(SPECIES_SCHEMA, value));
  }
});

test('missing required properties at one pointer are one error', () => {
  const errors = bundledEngine.validate(SPECIES_SCHEMA, { name: 'x' });
  assert.equal(errors.length, 1);
  const [error] = errors;
  assert.deepEqual([error.pointer, error.keyword], [[], 'required']);
  assert.ok(error.params.missingProperties.length > 1);
  assert.ok(!error.params.missingProperties.includes('name'));
  assert.equal(error.params.missingProperty, error.params.missingProperties[0]);
  assert.equal(error.message, `Missing required properties: ${error.params.missingProperties.map((name) => `'${name}'`).join(', ')}.`);
  assert.match(error.message, /^Missing required properties: 'nationalPokedexNumber', 'primaryType', 'maleRatio', /);
});

test('groupRequired: false gives one error per missing property', () => {
  const [grouped] = bundledEngine.validate(SPECIES_SCHEMA, { name: 'x' });
  const errors = bundledEngine.validate(SPECIES_SCHEMA, { name: 'x' }, { groupRequired: false });
  assert.deepEqual(errors.map((error) => error.params.missingProperties), grouped.params.missingProperties.map((name) => [name]));
  for (const error of errors) {
    assert.deepEqual([error.pointer, error.keyword], [[], 'required']);
    assert.equal(error.message, `Missing required property '${error.params.missingProperty}'.`);
  }
  assert.deepEqual(bundledEngine.check('data/x/species/a.json', { name: 'x' }, { groupRequired: false }).errors, errors);
});

const { name, height, ...TESTMON_WITHOUT_NAME_AND_HEIGHT } = TESTMON;
const MIXED_ERRORS = { ...TESTMON_WITHOUT_NAME_AND_HEIGHT, baseStats: {}, notARealField: true, catchRate: 'x' };

test('required errors at different pointers are not merged', () => {
  const required = bundledEngine.validate(SPECIES_SCHEMA, MIXED_ERRORS).filter((error) => error.keyword === 'required');
  assert.deepEqual(required.map((error) => [error.pointer, error.params.missingProperties]), [
    [[], ['name', 'height']],
    [['baseStats'], ['hp', 'attack', 'defence', 'special_attack', 'special_defence', 'speed']],
  ]);
  assert.equal(required[0].message, "Missing required properties: 'name', 'height'.");
});

test('grouping leaves other errors and their order alone', () => {
  const grouped = bundledEngine.validate(SPECIES_SCHEMA, MIXED_ERRORS);
  const ungrouped = bundledEngine.validate(SPECIES_SCHEMA, MIXED_ERRORS, { groupRequired: false });
  assert.deepEqual(grouped.map((error) => [error.pointer, error.keyword]), [
    [[], 'required'],
    [[], 'additionalProperties'],
    [['baseStats'], 'required'],
    [['catchRate'], 'type'],
  ]);
  const others = (errors) => errors.filter((error) => error.keyword !== 'required');
  assert.deepEqual(others(grouped), others(ungrouped));
  assert.deepEqual(others(grouped).map((error) => error.message), ["Unknown property 'notARealField'.", "Expected type 'integer'."]);
});
