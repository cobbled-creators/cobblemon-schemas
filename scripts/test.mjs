import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoRoot, selectPackages } from './packages.mjs';

const testFiles = (dir) => fs.readdirSync(dir).filter((name) => name.endsWith('.test.mjs')).sort().map((name) => path.join(dir, name));

function run(args, { cwd }) {
  return spawnSync(process.execPath, args, { cwd, stdio: 'inherit' }).status ?? 1;
}

function testPackage(pkg) {
  if (pkg.engine) return run(['--test', ...testFiles(path.join(pkg.dir, 'test'))], { cwd: pkg.dir });

  return run([path.join(repoRoot, 'scripts', 'build.mjs'), '--package', pkg.dir], { cwd: repoRoot });
}

const packages = selectPackages(process.argv.slice(2), { allowEngine: true });
const failed = [];
for (const pkg of packages) {
  if (packages.length > 1) console.log(`\n== ${pkg.folder}`);
  if (testPackage(pkg) !== 0) failed.push(pkg.folder);
}

if (packages.length > 1) console.log(failed.length ? `\nFailed: ${failed.join(', ')}` : `\nAll ${packages.length} packages passed.`);
process.exit(failed.length ? 1 : 0);
