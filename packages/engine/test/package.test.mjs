import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { engineRoot } from './helpers.mjs';

const SRC = path.join(engineRoot, 'src');
const NODE_ONLY = [path.join(SRC, 'node.mjs'), path.join(SRC, 'node')];
const NODE_APIS = /from ['"](?:node:[^'"]*|fs|path|url|ajv(?:\/[^'"]*)?)['"]|\bprocess\.|\bBuffer\b|\brequire\(/;
const packageJson = JSON.parse(fs.readFileSync(path.join(engineRoot, 'package.json'), 'utf8'));

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

test('the browser entry point never reaches Node APIs', () => {
  for (const file of sourceFiles(SRC).filter((candidate) => !isNodeOnly(candidate))) {
    const source = fs.readFileSync(file, 'utf8');
    const name = path.relative(engineRoot, file);
    assert.doesNotMatch(source, NODE_APIS, name);
    for (const [, imported] of source.matchAll(/from '(\.[^']+)'/g)) {
      assert.ok(!isNodeOnly(path.resolve(path.dirname(file), imported)), `${name} imports Node-only ${imported}`);
    }
  }
});

test('the published package contains what the exports point at, and nothing else', () => {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: engineRoot, encoding: 'utf8' }));
  const published = packed[0].files.map((file) => file.path);
  const exported = Object.values(packageJson.exports)
    .flatMap((target) => (typeof target === 'string' ? [target] : Object.values(target)))
    .map((target) => target.replace(/^\.\//, ''));

  for (const file of exported) assert.ok(published.includes(file), `${file} is not published`);
  const topLevel = [...new Set(published.map((file) => file.split('/')[0]))].sort();
  assert.deepEqual(topLevel, ['LICENSE.md', 'README.md', 'package.json', 'src']);
});
