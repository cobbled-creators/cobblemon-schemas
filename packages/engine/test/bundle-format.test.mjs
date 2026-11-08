import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUNDLE_FORMAT_VERSION, SchemaEngine } from '../src/index.mjs';
import { compileBundle } from '../src/node.mjs';
import { FIXTURE, FIXTURE_SPECIES, schemaPackageWith } from './helpers.mjs';

test('fromBundle rejects a bundle format it does not read, or validators from another build', () => {
  const validator = () => true;
  const bundle = { formatVersion: BUNDLE_FORMAT_VERSION, package: { name: 'x', version: '1.8.1' }, entries: [{ path: FIXTURE_SPECIES, validator: 'v0' }] };
  const { formatVersion, ...unversioned } = { ...bundle, package: '1.8.0' }; // what 1.8.0 and 1.7.0 shipped

  assert.throws(() => SchemaEngine.fromBundle({ ...bundle, formatVersion: 2 }, { v0: validator }), { code: 'ERR_COBBLEMON_BUNDLE_FORMAT', message: /^Unsupported schema bundle format 2 \(x 1\.8\.1\); this engine reads format 1\./ });
  assert.throws(() => SchemaEngine.fromBundle(unversioned, { v0: validator }), { code: 'ERR_COBBLEMON_BUNDLE_FORMAT', message: /format none/ });
  assert.throws(() => SchemaEngine.fromBundle(bundle, { v1: validator }), { code: 'ERR_COBBLEMON_BUNDLE_MISMATCH' });
});

test('compileBundle writes the current format and copies in the ajv runtime instead of importing it', () => {
  const { bundle, validators, declarations } = compileBundle(FIXTURE);
  assert.equal(bundle.formatVersion, BUNDLE_FORMAT_VERSION);
  assert.deepEqual(bundle.package, { name: '@cobbled-creators/cobblemon-schemas', version: '0.0.0-fixture' });
  assert.deepEqual(bundle.entries.map((entry) => [entry.path, entry.validator]), [[FIXTURE_SPECIES, 'v0']]);
  assert.match(validators, /function ucs2length\(str\)/); // needed by minLength
  assert.doesNotMatch(validators, /^\s*import\b|\brequire\(/m);
  assert.match(declarations, /^export declare const v0: /m);
});

test('a schema that needs an ajv runtime helper the build cannot copy in fails the build', () => {
  const root = schemaPackageWith({ tags: { $id: 'https://cobblemon-schema.local/test/tags/schema.json', type: 'array', uniqueItems: true } });
  assert.throws(() => compileBundle(root), /need ajv\/dist\/runtime\/equal, which the build doesn't inline/);
});
