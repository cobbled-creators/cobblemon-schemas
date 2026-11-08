import { ANNOTATION, ownAnnotation, renderTemplate, templateVariables, unionAnnotation } from './annotations.mjs';
import { COMBINATORS, combinatorClaims, isDirectBranchError } from './combinators.mjs';
import { formatAjvError, formatAlternatives, formatShapes, SHAPE_KEYWORDS } from './format.mjs';
import { decodePointer, valueAt } from './pointer.mjs';
import { simplifyAjvErrors } from './simplify.mjs';
import { unselectedBranchFilter } from './type-branches.mjs';

/**
 * Turns raw ajv errors into the engine's errors, one per problem, most helpful message first:
 *
 * 1. the outermost failed union with an annotation that contains the error becomes one error;
 * 2. an annotation on the error's own schema object;
 * 3. a union whose branches all rejected the value's shape, or that each require one property,
 *    becomes one error with a built-in message, unless a member has its own annotation;
 * 4. the built-in message for the keyword.
 *
 * An error whose message came from an annotation keeps the built-in one in `defaultMessage`.
 * `annotations` maps each annotated `required` error to its annotation, for required-grouping.
 */
export function describeAjvErrors(rawErrors, rootData) {
  const isFromUnselectedBranch = unselectedBranchFilter(rawErrors, rootData);
  const kept = simplifyAjvErrors(rawErrors, rootData, isFromUnselectedBranch);
  const claims = combinatorClaims(rawErrors);
  const merges = builtInMerges(rawErrors, kept);
  const annotations = new WeakMap();
  // A schema can be evaluated once per branch of an outer union: report each union once per place.
  const emitted = new Map();
  const firstTime = ({ parentSchema, instancePath }) => {
    if (!emitted.has(parentSchema)) emitted.set(parentSchema, new Set());
    if (emitted.get(parentSchema).has(instancePath)) return false;
    emitted.get(parentSchema).add(instancePath);
    return true;
  };
  const errors = [];

  for (const error of kept) {
    const annotated = (claims.get(error) ?? []).findLast(({ combinator }) =>
      unionAnnotation(combinator) !== undefined && !isFromUnselectedBranch(combinator));
    if (annotated) {
      const { combinator } = annotated;
      if (!firstTime(combinator)) continue;
      const merge = merges.find((candidate) => candidate.combinator.parentSchema === combinator.parentSchema && candidate.combinator.instancePath === combinator.instancePath);
      errors.push(annotatedError(combinator, unionAnnotation(combinator), merge?.message ?? formatAjvError(combinator), rootData));
      continue;
    }

    const own = ownAnnotation(error);
    if (own) {
      const described = annotatedError(error, own.template, formatAjvError(error), rootData);
      if (error.keyword === 'required') annotations.set(described, { ...own, variables: templateVariables(described.pointer, valueAt(rootData, error.instancePath)) });
      errors.push(described);
      continue;
    }

    const merge = merges.find((candidate) => !candidate.hasAnnotatedMember && candidate.members.includes(error));
    if (merge) {
      if (firstTime(merge.combinator)) errors.push({ ...plainError(merge.combinator), message: merge.message });
      continue;
    }
    errors.push({ ...plainError(error), message: formatAjvError(error) });
  }
  return { errors, annotations };
}

// Unions whose kept errors can be one error with a built-in message: the branches each require one
// property, or each rejected the value's shape where the union is. One with an annotated member is
// only used as the default message of an annotated union.
function builtInMerges(rawErrors, kept) {
  const merges = [];
  const claimed = new Set();
  for (const combinator of rawErrors.filter((error) => COMBINATORS.has(error.keyword))) {
    const members = kept.filter((error) => !claimed.has(error) && isDirectBranchError(error, combinator));
    if (!members.length) continue;
    const alternatives = requiredAlternatives(combinator);
    let message;
    if (alternatives && members.every((error) => error.keyword === 'required')) message = formatAlternatives(alternatives);
    else if (members.length > 1 && members.every((error) => SHAPE_KEYWORDS.has(error.keyword))) message = formatShapes(members);
    if (!message) continue;
    for (const member of members) claimed.add(member);
    merges.push({ combinator, members, message, hasAnnotatedMember: members.some((error) => ownAnnotation(error)) });
  }
  return merges;
}

// The names, if every branch is just `{ "required": [name] }`.
function requiredAlternatives(combinator) {
  const branches = combinator.schema;
  if (!Array.isArray(branches) || branches.length < 2) return undefined;
  const names = branches.map((branch) => {
    const keys = Object.keys(branch ?? {}).filter((key) => key !== ANNOTATION);
    return keys.length === 1 && Array.isArray(branch.required) && branch.required.length === 1 ? branch.required[0] : undefined;
  });
  return names.every((name) => typeof name === 'string') ? names : undefined;
}

function annotatedError(error, template, defaultMessage, rootData) {
  const described = plainError(error);
  const message = renderTemplate(template, { ...described.params, ...templateVariables(described.pointer, valueAt(rootData, error.instancePath)) });
  return message === defaultMessage ? { ...described, message } : { ...described, message, defaultMessage };
}

function plainError(error) {
  return { pointer: decodePointer(error.instancePath), keyword: error.keyword, params: paramsOf(error) };
}

function paramsOf(error) {
  const params = error.params ?? {};
  return error.keyword === 'required' ? { ...params, missingProperties: [params.missingProperty] } : params;
}
