import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const packagesDir = path.join(repoRoot, 'packages');
export const engine = Object.freeze({ folder: 'engine', dir: path.join(packagesDir, 'engine'), engine: true });

export function schemaPackages() {
  return fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter((child) => child.isDirectory() && child.name.startsWith('schemas-'))
    .map((child) => readSchemaPackage(path.join(packagesDir, child.name)))
    .sort((a, b) => compareVersions(a.cobblemon.version, b.cobblemon.version));
}

export function newestSchemaPackage() {
  return schemaPackages().at(-1);
}

export function selectPackages(args, { allowEngine = false } = {}) {
  const candidates = allowEngine ? [engine, ...schemaPackages()] : schemaPackages();
  if (args.includes('--all')) return candidates;

  const requested = valueOf(args, '--package');
  if (requested !== undefined) {
    const match = candidates.find((pkg) => matches(pkg, requested));
    if (!match) fail(`No package '${requested}'. ${available(candidates)}`);
    return [match];
  }

  const here = candidates.find((pkg) => samePath(pkg.dir, process.cwd()));
  if (!here) fail(`Pass --package <name> or --all. ${available(candidates)}`);
  return [here];
}

export function valueOf(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function compareVersions(a, b) {
  const [left, right] = [a, b].map((version) => version.split('.').map(Number));
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function readSchemaPackage(dir) {
  const json = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  return Object.freeze({ folder: path.basename(dir), dir, name: json.name, version: json.version, cobblemon: json.cobblemon });
}

function matches(pkg, requested) {
  if (requested === pkg.folder || requested === pkg.cobblemon?.version) return true;
  return samePath(pkg.dir, path.resolve(requested));
}

function samePath(a, b) {
  const real = (value) => (fs.existsSync(value) ? fs.realpathSync(value) : value);
  return real(a) === real(b);
}

function available(candidates) {
  return `Packages: ${candidates.map((pkg) => pkg.folder).join(', ')}.`;
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const folders = [...(args.includes('--with-engine') ? [engine] : []), ...schemaPackages()].map((pkg) => pkg.folder);
  console.log(args.includes('--json') ? JSON.stringify(folders) : folders.join('\n'));
}
