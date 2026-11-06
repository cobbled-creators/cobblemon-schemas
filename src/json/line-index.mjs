export function createLineIndex(text) {
  const lineStarts = [0];
  for (let offset = 0; offset < text.length; offset += 1) {
    if (text.charCodeAt(offset) === 10) lineStarts.push(offset + 1);
  }
  return (offset) => {
    const line = lineContaining(lineStarts, offset);
    return { line: line + 1, column: offset - lineStarts[line] + 1 };
  };
}

function lineContaining(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (lineStarts[middle] <= offset) low = middle;
    else high = middle - 1;
  }
  return low;
}
