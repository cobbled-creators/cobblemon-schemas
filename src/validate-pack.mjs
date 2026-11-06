import { parseJson } from './json/parse-json.mjs';

export function validatePack(files, engine) {
  const results = [];
  for (const [file, content] of files) {
    const schema = engine.resolve(file);
    if (schema) results.push({ file, schema, errors: validateFile(content, schema, engine) });
  }
  return results.sort((a, b) => a.file.localeCompare(b.file));
}

function validateFile(content, schema, engine) {
  const parsed = parseJson(content);
  const syntaxErrors = parsed.syntaxErrors.map((error) => ({ kind: 'syntax', pointer: [], ...error }));
  if (parsed.value === undefined) return syntaxErrors;

  const schemaErrors = engine.validate(schema, parsed.value).map((error) => ({
    kind: 'schema',
    ...error,
    ...locateError(parsed, error),
  }));
  return [...syntaxErrors, ...schemaErrors];
}

export function locateError(parsed, error) {
  const unknownProperty = error.keyword === 'additionalProperties' ? error.params.additionalProperty : undefined;
  if (unknownProperty !== undefined) return parsed.locate([...error.pointer, unknownProperty], { key: true });
  const value = valueAt(parsed.value, error.pointer);
  return parsed.locate(error.pointer, { key: value !== null && typeof value === 'object' });
}

function valueAt(root, pointer) {
  let current = root;
  for (const segment of pointer) {
    if (current === null || typeof current !== 'object') return undefined;
    current = current[segment];
  }
  return current;
}
