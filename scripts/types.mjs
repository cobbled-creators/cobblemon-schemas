import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { openSource, parseSourceOptions } from './cobblemon-source.mjs';
import { repoRoot, selectPackages } from './packages.mjs';
import { openShowdown } from './showdown-source.mjs';
import { conformanceProblems, standaloneProblems, typoProblems } from './types-check.mjs';

// Writes <package>/types/moves.d.ts and abilities.d.ts: the hand-written types-src/support.d.ts plus the callback
// interfaces of the Showdown that Cobblemon bundles at the package's cobblemon.baseline tag, each callback with a
// one-line description from scripts/callback-descriptions.json. Nothing is written unless the result type-checks on
// its own and Showdown's own moves, abilities and conditions type-check against it.

export const OUTPUTS = {
  'moves.d.ts': "Types for Cobblemon's Showdown move files (data/<namespace>/moves/*.js or .ts).",
  'abilities.d.ts': "Types for Cobblemon's Showdown ability files (data/<namespace>/abilities/*.js or .ts).",
};
export const DESCRIPTIONS = path.join(repoRoot, 'scripts', 'callback-descriptions.json');
const GENERATED = '// @generated ';

// What's copied from Showdown, in output order. Interfaces are copied whole, Condition from its class's declare members.
const COPIED = [
  ['sim/dex-moves.ts', 'MoveEventMethods'],
  ['sim/dex-conditions.ts', 'EventMethods'],
  ['sim/dex-conditions.ts', 'PokemonEventMethods'],
  ['sim/dex-conditions.ts', 'SideEventMethods'],
  ['sim/dex-conditions.ts', 'FieldEventMethods'],
  ['sim/dex-conditions.ts', 'Condition'],
  ['sim/dex-conditions.ts', 'PokemonConditionData'],
  ['sim/dex-conditions.ts', 'SideConditionData'],
  ['sim/dex-conditions.ts', 'FieldConditionData'],
  ['sim/dex-conditions.ts', 'ConditionData'],
  ['sim/dex-abilities.ts', 'AbilityEventMethods'],
];
// Hand-written in support.d.ts because they mix callbacks with curated fields. Their callbacks and the event
// interfaces they extend must match Showdown's.
const CHECKED = [
  ['sim/dex-moves.ts', 'HitEffect', []],
  ['sim/dex-moves.ts', 'MoveData', ['MoveEventMethods', 'HitEffect']],
  ['sim/dex-abilities.ts', 'AbilityData', ['AbilityEventMethods', 'PokemonEventMethods']],
];
// Interfaces whose callbacks get descriptions.
export const DOCUMENTED = new Set(['MoveEventMethods', 'HitEffect', 'EventMethods', 'PokemonEventMethods', 'SideEventMethods',
  'FieldEventMethods', 'Condition', 'AbilityEventMethods']);
export const isCallbackName = (name) => /^on[A-Z]|Callback$/.test(name);

export const supportFile = (pkg) => path.join(pkg.dir, 'types-src', 'support.d.ts');
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);

export function inputsHash(pkg) {
  const inputs = [supportFile(pkg), DESCRIPTIONS, path.join(repoRoot, 'scripts', 'types.mjs')];
  return sha(inputs.map((file) => `${path.relative(repoRoot, file)}\0${fs.readFileSync(file, 'utf8')}`).join('\0'));
}

export function outputHash(body) {
  return sha(body);
}

// Splits a generated file into its @generated header (parsed) and the body after it.
export function readGenerated(text) {
  const start = text.indexOf(GENERATED);
  if (start === -1) return undefined;
  const end = text.indexOf('\n', start);
  return { header: JSON.parse(text.slice(start + GENERATED.length, end)), body: text.slice(end + 1) };
}

export function loadDescriptions() {
  return JSON.parse(fs.readFileSync(DESCRIPTIONS, 'utf8'));
}

// The description for a callback, and the description keys it came from (for the unused-entry check).
export function describe(descriptions, iface, name, type) {
  const { members, prefixes, ordering, events } = descriptions;
  for (const key of [`${iface}.${name}`, name]) if (members[key]) return { text: members[key], keys: [`members.${key}`] };

  const order = type === 'number' && name.match(/^(on\w+?)(SubOrder|Order|Priority)$/);
  if (order && ordering[order[2]]) return { text: ordering[order[2]].replaceAll('{handler}', order[1]), keys: [`ordering.${order[2]}`] };

  const prefixed = name.match(/^on(Ally|Foe|Source|Any)([A-Z]\w*)$/);
  if (prefixed && prefixes[prefixed[1]] && events[prefixed[2]]) {
    const event = events[prefixed[2]];
    return { text: `${prefixes[prefixed[1]]}: ${event[0].toLowerCase()}${event.slice(1)}`, keys: [`prefixes.${prefixed[1]}`, `events.${prefixed[2]}`] };
  }
  const plain = name.match(/^on([A-Z]\w*)$/);
  if (plain && events[plain[1]]) return { text: events[plain[1]], keys: [`events.${plain[1]}`] };
  return undefined;
}

// Every callback member of the documented interfaces in a declarations file: [{ iface, name, type, node }].
export function callbackMembers(sourceFile) {
  const members = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement) || !DOCUMENTED.has(statement.name.text)) continue;
    for (const member of statement.members) {
      if (!ts.isPropertySignature(member) || !member.type || !isCallbackName(member.name.getText(sourceFile))) continue;
      members.push({ iface: statement.name.text, name: member.name.getText(sourceFile), type: member.type.getText(sourceFile), node: member });
    }
  }
  return members;
}

const parse = (name, text) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
const oneLine = (text) => text.replace(/\s*\n\s*/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

function declaration(sourceFile, name) {
  const found = sourceFile.statements.find((statement) => statement.name?.text === name);
  if (!found) throw new Error(`${sourceFile.fileName} no longer declares ${name}`);
  return found;
}

function memberText(sourceFile, member, { readonly = false } = {}) {
  if (!member.name || !member.type || !(ts.isPropertySignature(member) || ts.isPropertyDeclaration(member))) {
    throw new Error(`${sourceFile.fileName}: don't know how to copy '${member.getText(sourceFile).split('\n')[0]}'`);
  }
  return `  ${readonly ? 'readonly ' : ''}${member.name.getText(sourceFile)}${member.questionToken ? '?' : ''}: ${oneLine(member.type.getText(sourceFile))};`;
}

const heritage = (sourceFile, node) => (node.heritageClauses ?? []).flatMap((clause) => clause.types.map((type) => oneLine(type.getText(sourceFile))));

function copy(sourceFile, name) {
  const node = declaration(sourceFile, name);
  if (ts.isTypeAliasDeclaration(node)) return `export type ${name} = ${oneLine(node.type.getText(sourceFile))};`;
  if (ts.isClassDeclaration(node)) {
    // Only the declared fields: the class's other members are runtime code. Its base class is BasicEffect.
    const declared = node.members.filter((member) => member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword));
    const base = node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)?.types[0].getText(sourceFile);
    return `export interface ${name}${base ? ` extends ${base}` : ''} {\n${declared.map((member) => memberText(sourceFile, member, { readonly: true })).join('\n')}\n}`;
  }
  if (!ts.isInterfaceDeclaration(node)) throw new Error(`${sourceFile.fileName}: ${name} isn't an interface, class or type`);
  const parents = heritage(sourceFile, node);
  const members = node.members.map((member) => memberText(sourceFile, member));
  return `export interface ${name}${parents.length ? ` extends ${parents.join(', ')}` : ''} {${members.length ? `\n${members.join('\n')}\n` : ''}}`;
}

// The callbacks and event parents of the hand-written mixed interfaces must match Showdown's.
function supportProblems(sources, support) {
  const problems = [];
  const callbacks = (sourceFile, node) => node.members.filter((member) => member.name && isCallbackName(member.name.getText(sourceFile)))
    .map((member) => memberText(sourceFile, member).trim()).sort();
  for (const [file, name, events] of CHECKED) {
    const theirs = declaration(sources[file], name);
    const ours = declaration(support, name);
    const [a, b] = [callbacks(sources[file], theirs), callbacks(support, ours)];
    for (const member of a.filter((text) => !b.includes(text))) problems.push(`support.d.ts ${name} should have Showdown's ${member}`);
    for (const member of b.filter((text) => !a.includes(text))) problems.push(`support.d.ts ${name} has ${member}, which Showdown's doesn't`);
    const parents = heritage(support, ours);
    for (const event of events) {
      if (!heritage(sources[file], theirs).includes(event)) problems.push(`Showdown's ${name} no longer extends ${event}`);
      if (!parents.includes(event)) problems.push(`support.d.ts ${name} should extend ${event}, like Showdown's`);
    }
  }
  return problems;
}

// Adds each callback's description as a JSDoc line. Returns the text and the callbacks that have none.
function document(text, descriptions) {
  const sourceFile = parse('/body.d.ts', text);
  const inserts = [];
  const missing = [];
  for (const { iface, name, type, node } of callbackMembers(sourceFile)) {
    if (ts.getJSDocCommentsAndTags(node).length) throw new Error(`support.d.ts: ${iface}.${name} has a JSDoc; put its description in scripts/callback-descriptions.json`);
    const description = describe(descriptions, iface, name, type);
    if (!description) missing.push(`${iface}.${name}`);
    else inserts.push([node.getStart(sourceFile), `/** ${description.text} */\n  `]);
  }
  for (const [at, insert] of inserts.sort((a, b) => b[0] - a[0])) text = text.slice(0, at) + insert + text.slice(at);
  return { text, missing };
}

function generate(pkg, showdown) {
  const sources = Object.fromEntries(['sim/dex-moves.ts', 'sim/dex-conditions.ts', 'sim/dex-abilities.ts'].map((file) => [file, parse(file, showdown.file(file))]));
  const supportText = fs.readFileSync(supportFile(pkg), 'utf8');
  const support = parse('support.d.ts', supportText);
  const problems = supportProblems(sources, support);

  const copied = COPIED.map(([file, name]) => copy(sources[file], name)).join('\n\n');
  const body = [
    '\n',
    supportText.replace(/^(\/\/.*\n)+\n/, ''),
    "\n// From Showdown's sim/dex-moves.ts, sim/dex-conditions.ts and sim/dex-abilities.ts.\n\n",
    copied,
    '\n',
  ].join('');
  const { text, missing } = document(body, loadDescriptions());
  return { body: text, missing, problems };
}

function render(header, body, file) {
  return [
    `// ${OUTPUTS[file]}`,
    `// From @cobbled-creators/cobblemon-schemas. Generated by \`npm run types\` from the Showdown bundled with Cobblemon ${header.cobblemon},`,
    '// so edit types-src/support.d.ts or scripts/callback-descriptions.json in the repo and rerun, not this file.',
    `${GENERATED}${JSON.stringify(header)}`,
    body,
  ].join('\n');
}

function writeTypes(pkg, source) {
  const showdown = openShowdown(source);
  const { body, missing, problems } = generate(pkg, showdown);
  const data = Object.fromEntries(['data/moves.ts', 'data/abilities.ts', 'data/conditions.ts'].map((file) => [file, showdown.file(file)]));
  problems.push(...standaloneProblems(body), ...typoProblems(body), ...conformanceProblems(body, data));

  console.log(`${pkg.folder}/types/ from the Showdown in cable/cobblemon @ ${source.label} (showdownVersion ${showdown.showdownVersion}, zip ${showdown.zipBlob.slice(0, 12)})`);
  if (problems.length) {
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`  ${problems.length} problems: nothing written.`);
    return false;
  }

  const header = { cobblemon: source.label, revision: source.revision, showdownVersion: showdown.showdownVersion, showdownZip: showdown.zipBlob, inputs: inputsHash(pkg), output: outputHash(body) };
  for (const file of Object.keys(OUTPUTS)) fs.writeFileSync(path.join(pkg.dir, 'types', file), render(header, body, file));

  const callbacks = callbackMembers(parse('/body.d.ts', body)).length;
  console.log(`  moves.d.ts, abilities.d.ts: ${callbacks} callbacks, ${body.split('\n').length} lines`);
  if (missing.length) console.warn(`  ${missing.length} callbacks have no description (the build fails until they do): ${missing.join(', ')}`);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let ok = true;
  for (const pkg of selectPackages(args)) ok = writeTypes(pkg, openSource(parseSourceOptions(args, pkg))) && ok;
  process.exit(ok ? 0 : 1);
}
