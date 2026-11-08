import fs from 'node:fs';
import path from 'node:path';
import { openSource, parseSourceOptions } from './cobblemon-source.mjs';
import { selectPackages } from './packages.mjs';

// Writes <package>/indexes/data.json and assets.json: the ids of everything Cobblemon itself ships, so tools can
// tell a reference to stock content (cobblemon:bulbasaur) from a typo without a copy of Cobblemon.

const DATA = 'data/cobblemon/';
const ASSETS = 'assets/cobblemon/';
const args = process.argv.slice(2);

for (const pkg of selectPackages(args)) writeIndexes(pkg, openSource(parseSourceOptions(args, pkg)));

function writeIndexes(pkg, source) {
  const output = path.join(pkg.dir, 'indexes');
  const files = source.list([DATA, ASSETS]);
  const under = (prefix, suffix) => files.filter((name) => name.startsWith(prefix) && name.endsWith(suffix));
  const basename = (name, suffix) => path.posix.basename(name, suffix).toLowerCase();
  const sorted = (values) => [...new Set(values)].sort();
  const readJson = (names) => [...source.read(names).values()].map((content) => JSON.parse(content.toString('utf8').replace(/^﻿/, '')));
  const header = { cobblemon: source.label, revision: source.revision, namespace: 'cobblemon' };

  const data = {
    ...header,
    speciesIds: sorted(under(`${DATA}species/`, '.json').map((name) => `cobblemon:${basename(name, '.json')}`)),
    dexEntryIds: sorted(readJson(under(`${DATA}dex_entries/`, '.json')).map((entry) => entry?.id?.trim().toLowerCase()).filter(Boolean)),
  };

  const bedrock = `${ASSETS}bedrock/`;
  const assets = {
    ...header,
    poserIds: sorted(under(bedrock, '.json').filter((name) => name.includes('/posers/')).map((name) => `cobblemon:${basename(name, '.json')}`)),
    modelIds: sorted(under(bedrock, '.geo.json').map((name) => `cobblemon:${basename(name, '.json')}`)),
    animationGroupNames: sorted(under(bedrock, '.animation.json').map((name) => basename(name, '.animation.json'))),
    textureIds: sorted(under(ASSETS, '.png').map((name) => `cobblemon:${name.slice(ASSETS.length).toLowerCase()}`)),
    langKeys: sorted(readJson(under(`${ASSETS}lang/`, '.json')).flatMap((lang) =>
      Object.entries(lang ?? {}).filter(([, value]) => typeof value === 'string').map(([key]) => key))),
  };

  fs.mkdirSync(output, { recursive: true });
  for (const [name, index] of Object.entries({ data, assets })) {
    fs.writeFileSync(path.join(output, `${name}.json`), `${JSON.stringify(index, null, 2)}\n`);
  }

  const counts = (index) => Object.entries(index).filter(([, value]) => Array.isArray(value)).map(([key, value]) => `${value.length} ${key}`).join(', ');
  console.log(`${pkg.folder}/indexes/ from cable/cobblemon @ ${source.label} (${source.revision.slice(0, 10)})`);
  console.log(`  data.json: ${counts(data)}`);
  console.log(`  assets.json: ${counts(assets)}`);
}
