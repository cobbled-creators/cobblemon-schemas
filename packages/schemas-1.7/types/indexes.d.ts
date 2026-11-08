// Types for indexes/data.json and indexes/assets.json, for this Cobblemon version.
//   import type { CobblemonDataIndex } from "@cobbled-creators/cobblemon-schemas/types/indexes.d.ts";

/** Shared header of `indexes/data.json` and `indexes/assets.json`. */
export interface CobblemonIndexHeader {
  /** The Cobblemon tag the index was read from (package.json's `cobblemon.baseline`). */
  cobblemon: string;
  /** Commit of that tag in cable-mc/cobblemon. */
  revision: string;
  namespace: 'cobblemon';
}

/** `indexes/data.json`: ids of Cobblemon's own datapack content. */
export interface CobblemonDataIndex extends CobblemonIndexHeader {
  /** e.g. `cobblemon:bulbasaur` */
  speciesIds: string[];
  /** e.g. `cobblemon:bulbasaur` */
  dexEntryIds: string[];
}

/** `indexes/assets.json`: ids of Cobblemon's own resource pack content. */
export interface CobblemonAssetsIndex extends CobblemonIndexHeader {
  /** e.g. `cobblemon:bulbasaur` */
  poserIds: string[];
  /** e.g. `cobblemon:bulbasaur.geo`, from `bulbasaur.geo.json` */
  modelIds: string[];
  /** e.g. `bulbasaur`, from `bulbasaur.animation.json` */
  animationGroupNames: string[];
  /** e.g. `cobblemon:textures/pokemon/0001_bulbasaur/bulbasaur.png` */
  textureIds: string[];
  /** Every key in Cobblemon's lang files, in any language. */
  langKeys: string[];
}
