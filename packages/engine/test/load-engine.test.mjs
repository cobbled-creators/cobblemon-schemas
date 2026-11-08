import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEngine } from '../src/node.mjs';
import { installFixture, TESTMON } from './helpers.mjs';

const installed = installFixture();

function assertFixtureEngine(engine) {
  assert.deepEqual(engine.schemaPackage, { name: '@cobbled-creators/cobblemon-schemas', version: '0.0.0-fixture' });
  assert.equal(engine.cobblemon.version, '0.0');
  assert.deepEqual(engine.check('data/mypack/species/a.json', { ...TESTMON, extra: true }).errors.map((error) => error.message), ["Unknown property 'extra'."]);
}

test('a schema package is found by name from `from`, by path, or passed in already loaded', async () => {
  assertFixtureEngine(await loadEngine({ schemas: installed.alias, from: pathToFileURL(path.join(installed.dir, 'src', 'app.mjs')) }));
  assertFixtureEngine(await loadEngine({ schemas: installed.root }));

  const dist = path.join(installed.root, 'dist');
  const bundle = JSON.parse(fs.readFileSync(path.join(dist, 'bundle.json'), 'utf8'));
  const validators = await import(pathToFileURL(path.join(dist, 'validators.mjs')).href);
  assertFixtureEngine(await loadEngine({ schemas: { bundle, validators } }));
});

test('a missing, unknown or non-schema package is a clear error', async () => {
  await assert.rejects(loadEngine(), { name: 'TypeError', message: /loadEngine\(\{ schemas: '@cobbled-creators\/cobblemon-schemas' \}\)/ });
  await assert.rejects(loadEngine({ schemas: 'cobblemon-schemas-9.9', from: installed.dir }), {
    code: 'ERR_COBBLEMON_SCHEMAS_NOT_FOUND',
    message: /Cannot find schema package 'cobblemon-schemas-9\.9'.*npm i @cobbled-creators\/cobblemon-schemas/,
  });

  const notSchemas = path.join(installed.dir, 'node_modules', 'not-schemas');
  fs.mkdirSync(notSchemas, { recursive: true });
  fs.writeFileSync(path.join(notSchemas, 'package.json'), JSON.stringify({ name: 'not-schemas', version: '1.0.0' }));
  await assert.rejects(loadEngine({ schemas: 'not-schemas', from: installed.dir }), { code: 'ERR_COBBLEMON_NOT_SCHEMA_PACKAGE' });
});

test('a package without dist/ is an error unless live', async () => {
  const unbuilt = installFixture({ build: false });
  await assert.rejects(loadEngine({ schemas: unbuilt.root }), { code: 'ERR_COBBLEMON_BUNDLE_MISSING', message: /run npm run build, or pass live: true/ });
  assertFixtureEngine(await loadEngine({ schemas: unbuilt.root, live: true }));
});
