const MAX_LISTED_VALUES = 8;

export function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

export function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

/** `"a", "b", "c"`, with at most 8 values and then how many more. */
export function listValues(values) {
  const shown = values.slice(0, MAX_LISTED_VALUES).map((value) => JSON.stringify(value)).join(', ');
  return values.length > MAX_LISTED_VALUES ? `${shown} and ${values.length - MAX_LISTED_VALUES} more` : shown;
}
