import { formatAjvError } from './errors/format.mjs';
import { decodePointer } from './errors/pointer.mjs';
import { simplifyAjvErrors } from './errors/simplify.mjs';
import { SchemaIndex } from './schema-index.mjs';

export class SchemaEngine {
  #index;
  #validators;

  constructor({ entries, validators, cobblemon = null }) {
    this.cobblemon = cobblemon;
    this.#index = new SchemaIndex(entries);
    this.#validators = new Map(Object.entries(validators));
  }

  static fromBundle(bundle, compiled) {
    const validators = {};
    for (const entry of bundle.entries) {
      if (entry.validator) validators[entry.path] = compiled[entry.validator];
    }
    return new SchemaEngine({ entries: bundle.entries, validators, cobblemon: bundle.cobblemon });
  }

  resolve(packPath) {
    return this.#index.resolve(packPath);
  }

  validate(schemaPath, value) {
    const validator = this.#validators.get(schemaPath);
    if (!validator || validator(value)) return [];
    return simplifyAjvErrors(validator.errors ?? [], value).map((error) => ({
      pointer: decodePointer(error.instancePath),
      keyword: error.keyword,
      params: error.params ?? {},
      message: formatAjvError(error),
    }));
  }

  check(packPath, value) {
    const schema = this.resolve(packPath) ?? null;
    return { schema, errors: schema ? this.validate(schema, value) : [] };
  }
}
