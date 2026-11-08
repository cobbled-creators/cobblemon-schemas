// Types for Cobblemon's Showdown ability files (data/<namespace>/abilities/*.js or .ts).
// From @cobbled-creators/cobblemon-schemas; they follow the Showdown version bundled with this package's Cobblemon version.

export type AbilityCallback = (this: any, ...args: any[]) => unknown;
export type AbilityCallbackValue =
  | AbilityCallback
  | number
  | boolean
  | string;

export interface AbilityFlags {
  breakable?: 1;
  cantsuppress?: 1;
  failroleplay?: 1;
  failskillswap?: 1;
  noentrain?: 1;
  noreceiver?: 1;
  notrace?: 1;
  notransform?: 1;
}

export type AbilityConditionData = {
  duration?: number;
  noCopy?: boolean;
} & Partial<Record<`on${string}`, AbilityCallbackValue>>;

export type AbilityData = {
  name: string;
  num?: number;
  rating: number;
  flags: AbilityFlags;
  suppressWeather?: true;
  isNonstandard?: string;
  condition?: AbilityConditionData;
} & Partial<Record<`on${string}`, AbilityCallbackValue>>;
