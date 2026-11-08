import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { schemaPackages } from './packages.mjs';
import { OUTPUTS, callbackMembers, describe, inputsHash, loadDescriptions, outputHash, readGenerated } from './types.mjs';

// Checks of a schema package's types/moves.d.ts and abilities.d.ts. npm run types runs them before writing;
// the build runs the ones that don't need Showdown's sources, plus checks that the files are what it wrote.

const LIB_ES5 = fs.readFileSync(createRequire(import.meta.url).resolve('typescript/lib/lib.es5.d.ts'), 'utf8');
// The extension's settings: lib.es5 only, strict, callback parameters may go untyped.
const OPTIONS = { noLib: true, strict: true, noImplicitAny: false, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, types: [], noEmit: true };

// Type-checks the types as /types.d.ts plus `files` (name → source importing './types').
function check(body, files = {}) {
  const sources = new Map([['/lib.es5.d.ts', LIB_ES5], ['/types.d.ts', body], ...Object.entries(files)]);
  const host = {
    ...ts.createCompilerHost(OPTIONS),
    getSourceFile: (name, language) => (sources.has(name) ? ts.createSourceFile(name, sources.get(name), language, true) : undefined),
    fileExists: (name) => sources.has(name),
    readFile: (name) => sources.get(name),
    getDefaultLibFileName: () => '/lib.es5.d.ts',
    getCurrentDirectory: () => '/',
    resolveModuleNames: (names) => names.map(() => ({ resolvedFileName: '/types.d.ts', extension: ts.Extension.Dts })),
  };
  return ts.createProgram({ rootNames: [...sources.keys()], options: OPTIONS, host });
}

const message = (diagnostic) => {
  const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
  if (!diagnostic.file) return `TS${diagnostic.code} ${text}`;
  const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${diagnostic.file.fileName.slice(1)}:${line + 1}: TS${diagnostic.code} ${text}`;
};

/** The types alone, with only lib.es5.d.ts, have no errors. */
export function standaloneProblems(body) {
  const program = check(body);
  return [...program.getGlobalDiagnostics(), ...program.getSemanticDiagnostics(), ...program.getSyntacticDiagnostics()].map(message);
}

const TYPOS = {
  move: ['MoveData', "{ name: 'Typo', basePower: 0, accuracy: true, pp: 5, category: 'Status', type: 'Normal', priority: 0, target: 'self', flags: {}, onHitt() {} }", 'onHit'],
  ability: ['AbilityData', "{ name: 'Typo', rating: 0, flags: {}, onStrat(pokemon) {} }", 'onStart'],
};

/** A misspelt callback is an excess-property error that suggests the right name. */
export function typoProblems(body) {
  const problems = [];
  for (const [kind, [type, object, expected]] of Object.entries(TYPOS)) {
    const file = `/${kind}.ts`;
    const program = check(body, { [file]: `import type { ${type} } from './types';\nexport const typo = ${object} satisfies ${type};\n` });
    const found = program.getSemanticDiagnostics(program.getSourceFile(file));
    const suggests = found.length === 1 && found[0].code === 2561 && message(found[0]).includes(`Did you mean to write '${expected}'?`);
    if (!suggests) problems.push(`a misspelt ${kind} callback should only get "Did you mean to write '${expected}'?", not: ${found.map(message).join('; ') || 'no error'}`);
  }
  return problems;
}

/**
 * Showdown's own data/moves.ts, abilities.ts and conditions.ts type-check against the types, ignoring errors inside
 * callback bodies: the same diagnostics the extension shows for an addon's move or ability.
 */
export function conformanceProblems(body, data) {
  const files = Object.fromEntries(Object.entries(data).map(([name, text]) => [`/${name}`, `import type { MoveData, AbilityData, ConditionData } from './types';\n${text}`]));
  const program = check(body, files);
  const problems = [];
  for (const name of Object.keys(files)) {
    const sourceFile = program.getSourceFile(name);
    const bodies = [];
    const visit = (node) => {
      if (ts.isFunctionLike(node) && node.body) bodies.push([node.body.getStart(sourceFile), node.body.getEnd()]);
      else ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    for (const diagnostic of program.getSemanticDiagnostics(sourceFile)) {
      if (!bodies.some(([start, end]) => diagnostic.start >= start && diagnostic.start < end)) problems.push(`Showdown's ${message(diagnostic)}`);
    }
  }
  return problems;
}

/** Callbacks without a description. */
export function undocumented(body) {
  const sourceFile = ts.createSourceFile('/types.d.ts', body, ts.ScriptTarget.Latest, true);
  return callbackMembers(sourceFile).filter(({ node }) => !ts.getJSDocCommentsAndTags(node).length).map(({ iface, name }) => `${iface}.${name}`);
}

/** Build checks for one schema package: the types are what npm run types wrote, from the baseline tag, and still pass. */
export function typeProblems(pkg) {
  const rerun = `run npm run types -- --package ${pkg.cobblemon.version}`;
  const problems = [];
  const bodies = new Set();
  for (const file of Object.keys(OUTPUTS)) {
    const generated = readGenerated(fs.readFileSync(path.join(pkg.dir, 'types', file), 'utf8'));
    if (!generated) {
      problems.push(`types/${file} wasn't generated: ${rerun}`);
      continue;
    }
    const { header, body } = generated;
    if (header.cobblemon !== pkg.cobblemon.baseline) problems.push(`types/${file} is from ${header.cobblemon}, not ${pkg.cobblemon.baseline}: ${rerun}`);
    if (header.inputs !== inputsHash(pkg)) problems.push(`types/${file} is older than types-src/support.d.ts, scripts/callback-descriptions.json or scripts/types.mjs: ${rerun}`);
    if (header.output !== outputHash(body)) problems.push(`types/${file} was edited by hand: change types-src/support.d.ts or scripts/callback-descriptions.json and ${rerun}`);
    bodies.add(body);
  }
  if (problems.length) return problems;
  if (bodies.size !== 1) return [`types/moves.d.ts and abilities.d.ts should have the same declarations: ${rerun}`];

  const [body] = bodies;
  problems.push(...standaloneProblems(body).map((problem) => `types: ${problem}`), ...typoProblems(body).map((problem) => `types: ${problem}`));
  const missing = undocumented(body);
  if (missing.length) problems.push(`types: ${missing.length} callbacks have no description in scripts/callback-descriptions.json: ${missing.join(', ')}`);
  return problems;
}

/** Entries in scripts/callback-descriptions.json that no schema package's types use. */
export function unusedDescriptions() {
  const descriptions = loadDescriptions();
  const used = new Set();
  for (const pkg of schemaPackages()) {
    const generated = readGenerated(fs.readFileSync(path.join(pkg.dir, 'types', 'moves.d.ts'), 'utf8'));
    if (!generated) continue;
    const sourceFile = ts.createSourceFile('/types.d.ts', generated.body, ts.ScriptTarget.Latest, true);
    for (const { iface, name, type } of callbackMembers(sourceFile)) for (const key of describe(descriptions, iface, name, type)?.keys ?? []) used.add(key);
  }
  return Object.entries(descriptions).flatMap(([section, entries]) => Object.keys(entries).map((key) => `${section}.${key}`)).filter((key) => !used.has(key));
}
