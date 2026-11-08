import { asRecord, listValues } from './values.mjs';

/**
 * Collaborator-written messages live in the schemas, on the schema object whose keyword fails:
 *
 *   "x-errorMessage": "…"                                   every error from this schema object
 *   "x-errorMessage": { "minimum": "…", "oneOf": "…" }      by keyword
 *   "x-errorMessage": { "required": { "species": "…", "*": "…" } }
 *                                                           by property name, for required and
 *                                                           additionalProperties
 *
 * A string, or a `oneOf`/`anyOf` entry, on a schema with a failing union turns the union into one
 * error. ajv puts each error's schema object in `parentSchema` (with `verbose`), including in the
 * standalone validators, so annotations need nothing beyond the schemas.
 */
export const ANNOTATION = 'x-errorMessage';

const NAME_PARAMS = { required: 'missingProperty', additionalProperties: 'additionalProperty' };
const ALWAYS_AVAILABLE = ['property', 'value'];
const BOUND_PARAMS = ['limit', 'comparison'];
const KEYWORD_PARAMS = {
  type: ['type'],
  required: ['missingProperty', 'missingProperties'],
  additionalProperties: ['additionalProperty'],
  enum: ['allowedValues'],
  const: ['allowedValue'],
  minimum: BOUND_PARAMS,
  maximum: BOUND_PARAMS,
  exclusiveMinimum: BOUND_PARAMS,
  exclusiveMaximum: BOUND_PARAMS,
  minLength: ['limit'],
  maxLength: ['limit'],
  minItems: ['limit'],
  maxItems: ['limit'],
  minProperties: ['limit'],
  maxProperties: ['limit'],
  pattern: ['pattern'],
  format: ['format'],
  multipleOf: ['multipleOf'],
};
const PLACEHOLDER = /\{([A-Za-z]+)\}/g;
const MAX_VALUE_LENGTH = 40;

/**
 * The annotation for an error from its own schema object: a by-name entry, then the keyword's entry,
 * then the string form. `source` identifies where it came from; `byName` is set for by-name entries.
 */
export function ownAnnotation(error) {
  const annotation = error.parentSchema?.[ANNOTATION];
  if (typeof annotation === 'string') return { template: annotation, source: error.parentSchema };
  const entry = asRecord(annotation)?.[error.keyword];
  if (typeof entry === 'string') return { template: entry, source: error.parentSchema };
  const byName = NAME_PARAMS[error.keyword] ? asRecord(entry) : undefined;
  if (!byName) return undefined;
  const named = byName[error.params?.[NAME_PARAMS[error.keyword]]];
  if (typeof named === 'string') return { template: named, source: error.parentSchema, byName: true };
  return typeof byName['*'] === 'string' ? { template: byName['*'], source: error.parentSchema } : undefined;
}

/** The annotation that turns a failed `oneOf`/`anyOf` into one error: the string form or the keyword's entry. */
export function unionAnnotation(combinator) {
  const annotation = combinator.parentSchema?.[ANNOTATION];
  if (typeof annotation === 'string') return annotation;
  const entry = asRecord(annotation)?.[combinator.keyword];
  return typeof entry === 'string' ? entry : undefined;
}

/** `{property}` and `{value}` for an error at `pointer` (decoded) whose value is `value`. */
export function templateVariables(pointer, value) {
  const property = pointer.findLast((segment) => typeof segment === 'string') ?? '(root)';
  return { property, value: shortJson(value) };
}

export function renderTemplate(template, variables) {
  return template.replace(PLACEHOLDER, (placeholder, name) => (variables[name] === undefined ? placeholder : renderValue(variables[name])));
}

/**
 * Problems with the annotations in one schema file, as `{ pointer, message }` with the JSON pointer of
 * the annotation. Used by the build, so a bad annotation can't be published.
 */
export function annotationProblems(schema) {
  const problems = [];
  visitSchemas(schema, '', (node, pointer) => {
    if (!Object.hasOwn(node, ANNOTATION)) return;
    const at = `${pointer}/${ANNOTATION}`;
    const report = (where, message) => problems.push({ pointer: where, message });
    const annotation = node[ANNOTATION];

    if (Object.hasOwn(node, '$ref')) {
      report(at, 'is next to $ref, so it never applies: errors come from the referenced schema. Annotate the referenced schema '
        + '(it can name the field with {property}), or wrap the reference: { "anyOf": [{ "$ref": … }], "x-errorMessage": … }.');
      return;
    }
    if (typeof annotation === 'string') {
      checkTemplate(annotation, ALWAYS_AVAILABLE, (message) => report(at, message));
      return;
    }
    if (!asRecord(annotation)) {
      report(at, 'must be a string, or an object that maps keywords to messages.');
      return;
    }
    for (const [keyword, entry] of Object.entries(annotation)) {
      const where = `${at}/${escapePointer(keyword)}`;
      if (!Object.hasOwn(node, keyword)) {
        report(where, `has a message for '${keyword}', which this schema object doesn't have, so it never applies.`);
      } else if (typeof entry === 'string') {
        checkTemplate(entry, placeholdersFor(keyword), (message) => report(where, message));
      } else if (NAME_PARAMS[keyword] && asRecord(entry)) {
        checkByName(node, keyword, entry, (name, message) => report(`${where}/${escapePointer(name)}`, message));
      } else {
        report(where, NAME_PARAMS[keyword] ? 'must be a string, or an object that maps property names to messages.' : 'must be a string.');
      }
    }
  });
  return problems;
}

function checkByName(node, keyword, entry, report) {
  const declared = Object.keys(asRecord(node.properties) ?? {});
  for (const [name, template] of Object.entries(entry)) {
    if (typeof template !== 'string') report(name, 'must be a string.');
    else if (keyword === 'required' && name !== '*' && !(node.required ?? []).includes(name)) report(name, `names '${name}', which this schema object doesn't require.`);
    else if (keyword === 'additionalProperties' && node.additionalProperties !== false) report(name, 'only applies with "additionalProperties": false.');
    else if (keyword === 'additionalProperties' && declared.includes(name)) report(name, `names '${name}', which is a declared property, so it's never unknown.`);
    else checkTemplate(template, placeholdersFor(keyword), (message) => report(name, message));
  }
}

function placeholdersFor(keyword) {
  return [...ALWAYS_AVAILABLE, ...(KEYWORD_PARAMS[keyword] ?? [])];
}

function checkTemplate(template, available, report) {
  const unknown = [...template.matchAll(PLACEHOLDER)].map(([, name]) => name).filter((name) => !available.includes(name));
  if (unknown.length) report(`uses ${unknown.map((name) => `{${name}}`).join(', ')}; it can use ${available.map((name) => `{${name}}`).join(', ')}.`);
}

// Schema objects only: the values of `properties`-like maps, not the maps; not `const`/`enum` data.
const SCHEMA_MAPS = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']);
const DATA = new Set(['const', 'enum', 'default', 'examples', ANNOTATION]);

function visitSchemas(node, pointer, visit) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => visitSchemas(item, `${pointer}/${index}`, visit));
    return;
  }
  if (!asRecord(node)) return;
  visit(node, pointer);
  for (const [key, child] of Object.entries(node)) {
    if (DATA.has(key)) continue;
    const childPointer = `${pointer}/${escapePointer(key)}`;
    if (SCHEMA_MAPS.has(key) && asRecord(child)) {
      for (const [name, schema] of Object.entries(child)) visitSchemas(schema, `${childPointer}/${escapePointer(name)}`, visit);
    } else {
      visitSchemas(child, childPointer, visit);
    }
  }
}

function renderValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return listValues(value);
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function shortJson(value) {
  const json = JSON.stringify(value) ?? String(value);
  return json.length > MAX_VALUE_LENGTH ? `${json.slice(0, MAX_VALUE_LENGTH - 1)}…` : json;
}

function escapePointer(segment) {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}
