import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cobblemon, packageRoot } from '../src/node.mjs';
import { TESTMON, TESTMON_WITH_UNKNOWN_PROPERTY } from './helpers.mjs';

const CLI = path.join(packageRoot, 'bin', 'cobblemon-schemas.mjs');

function run(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

function packWithSpecies(species) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cobblemon-schemas-'));
  fs.mkdirSync(path.join(dir, 'data/mypack/species'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data/mypack/species/testmon.json'), JSON.stringify(species));
  return dir;
}

test('validate lists errors and exits 1', () => {
  const output = run('validate', packWithSpecies(TESTMON_WITH_UNKNOWN_PROPERTY));
  assert.equal(output.status, 1);
  assert.match(output.stdout, /data\/mypack\/species\/testmon\.json\n.*Unknown property 'fireImmune'\. {2}at \/behaviour\/moving/);
  assert.match(output.stdout, /1 file checked: 1 error in 1 file\./);
});

test('validate --json gives the same errors as data', () => {
  const report = JSON.parse(run('validate', packWithSpecies(TESTMON_WITH_UNKNOWN_PROPERTY), '--json').stdout);
  assert.equal(report.results[0].errors[0].keyword, 'additionalProperties');
});

test('validate exits 0 on a valid pack', () => {
  assert.equal(run('validate', packWithSpecies(TESTMON)).status, 0);
});

test('bad arguments print usage and exit 2', () => {
  assert.equal(run('validate').status, 2);
  assert.equal(run('validate', path.join(os.tmpdir(), 'does-not-exist')).status, 2);
  assert.equal(run('lint', '.').status, 2);
});

test('--version names the Cobblemon version', () => {
  assert.match(run('--version').stdout, new RegExp(`Cobblemon ${cobblemon.version}`));
});
