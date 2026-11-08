import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locateError, parseJson } from '../src/index.mjs';

const span = (line, column, offset, length, endLine, endColumn) => ({ line, column, offset, length, endLine, endColumn });

test('comments are allowed, and each syntax error is reported once with a plain message and a span', () => {
  assert.equal(parseJson('{ /* note */ "a": 1 }').ok, true);
  assert.deepEqual(parseJson('{\n  "a": 1\n  "b": 2\n}').syntaxErrors, [{ message: 'Expected ",".', ...span(3, 3, 13, 3, 3, 6) }]);
  assert.deepEqual(parseJson('[1, 2,]').syntaxErrors, [{ message: 'Trailing comma.', ...span(1, 6, 5, 1, 1, 7) }]);
  assert.deepEqual(parseJson('{"a": 1, // note\n}').syntaxErrors, [{ message: 'Trailing comma.', ...span(1, 8, 7, 1, 1, 9) }]);
});

const NESTED = '{\n  "name": "x",\n  "stats": {\n    "hp": 1\n  },\n  "tags": ["a", "b"]\n}';

test('locate spans a value, or with key: true its key, and gives {} for what is not there', () => {
  const parsed = parseJson(NESTED);
  assert.deepEqual(parsed.locate(['name']), span(2, 11, 12, 3, 2, 14));
  assert.deepEqual(parsed.locate(['stats']), span(3, 12, 28, 17, 5, 4));
  assert.deepEqual(parsed.locate(['stats', 'hp'], { key: true }), span(4, 5, 34, 4, 4, 9));
  // Array elements and the root have no key, so they fall back to the value.
  assert.deepEqual(parsed.locate(['tags', 1], { key: true }), span(6, 17, 63, 3, 6, 20));
  assert.deepEqual(parsed.locate([], { key: true }), span(1, 1, 0, NESTED.length, 7, 2));

  assert.deepEqual(parsed.locate(['missing']), {});
  assert.deepEqual(parsed.locate(['tags', 5], { key: true }), {});
  assert.deepEqual(parseJson('').locate([]), {});
});

test('a byte order mark is skipped, and offsets count from after it, for text or bytes', () => {
  const text = '﻿{"a": [1]}';
  assert.deepEqual(parseJson(text).value, { a: [1] });
  assert.deepEqual(parseJson(text).locate(['a']), span(1, 7, 6, 3, 1, 10));
  assert.deepEqual(parseJson(new TextEncoder().encode(text)).locate(['a']), span(1, 7, 6, 3, 1, 10));
  // A missing } at the end of the file is an empty span.
  assert.deepEqual(parseJson('﻿{"a":1').syntaxErrors, [{ message: 'Expected "}".', ...span(1, 7, 6, 0, 1, 7) }]);
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
