import { asRecord, listValues, stringArray } from './values.mjs';

const TYPE_NAMES = {
  array: 'an array',
  boolean: 'true or false',
  integer: 'an integer',
  null: 'null',
  number: 'a number',
  object: 'an object',
  string: 'a string',
};

/** The engine's built-in message for one ajv error (from a validator compiled with `verbose`). */
export function formatAjvError(error) {
  const params = error.params ?? {};
  switch (error.keyword) {
    case 'required':
      return `Missing required property '${params.missingProperty}'.`;
    case 'additionalProperties':
      return `Unknown property '${params.additionalProperty}'.${suggest(params.additionalProperty, unusedPropertyNames(error))}`;
    case 'enum':
      return `Value must be one of: ${listValues(params.allowedValues ?? [])}.${suggest(error.data, stringArray(params.allowedValues), JSON.stringify)}`;
    case 'const':
      return `Value must be ${JSON.stringify(params.allowedValue)}.`;
    case 'type':
      return `Expected type '${params.type}'.`;
    case 'minimum':
      return `Must be at least ${params.limit}.`;
    case 'maximum':
      return `Must be at most ${params.limit}.`;
    case 'exclusiveMinimum':
      return `Must be greater than ${params.limit}.`;
    case 'exclusiveMaximum':
      return `Must be less than ${params.limit}.`;
    case 'minLength':
      return params.limit === 1 ? 'Must not be empty.' : `Must be at least ${count(params.limit, 'character')} long.`;
    case 'maxLength':
      return `Must be at most ${count(params.limit, 'character')} long.`;
    case 'minItems':
      return params.limit === 1 ? 'Must have at least one item.' : `Must have at least ${count(params.limit, 'item')}.`;
    case 'maxItems':
      return `Must have at most ${count(params.limit, 'item')}.`;
    case 'minProperties':
      return `Object must define at least ${count(params.limit, 'property', 'properties')}.`;
    case 'maxProperties':
      return `Object must define at most ${count(params.limit, 'property', 'properties')}.`;
    case 'pattern':
      return `${typeof error.data === 'string' ? `${JSON.stringify(error.data)} doesn't` : "Doesn't"} match the expected format ${params.pattern}.`;
    case 'not':
      return formatNot(asRecord(asRecord(error.parentSchema)?.not));
    case 'oneOf':
      return 'Value must match exactly one supported schema shape.';
    case 'anyOf':
      return 'Value does not match any supported schema shape.';
    default:
      return error.message ?? 'Validation failed';
  }
}

/** For a union whose branches each require one property. */
export function formatAlternatives(names) {
  return `Missing one of these properties: ${names.map((name) => `'${name}'`).join(', ')}.`;
}

/** For a union whose branches each rejected the value's shape: `type`, `pattern`, `enum` or `const` errors. */
export function formatShapes(errors) {
  return `Expected ${orList([...new Set(errors.map(describeShape))])}.`;
}

export const SHAPE_KEYWORDS = new Set(['type', 'pattern', 'enum', 'const']);

function describeShape(error) {
  const params = error.params ?? {};
  switch (error.keyword) {
    case 'type':
      return orList(String(params.type).split(',').map((type) => TYPE_NAMES[type] ?? type));
    case 'pattern':
      return `a string matching ${params.pattern}`;
    case 'enum':
      return `one of ${listValues(params.allowedValues ?? [])}`;
    default:
      return JSON.stringify(params.allowedValue);
  }
}

function formatNot(notSchema) {
  if (typeof notSchema?.maxProperties === 'number') return `Object must define more than ${count(notSchema.maxProperties, 'property', 'properties')}.`;
  const disallowed = stringArray(notSchema?.required);
  if (disallowed.length === 1) return `Property '${disallowed[0]}' is not allowed in this context.`;
  if (disallowed.length > 1) return `These properties are not allowed in this context: ${disallowed.join(', ')}.`;
  return 'Value matches a disallowed schema shape.';
}

// Declared properties the object doesn't already have: what an unknown property might be meant as.
function unusedPropertyNames(error) {
  const declared = Object.keys(asRecord(asRecord(error.parentSchema)?.properties) ?? {});
  const data = asRecord(error.data) ?? {};
  return declared.filter((name) => !Object.hasOwn(data, name));
}

function suggest(value, candidates, quote = (name) => `'${name}'`) {
  const match = typeof value === 'string' ? closestName(value, candidates) : undefined;
  return match === undefined ? '' : ` Did you mean ${quote(match)}?`;
}

/** A candidate that differs only in case, or by a typo or two for longer names; nothing if it's ambiguous. */
function closestName(name, candidates) {
  const lower = name.toLowerCase();
  const sameIgnoringCase = candidates.filter((candidate) => candidate.toLowerCase() === lower);
  if (sameIgnoringCase.length) return sameIgnoringCase.length === 1 ? sameIgnoringCase[0] : undefined;

  const maxDistance = name.length < 4 ? 0 : name.length < 7 ? 1 : 2;
  let best;
  let bestDistance = maxDistance + 1;
  let ties = 0;
  for (const candidate of candidates) {
    const distance = editDistance(lower, candidate.toLowerCase());
    if (distance < bestDistance) [best, bestDistance, ties] = [candidate, distance, 0];
    else if (distance === bestDistance) ties += 1;
  }
  return best !== undefined && ties === 0 ? best : undefined;
}

// Levenshtein distance, counting a swap of two neighbours as one edit.
function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

function orList(items) {
  if (items.length < 3) return items.join(' or ');
  return `${items.slice(0, -1).join(', ')}, or ${items.at(-1)}`;
}

function count(n, singular, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}
