import { COMBINATORS } from './combinators.mjs';
import { isAtOrBelow, isBelow, parentPointer, valueAt } from './pointer.mjs';
import { asRecord, stringArray } from './values.mjs';

const BRANCH_KEYWORDS = new Set(['anyOf', 'oneOf', 'if', 'const', 'required']);

export function findTypeBranches(errors, rootData) {
  const branches = new Map();
  for (const [objectPointer, branch] of collectBranches(errors, rootData)) {
    branches.set(objectPointer, summarizeBranch(objectPointer, branch, errors));
  }
  return branches;
}

/**
 * Finds `type`-discriminated unions where every branch but one rejected the value's `type`: the one
 * left is the branch the value means, whatever else failed in it. Returns whether an error comes from
 * one of the other branches. An error belongs to a branch when it's a `type` const error for it, or
 * its schema object is the branch's (the one with the `type` const) or inside it without a `$ref`.
 */
export function unselectedBranchFilter(errors, rootData) {
  const selected = selectedTypes(errors, rootData);
  if (selected.size === 0) return () => false;
  const branchSchemas = errors
    .filter((error) => branchTypeOf(error.parentSchema) !== undefined && selected.has(objectPointerOf(error)))
    .map((error) => ({ schema: error.parentSchema, pointer: objectPointerOf(error), type: branchTypeOf(error.parentSchema) }));

  return (error) => {
    const branch = branchOf(error, branchSchemas);
    return branch !== undefined && selected.has(branch.pointer) && selected.get(branch.pointer) !== branch.type;
  };
}

function selectedTypes(errors, rootData) {
  const rejectedByObject = new Map();
  for (const error of errors.filter(isTypeConstError)) {
    const objectPointer = parentPointer(error.instancePath);
    if (!rejectedByObject.has(objectPointer)) rejectedByObject.set(objectPointer, new Set());
    rejectedByObject.get(objectPointer).add(error.params.allowedValue);
  }

  const selected = new Map();
  for (const [objectPointer, rejected] of rejectedByObject) {
    const actualType = typeAt(rootData, objectPointer);
    if (!actualType || rejected.has(actualType) || isTypeInvalid(errors, objectPointer)) continue;
    const isUnion = errors.some((error) =>
      COMBINATORS.has(error.keyword)
      && error.instancePath === objectPointer
      && Array.isArray(error.schema)
      && error.schema.length === rejected.size + 1);
    if (isUnion) selected.set(objectPointer, actualType);
  }
  return selected;
}

function branchOf(error, branchSchemas) {
  if (isTypeConstError(error)) return { pointer: parentPointer(error.instancePath), type: error.params.allowedValue };
  const ownType = branchTypeOf(error.parentSchema);
  if (ownType !== undefined) return { pointer: objectPointerOf(error), type: ownType };
  return branchSchemas.find((branch) => isAtOrBelow(error.instancePath, branch.pointer) && inlineSchemas(branch.schema).has(error.parentSchema));
}

const inlineSchemaCache = new WeakMap();
const DATA_KEYWORDS = new Set(['const', 'enum', 'default', 'examples']);

/** Every object inside a schema that isn't data, without following `$ref`. */
function inlineSchemas(schema) {
  if (!inlineSchemaCache.has(schema)) {
    const found = new Set();
    const visit = (node) => {
      if (!node || typeof node !== 'object' || found.has(node)) return;
      found.add(node);
      for (const [key, child] of Object.entries(node)) if (!DATA_KEYWORDS.has(key)) visit(child);
    };
    visit(schema);
    inlineSchemaCache.set(schema, found);
  }
  return inlineSchemaCache.get(schema);
}

function collectBranches(errors, rootData) {
  const branches = new Map();
  for (const error of errors) {
    const parentSchema = asRecord(error.parentSchema);
    const branchType = branchTypeOf(parentSchema);
    if (branchType === undefined) continue;

    const objectPointer = objectPointerOf(error);
    if (!objectPointer) continue;

    if (!branches.has(objectPointer)) {
      branches.set(objectPointer, { actualType: typeAt(rootData, objectPointer), requiredByType: new Map() });
    }
    const { requiredByType } = branches.get(objectPointer);
    const required = requiredByType.get(branchType) ?? new Set();
    for (const field of requiredFields(parentSchema)) required.add(field);
    requiredByType.set(branchType, required);
  }
  return branches;
}

function summarizeBranch(objectPointer, { actualType, requiredByType }, errors) {
  const typePointer = `${objectPointer}/type`;
  const hasOtherErrorsInside = errors.some((error) =>
    error.instancePath !== typePointer
    && isBelow(error.instancePath, objectPointer)
    && !BRANCH_KEYWORDS.has(error.keyword));

  return {
    actualType,
    selectedRequired: (actualType && requiredByType.get(actualType)) || new Set(),
    typeIsInvalid: isTypeInvalid(errors, objectPointer),
    hasOtherErrorsInside,
  };
}

function isTypeInvalid(errors, objectPointer) {
  const typePointer = `${objectPointer}/type`;
  return errors.some((error) => error.instancePath === typePointer && (error.keyword === 'enum' || error.keyword === 'type'));
}

function isTypeConstError(error) {
  return error.keyword === 'const' && error.instancePath.endsWith('/type') && typeof error.params?.allowedValue === 'string';
}

function branchTypeOf(schema) {
  const type = asRecord(asRecord(asRecord(schema)?.properties)?.type)?.const;
  return typeof type === 'string' ? type : undefined;
}

function objectPointerOf(error) {
  return error.instancePath.endsWith('/type') ? parentPointer(error.instancePath) : error.instancePath;
}

function requiredFields(schema) {
  const fields = new Set(stringArray(schema.required));
  for (const combinator of [schema.anyOf, schema.oneOf]) {
    if (!Array.isArray(combinator)) continue;
    for (const option of combinator) {
      for (const field of stringArray(asRecord(option)?.required)) fields.add(field);
    }
  }
  return fields;
}

function typeAt(rootData, pointer) {
  const type = asRecord(valueAt(rootData, pointer))?.type;
  return typeof type === 'string' ? type : undefined;
}
