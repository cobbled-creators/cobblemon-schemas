import { loadEngine, validatePack } from '../src/node.mjs';
import { openSource, parseSourceOptions } from './cobblemon-source.mjs';

const source = openSource(parseSourceOptions(process.argv.slice(2)));
const files = source.read(source.list(['data/', 'assets/']).filter((name) => name.endsWith('.json')));
const results = validatePack(files, await loadEngine({ live: true }));
const errors = results.flatMap((result) => result.errors.map((error) => `${result.file} /${error.pointer.join('/')}: ${error.message}`));

for (const error of errors) console.log(error);
console.log(`\ncable/cobblemon @ ${source.label}: ${results.length} files checked, ${errors.length} errors`);
