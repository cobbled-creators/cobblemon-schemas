import { isBelow, parentPointer, valueAt } from './pointer.mjs';
import { findTypeBranches, unselectedBranchFilter } from './type-branches.mjs';

const COMBINATOR_KEYWORDS = new Set(['anyOf', 'oneOf', 'if']);

export function simplifyAjvErrors(errors, rootData, isFromUnselectedBranch = unselectedBranchFilter(errors, rootData)) {
  const branches = findTypeBranches(errors, rootData);
  const isFromWrongJsonType = wrongJsonTypeBranchFilter(errors, rootData);
  const meaningful = errors.filter((error) =>
    !isOtherBranchError(error, branches)
    && !isFromWrongJsonType(error)
    && !isFromUnselectedBranch(error)
    && !isParentTypeError(error, errors)
    && !isRedundantCombinatorError(error, errors));
  return withoutDuplicates(meaningful);
}

/**
 * In an anyOf/oneOf over an object or array value, where some inline branch takes that JSON type
 * (it failed, but not on `type`), the branches that rejected the type are noise:
 * `{"width": 1, "fixed": true}` is about the object branch, not "Expected type 'string'". Scalars
 * keep every branch, for the "Expected an integer or a string matching …" union message. Branches
 * behind a `$ref` report schema paths of their own, so they're never matched and are left alone.
 */
function wrongJsonTypeBranchFilter(errors, rootData) {
  const dropped = [];
  for (const union of errors.filter((error) => error.keyword === 'anyOf' || error.keyword === 'oneOf')) {
    const value = valueAt(rootData, union.instancePath);
    if (value === null || typeof value !== 'object') continue;
    const branches = Array.isArray(union.schema) ? union.schema.map((_, index) => `${union.schemaPath}/${index}/`) : [];
    const inBranch = (prefix) => errors.filter((error) => error.schemaPath?.startsWith(prefix)
      && (error.instancePath === union.instancePath || isBelow(error.instancePath, union.instancePath)));
    const rejectsType = (prefix) => inBranch(prefix).some((error) => error.keyword === 'type' && error.instancePath === union.instancePath);
    const rejecting = branches.filter(rejectsType);
    if (branches.some((prefix) => !rejectsType(prefix) && inBranch(prefix).length > 0)) dropped.push(...rejecting);
  }
  return (error) => dropped.some((prefix) => error.schemaPath?.startsWith(prefix));
}

function isOtherBranchError(error, branches) {
  if (error.keyword === 'required') return isRequiredByOtherBranch(error, branches.get(error.instancePath));
  if (error.keyword === 'const' && error.instancePath.endsWith('/type')) {
    return isOtherBranchTypeConst(error, branches.get(parentPointer(error.instancePath)));
  }
  return false;
}

function isRequiredByOtherBranch(error, branch) {
  const missing = error.params?.missingProperty;
  if (!missing || !branch?.actualType) return false;
  if (branch.selectedRequired.size > 0) return !branch.selectedRequired.has(missing);
  return branch.typeIsInvalid || branch.hasOtherErrorsInside;
}

function isOtherBranchTypeConst(error, branch) {
  if (!branch?.actualType) return false;
  if (branch.typeIsInvalid || branch.hasOtherErrorsInside) return true;
  if (branch.selectedRequired.size === 0) return false;
  return error.params?.allowedValue !== branch.actualType;
}

function isParentTypeError(error, errors) {
  if (error.keyword !== 'type' || !error.params?.type) return false;
  return errors.some((other) => other !== error && !COMBINATOR_KEYWORDS.has(other.keyword) && isBelow(other.instancePath, error.instancePath));
}

function isRedundantCombinatorError(error, errors) {
  if (!COMBINATOR_KEYWORDS.has(error.keyword)) return false;
  return errors.some((other) =>
    other !== error
    && !COMBINATOR_KEYWORDS.has(other.keyword)
    && (other.instancePath === error.instancePath || isBelow(other.instancePath, error.instancePath)));
}

function withoutDuplicates(errors) {
  const seen = new Set();
  return errors.filter((error) => {
    const key = `${error.keyword}|${error.instancePath}|${error.schemaPath}|${JSON.stringify(error.params)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
