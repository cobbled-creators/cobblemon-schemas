const SHARED_SCHEMAS = 'schemas/_shared/';
const POKEMON_RESOLVER_FILE = /^assets\/[^/]+\/bedrock\/pokemon\/resolvers\//;
const POSER_FILE = /^assets\/[^/]+\/bedrock\/(pokemon|npcs|fossils|block_entities|generic|poke_balls)\/posers\//;
const DATA_FILE = /^data\/[^/]+\/(.+\.json)$/;
const PER_FILE_SCHEMA = /^schemas\/(mechanics|ride_settings)\/([^.]+)\.schema\.json$/;
const FOLDER_SCHEMA = /^schemas\/([^/]+)\/schema\.json$/;

export class SchemaIndex {
  #byDataPath = new Map();
  #byFolderAndFile = new Map();
  #byFolder = new Map();

  constructor(entries) {
    for (const entry of entries) {
      if (!entry.path.startsWith(SHARED_SCHEMAS)) this.#add(entry);
    }
  }

  resolve(packPath) {
    if (POKEMON_RESOLVER_FILE.test(packPath)) return 'schemas/bedrock_pokemon_resolvers/schema.json';
    if (POSER_FILE.test(packPath)) return 'schemas/bedrock_posers/schema.json';

    const dataPath = packPath.match(DATA_FILE)?.[1];
    if (!dataPath) return undefined;
    return this.#byDataPath.get(dataPath) ?? this.#resolveByFolder(dataPath);
  }

  #resolveByFolder(dataPath) {
    const slash = dataPath.indexOf('/');
    if (slash === -1) return undefined;
    const folder = dataPath.slice(0, slash);
    const fileName = dataPath.slice(dataPath.lastIndexOf('/') + 1);
    return this.#byFolderAndFile.get(folder)?.get(fileName) ?? this.#byFolder.get(folder);
  }

  #add(entry) {
    if (entry.dataPath) {
      this.#byDataPath.set(entry.dataPath, entry.path);
      return;
    }

    const perFile = entry.path.match(PER_FILE_SCHEMA);
    if (perFile) {
      const [, folder, name] = perFile;
      const byFile = this.#byFolderAndFile.get(folder) ?? new Map();
      byFile.set(`${name}.json`, entry.path);
      this.#byFolderAndFile.set(folder, byFile);
      return;
    }

    const folder = entry.path.match(FOLDER_SCHEMA)?.[1];
    if (folder && !folder.startsWith('bedrock_')) this.#byFolder.set(folder, entry.path);
  }
}
