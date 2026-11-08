import fs from 'node:fs';
import path from 'node:path';

export function readPack(packRoot) {
  const files = new Map();
  for (const relativePath of jsonFiles(packRoot, '')) {
    files.set(relativePath, fs.readFileSync(path.join(packRoot, relativePath)));
  }
  return files;
}

function* jsonFiles(packRoot, relativeDir) {
  for (const child of fs.readdirSync(path.join(packRoot, relativeDir), { withFileTypes: true })) {
    const relativePath = relativeDir ? `${relativeDir}/${child.name}` : child.name;
    if (child.isDirectory()) yield* jsonFiles(packRoot, relativePath);
    else if (child.isFile() && child.name.endsWith('.json')) yield relativePath;
  }
}
