import fs from 'node:fs';
import path from 'node:path';
import { buildSchemaPackage, loadEngine } from '@cobbled-creators/cobblemon-validator/node';
import { selectPackages } from './packages.mjs';

const readJson = (...segments) => JSON.parse(fs.readFileSync(path.join(...segments), 'utf8'));
const sizeOf = (dist, name) => `${name} ${Math.round(fs.statSync(path.join(dist, name)).size / 1024)} KB`;

function problemsWith(pkg) {
  const { version, baseline } = pkg.cobblemon;
  const problems = [];
  if (pkg.folder !== `schemas-${version}`) problems.push(`its folder should be schemas-${version}, for cobblemon.version ${version}`);
  if (!pkg.version.startsWith(`${version}.`)) problems.push(`version ${pkg.version} should be ${version}.x`);
  if (!baseline.startsWith(`${version}.`)) problems.push(`cobblemon.baseline ${baseline} should be ${version}.x`);

  const bundled = new Map(readJson(pkg.dir, 'dist', 'bundle.json').entries.map((entry) => [entry.path, entry]));
  for (const entry of readJson(pkg.dir, 'schemas', 'index.json').schemas) {
    if (!fs.existsSync(path.join(pkg.dir, entry.path))) problems.push(`schemas/index.json lists ${entry.path}, which doesn't exist`);
    else if (!entry.path.startsWith('schemas/_shared/') && !bundled.get(entry.path)?.validator) problems.push(`${entry.path} has no validator (check its $id)`);
  }

  for (const name of ['data.json', 'assets.json']) {
    const from = readJson(pkg.dir, 'indexes', name).cobblemon;
    if (from !== baseline) problems.push(`indexes/${name} is from ${from}, not ${baseline}: run npm run indexes -- --package ${version}`);
  }
  return problems;
}

let failed = false;
for (const pkg of selectPackages(process.argv.slice(2))) {
  const started = Date.now();
  const { dist, validatorCount } = buildSchemaPackage(pkg.dir);
  await loadEngine({ schemas: pkg.dir });

  const problems = problemsWith(pkg);
  const sizes = ['validators.mjs', 'bundle.json'].map((name) => sizeOf(dist, name)).join(', ');
  console.log(`${pkg.folder}/dist: ${validatorCount} validators for Cobblemon ${pkg.cobblemon.version} (${sizes}) in ${Date.now() - started} ms`);
  for (const problem of problems) console.error(`  ${pkg.folder}: ${problem}`);
  failed ||= problems.length > 0;
}
process.exit(failed ? 1 : 0);
