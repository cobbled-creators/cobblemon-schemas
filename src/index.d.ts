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

export interface Bundle {
  package: string;
  cobblemon: CobblemonTarget;
  entries: SchemaEntry[];
}

/** Shared header of `indexes/data.json` and `indexes/assets.json`. */
export interface CobblemonIndexHeader {
  /** The Cobblemon tag the index was read from (package.json's `cobblemon.baseline`). */
  cobblemon: string;
  /** Commit of that tag in cable-mc/cobblemon. */
  revision: string;
  namespace: 'cobblemon';
}

/** `indexes/data.json`: ids of Cobblemon's own datapack content. */
export interface CobblemonDataIndex extends CobblemonIndexHeader {
  /** e.g. `cobblemon:bulbasaur` */
  speciesIds: string[];
  /** e.g. `cobblemon:bulbasaur` */
  dexEntryIds: string[];
}

/** `indexes/assets.json`: ids of Cobblemon's own resource pack content. */
export interface CobblemonAssetsIndex extends CobblemonIndexHeader {
  /** e.g. `cobblemon:bulbasaur` */
  poserIds: string[];
  /** e.g. `cobblemon:bulbasaur.geo`, from `bulbasaur.geo.json` */
  modelIds: string[];
  /** e.g. `bulbasaur`, from `bulbasaur.animation.json` */
  animationGroupNames: string[];
  /** e.g. `cobblemon:textures/pokemon/0001_bulbasaur/bulbasaur.png` */
  textureIds: string[];
  /** Every key in Cobblemon's lang files, in any language. */
  langKeys: string[];
}

export interface SchemaError {
  pointer: Pointer;
  keyword: string;
  params: Record<string, unknown>;
  message: string;
}

export interface ValidateOptions {
  /** Merge `required` errors at the same pointer. Default true. */
  groupRequired?: boolean;
}

export type ValidateFunction = ((value: unknown) => boolean) & { errors?: unknown[] | null };

export class SchemaEngine {
  constructor(options: { entries: SchemaEntry[]; validators: Record<string, ValidateFunction>; cobblemon?: CobblemonTarget | null });
  static fromBundle(bundle: Bundle, compiled: Record<string, ValidateFunction>): SchemaEngine;
  readonly cobblemon: CobblemonTarget | null;
  resolve(relPath: string): string | undefined;
  validate(schemaPath: string, value: unknown, options?: ValidateOptions): SchemaError[];
  check(relPath: string, value: unknown, options?: ValidateOptions): { schema: string | null; errors: SchemaError[] };
}

export function simplifyAjvErrors<T>(errors: T[], rootData: unknown): T[];
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
