#!/usr/bin/env node
import fs from 'node:fs';
import { cobblemon, loadEngine, readPack, validatePack } from '../src/node.mjs';

const USAGE = 'usage: cobblemon-schemas validate <pack folder> [--json]\n       cobblemon-schemas --version';

function isDirectory(dir) {
  return Boolean(dir && fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory());
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function formatError(error) {
  const position = error.line ? `${error.line}:${error.column}` : '-';
  const location = error.pointer.length ? `  at /${error.pointer.join('/')}` : '';
  return `  ${position.padEnd(8)} ${error.message}${location}`;
}

function printText(results, failing) {
  for (const result of failing) {
    console.log(`\n${result.file}`);
    for (const error of result.errors) console.log(formatError(error));
  }
  const errorCount = failing.reduce((total, result) => total + result.errors.length, 0);
  const summary = errorCount ? `${plural(errorCount, 'error')} in ${plural(failing.length, 'file')}` : 'no errors';
  console.log(`\n${plural(results.length, 'file')} checked: ${summary}.`);
}

function printJson(results, failing) {
  console.log(JSON.stringify({ cobblemon, checked: results.length, results: failing }, null, 2));
}

async function main([command, dir, ...flags]) {
  if (command === '--version') {
    console.log(`Cobblemon ${cobblemon.version} schemas`);
    return 0;
  }
  if (command !== 'validate' || !isDirectory(dir)) {
    console.error(USAGE);
    return 2;
  }

  const results = validatePack(readPack(dir), await loadEngine());
  const failing = results.filter((result) => result.errors.length);
  (flags.includes('--json') ? printJson : printText)(results, failing);
  return failing.length ? 1 : 0;
}

process.exit(await main(process.argv.slice(2)));
