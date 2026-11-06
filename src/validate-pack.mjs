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
    ...parsed.locate(pointerToHighlight(error)),
  }));
  return [...syntaxErrors, ...schemaErrors];
}

function pointerToHighlight(error) {
  const unknownProperty = error.keyword === 'additionalProperties' ? error.params.additionalProperty : undefined;
  return unknownProperty === undefined ? error.pointer : [...error.pointer, unknownProperty];
}
