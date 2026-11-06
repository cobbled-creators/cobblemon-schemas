import { createScanner, printParseErrorCode, SyntaxKind } from 'jsonc-parser';

const MESSAGES = {
  InvalidSymbol: 'Unexpected character.',
  InvalidNumberFormat: 'Invalid number.',
  PropertyNameExpected: 'Expected a property name.',
  ValueExpected: 'Expected a value.',
  ColonExpected: 'Expected ":".',
  CommaExpected: 'Expected ",".',
  CloseBraceExpected: 'Expected "}".',
  CloseBracketExpected: 'Expected "]".',
  EndOfFileExpected: 'Unexpected content after the end of the JSON.',
  UnexpectedEndOfComment: 'Unclosed comment.',
  UnexpectedEndOfString: 'Unclosed string.',
  UnexpectedEndOfNumber: 'Incomplete number.',
  InvalidUnicode: 'Invalid unicode escape.',
  InvalidEscapeCharacter: 'Invalid escape character.',
  InvalidCharacter: 'Invalid character in string.',
};

const CLOSING_BRACKETS = '}]';
const ERRORS_AFTER_TRAILING_COMMA = new Set(['PropertyNameExpected', 'ValueExpected']);

export function describeSyntaxErrors(text, parseErrors, spanOf) {
  const described = [];
  const reportedOffsets = new Set();
  for (const parseError of parseErrors) {
    const { message, offset, length } = describe(text, parseError);
    if (reportedOffsets.has(offset)) continue;
    reportedOffsets.add(offset);
    described.push({ message, ...spanOf(offset, length) });
  }
  return described;
}

function describe(text, { error, offset, length }) {
  const code = printParseErrorCode(error);
  const trailingComma = findTrailingComma(text, code, offset);
  if (trailingComma !== null) return { message: 'Trailing comma.', offset: trailingComma, length: 1 };
  return { message: MESSAGES[code] ?? code, offset, length };
}

function findTrailingComma(text, code, offset) {
  if (!CLOSING_BRACKETS.includes(text[offset]) || !ERRORS_AFTER_TRAILING_COMMA.has(code)) return null;
  const previous = tokenBefore(text, offset);
  return previous?.kind === SyntaxKind.CommaToken ? previous.offset : null;
}

function tokenBefore(text, offset) {
  const scanner = createScanner(text, true);
  let previous = null;
  for (let kind = scanner.scan(); kind !== SyntaxKind.EOF && scanner.getTokenOffset() < offset; kind = scanner.scan()) {
    previous = { kind, offset: scanner.getTokenOffset() };
  }
  return previous;
}
