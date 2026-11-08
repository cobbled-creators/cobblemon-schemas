import { checkBundle } from './bundle-format.mjs';
import { describeAjvErrors } from './errors/describe.mjs';
import { groupRequiredErrors } from './errors/group-required.mjs';
import { SchemaIndex } from './schema-index.mjs';

export class SchemaEngine {
  #index;
  #validators;

  constructor({ entries, validators, cobblemon = null, schemaPackage = null }) {
    this.cobblemon = cobblemon;
    this.schemaPackage = schemaPackage;
    this.#index = new SchemaIndex(entries);
    this.#validators = new Map(Object.entries(validators));
  }

  static fromBundle(bundle, compiled) {
    checkBundle(bundle, compiled);
    const validators = {};
    for (const entry of bundle.entries) {
      if (entry.validator) validators[entry.path] = compiled[entry.validator];
    }
    return new SchemaEngine({ entries: bundle.entries, validators, cobblemon: bundle.cobblemon, schemaPackage: bundle.package });
  }

  resolve(packPath) {
    return this.#index.resolve(packPath);
  }

  validate(schemaPath, value, { groupRequired = true } = {}) {
    const validator = this.#validators.get(schemaPath);
    if (!validator || validator(value)) return [];
    const { errors, annotations } = describeAjvErrors(validator.errors ?? [], value);
    return groupRequired ? groupRequiredErrors(errors, annotations) : errors;
  }

  check(packPath, value, options) {
    const schema = this.resolve(packPath) ?? null;
    return { schema, errors: schema ? this.validate(schema, value, options) : [] };
  }
}
