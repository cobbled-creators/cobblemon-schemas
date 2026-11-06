import { isBelow, parentPointer, valueAt } from './pointer.mjs';
import { asRecord, stringArray } from './values.mjs';

const BRANCH_KEYWORDS = new Set(['anyOf', 'oneOf', 'if', 'const', 'required']);

export function findTypeBranches(errors, rootData) {
  const branches = new Map();
  for (const [objectPointer, branch] of collectBranches(errors, rootData)) {
    branches.set(objectPointer, summarizeBranch(objectPointer, branch, errors));
  }
  return branches;
}

function collectBranches(errors, rootData) {
  const branches = new Map();
  for (const error of errors) {
    const parentSchema = asRecord(error.parentSchema);
    const branchType = asRecord(asRecord(parentSchema?.properties)?.type)?.const;
    if (typeof branchType !== 'string') continue;

    const objectPointer = error.instancePath.endsWith('/type') ? parentPointer(error.instancePath) : error.instancePath;
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
  const typeIsInvalid = errors.some((error) => error.instancePath === typePointer && (error.keyword === 'enum' || error.keyword === 'type'));
  const hasOtherErrorsInside = errors.some((error) =>
    error.instancePath !== typePointer
    && isBelow(error.instancePath, objectPointer)
    && !BRANCH_KEYWORDS.has(error.keyword));

  return {
    actualType,
    selectedRequired: (actualType && requiredByType.get(actualType)) || new Set(),
    typeIsInvalid,
    hasOtherErrorsInside,
  };
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
