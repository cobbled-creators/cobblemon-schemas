import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locateError, parseJson, validatePack } from '../src/index.mjs';
import { bundledEngine, TESTMON_WITH_UNKNOWN_PROPERTY } from './helpers.mjs';

test('comments and a byte order mark are accepted', () => {
  assert.equal(parseJson('{ /* note */ "a": 1 }').ok, true);
  assert.equal(parseJson('﻿{"a": 1}').value.a, 1);
});

test('syntax errors have plain messages and spans', () => {
  assert.deepEqual(parseJson('{\n  "a": 1\n  "b": 2\n}').syntaxErrors, [
    { message: 'Expected ",".', line: 3, column: 3, offset: 13, length: 3, endLine: 3, endColumn: 6 },
  ]);
  assert.deepEqual(parseJson('\uFEFF{"a":1').syntaxErrors, [
    { message: 'Expected "}".', line: 1, column: 7, offset: 6, length: 0, endLine: 1, endColumn: 7 },
  ]);
});

test('a trailing comma is reported once, at the comma', () => {
  const comma = (offset) => ({ message: 'Trailing comma.', line: 1, column: offset + 1, offset, length: 1, endLine: 1, endColumn: offset + 2 });
  assert.deepEqual(parseJson('[1, 2,]').syntaxErrors, [comma(5)]);
  assert.deepEqual(parseJson('{"a": 1, // note\n}').syntaxErrors, [comma(7)]);
  assert.deepEqual(parseJson('{"a": 1, /* note */ }').syntaxErrors, [comma(7)]);
});

const NESTED = '{\n  "name": "x",\n  "stats": {\n    "hp": 1\n  },\n  "tags": ["a", "b"]\n}';

test('locate gives the span of a value', () => {
  const parsed = parseJson(NESTED);
  assert.deepEqual(parsed.locate(['name']), { line: 2, column: 11, offset: 12, length: 3, endLine: 2, endColumn: 14 });
  assert.deepEqual(parsed.locate(['tags', 1]), { line: 6, column: 17, offset: 63, length: 3, endLine: 6, endColumn: 20 });
});

test('locate spans an object across lines', () => {
  assert.deepEqual(parseJson(NESTED).locate(['stats']), { line: 3, column: 12, offset: 28, length: 17, endLine: 5, endColumn: 4 });
  assert.deepEqual(parseJson(NESTED).locate([]), { line: 1, column: 1, offset: 0, length: NESTED.length, endLine: 7, endColumn: 2 });
});

test('locate with key: true gives the span of the property key', () => {
  const parsed = parseJson(NESTED);
  assert.deepEqual(parsed.locate(['stats'], { key: true }), { line: 3, column: 3, offset: 19, length: 7, endLine: 3, endColumn: 10 });
  assert.deepEqual(parsed.locate(['stats', 'hp'], { key: true }), { line: 4, column: 5, offset: 34, length: 4, endLine: 4, endColumn: 9 });
});

test('locate with key: true falls back to the value for array elements and the root', () => {
  const parsed = parseJson(NESTED);
  assert.deepEqual(parsed.locate(['tags', 1], { key: true }), parsed.locate(['tags', 1]));
  assert.deepEqual(parsed.locate([], { key: true }), parsed.locate([]));
});

test('locate offsets ignore a byte order mark', () => {
  const withBom = parseJson('\uFEFF{"a": [1]}');
  assert.deepEqual(withBom.locate(['a']), { line: 1, column: 7, offset: 6, length: 3, endLine: 1, endColumn: 10 });
  assert.deepEqual(withBom.locate(['a']), parseJson(new TextEncoder().encode('\uFEFF{"a": [1]}')).locate(['a']));
});

test('locate gives {} for a pointer that is not in the file', () => {
  const parsed = parseJson(NESTED);
  assert.deepEqual(parsed.locate(['missing']), {});
  assert.deepEqual(parsed.locate(['tags', 5], { key: true }), {});
  assert.deepEqual(parseJson('').locate([]), {});
});

test('locateError underlines the key of an unknown property, object or array, and other values whole', () => {
  const parsed = parseJson(NESTED);
  const error = (pointer, keyword = 'type', params = {}) => ({ pointer, keyword, params, message: '' });
  assert.deepEqual(locateError(parsed, error([], 'additionalProperties', { additionalProperty: 'stats' })), parsed.locate(['stats'], { key: true }));
  assert.deepEqual(locateError(parsed, error(['stats'], 'required')), parsed.locate(['stats'], { key: true }));
  assert.deepEqual(locateError(parsed, error(['tags'])), parsed.locate(['tags'], { key: true }));
  assert.deepEqual(locateError(parsed, error(['name'])), parsed.locate(['name']));
  assert.deepEqual(locateError(parsed, error(['tags', 0])), parsed.locate(['tags', 0]));
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
  assert.equal(text.slice(trailingComma.offset, trailingComma.offset + trailingComma.length), ',');
  assert.equal(text.slice(unknownProperty.offset, unknownProperty.offset + unknownProperty.length), '"notARealField"');
});
