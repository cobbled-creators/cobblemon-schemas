import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJson, validatePack } from '../src/index.mjs';
import { bundledEngine, TESTMON_WITH_UNKNOWN_PROPERTY } from './helpers.mjs';

test('comments and a byte order mark are accepted', () => {
  assert.equal(parseJson('{ /* note */ "a": 1 }').ok, true);
  assert.equal(parseJson('﻿{"a": 1}').value.a, 1);
});

test('syntax errors have plain messages and positions', () => {
  assert.deepEqual(parseJson('{\n  "a": 1\n  "b": 2\n}').syntaxErrors, [{ message: 'Expected ",".', line: 3, column: 3 }]);
});

test('a trailing comma is reported once, at the comma', () => {
  assert.deepEqual(parseJson('[1, 2,]').syntaxErrors, [{ message: 'Trailing comma.', line: 1, column: 6 }]);
  assert.deepEqual(parseJson('{"a": 1, // note\n}').syntaxErrors, [{ message: 'Trailing comma.', line: 1, column: 8 }]);
  assert.deepEqual(parseJson('{"a": 1, /* note */ }').syntaxErrors, [{ message: 'Trailing comma.', line: 1, column: 8 }]);
});

test('validatePack only checks files a schema covers', () => {
  const files = new Map([
    ['pack.mcmeta', '{}'],
    ['data/mypack/species/testmon.json', '{}'],
    ['data/mypack/not_a_registry/x.json', '{'],
  ]);
  assert.deepEqual(validatePack(files, bundledEngine).map((result) => result.file), ['data/mypack/species/testmon.json']);
});

test('validatePack gives line numbers for syntax and schema errors', () => {
  const text = JSON.stringify(TESTMON_WITH_UNKNOWN_PROPERTY, null, 2).replace(/\n}$/, ',\n  // note\n}');
  const [result] = validatePack(new Map([['data/mypack/species/testmon.json', text]]), bundledEngine);
  const lines = text.split('\n');
  const [trailingComma, unknownProperty] = result.errors;

  assert.deepEqual([trailingComma.kind, trailingComma.message], ['syntax', 'Trailing comma.']);
  assert.match(lines[trailingComma.line - 1], /,$/);
  assert.equal(unknownProperty.kind, 'schema');
  assert.match(lines[unknownProperty.line - 1], /"notARealField"/);
});
