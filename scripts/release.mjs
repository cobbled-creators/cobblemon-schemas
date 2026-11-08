import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compareVersions, engine, newestSchemaPackage, packagesDir, repoRoot } from './packages.mjs';

// Prints, as GITHUB_OUTPUT lines, the package dir, name, version and npm dist-tag a release tag publishes.
// --offline skips the check against the registry's current latest.

const [tag, ...flags] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function release() {
  const engineTag = tag?.match(/^engine-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
  if (engineTag) return { dir: engine.dir, version: engineTag[1], distTag: engineTag[1].includes('-') ? 'next' : 'latest' };

  const schemasTag = tag?.match(/^schemas-v((\d+\.\d+)\.\d+)$/);
  if (schemasTag) {
    const [, version, line] = schemasTag;
    const dir = path.join(packagesDir, `schemas-${line}`);
    if (!fs.existsSync(dir)) fail(`${tag}: there is no packages/schemas-${line}.`);
    const newest = newestSchemaPackage().cobblemon.version === line;
    return { dir, version, distTag: newest ? 'latest' : `cobblemon-${line}` };
  }

  fail(`${tag ?? '(no tag)'} is not a release tag: use engine-v<version> or schemas-v<x.y.z>.`);
}

const { dir, version, distTag } = release();
const packageJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
if (packageJson.version !== version) fail(`${tag} doesn't match ${path.relative(repoRoot, dir)}/package.json version ${packageJson.version}.`);

if (distTag === 'latest' && !flags.includes('--offline')) {
  const current = registryLatest(packageJson.name);
  if (current && compareVersions(version, current) < 0) fail(`${packageJson.name}@${version} is older than latest (${current}); it would move latest backwards.`);
}

const outputs = { dir: path.relative(repoRoot, dir), name: packageJson.name, version, dist_tag: distTag };
for (const [key, value] of Object.entries(outputs)) console.log(`${key}=${value}`);

function registryLatest(name) {
  try {
    return execFileSync('npm', ['view', name, 'dist-tags.latest'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined;
  } catch {
    return undefined; // not published yet
  }
}
