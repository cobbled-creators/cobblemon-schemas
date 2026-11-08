export type Pointer = Array<string | number>;

export interface CobblemonTarget {
  version: string;
  minecraft: string;
  baseline: string;
}

export interface SchemaEntry {
  path: string;
  id?: string;
  dataPath?: string;
  validator?: string;
}

/** The schema package a bundle was built from, as named in its package.json. */
export interface SchemaPackageInfo {
  name: string;
  version: string;
}

/** `dist/bundle.json` of a schema package. */
export interface Bundle {
  /** The bundle format; see `SUPPORTED_BUNDLE_FORMATS`. */
  formatVersion: number;
  package: SchemaPackageInfo;
  cobblemon: CobblemonTarget;
  /** The ajv version that compiled the validators. For diagnostics only. */
  compiler?: { ajv: string };
  entries: SchemaEntry[];
}

/** The bundle format this engine writes. */
export const BUNDLE_FORMAT_VERSION: number;
/** The bundle formats this engine reads. `SchemaEngine.fromBundle` throws `ERR_COBBLEMON_BUNDLE_FORMAT` for others. */
export const SUPPORTED_BUNDLE_FORMATS: readonly number[];

export interface SchemaError {
  pointer: Pointer;
  keyword: string;
  params: Record<string, unknown>;
  /** The most helpful message the engine has: from an `x-errorMessage` annotation in the schema, or built in. */
  message: string;
  /** The engine's built-in message, when an annotation supplied `message` instead. */
  defaultMessage?: string;
}

export interface ValidateOptions {
  /** Merge `required` errors at the same pointer. Default true. */
  groupRequired?: boolean;
}

export type ValidateFunction = ((value: unknown) => boolean) & { errors?: unknown[] | null };

export class SchemaEngine {
  constructor(options: {
    entries: SchemaEntry[];
    validators: Record<string, ValidateFunction>;
    cobblemon?: CobblemonTarget | null;
    schemaPackage?: SchemaPackageInfo | null;
  });
  /**
   * An engine for a schema package's prebuilt `bundle.json` and `validators.mjs`. Throws an error with
   * `code` `ERR_COBBLEMON_BUNDLE_FORMAT` for a bundle format this engine doesn't read, or
   * `ERR_COBBLEMON_BUNDLE_MISMATCH` if `compiled` lacks a validator the bundle names.
   */
  static fromBundle(bundle: Bundle, compiled: Record<string, ValidateFunction>): SchemaEngine;
  readonly cobblemon: CobblemonTarget | null;
  readonly schemaPackage: SchemaPackageInfo | null;
  resolve(relPath: string): string | undefined;
  validate(schemaPath: string, value: unknown, options?: ValidateOptions): SchemaError[];
  check(relPath: string, value: unknown, options?: ValidateOptions): { schema: string | null; errors: SchemaError[] };
}

export function simplifyAjvErrors<T>(errors: T[], rootData: unknown): T[];
/** The built-in message for one ajv error, from a validator compiled with `verbose`. Never uses annotations. */
export function formatAjvError(error: unknown): string;
export function decodePointer(pointer: string): Pointer;

export interface Position {
  /** 1-based. */
  line: number;
  /** 1-based, in UTF-16 code units. */
  column: number;
}

/** A range of the BOM-stripped text. `endLine`/`endColumn` is exclusive: just after the last character. */
export interface Span extends Position {
  /** 0-based, in UTF-16 code units. */
  offset: number;
  length: number;
  endLine: number;
  endColumn: number;
}

export interface LocateOptions {
  /**
   * Locate the property's key rather than its value. Array elements and the root have no key, so
   * they fall back to the value.
   */
  key?: boolean;
}

export interface ParsedJson {
  value: unknown;
  ok: boolean;
  /** `length` can be 0, e.g. for a missing `}` at the end of the file. */
  syntaxErrors: Array<Span & { message: string }>;
  locate(pointer: Pointer, options?: LocateOptions): Span | Record<string, never>;
}

export function parseJson(bytes: Uint8Array | string): ParsedJson;

export interface PackError {
  kind: 'syntax' | 'schema';
  pointer: Pointer;
  message: string;
  /** For schema errors whose `message` came from an annotation: the built-in message. */
  defaultMessage?: string;
  line?: number;
  column?: number;
  offset?: number;
  length?: number;
  endLine?: number;
  endColumn?: number;
  keyword?: string;
  params?: Record<string, unknown>;
}

export interface PackResult {
  file: string;
  schema: string;
  errors: PackError[];
}

/**
 * The span `validatePack` reports for a schema error: the key of an unknown property, the key of an
 * object or array (rather than the whole block), or else the value.
 */
export function locateError(parsed: ParsedJson, error: SchemaError): Span | Record<string, never>;

export function validatePack(files: Map<string, Uint8Array | string>, engine: SchemaEngine): PackResult[];
