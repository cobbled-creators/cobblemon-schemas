import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { cobblemon, loadEngine, packageRoot, validatePack } from '../src/node.mjs';

const RESOURCES = 'common/src/main/resources/';
const DATA_ROOTS = [`${RESOURCES}data/`, `${RESOURCES}assets/`];
const DEFAULT_CHECKOUTS = ['../cable/cobblemon', '../cobblemon'];
const MAX_GIT_OUTPUT = 1024 * 1024 * 1024;

function parseOptions(args) {
  const valueOf = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  return {
    checkout: valueOf('--cobblemon') ?? findCheckout(),
    rev: valueOf('--rev') ?? cobblemon.baseline,
    worktree: args.includes('--worktree'),
  };
}

function findCheckout() {
  return DEFAULT_CHECKOUTS
    .map((candidate) => path.resolve(packageRoot, candidate))
    .find((candidate) => fs.existsSync(path.join(candidate, RESOURCES)));
}

function git(checkout, args, input) {
  return execFileSync('git', ['-C', checkout, ...args], { input, maxBuffer: MAX_GIT_OUTPUT });
}

function jsonPaths(listing) {
  return listing.toString('utf8').split('\n').filter((name) => name.endsWith('.json'));
}

function readWorktree(checkout) {
  const files = new Map();
  for (const name of jsonPaths(git(checkout, ['ls-files', ...DATA_ROOTS]))) {
    files.set(name.slice(RESOURCES.length), fs.readFileSync(path.join(checkout, name)));
  }
  return files;
}

function readRevision(checkout, rev) {
  const names = jsonPaths(git(checkout, ['ls-tree', '-r', '--name-only', rev, ...DATA_ROOTS]));
  const batch = git(checkout, ['cat-file', '--batch'], `${names.map((name) => `${rev}:${name}`).join('\n')}\n`);
  const contents = splitCatFileBatch(batch, names.length);
  return new Map(names.map((name, i) => [name.slice(RESOURCES.length), contents[i]]));
}

function splitCatFileBatch(batch, count) {
  const contents = [];
  let offset = 0;
  for (let i = 0; i < count; i += 1) {
    const headerEnd = batch.indexOf(10, offset);
    const size = Number(batch.subarray(offset, headerEnd).toString('utf8').split(' ')[2]);
    contents.push(batch.subarray(headerEnd + 1, headerEnd + 1 + size));
    offset = headerEnd + 1 + size + 1;
  }
  return contents;
}

const options = parseOptions(process.argv.slice(2));
if (!options.checkout) {
  console.error('No Cobblemon checkout found. Clone https://gitlab.com/cable-mc/cobblemon next to this repo, or pass --cobblemon <path>.');
  process.exit(2);
}

const files = options.worktree ? readWorktree(options.checkout) : readRevision(options.checkout, options.rev);
const results = validatePack(files, await loadEngine({ live: true }));
const errors = results.flatMap((result) => result.errors.map((error) => `${result.file} /${error.pointer.join('/')}: ${error.message}`));

for (const error of errors) console.log(error);
console.log(`\ncable/cobblemon @ ${options.worktree ? 'working tree' : options.rev}: ${results.length} files checked, ${errors.length} errors`);
