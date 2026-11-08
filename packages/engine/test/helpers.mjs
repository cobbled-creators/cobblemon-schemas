import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSchemaPackage } from '../src/node.mjs';

export const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE = path.join(engineRoot, 'test', 'fixtures', 'minimal-schemas');
export const FIXTURE_SPECIES = 'schemas/species/schema.json';
export const TESTMON = Object.freeze({ name: 'Testmon', primaryType: 'grass', height: 7, baseStats: { hp: 45, attack: 49, defence: 49 } });

/** A temp directory with node_modules/<alias> holding a copy of the fixture package, as `npm i <alias>@npm:…` would. */
export function installFixture({ alias = 'cobblemon-schemas-fixture', build = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cobblemon-validator-'));
  const root = path.join(dir, 'node_modules', alias);
  fs.cpSync(FIXTURE, root, { recursive: true });
  if (build) buildSchemaPackage(root);
  return { dir, root, alias };
}

export function schemaPackageWith(schemas) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cobblemon-validator-'));
  const entries = Object.entries(schemas).map(([name, schema]) => {
    const file = path.join(root, 'schemas', name, 'schema.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(schema));
    return { name, path: `schemas/${name}/schema.json`, $id: schema.$id };
  });
  fs.writeFileSync(path.join(root, 'schemas', 'index.json'), JSON.stringify({ schemas: entries }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'test-schemas', version: '0.0.0', cobblemon: { version: '0.0', minecraft: '1.21.1', baseline: '0.0.0' } }));
  return root;
}
