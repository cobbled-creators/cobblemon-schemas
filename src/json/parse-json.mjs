import { findNodeAtLocation, parse, parseTree } from 'jsonc-parser';
import { createLineIndex } from './line-index.mjs';
import { describeSyntaxErrors } from './syntax-errors.mjs';

const STRICT_COMMAS = { allowTrailingComma: false, disallowComments: false };
const LENIENT_COMMAS = { allowTrailingComma: true, disallowComments: false };

export function parseJson(content) {
  const text = withoutBom(typeof content === 'string' ? content : new TextDecoder('utf-8', { ignoreBOM: true }).decode(content));
  const positionOf = createLineIndex(text);
  const parseErrors = [];
  const value = parse(text, parseErrors, STRICT_COMMAS);
  const tree = parseTree(text, [], LENIENT_COMMAS);

  return {
    value,
    ok: parseErrors.length === 0,
    syntaxErrors: describeSyntaxErrors(text, parseErrors, positionOf),
    locate(pointer) {
      const node = tree && findNodeAtLocation(tree, pointer);
      return node ? positionOf(node.offset) : {};
    },
  };
}

function withoutBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
