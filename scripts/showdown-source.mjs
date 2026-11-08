import crypto from 'node:crypto';
import zlib from 'node:zlib';

// Reads the Showdown that Cobblemon bundles (data/cobblemon/showdown.zip, a build of
// https://gitlab.com/cable-mc/cobblemon-showdown) from a Cobblemon source opened with cobblemon-source.mjs.
// The zip holds compiled JavaScript, but every .js.map carries the original TypeScript in sourcesContent,
// so file('sim/dex-moves.ts') returns the source exactly as it is in the fork.

const ZIP = 'data/cobblemon/showdown.zip';
const METADATA = 'data/cobblemon/showdown.json';

export function openShowdown(source) {
  const contents = source.read([ZIP, METADATA]);
  const zip = contents.get(ZIP);
  const entries = readZipDirectory(zip);
  const metadata = JSON.parse(contents.get(METADATA).toString('utf8').replace(/^﻿/, ''));

  return {
    showdownVersion: Number(metadata.showdownVersion),
    zipBlob: gitBlobId(zip),
    file(name) {
      const mapName = name.replace(/\.ts$/, '.js.map');
      const entry = entries.get(mapName);
      if (!entry) throw new Error(`${ZIP} at ${source.label} has no ${mapName}`);
      const map = JSON.parse(inflate(zip, entry).toString('utf8'));
      const index = (map.sources ?? []).findIndex((sourceName) => sourceName.endsWith(`/${name}`));
      const text = map.sourcesContent?.[index];
      if (typeof text !== 'string') throw new Error(`${mapName} in ${ZIP} at ${source.label} has no sourcesContent for ${name}`);
      return text.replace(/\r\n/g, '\n');
    },
  };
}

function gitBlobId(bytes) {
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

// Just enough of the zip format for Cobblemon's archive: the central directory, then stored or deflated entries.
function readZipDirectory(zip) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end === -1) throw new Error(`${ZIP} isn't a zip file`);
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  if (count === 0xffff || offset === 0xffffffff) throw new Error(`${ZIP} is a zip64 archive, which this reader doesn't handle`);

  const entries = new Map();
  for (let i = 0; i < count; i += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error(`${ZIP} has a corrupt central directory`);
    const nameLength = zip.readUInt16LE(offset + 28);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, {
      method: zip.readUInt16LE(offset + 10),
      size: zip.readUInt32LE(offset + 20),
      header: zip.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
  }
  return entries;
}

function inflate(zip, { method, size, header }) {
  const start = header + 30 + zip.readUInt16LE(header + 26) + zip.readUInt16LE(header + 28);
  const data = zip.subarray(start, start + size);
  if (method === 0) return data;
  if (method === 8) return zlib.inflateRawSync(data);
  throw new Error(`${ZIP} uses compression method ${method}, which this reader doesn't handle`);
}
