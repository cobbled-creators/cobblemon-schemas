import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RELATIVE_PATH = /^\.\.?(?:[\\/]|$)/;
const INSTALL_HINT = 'npm i @cobbled-creators/cobblemon-schemas@~1.8.0, or an alias such as "cobblemon-schemas-1.8": "npm:@cobbled-creators/cobblemon-schemas@~1.8.0"';

export function resolveSchemaPackage(schemas, { from } = {}) {
  if (isSchemaPackage(schemas)) return schemas;
  if (typeof schemas !== 'string' && !(schemas instanceof URL)) {
    throw new TypeError(`Expected a schema package name, path or file: URL, got ${typeof schemas}.`);
  }
  return readSchemaPackage(locatePackageJson(schemas, baseFile(from)));
}

function isSchemaPackage(value) {
  return Boolean(value && typeof value === 'object' && !(value instanceof URL) && typeof value.root === 'string' && value.cobblemon);
}

// A file whose directory is the base: createRequire wants a file, and relative paths want its directory.
function baseFile(from) {
  const base = from === undefined ? process.cwd() : toPath(from);
  return fs.statSync(base, { throwIfNoEntry: false })?.isDirectory() ? path.join(base, '[schemas]') : base;
}

function toPath(value) {
  if (value instanceof URL || value.startsWith('file:')) return fileURLToPath(value);
  return path.resolve(value);
}

function locatePackageJson(schemas, base) {
  const isPath = schemas instanceof URL || schemas.startsWith('file:') || path.isAbsolute(schemas) || RELATIVE_PATH.test(schemas);
  if (!isPath) return resolveSpecifier(schemas, base);

  const target = schemas instanceof URL || schemas.startsWith('file:') ? fileURLToPath(schemas) : path.resolve(path.dirname(base), schemas);
  const packageJson = path.basename(target) === 'package.json' ? target : path.join(target, 'package.json');
  if (!fs.existsSync(packageJson)) throw notFound(`No schema package at ${path.dirname(packageJson)}: it has no package.json.`);
  return packageJson;
}

function resolveSpecifier(specifier, base) {
  try {
    return createRequire(base).resolve(`${specifier}/package.json`);
  } catch (cause) {
    throw notFound(`Cannot find schema package '${specifier}' from ${path.dirname(base)}. Install it (${INSTALL_HINT}), or pass a path.`, cause);
  }
}

function readSchemaPackage(packageJsonPath) {
  const root = path.dirname(packageJsonPath);
  const json = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (typeof json.cobblemon?.version !== 'string') {
    const error = new Error(`${json.name ?? 'The package'} at ${root} is not a Cobblemon schema package (no "cobblemon" block in package.json).`);
    error.code = 'ERR_COBBLEMON_NOT_SCHEMA_PACKAGE';
    throw error;
  }
  return Object.freeze({ name: json.name, version: json.version, root, cobblemon: json.cobblemon });
}

function notFound(message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = 'ERR_COBBLEMON_SCHEMAS_NOT_FOUND';
  return error;
}
