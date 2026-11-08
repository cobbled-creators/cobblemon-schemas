import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { repoRoot, valueOf } from './packages.mjs';

// Reads Cobblemon's bundled resources out of a local clone of https://gitlab.com/cable-mc/cobblemon,
// either at a git revision (a schema package's cobblemon.baseline tag by default) or from the working tree.

const RESOURCES = 'common/src/main/resources/';
const DEFAULT_CHECKOUTS = ['../cable/cobblemon', '../cobblemon'];
const MAX_GIT_OUTPUT = 1024 * 1024 * 1024;

export function parseSourceOptions(args, pkg) {
  const checkout = valueOf(args, '--cobblemon') ?? process.env.COBBLEMON_CHECKOUT ?? findCheckout();
  if (!checkout) {
    console.error('No Cobblemon checkout found. Clone https://gitlab.com/cable-mc/cobblemon next to this repo, set COBBLEMON_CHECKOUT, or pass --cobblemon <path>.');
    process.exit(2);
  }
  return { checkout, rev: valueOf(args, '--rev') ?? pkg.cobblemon.baseline, worktree: args.includes('--worktree') };
}

function findCheckout() {
  return DEFAULT_CHECKOUTS
    .map((candidate) => path.resolve(repoRoot, candidate))
    .find((candidate) => fs.existsSync(path.join(candidate, RESOURCES)));
}

// Paths given to and returned by the source are relative to the resources folder, e.g. 'data/cobblemon/species/...'.
export function openSource({ checkout, rev, worktree }) {
  const git = (args, input) => execFileSync('git', ['-C', checkout, ...args], { input, maxBuffer: MAX_GIT_OUTPUT });
  const fileNames = (listing) => listing.toString('utf8').split('\n').filter(Boolean).map((name) => name.slice(RESOURCES.length));
  const roots = (prefixes) => prefixes.map((prefix) => `${RESOURCES}${prefix}`);

  if (worktree) {
    return {
      label: 'working tree',
      revision: git(['rev-parse', 'HEAD']).toString('utf8').trim(),
      list: (prefixes) => fileNames(git(['ls-files', ...roots(prefixes)])),
      read: (names) => new Map(names.map((name) => [name, fs.readFileSync(path.join(checkout, RESOURCES, name))])),
    };
  }

  return {
    label: rev,
    revision: git(['rev-parse', `${rev}^{commit}`]).toString('utf8').trim(),
    list: (prefixes) => fileNames(git(['ls-tree', '-r', '--name-only', rev, ...roots(prefixes)])),
    read(names) {
      const batch = git(['cat-file', '--batch'], `${names.map((name) => `${rev}:${RESOURCES}${name}`).join('\n')}\n`);
      const contents = splitCatFileBatch(batch, names.length);
      return new Map(names.map((name, i) => [name, contents[i]]));
    },
  };
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
