import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SchemaEngine } from '../schema-engine.mjs';
import { loadSchemas } from './load-schemas.mjs';
import { cobblemon, distRoot } from './package-info.mjs';

const BUNDLE_FILE = path.join(distRoot, 'bundle.json');
const VALIDATORS_FILE = path.join(distRoot, 'validators.mjs');

export async function loadEngine({ live = false } = {}) {
  if (!live && fs.existsSync(BUNDLE_FILE)) return loadBundledEngine();
  return compileEngine();
}

async function loadBundledEngine() {
  const bundle = JSON.parse(fs.readFileSync(BUNDLE_FILE, 'utf8'));
  const compiled = await import(pathToFileURL(VALIDATORS_FILE).href);
  return SchemaEngine.fromBundle(bundle, compiled);
}

function compileEngine() {
  const { ajv, entries } = loadSchemas();
  const validators = {};
  for (const entry of entries) {
    const validator = entry.id && ajv.getSchema(entry.id);
    if (validator) validators[entry.path] = validator;
  }
  return new SchemaEngine({ entries, validators, cobblemon });
}
