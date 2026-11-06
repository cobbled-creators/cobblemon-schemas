import { findNodeAtLocation, parse, parseTree } from 'jsonc-parser';
import { createLineIndex } from './line-index.mjs';
import { describeSyntaxErrors } from './syntax-errors.mjs';

const STRICT_COMMAS = { allowTrailingComma: false, disallowComments: false };
const LENIENT_COMMAS = { allowTrailingComma: true, disallowComments: false };

export function parseJson(content) {
  const text = withoutBom(typeof content === 'string' ? content : new TextDecoder('utf-8', { ignoreBOM: true }).decode(content));
  const spanOf = createSpanIndex(text);
  const parseErrors = [];
  const value = parse(text, parseErrors, STRICT_COMMAS);
  const tree = parseTree(text, [], LENIENT_COMMAS);

  return {
    value,
    ok: parseErrors.length === 0,
    syntaxErrors: describeSyntaxErrors(text, parseErrors, spanOf),
    locate(pointer, { key = false } = {}) {
      const node = tree && findNodeAtLocation(tree, pointer);
      if (!node) return {};
      const target = key ? (keyOf(node) ?? node) : node;
      return spanOf(target.offset, target.length);
    },
  };
}

function keyOf(node) {
  return node.parent?.type === 'property' ? node.parent.children[0] : undefined;
}

function createSpanIndex(text) {
  const positionOf = createLineIndex(text);
  return (offset, length) => {
    const end = positionOf(offset + length);
    return { ...positionOf(offset), offset, length, endLine: end.line, endColumn: end.column };
  };
}

function withoutBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
