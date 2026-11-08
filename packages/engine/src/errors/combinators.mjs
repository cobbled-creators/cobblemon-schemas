import { isAtOrBelow } from './pointer.mjs';

export const COMBINATORS = new Set(['oneOf', 'anyOf']);

/**
 * The failed `oneOf`/`anyOf` groups each error may have come from, innermost first. With `allErrors`,
 * ajv emits a combinator's branch errors just before its own error, at or below its instance path,
 * and it evaluates a schema's combinators before its other keywords. So walking back from a
 * combinator error finds its branch errors, until an error outside its instance path or from the same
 * schema object (an earlier evaluation of it). A schema evaluated just before it at the same path,
 * such as an earlier branch of an outer union, can't be told apart, so a group may claim too much:
 * use it only where that's acceptable. A combinator's own error is in its group. Needs ajv's
 * `verbose` option; without it, there are no groups.
 */
export function combinatorClaims(errors) {
  const claims = new Map();
  errors.forEach((combinator, index) => {
    if (!COMBINATORS.has(combinator.keyword) || !combinator.parentSchema) return;
    let start = index;
    while (start > 0 && isAtOrBelow(errors[start - 1].instancePath, combinator.instancePath) && errors[start - 1].parentSchema !== combinator.parentSchema) {
      start -= 1;
    }
    const group = { combinator };
    for (const member of errors.slice(start, index + 1)) {
      if (!claims.has(member)) claims.set(member, []);
      claims.get(member).push(group);
    }
  });
  return claims;
}

/**
 * Whether `error` comes straight from one of the combinator's branches: that branch is the schema
 * object of the failing keyword, or a `$ref` that ajv inlined (its errors' `schemaPath` starts with
 * the reference). Errors from deeper inside a branch, or through a `$ref` ajv compiled separately,
 * don't count. Needs ajv's `verbose` option.
 */
export function isDirectBranchError(error, combinator) {
  const branches = combinator.schema;
  if (!Array.isArray(branches) || error.instancePath !== combinator.instancePath) return false;
  return branches.some((branch) => branch === error.parentSchema || (typeof branch?.$ref === 'string' && error.schemaPath.startsWith(`${branch.$ref}/`)));
}
