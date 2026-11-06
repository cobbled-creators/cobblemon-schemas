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

export interface SchemaError {
  pointer: Pointer;
  keyword: string;
  params: Record<string, unknown>;
  message: string;
}

export type ValidateFunction = ((value: unknown) => boolean) & { errors?: unknown[] | null };

export class SchemaEngine {
  constructor(options: { entries: SchemaEntry[]; validators: Record<string, ValidateFunction>; cobblemon?: CobblemonTarget | null });
  static fromBundle(bundle: Bundle, compiled: Record<string, ValidateFunction>): SchemaEngine;
  readonly cobblemon: CobblemonTarget | null;
  resolve(relPath: string): string | undefined;
  validate(schemaPath: string, value: unknown): SchemaError[];
  check(relPath: string, value: unknown): { schema: string | null; errors: SchemaError[] };
}

export function simplifyAjvErrors<T>(errors: T[], rootData: unknown): T[];
export function formatAjvError(error: unknown): string;
export function decodePointer(pointer: string): Pointer;

export interface Position {
  line: number;
  column: number;
}

export interface ParsedJson {
  value: unknown;
  ok: boolean;
  syntaxErrors: Array<Position & { message: string }>;
  locate(pointer: Pointer): Position | Record<string, never>;
}

export function parseJson(bytes: Uint8Array | string): ParsedJson;

export interface PackError {
  kind: 'syntax' | 'schema';
  pointer: Pointer;
  message: string;
  line?: number;
  column?: number;
  keyword?: string;
  params?: Record<string, unknown>;
}

export interface PackResult {
  file: string;
  schema: string;
  errors: PackError[];
}

export function validatePack(files: Map<string, Uint8Array | string>, engine: SchemaEngine): PackResult[];
