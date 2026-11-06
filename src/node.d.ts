import type { CobblemonTarget, SchemaEngine, SchemaEntry } from './index.js';

export * from './index.js';

export const packageRoot: string;
export const schemaRoot: string;
export const cobblemon: CobblemonTarget;

export function loadSchemas(root?: string, ajvOptions?: Record<string, unknown>): { ajv: import('ajv/dist/2020.js').default; entries: SchemaEntry[] };

export function loadEngine(options?: { live?: boolean }): Promise<SchemaEngine>;

export function readPack(dir: string): Map<string, Uint8Array>;
