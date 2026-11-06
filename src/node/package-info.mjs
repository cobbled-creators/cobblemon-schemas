import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const schemaRoot = path.join(packageRoot, 'schemas');
export const distRoot = path.join(packageRoot, 'dist');

export const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
export const cobblemon = packageJson.cobblemon;
