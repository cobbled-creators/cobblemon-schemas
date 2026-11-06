import fs from 'node:fs';
import path from 'node:path';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { loadSchemas } from '../src/node/load-schemas.mjs';
import { cobblemon, distRoot, packageJson } from '../src/node/package-info.mjs';

const STANDALONE_OPTIONS = { code: { source: true, esm: true, optimize: true } };

function nameValidators(ajv, entries) {
  const exportedIds = {};
  const namedEntries = entries.map((entry, i) => {
    if (!entry.id || !ajv.getSchema(entry.id)) return entry;
    const name = `v${i}`;
    exportedIds[name] = entry.id;
    return { ...entry, validator: name };
  });
  return { exportedIds, namedEntries };
}

function requiresToImports(code) {
  const imports = [];
  const withoutDefaultRequires = code.replace(/const (\w+) = require\("([^"]+)"\)\.default;/g, (_, name, module) => {
    imports.push(`import ${name}__mod from "${module}.js";\nconst ${name} = ${name}__mod.default ?? ${name}__mod;`);
    return '';
  });
  const withoutRequires = withoutDefaultRequires.replace(/const (\w+) = require\("([^"]+)"\);/g, (_, name, module) => {
    imports.push(`import ${name} from "${module}.js";`);
    return '';
  });
  if (/\brequire\(/.test(withoutRequires)) throw new Error('Standalone validator code still contains require() calls.');
  return `${imports.join('\n')}\n${withoutRequires}`;
}

function writeDist(files) {
  fs.mkdirSync(distRoot, { recursive: true });
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(distRoot, name), content);
}

function sizeOf(name) {
  return `${Math.round(fs.statSync(path.join(distRoot, name)).size / 1024)} KB`;
}

const started = Date.now();
const { ajv, entries } = loadSchemas(undefined, STANDALONE_OPTIONS);
const { exportedIds, namedEntries } = nameValidators(ajv, entries);

writeDist({
  'validators.mjs': requiresToImports(standaloneCode(ajv, exportedIds)),
  'bundle.json': JSON.stringify({ package: packageJson.version, cobblemon, entries: namedEntries }),
});

const sizes = `validators.mjs ${sizeOf('validators.mjs')}, bundle.json ${sizeOf('bundle.json')}`;
console.log(`dist/: ${Object.keys(exportedIds).length} validators for Cobblemon ${cobblemon.version} (${sizes}) in ${Date.now() - started} ms`);
