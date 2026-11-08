import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SchemaEngine } from '../schema-engine.mjs';
import { loadSchemas } from './load-schemas.mjs';
import { resolveSchemaPackage } from './schema-package.mjs';

const MISSING_SCHEMAS =
  "loadEngine needs a schema package, e.g. loadEngine({ schemas: '@cobbled-creators/cobblemon-schemas' }) " +
  "or an npm alias such as loadEngine({ schemas: 'cobblemon-schemas-1.8' }).";

export async function loadEngine({ schemas, from, live = false } = {}) {
  if (schemas === undefined || schemas === null) throw new TypeError(MISSING_SCHEMAS);
  if (isLoadedBundle(schemas)) {
    if (live) throw new TypeError('live: true compiles a schema package from its schemas/ folder, so it needs a package name or path, not a loaded bundle.');
    return SchemaEngine.fromBundle(schemas.bundle, schemas.validators);
  }
  const pkg = resolveSchemaPackage(schemas, { from });
  return live ? compileEngine(pkg) : loadBundledEngine(pkg);
}

function isLoadedBundle(value) {
  return Boolean(value && typeof value === 'object' && !(value instanceof URL) && 'bundle' in value && 'validators' in value);
}

async function loadBundledEngine(pkg) {
  const dist = path.join(pkg.root, 'dist');
  const bundleFile = path.join(dist, 'bundle.json');
  if (!fs.existsSync(bundleFile)) {
    const error = new Error(`${bundleFile} is missing: run npm run build, or pass live: true.`);
    error.code = 'ERR_COBBLEMON_BUNDLE_MISSING';
    throw error;
  }
  const bundle = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
  const validators = await import(pathToFileURL(path.join(dist, 'validators.mjs')).href);
  return SchemaEngine.fromBundle(bundle, validators);
}

function compileEngine(pkg) {
  const { ajv, entries } = loadSchemas(path.join(pkg.root, 'schemas'));
  const validators = {};
  for (const entry of entries) {
    const validator = entry.id && ajv.getSchema(entry.id);
    if (validator) validators[entry.path] = validator;
  }
  return new SchemaEngine({ entries, validators, cobblemon: pkg.cobblemon, schemaPackage: { name: pkg.name, version: pkg.version } });
}
