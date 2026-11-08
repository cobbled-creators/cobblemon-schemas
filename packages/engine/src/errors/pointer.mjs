export function decodePointer(pointer) {
  if (!pointer || pointer === '/') return [];
  return pointer
    .split('/')
    .slice(1)
    .map(unescapeSegment)
    .map((segment) => (/^[0-9]+$/.test(segment) ? Number.parseInt(segment, 10) : segment));
}

export function parentPointer(pointer) {
  const lastSlash = pointer.lastIndexOf('/');
  return lastSlash <= 0 ? '' : pointer.slice(0, lastSlash);
}

export function isBelow(pointer, ancestor) {
  return pointer.startsWith(ancestor ? `${ancestor}/` : '/');
}

export function isAtOrBelow(pointer, ancestor) {
  return pointer === ancestor || isBelow(pointer, ancestor);
}

export function valueAt(root, pointer) {
  let current = root;
  for (const segment of decodePointer(pointer)) {
    if (current === null || typeof current !== 'object') return undefined;
    current = current[segment];
  }
  return current;
}

function unescapeSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}
