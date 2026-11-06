import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { cobblemon, packageRoot } from '../src/node.mjs';
import { packageJson } from '../src/node/package-info.mjs';
import { bundledEngine } from './helpers.mjs';

const SRC = path.join(packageRoot, 'src');
const NODE_ONLY = [path.join(SRC, 'node.mjs'), path.join(SRC, 'node')];
const NODE_APIS = /from ['"](?:node:[^'"]*|fs|path|url|ajv(?:\/[^'"]*)?)['"]|\bprocess\.|\bBuffer\b|\brequire\(/;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((child) => {
    const childPath = path.join(dir, child.name);
    if (child.isDirectory()) return sourceFiles(childPath);
    return child.name.endsWith('.mjs') ? [childPath] : [];
  });
}

function isNodeOnly(file) {
  return NODE_ONLY.some((nodePath) => file === nodePath || file.startsWith(`${nodePath}${path.sep}`));
}

test('the package version is on the line for its Cobblemon version', () => {
  assert.match(cobblemon.version, /^\d+\.\d+$/);
  assert.ok(cobblemon.baseline.startsWith(`${cobblemon.version}.`));
  assert.ok(packageJson.version.startsWith(`${cobblemon.version}.`), `package ${packageJson.version} has to be ${cobblemon.version}.x`);
  assert.deepEqual(bundledEngine.cobblemon, cobblemon);
});

test('the browser entry point never reaches Node APIs', () => {
  for (const file of sourceFiles(SRC).filter((candidate) => !isNodeOnly(candidate))) {
    const source = fs.readFileSync(file, 'utf8');
    const name = path.relative(packageRoot, file);
    assert.doesNotMatch(source, NODE_APIS, name);
    for (const [, imported] of source.matchAll(/from '(\.[^']+)'/g)) {
      assert.ok(!isNodeOnly(path.resolve(path.dirname(file), imported)), `${name} imports Node-only ${imported}`);
    }
  }
});

test('every schema in the index exists and has a compiled validator', () => {
  const index = JSON.parse(fs.readFileSync(path.join(packageRoot, 'schemas', 'index.json'), 'utf8'));
  const bundle = JSON.parse(fs.readFileSync(path.join(packageRoot, 'dist', 'bundle.json'), 'utf8'));
  for (const entry of index.schemas) {
    assert.ok(fs.existsSync(path.join(packageRoot, entry.path)), entry.path);
    if (entry.path.startsWith('schemas/_shared/')) continue;
    assert.ok(bundle.entries.find((bundled) => bundled.path === entry.path)?.validator, `${entry.path} has no validator`);
  }
});

test('the published package contains what the exports point at, and nothing else', () => {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: packageRoot, encoding: 'utf8' }));
  const published = packed[0].files.map((file) => file.path);
  const exported = Object.values(packageJson.exports)
    .flatMap((target) => (typeof target === 'string' ? [target] : Object.values(target)))
    .filter((target) => !target.includes('*'))
    .map((target) => target.replace(/^\.\//, ''));

  for (const file of exported) assert.ok(published.includes(file), `${file} is exported but not published`);
  const topLevel = [...new Set(published.map((file) => file.split('/')[0]))].sort();
  assert.deepEqual(topLevel, ['LICENSE.md', 'README.md', 'bin', 'dist', 'package.json', 'schemas', 'src']);
});
