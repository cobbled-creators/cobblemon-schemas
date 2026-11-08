export function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

export function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}
