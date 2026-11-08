import { loadEngine, validatePack } from '@cobbled-creators/cobblemon-validator/node';
import { openSource, parseSourceOptions } from './cobblemon-source.mjs';
import { selectPackages } from './packages.mjs';

const args = process.argv.slice(2);
const packages = selectPackages(args);

for (const pkg of packages) {
  if (packages.length > 1) console.log(`\n== ${pkg.folder}`);
  const source = openSource(parseSourceOptions(args, pkg));
  const files = source.read(source.list(['data/', 'assets/']).filter((name) => name.endsWith('.json')));
  const results = validatePack(files, await loadEngine({ schemas: pkg.dir, live: true }));
  const errors = results.flatMap((result) => result.errors.map((error) => `${result.file} /${error.pointer.join('/')}: ${error.message}`));

  for (const error of errors) console.log(error);
  console.log(`\ncable/cobblemon @ ${source.label}: ${results.length} files checked, ${errors.length} errors`);
}
