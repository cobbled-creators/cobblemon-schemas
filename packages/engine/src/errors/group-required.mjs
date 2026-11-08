/**
 * Merges `required` errors at the same pointer into one, at the position of the first. Every other
 * error keeps its relative order.
 */
export function groupRequiredErrors(errors) {
  const groups = new Map();
  const result = [];
  for (const error of errors) {
    if (error.keyword !== 'required') {
      result.push(error);
      continue;
    }
    const key = JSON.stringify(error.pointer);
    const group = groups.get(key);
    if (group) {
      for (const name of missingNames(error)) group.names.add(name);
      continue;
    }
    groups.set(key, { index: result.length, first: error, names: new Set(missingNames(error)) });
    result.push(error);
  }
  for (const group of groups.values()) result[group.index] = mergeGroup(group);
  return result;
}

function missingNames(error) {
  return error.params.missingProperties ?? [error.params.missingProperty];
}

function mergeGroup({ first, names }) {
  const missingProperties = [...names];
  return {
    ...first,
    params: { ...first.params, missingProperty: missingProperties[0], missingProperties },
    message: formatMissing(missingProperties),
  };
}

function formatMissing(names) {
  if (names.length === 1) return `Missing required property '${names[0]}'.`;
  return `Missing required properties: ${names.map((name) => `'${name}'`).join(', ')}.`;
}
