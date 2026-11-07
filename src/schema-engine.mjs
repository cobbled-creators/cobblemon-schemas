import { formatAjvError } from './errors/format.mjs';
import { groupRequiredErrors } from './errors/group-required.mjs';
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

  validate(schemaPath, value, { groupRequired = true } = {}) {
    const validator = this.#validators.get(schemaPath);
    if (!validator || validator(value)) return [];
    const errors = simplifyAjvErrors(validator.errors ?? [], value).map((error) => ({
      pointer: decodePointer(error.instancePath),
      keyword: error.keyword,
      params: withMissingProperties(error),
      message: formatAjvError(error),
    }));
    return groupRequired ? groupRequiredErrors(errors) : errors;
  }

  check(packPath, value, options) {
    const schema = this.resolve(packPath) ?? null;
    return { schema, errors: schema ? this.validate(schema, value, options) : [] };
  }
}

function withMissingProperties(error) {
  const params = error.params ?? {};
  return error.keyword === 'required' ? { ...params, missingProperties: [params.missingProperty] } : params;
}
