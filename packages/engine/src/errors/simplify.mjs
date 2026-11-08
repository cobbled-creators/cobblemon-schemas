import { isBelow, parentPointer } from './pointer.mjs';
import { findTypeBranches, unselectedBranchFilter } from './type-branches.mjs';

const COMBINATOR_KEYWORDS = new Set(['anyOf', 'oneOf', 'if']);

export function simplifyAjvErrors(errors, rootData, isFromUnselectedBranch = unselectedBranchFilter(errors, rootData)) {
  const branches = findTypeBranches(errors, rootData);
  const meaningful = errors.filter((error) =>
    !isOtherBranchError(error, branches)
    && !isFromUnselectedBranch(error)
    && !isParentTypeError(error, errors)
    && !isRedundantCombinatorError(error, errors));
  return withoutDuplicates(meaningful);
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
