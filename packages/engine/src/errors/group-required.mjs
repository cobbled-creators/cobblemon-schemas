import { renderTemplate } from './annotations.mjs';

/**
 * Merges `required` errors at the same pointer into one, at the position of the first. Every other
 * error keeps its relative order. `annotations` maps annotated `required` errors to their annotation:
 * one with a message for that property alone stays on its own, and a merged error uses an annotation
 * only if all of its errors had the same one.
 */
export function groupRequiredErrors(errors, annotations = new WeakMap()) {
  const groups = new Map();
  const result = [];
  for (const error of errors) {
    if (error.keyword !== 'required' || annotations.get(error)?.byName) {
      result.push(error);
      continue;
    }
    const key = JSON.stringify(error.pointer);
    const group = groups.get(key);
    if (group) {
      for (const name of missingNames(error)) group.names.add(name);
      group.members.push(error);
      continue;
    }
    groups.set(key, { index: result.length, first: error, members: [error], names: new Set(missingNames(error)) });
    result.push(error);
  }
  for (const group of groups.values()) result[group.index] = mergeGroup(group, annotations);
  return result;
}

function missingNames(error) {
  return error.params.missingProperties ?? [error.params.missingProperty];
}

function mergeGroup({ first, members, names }, annotations) {
  const missingProperties = [...names];
  const { defaultMessage: _, ...rest } = first;
  const params = { ...first.params, missingProperty: missingProperties[0], missingProperties };
  const builtIn = formatMissing(missingProperties);
  const annotation = sharedAnnotation(members, annotations);
  const message = annotation ? renderTemplate(annotation.template, { ...params, ...annotation.variables }) : builtIn;
  return message === builtIn ? { ...rest, params, message } : { ...rest, params, message, defaultMessage: builtIn };
}

function sharedAnnotation([first, ...others], annotations) {
  const annotation = annotations.get(first);
  const same = (other) => annotations.get(other)?.source === annotation.source && annotations.get(other)?.template === annotation.template;
  return annotation && others.every(same) ? annotation : undefined;
}

function formatMissing(names) {
  if (names.length === 1) return `Missing required property '${names[0]}'.`;
  return `Missing required properties: ${names.map((name) => `'${name}'`).join(', ')}.`;
}
