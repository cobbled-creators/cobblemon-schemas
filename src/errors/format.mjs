import { asRecord, stringArray } from './values.mjs';

const MAX_LISTED_VALUES = 8;

export function formatAjvError(error) {
  const params = error.params ?? {};
  switch (error.keyword) {
    case 'required':
      return `Missing required property '${params.missingProperty}'.`;
    case 'additionalProperties':
      return `Unknown property '${params.additionalProperty}'.`;
    case 'enum':
      return `Value must be one of: ${listValues(params.allowedValues ?? [])}.`;
    case 'const':
      return `Value must be ${JSON.stringify(params.allowedValue)}.`;
    case 'type':
      return `Expected type '${params.type}'.`;
    case 'minProperties':
      return `Object must define at least ${countProperties(params.limit)}.`;
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

function formatNot(notSchema) {
  if (typeof notSchema?.maxProperties === 'number') return `Object must define more than ${countProperties(notSchema.maxProperties)}.`;
  const disallowed = stringArray(notSchema?.required);
  if (disallowed.length === 1) return `Property '${disallowed[0]}' is not allowed in this context.`;
  if (disallowed.length > 1) return `These properties are not allowed in this context: ${disallowed.join(', ')}.`;
  return 'Value matches a disallowed schema shape.';
}

function listValues(values) {
  const shown = values.slice(0, MAX_LISTED_VALUES).map((value) => JSON.stringify(value)).join(', ');
  return values.length > MAX_LISTED_VALUES ? `${shown}, ...` : shown;
}

function countProperties(count) {
  return `${count} ${count === 1 ? 'property' : 'properties'}`;
}
