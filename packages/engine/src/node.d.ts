import type { Bundle, CobblemonTarget, SchemaEngine, SchemaEntry, ValidateFunction } from './index.js';

export * from './index.js';

/** A schema package on disk, such as an installed `@cobbled-creators/cobblemon-schemas`. */
export interface SchemaPackage {
  /** From its package.json, e.g. `@cobbled-creators/cobblemon-schemas` (also when installed under an alias). */
  name: string;
  version: string;
  /** Absolute path of the package directory. */
  root: string;
  cobblemon: CobblemonTarget;
}

/**
 * Where to find a schema package:
 * - a bare specifier such as `'cobblemon-schemas-1.8'` or `'@cobbled-creators/cobblemon-schemas'`, resolved
 *   from `from` the way an import in that file would be;
 * - a path to the package directory or its package.json (relative paths resolve against `from`), or a file: URL;
 * - a `SchemaPackage` from `resolveSchemaPackage`.
 */
export type SchemaPackageSource = string | URL | SchemaPackage;

export interface ResolveOptions {
  /**
   * A file or directory to resolve from. Libraries should pass `import.meta.url`, so their own
   * dependencies are found. Default: `process.cwd()`.
   */
  from?: string | URL;
}

/**
 * Finds a schema package. Throws an error with `code` `ERR_COBBLEMON_SCHEMAS_NOT_FOUND` if it can't be
 * found, or `ERR_COBBLEMON_NOT_SCHEMA_PACKAGE` if its package.json has no `cobblemon` block.
 */
export function resolveSchemaPackage(schemas: SchemaPackageSource, options?: ResolveOptions): SchemaPackage;

export interface LoadEngineOptions extends ResolveOptions {
  /** The schema package to validate with, or its already imported bundle and validators. Required. */
  schemas: SchemaPackageSource | { bundle: Bundle; validators: Record<string, ValidateFunction> };
  /**
   * Compile the package's `schemas/` with ajv instead of loading its prebuilt `dist/`. Without it, a
   * missing `dist/bundle.json` throws `ERR_COBBLEMON_BUNDLE_MISSING`.
   */
  live?: boolean;
}

export function loadEngine(options: LoadEngineOptions): Promise<SchemaEngine>;

/** Compiles every schema under a schema package's `schemas/` folder. */
export function loadSchemas(schemasDir: string, ajvOptions?: Record<string, unknown>): { ajv: import('ajv/dist/2020.js').default; entries: SchemaEntry[] };

/** For building schema packages: the contents of `dist/bundle.json`, `dist/validators.mjs` and `dist/validators.d.mts`. */
export function compileBundle(schemas: SchemaPackageSource, options?: ResolveOptions): { bundle: Bundle; validators: string; declarations: string };

/** For building schema packages: compiles one and writes its `dist/`. */
export function buildSchemaPackage(schemas: SchemaPackageSource, options?: ResolveOptions): { package: SchemaPackage; dist: string; validatorCount: number };

export function readPack(dir: string): Map<string, Uint8Array>;
