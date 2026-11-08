import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { ANNOTATION, annotationProblems } from '../errors/annotations.mjs';

const AJV_OPTIONS = { allErrors: true, strict: false, allowUnionTypes: true, verbose: true };

export function loadSchemas(schemasDir, ajvOptions = {}) {
  if (typeof schemasDir !== 'string') throw new TypeError("loadSchemas needs the path of a schema package's schemas/ folder.");
  const root = path.resolve(schemasDir);
  const packageRoot = path.dirname(root);
  const ajv = new Ajv2020({ ...AJV_OPTIONS, ...ajvOptions });
  const problems = [];
  for (const file of schemaFiles(root)) {
    const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
    const relativePath = path.relative(packageRoot, file).split(path.sep).join('/');
    for (const { pointer, message } of annotationProblems(schema)) problems.push(`${relativePath}#${pointer} ${message}`);
    ajv.addSchema(schema, schema.$id ?? relativePath);
  }
  if (problems.length) throw annotationError(problems);
  return { ajv, entries: readIndex(root) };
}

function annotationError(problems) {
  const error = new Error(`${problems.length === 1 ? 'An' : problems.length} ${ANNOTATION} annotation${problems.length === 1 ? ' is' : 's are'} invalid:\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
  error.code = 'ERR_COBBLEMON_ANNOTATION';
  error.problems = problems;
  return error;
}

function readIndex(root) {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
  return index.schemas
    .filter((entry) => !entry.path.startsWith('schemas/_shared/'))
    .map((entry) => ({ path: entry.path, id: entry.$id, ...(entry.dataPath ? { dataPath: entry.dataPath } : {}) }));
}

function* schemaFiles(dir) {
  const children = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const child of children) {
    const childPath = path.join(dir, child.name);
    if (child.isDirectory()) yield* schemaFiles(childPath);
    else if (isSchemaFile(child.name)) yield childPath;
  }
}

function isSchemaFile(name) {
  return name === 'schema.json' || name.endsWith('.schema.json');
}
